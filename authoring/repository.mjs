import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { load } from "cheerio";
import {
    CONTENT_CSS, WRITING_SCRIPT, StudioError, escape, imageUrl, infoMetadata, localDate,
    normalizeDocument, readBody, renderPage, validateForPublish, writingCard
} from "./documents.mjs";
import { DOCUMENT_ID, IMAGE_FILE, RESERVED_ROOT, isPagePath, routeFor, sectionPath, sectionValue } from "./editor-schema.mjs";

const JOURNAL = ".authoring/publish-journal.json";
const PAGE_REGISTRY = "data/pages.json";
const contentFolders = { writing: "writings", info: "info-sprawlings", page: "pages" };
const json = value => JSON.stringify(value, null, 4) + "\n";
const hash = value => createHash("sha256").update(value).digest("hex");
const draftPath = id => `.authoring/drafts/${id}.json`;

function inside(root, relative) {
    const target = path.resolve(root, relative);
    if (!target.startsWith(root + path.sep)) throw new Error("Invalid authoring file path.");
    return target;
}

async function optional(action, fallback = null) {
    try {
        return await action();
    } catch (error) {
        if (error.code === "ENOENT") return fallback;
        throw error;
    }
}

async function readJson(root, relative) {
    const contents = await optional(() => readFile(inside(root, relative), "utf8"));
    return contents === null ? null : JSON.parse(contents);
}

async function isAvailableParent(root, pages, pathname) {
    if (!isPagePath(pathname) || pathname === "/") return false;
    const segments = pathname.slice(1, -1).split("/");
    if (RESERVED_ROOT.has(segments[0])) return false;
    let ancestor = "/";
    for (const segment of segments) {
        ancestor += `${segment}/`;
        if (!Object.hasOwn(pages, ancestor)) return false;
        const file = await optional(() => stat(inside(root, `${ancestor.slice(1)}index.html`)));
        if (!file?.isFile()) return false;
    }
    return true;
}

export async function listPageParents(root) {
    const pages = await readJson(root, PAGE_REGISTRY);
    const options = await Promise.all(Object.keys(pages).sort().map(async pathname => {
        if (!await isAvailableParent(root, pages, pathname)) return null;
        return {
            section: sectionValue(pathname),
            label: `${pages[pathname].breadcrumbLabel || pages[pathname].title || pathname} (${pathname})`
        };
    }));
    return options.filter(Boolean);
}

async function writeAtomic(root, relative, contents) {
    const target = inside(root, relative);
    await mkdir(path.dirname(target), { recursive: true });
    const workspace = inside(root, ".authoring");
    await mkdir(workspace, { recursive: true });
    const temporary = path.join(workspace, `write-${randomUUID()}.tmp`);
    try {
        await writeFile(temporary, contents);
        await rename(temporary, target);
    } finally {
        await rm(temporary, { force: true });
    }
}

export async function recoverPublication(root) {
    const journal = await readJson(root, JOURNAL);
    if (!journal) return;
    for (const { relative, before } of journal) {
        if (before === null) {
            await rm(inside(root, relative), { force: true });
        } else {
            await writeAtomic(root, relative, Buffer.from(before, "base64"));
        }
    }
    await rm(inside(root, JOURNAL));
}

async function applyPublication(root, changes) {
    // Save originals before changing any files so an interrupted run can be retried.
    const journal = [];
    for (const [relative] of changes) {
        const before = await optional(() => readFile(inside(root, relative)));
        journal.push({ relative, before: before?.toString("base64") ?? null });
    }
    await writeAtomic(root, JOURNAL, json(journal));
    try {
        for (const [relative, contents] of changes) {
            if (contents === null) {
                await rm(inside(root, relative), { force: true });
            } else {
                await writeAtomic(root, relative, contents);
            }
        }
        await rm(inside(root, JOURNAL));
    } catch (error) {
        await recoverPublication(root);
        throw error;
    }
}

function recordPath(document) {
    let filename = document.slug;
    if (document.type === "page") {
        const { section } = document;
        // Preserve existing filenames. Use the document ID for newly supported parent paths.
        filename = section.startsWith("/")
            ? `${document.slug}--${document.id}`
            : `${section}-${document.slug}`;
    }
    return `content/${contentFolders[document.type]}/${filename}.json`;
}

async function records(root, directory) {
    const entries = await optional(() => readdir(inside(root, directory), { withFileTypes: true }), []);
    return Promise.all(entries.filter(entry => entry.isFile() && entry.name.endsWith(".json"))
        .map(entry => readJson(root, `${directory}/${entry.name}`)));
}

async function preparedDocuments(root) {
    const folders = await Promise.all(Object.values(contentFolders).map(folder => records(root, `content/${folder}`)));
    return folders.flat();
}

