import { getSchema } from "@tiptap/core";
import { renderToHTMLString } from "@tiptap/static-renderer/pm/html-string";
import {
    DOCUMENT_ID, IMAGE_FILE, RESERVED_ROOT, SLUG, TYPES, WRITING_TYPES,
    editorExtensions, isPagePath, mathHtml, routeFor, safeHref, sectionPath, sectionValue
} from "./editor-schema.mjs";

export class StudioError extends Error {
    constructor(message, status = 400) {
        super(message);
        this.status = status;
    }
}

const schema = getSchema(editorExtensions);

export const CONTENT_CSS = "/assets/css/components/authoring-content.css";
export const WRITING_SCRIPT = "/assets/js/pages/writing-piece.js";
export const imageUrl = file => `/assets/img/authoring/${file}`;

export function escape(value) {
    return String(value).replace(/[&<>"']/g, character => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[character]));
}

function field(value, label, max) {
    if (value == null) return "";
    if (typeof value !== "string" || value.length > max) {
        throw new StudioError(`${label} must be ${max} characters or fewer.`);
    }
    return value.trim();
}

function dateField(value) {
    const date = field(value, "Publication date", 10);
    if (!date) return "";
    const parsed = new Date(`${date}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(parsed.valueOf())
        || parsed.toISOString().slice(0, 10) !== date) {
        throw new StudioError("Choose a valid publication date.");
    }
    return date;
}

function safeRelatedLinks(value) {
    return value.split(/\r?\n/).filter(line => line.trim()).map(line => {
        const divider = line.indexOf("|");
        const label = line.slice(0, divider).trim();
        const href = safeHref(line.slice(divider + 1).trim());
        if (divider < 0 || !label || !href) {
            throw new StudioError("Put each related link on its own line as Label | URL.");
        }
        return { label, href };
    });
}

export function splitList(value) {
    return [...new Set(value.split(",").map(item => item.trim()).filter(Boolean))];
}

export function localDate() {
    const now = new Date();
    return [
        now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"),
        String(now.getDate()).padStart(2, "0")
    ].join("-");
}

export function readBody(body) {
    let node;
    try {
        node = schema.nodeFromJSON(body);
        node.check();
        if (node.type !== schema.topNodeType) throw new Error("Wrong root type");
    } catch {
        throw new StudioError("The body contains unsupported formatting. Reopen the draft and try again.");
    }
    node.descendants(child => {
        for (const mark of child.marks) {
            if (mark.type.name === "link" && !safeHref(mark.attrs.href)) {
                throw new StudioError("A link has an invalid address. Use https://, a site path, or a #section.");
            }
        }
        const { file, alt, caption, note, source, latex } = child.attrs;
        switch (child.type.name) {
            case "studioFigure":
                if (typeof file !== "string" || !IMAGE_FILE.test(file) || !field(alt, "Alt text", 300)) {
                    throw new StudioError("Every image needs a valid file and alt text.");
                }
                field(caption, "Caption", 800);
                break;
            case "studioFootnote":
                if (!field(note, "Footnote", 3000) || (source && !safeHref(source))) {
                    throw new StudioError("Each footnote needs text and a valid source URL if supplied.");
                }
                break;
            case "studioDisplayMath":
            case "studioInlineMath":
                if (!field(latex, "Equation", 2000)) throw new StudioError("An equation is empty.");
                try {
                    mathHtml(latex, child.type.name === "studioDisplayMath");
                } catch {
                    throw new StudioError("An equation contains invalid LaTeX.");
                }
                break;
        }
    });
    return node;
}

export function normalizeDocument(value, id) {
    if (!DOCUMENT_ID.test(id) || value?.id !== id || !Object.hasOwn(TYPES, value.type)
        || !WRITING_TYPES.includes(value.writingType)) {
        throw new StudioError("This draft has an invalid identity or page type.");
    }
    const parent = sectionPath(value.section);
    if (!isPagePath(parent)) throw new StudioError("Choose a valid parent page.");
    return {
        id,
        type: value.type,
        section: value.type === "page" ? sectionValue(parent) : "root",
        title: field(value.title, "Title", 180),
        slug: field(value.slug, "Slug", 80),
        subtitle: field(value.subtitle, "Subtitle", 240),
        description: field(value.description, "Description", 320),
        context: field(value.context, "Context", 4000),
        date: dateField(value.date),
        writingType: value.writingType,
        tags: field(value.tags, "Tags or topics", 450),
        entityType: field(value.entityType, "Knowledge type", 80),
        aliases: field(value.aliases, "Aliases", 450),
        relatedTerms: field(value.relatedTerms, "Related terms", 450),
        relatedLinks: field(value.relatedLinks, "Related links", 2500),
        body: readBody(value.body).toJSON()
    };
}

export function validateForPublish(document) {
    if (!document.title || !document.description || !SLUG.test(document.slug)) {
        throw new StudioError("Enter a title, description, and a slug with lowercase letters, numbers, or hyphens.");
    }
    if (document.type === "page" && document.section === "root" && RESERVED_ROOT.has(document.slug)) {
        throw new StudioError("That slug is reserved by the site. Pick another one.");
    }
    if (document.type === "info") {
        if (!document.entityType) throw new StudioError("Enter a knowledge type for this Info Sprawling.");
        safeRelatedLinks(document.relatedLinks);
    }
    if (!readBody(document.body).textContent.trim()) {
        throw new StudioError("Write some body text before preparing the page.");
    }
}

function linked(href, text) {
    return `<a href="${escape(href)}">${escape(text)}</a>`;
}

export function renderBody(body, { preview = false } = {}) {
    const images = new Set();
    const notes = [];
    const html = renderToHTMLString({
        content: readBody(body),
        extensions: editorExtensions,
        options: {
            nodeMapping: {
                doc: ({ children }) => children.join("\n"),
                studioFigure({ node }) {
                    const { file, alt, caption } = node.attrs;
                    images.add(file);
                    const src = preview ? `/media/${file}` : imageUrl(file);
                    return `<figure class="writing-figure writing-figure--wide">
                        <img src="${src}" alt="${escape(alt)}" loading="lazy" decoding="async">
                        ${caption ? `<figcaption>${escape(caption)}</figcaption>` : ""}
                    </figure>`;
                },
                studioFootnote({ node }) {
                    const number = notes.push(node.attrs);
                    return `<sup class="writing-citation" id="ref-${number}"><a href="#note-${number}" aria-label="Footnote ${number}">[${number}]</a></sup>`;
                },
                studioInlineMath: ({ node }) => mathHtml(node.attrs.latex, false),
                studioDisplayMath: ({ node }) => `<div class="studio-display-math">${mathHtml(node.attrs.latex, true)}</div>`
            },
            markMapping: {
                link: ({ mark, children }) => `<a href="${escape(safeHref(mark.attrs.href))}">${children}</a>`
            }
        }
    });
    const footnotes = notes.length ? `
        <section class="writing-footnotes" aria-labelledby="footnotes-title">
            <h2 id="footnotes-title">Footnotes</h2>
            <ol>
                ${notes.map(({ note, source }, index) => {
                    const number = index + 1;
                    return `<li id="note-${number}">${escape(note)}${source ? ` ${linked(safeHref(source), "Source")}` : ""}
                        <a class="writing-footnote-back" href="#ref-${number}" aria-label="Return to footnote ${number} reference">↩</a>
                    </li>`;
                }).join("\n")}
            </ol>
        </section>` : "";
    return { html: html + footnotes, images: [...images] };
}

function breadcrumbs(document, pages) {
    const route = routeFor(document);
    let prefix = "/";
    const ancestors = route.split("/").filter(Boolean).slice(0, -1).map(segment => {
        prefix += `${segment}/`;
        const label = pages[prefix]?.breadcrumbLabel || pages[prefix]?.title || segment;
        return `<li>${linked(prefix, label)}</li>`;
    });
    return `<nav class="breadcrumbs" aria-label="Breadcrumb"><ol>
        <li>${linked("/", pages["/"]?.breadcrumbLabel || "Home")}</li>
        ${ancestors.join("\n")}
        <li aria-current="page">${escape(document.title || "Untitled draft")}</li>
    </ol></nav>`;
}

function detail(label, value) {
    return value ? `<div><dt>${escape(label)}</dt><dd>${escape(value)}</dd></div>` : "";
}

function pageMain(document, body, author, shareDialog, pages) {
    const title = escape(document.title || "Untitled draft");
    const deck = escape(document.subtitle || document.description);
    const trail = breadcrumbs(document, pages);
    if (document.type === "writing") {
        const tags = splitList(document.tags).join(" · ");
        const context = document.context ? `<section class="writing-piece-context" aria-labelledby="about-piece-title">
                    <h2 id="about-piece-title">Context: About This Piece</h2>
                    ${document.context.split(/\n\s*\n/).map(text => `<p>${escape(text)}</p>`).join("\n")}
                </section>` : "";
        return `<main class="writing-piece-main">
        <section class="writing-piece-hero" aria-labelledby="piece-title">
            ${trail}
            <div class="writing-piece-hero-inner" data-writing-search-tag="${escape(tags || document.writingType)}">
                <h1 id="piece-title">${title}</h1>
                ${deck ? `<p class="writing-piece-deck">${deck}</p>` : ""}
                <p class="writing-piece-byline">By <a href="/about-me/" rel="author">${escape(author)}</a></p>
                <div class="writing-piece-actions">
                    <button class="writings-button writings-button-secondary writing-share-trigger"
                        type="button" aria-haspopup="dialog" aria-controls="writing-share-dialog"
                        data-share-open hidden>Share this piece</button>
                </div>
                <details class="writing-piece-details">
                    <summary>Piece details</summary>
                    <dl class="writing-piece-meta">
                        ${detail("Form", document.writingType)}
                        ${detail("Published", document.date)}
                        ${detail("Tags", tags)}
                    </dl>
                </details>
                ${context}
            </div>
        </section>
        <div class="container writing-piece-container">
            <article class="writing-piece-article" id="read-piece" aria-labelledby="piece-title">
                <div class="writing-story studio-prose" data-reading-body data-search-body>${body}</div>
            </article>
        </div>
    </main>
    ${shareDialog || ""}`;
    }
    if (document.type === "info") {
        let related = [];
        if (document.relatedLinks) {
            try {
                related = safeRelatedLinks(document.relatedLinks);
            } catch {
                // Incomplete related links can be saved in a draft.
            }
        }
        return `<main class="info-detail-page">
        <header class="info-detail-hero">
            ${trail}
            <div class="info-detail-title-block">
                <h1>${title}</h1>
                ${deck ? `<p class="info-detail-deck">${deck}</p>` : ""}
                <dl class="info-detail-meta">
                    ${detail("Also known as", splitList(document.aliases).join(" · "))}
                    ${detail("Knowledge type", document.entityType)}
                    ${detail("Primary topics", splitList(document.tags).join(" · "))}
                    ${detail("Last updated", document.modified || document.date)}
                </dl>
            </div>
        </header>
        <div class="container info-detail-container">
            <article class="info-detail-article" data-search-body>
                <div class="info-article-section studio-prose">${body}</div>
                ${related.length ? `<section class="info-article-section" data-search-exclude>
                    <h2>Related entries</h2>
                    <ul>${related.map(({ label, href }) => `<li>${linked(href, label)}</li>`).join("")}</ul>
                </section>` : ""}
            </article>
        </div>
    </main>`;
    }
    return `<main class="container studio-general-page">
        ${trail}
        <header>
            <h1>${title}</h1>
            ${deck ? `<p class="subtitle">${deck}</p>` : ""}
        </header>
        <article class="section studio-prose" data-search-body>${body}</article>
    </main>`;
}

export function renderPage(document, { config, pages = {}, preview = false, header = "", footer = "", shareDialog = "" }) {
    const { html, images } = renderBody(document.body, { preview });
    const writing = document.type === "writing";
    const head = preview ? `
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex">
    <title>${escape(document.title || "Untitled draft")}</title>
    <link rel="stylesheet" href="/assets/css/main.css">
    <link rel="stylesheet" href="${CONTENT_CSS}">` : "";
    return {
        images,
        html: `<!DOCTYPE html>
<html lang="${escape(config.language)}">
<head>${head}
</head>
<body${writing ? ' class="writing-piece-page"' : ""}>
    <!-- Authoring document ${document.id} -->
    ${writing ? '<progress class="writing-progress" aria-label="Reading progress" max="100" value="0" data-reading-progress>0%</progress>' : ""}
    ${preview ? header : '<div id="header-placeholder"></div>'}
    ${pageMain(document, html, config.personName, preview ? "" : shareDialog, pages)}
    ${preview ? footer : '<div id="footer-placeholder"></div>'}
</body>
</html>
`
    };
}

export function writingCard(document) {
    const title = escape(document.title);
    const tags = [...new Set([document.writingType, ...splitList(document.tags)])];
    return `                    <article class="writings-piece-card" data-writing-card data-writing-types="${document.writingType.toLowerCase()}">
                        <h3>${title}</h3>
                        <p class="writings-piece-summary">${escape(document.description)}</p>
                        <div class="writings-piece-tags" aria-label="Writing tags">
                            ${tags.map(tag => `<span>#${escape(tag.replace(/^#/, ""))}</span>`).join("")}
                        </div>
                        <dl class="writings-piece-meta">${detail("Published", document.date)}</dl>
                        <a class="writings-piece-action writings-button writings-button-primary" href="${routeFor(document)}" aria-label="Read ${title}">Read this piece</a>
                    </article>`;
}

export function infoMetadata(document) {
    return {
        schemaVersion: 1,
        id: `article--${document.slug}`,
        slug: document.slug,
        url: routeFor(document),
        title: document.title,
        entityType: document.entityType,
        primarySection: "info-sprawlings",
        collections: ["info-sprawlings"],
        aliases: splitList(document.aliases),
        summary: document.description,
        topics: splitList(document.tags),
        relatedTerms: splitList(document.relatedTerms),
        relationships: safeRelatedLinks(document.relatedLinks).map(({ label, href }) => ({
            predicate: "related-to",
            label,
            url: href
        })),
        dateCreated: document.date,
        dateModified: document.modified
    };
}