function state(draft, prepared) {
    const document = draft || prepared;
    if (!document) return null;
    return {
        document,
        revision: hash(JSON.stringify(document)),
        status: !prepared ? "draft" : JSON.stringify(document) === JSON.stringify(prepared) ? "prepared" : "revision",
        route: prepared ? routeFor(prepared) : ""
    };
}

export async function listDocuments(root) {
    const [drafts, prepared] = await Promise.all([records(root, ".authoring/drafts"), preparedDocuments(root)]);
    const combined = new Map(prepared.map(document => [document.id, state(null, document)]));
    for (const draft of drafts) combined.set(draft.id, state(draft, combined.get(draft.id)?.document));
    return [...combined.values()].map(({ document, status }) => ({
        id: document.id,
        title: document.title,
        type: document.type,
        status
    })).sort((first, second) => first.title.localeCompare(second.title));
}

export async function getDocument(root, id) {
    const [draft, prepared] = await Promise.all([readJson(root, draftPath(id)), preparedDocuments(root)]);
    return state(draft, prepared.find(document => document.id === id));
}

function requireRevision(current, revision) {
    if ((current?.revision ?? null) !== revision) {
        throw new StudioError("This draft changed in another tab. Keep a copy of your edits and reopen the saved draft.", 409);
    }
}

export async function saveDraft(root, id, value, revision) {
    const document = normalizeDocument(value, id);
    const current = await getDocument(root, id);
    requireRevision(current, revision);
    if (current?.route) {
        if (routeFor(document) !== current.route || document.type !== current.document.type) {
            throw new StudioError("The type and address are locked after the page has been prepared.");
        }
        document.modified = current.document.modified;
    }
    await writeAtomic(root, draftPath(id), json(document));
    return getDocument(root, id);
}

export async function deleteDraft(root, id, revision) {
    if (!DOCUMENT_ID.test(id)) throw new StudioError("This draft has an invalid identity.");
    const current = await getDocument(root, id);
    if (!current || current.status === "prepared") {
        throw new StudioError("This page has no local draft to delete.", 404);
    }
    requireRevision(current, revision);
    await rm(inside(root, draftPath(id)));
    return getDocument(root, id);
}

export async function readImage(root, file) {
    if (!IMAGE_FILE.test(file)) return null;
    return await optional(() => readFile(inside(root, `.authoring/media/${file}`)))
        ?? await optional(() => readFile(inside(root, imageUrl(file).slice(1))));
}

export async function saveImage(root, contents, extension) {
    const file = `${hash(contents)}.${extension}`;
    if (!IMAGE_FILE.test(file)) throw new StudioError("Choose a JPG, PNG, WebP, or GIF image.");
    await writeAtomic(root, `.authoring/media/${file}`, contents);
    return file;
}

function replaceRegion(source, name, content) {
    const start = `<!-- Authoring ${name}: start -->`;
    const end = `<!-- Authoring ${name}: end -->`;
    const from = source.indexOf(start);
    const to = source.indexOf(end);
    if (from < 0 || to < from || source.indexOf(start, from + start.length) !== -1
        || source.indexOf(end, to + end.length) !== -1) {
        throw new StudioError(`The site is missing the unique authoring markers for ${name}.`, 409);
    }
    const indentation = source.slice(source.lastIndexOf("\n", to) + 1, to);
    return source.slice(0, from + start.length) + "\n"
        + (content ? content + "\n" : "") + indentation + source.slice(to);
}

function publicHead(document, config) {
    const page = {
        title: `${document.title} | ${config.siteName}`,
        description: document.description,
        breadcrumbLabel: document.title,
        schemaType: "WebPage",
        extraStyles: [CONTENT_CSS]
    };
    if (document.type !== "page") {
        page.ogType = "article";
        page.article = { published: document.date, modified: document.modified };
        page.schemaNodes = [{
            "@type": document.type === "writing" && document.writingType === "Fiction" ? "ShortStory" : "Article",
            headline: document.title,
            description: document.description,
            datePublished: document.date,
            dateModified: document.modified,
            author: { "@id": `${config.baseUrl}/#person` }
        }];
    }
    if (document.type === "writing") page.extraScripts = [WRITING_SCRIPT];
    return page;
}

function sitemapEntry(document, baseUrl, imageSitemap) {
    const url = escape(baseUrl + routeFor(document));
    if (!imageSitemap) {
        return `    <url><loc>${url}</loc><lastmod>${document.modified}</lastmod></url>`;
    }
    const images = new Set();
    readBody(document.body).descendants(node => {
        if (node.type.name === "studioFigure") images.add(node.attrs.file);
    });
    if (!images.size) return "";
    const elements = [...images].map(file =>
        `        <image:image><image:loc>${escape(baseUrl + imageUrl(file))}</image:loc></image:image>`
    );
    return `    <url>\n        <loc>${url}</loc>\n${elements.join("\n")}\n    </url>`;
}

export async function preparePublication(root, id, revision) {
    if (!DOCUMENT_ID.test(id)) throw new StudioError("This draft has an invalid identity.");
    const current = await getDocument(root, id);
    if (!current) throw new StudioError("Save this draft first.", 404);
    requireRevision(current, revision);
    const document = normalizeDocument(current.document, id);
    validateForPublish(document);
    const today = localDate();
    document.date ||= today;
    document.modified = today;

    const route = routeFor(document);
    const pageFile = `${route.slice(1)}index.html`;
    const [config, pages, existing, prepared, shareDialog, redirects] = await Promise.all([
        readJson(root, "data/config.json"),
        readJson(root, PAGE_REGISTRY),
        optional(() => readFile(inside(root, pageFile), "utf8")),
        preparedDocuments(root),
        readFile(inside(root, "authoring/writing-share.html"), "utf8"),
        readFile(inside(root, "_redirects"), "utf8")
    ]);
    if (document.type === "page" && document.section !== "root"
        && !await isAvailableParent(root, pages, sectionPath(document.section))) {
        throw new StudioError("Choose an existing parent page for this address.");
    }
    const samePage = current.route === route;
    const redirectPaths = redirects.split(/\r?\n/).map(line => line.trim().split(/\s+/)[0]);
    if ((existing !== null && !existing.includes(`<!-- Authoring document ${id} -->`))
        || (!samePage && (Object.hasOwn(pages, route) || redirectPaths.includes(route)
            || redirectPaths.includes(route.slice(0, -1))))
        || prepared.some(entry => entry.id !== id && routeFor(entry) === route)) {
        throw new StudioError(`${route} is already in use. Choose a different slug.`, 409);
    }
    if (Object.entries(pages).some(([url, page]) => url !== route && page.description === document.description)) {
        throw new StudioError("Another page already uses this description. Write a distinct description for this page.");
    }

    const rendered = renderPage(document, { config, pages, shareDialog });
    const changes = new Map();
    for (const file of rendered.images) {
        const image = await readImage(root, file);
        if (!image) throw new StudioError("An image is missing. Open the draft and upload it again.");
        const relative = imageUrl(file).slice(1);
        if (!await optional(() => readFile(inside(root, relative)))) changes.set(relative, image);
    }
    changes.set(pageFile, rendered.html);
    pages[route] = publicHead(document, config);
    changes.set(PAGE_REGISTRY, json(pages));

    if (document.type === "info") {
        const metadataPath = `data/info-sprawlings/${document.slug}.json`;
        if (!samePage && await readJson(root, metadataPath)) {
            throw new StudioError("An Info Sprawling already uses that slug.", 409);
        }
        changes.set(metadataPath, json(infoMetadata(document)));
    }

    const all = [document, ...prepared.filter(entry => entry.id !== id)]
        .sort((first, second) => second.date.localeCompare(first.date) || first.title.localeCompare(second.title));
    const catalog = "writings/index.html";
    const cards = all.filter(entry => entry.type === "writing").map(writingCard).join("\n");
    const catalogHtml = replaceRegion(await readFile(inside(root, catalog), "utf8"), "writing cards", cards);
    const count = load(catalogHtml)("[data-writing-card]").length;
    changes.set(catalog, catalogHtml.replace(
        /(<p\b[^>]*data-writing-results-count[^>]*>)[^<]*/,
        (_, start) => `${start}${count} ${count === 1 ? "piece" : "pieces"} shown`
    ));

    const sitemap = "site-map/index.html";
    const siteLinks = all.map(entry =>
        `                <li><a href="${routeFor(entry)}">${escape(entry.title)}</a><span class="text-small"> · ${escape(entry.description)}</span></li>`
    ).join("\n");
    changes.set(sitemap, replaceRegion(await readFile(inside(root, sitemap), "utf8"), "site links", siteLinks));
    for (const kind of ["pages", "images"]) {
        const target = `sitemaps/sitemap-${kind}.xml`;
        const entries = all.map(entry => sitemapEntry(entry, config.baseUrl, kind === "images")).filter(Boolean);
        changes.set(target, replaceRegion(await readFile(inside(root, target), "utf8"), "sitemap", entries.join("\n")));
    }

    changes.set(recordPath(document), json(document));
    changes.set(draftPath(id), null);
    await applyPublication(root, changes);
    return state(null, document);
}
