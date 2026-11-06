import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { load } from "cheerio";
import { renderBody } from "./documents.mjs";
import {
    deleteDraft, getDocument, listPageParents, preparePublication, recoverPublication, saveDraft, saveImage
} from "./repository.mjs";

const sitemap = "<urlset>\n<!-- Authoring sitemap: start -->\n<!-- Authoring sitemap: end -->\n</urlset>";
const fixtureFiles = {
    "_redirects": "",
    "authoring/writing-share.html": '<dialog id="writing-share-dialog"></dialog>',
    "data/config.json": JSON.stringify({
        siteName: "Test site", baseUrl: "https://example.com", personName: "Author", language: "en"
    }),
    "data/pages.json": JSON.stringify({
        "/": { breadcrumbLabel: "Home" },
        "/assets/": { breadcrumbLabel: "Assets" },
        "/education/": { breadcrumbLabel: "Education" },
        "/images/": { breadcrumbLabel: "Images" },
        "/images/missing/": { breadcrumbLabel: "Missing page" },
        "/images/pictures-of-me/": { breadcrumbLabel: "Photos & Portraits" },
        "/orphan/nested/": { breadcrumbLabel: "Missing ancestor" },
        "/writings/": { breadcrumbLabel: "Writings" },
        "/writings/just-this-once/": { description: "An existing page." }
    }),
    "assets/index.html": "<main>Reserved folder</main>",
    "education/index.html": "<main>Education</main>",
    "images/index.html": "<main>Images</main>",
    "images/pictures-of-me/index.html": "<main>Portraits</main>",
    "orphan/nested/index.html": "<main>Orphaned route</main>",
    "writings/index.html": `<div data-writing-grid>
        <!-- Authoring writing cards: start -->
        <!-- Authoring writing cards: end -->
        <article data-writing-card><a href="/writings/just-this-once/">A handwritten story</a></article>
    </div>`,
    "writings/just-this-once/index.html": "<main>A handwritten story</main>",
    "site-map/index.html": "<ol>\n<!-- Authoring site links: start -->\n<!-- Authoring site links: end -->\n</ol>",
    "sitemaps/sitemap-pages.xml": sitemap,
    "sitemaps/sitemap-images.xml": sitemap
};

async function fixture(t) {
    const directory = await mkdtemp(path.join(os.tmpdir(), "asu-authoring-"));
    t.after(() => rm(directory, { recursive: true, force: true }));
    await Promise.all(Object.entries(fixtureFiles).map(async ([filename, contents]) => {
        const target = path.join(directory, filename);
        await mkdir(path.dirname(target), { recursive: true });
        await writeFile(target, contents);
    }));
    return directory;
}

function document(fields = {}) {
    return {
        id: randomUUID(), type: "writing", section: "root", title: "The editor test",
        slug: "editor-test", subtitle: "", description: "Test of a prepared page.",
        context: "", date: "2026-01-10", writingType: "Essay", tags: "Editing, Essay",
        entityType: "", aliases: "", relatedTerms: "", relatedLinks: "",
        body: { type: "doc", content: [
            { type: "paragraph", content: [{ type: "text", text: "A searchable paragraph." }] }
        ] },
        ...fields
    };
}

test("renders safe text, links, figures, numbered footnotes and MathML", () => {
    const file = "a".repeat(64) + ".png";
    const body = { type: "doc", content: [
        { type: "paragraph", content: [
            { type: "text", text: "<script> & text", marks: [{ type: "bold" }] },
            { type: "text", text: "internal link", marks: [{ type: "link", attrs: { href: "/about-me/" } }] },
            { type: "studioFootnote", attrs: { note: "First <note>", source: "https://example.com/" } },
            { type: "studioInlineMath", attrs: { latex: "x^2" } },
            { type: "studioFootnote", attrs: { note: "Second note" } }
        ] },
        { type: "studioFigure", attrs: { file, alt: '"Alt text"', caption: "A caption." } },
        { type: "studioDisplayMath", attrs: { latex: "x=2" } },
        { type: "codeBlock", content: [{ type: "text", text: "const x = '<code>';" }] }
    ] };
    const rendered = renderBody(body);
    const $ = load(rendered.html);
    assert.deepEqual(rendered.images, [file]);
    assert.equal($("strong").text(), "<script> & text");
    assert.equal($("script").length, 0);
    assert.equal($('a[href="/about-me/"]').text(), "internal link");
    assert.equal($("figure img").attr("alt"), '"Alt text"');
    assert.equal($("figcaption").text(), "A caption.");
    assert.equal($("#ref-1 a").attr("href"), "#note-1");
    assert.equal($("#note-2 .writing-footnote-back").attr("href"), "#ref-2");
    assert.match($("#note-1").text(), /First <note>/);
    assert.equal($("math").length, 2);
    assert.equal($(".studio-display-math math").attr("display"), "block");
    assert.equal($("pre code").text(), "const x = '<code>';");
    assert.match(rendered.html, /<\/p>\n<figure/);
    assert.throws(() => renderBody({ type: "doc", content: [
        { type: "paragraph", content: [
            { type: "text", text: "bad link", marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }] }
        ] }
    ] }), /invalid address/);
});

test("drafts stay private and preparing a revised writing updates its page once", async t => {
    const root = await fixture(t);
    const file = await saveImage(root, Buffer.from("test image bytes"), "png");
    const entry = document();
    entry.body.content.push({ type: "studioFigure", attrs: { file, alt: "Test image" } });
    const originalCatalog = await readFile(path.join(root, "writings/index.html"), "utf8");
    const originalPage = await readFile(path.join(root, "writings/just-this-once/index.html"), "utf8");

    const saved = await saveDraft(root, entry.id, entry, null);
    assert.equal(saved.status, "draft");
    assert.equal((await getDocument(root, entry.id)).document.title, entry.title);
    await assert.rejects(readFile(path.join(root, "writings/editor-test/index.html")), { code: "ENOENT" });
    await assert.rejects(readFile(path.join(root, "assets/img/authoring", file)), { code: "ENOENT" });

    const prepared = await preparePublication(root, entry.id, saved.revision);
    assert.equal(prepared.route, "/writings/editor-test/");
    assert.equal(prepared.status, "prepared");
    assert.equal((await getDocument(root, entry.id)).status, "prepared");
    const generated = await readFile(path.join(root, "writings/editor-test/index.html"), "utf8");
    assert.match(generated, /data-reading-body data-search-body/);
    assert.match(generated, /Test image/);
    assert.equal(await readFile(path.join(root, "assets/img/authoring", file), "utf8"), "test image bytes");
    await assert.rejects(saveDraft(root, entry.id, entry, saved.revision), /changed in another tab/);
    await assert.rejects(saveDraft(root, entry.id, { ...entry, slug: "changed-address" }, prepared.revision), /locked/);

    const edited = await saveDraft(root, entry.id, { ...entry, title: "The revised editor test" }, prepared.revision);
    assert.equal(edited.status, "revision");
    await preparePublication(root, entry.id, edited.revision);
    const $ = load(await readFile(path.join(root, "writings/index.html"), "utf8"));
    assert.equal($("[data-writing-card]").length, load(originalCatalog)("[data-writing-card]").length + 1);
    assert.equal($('[href="/writings/editor-test/"]').length, 1);
    assert.match($('[href="/writings/editor-test/"]').attr("aria-label"), /revised editor test/);
    assert.equal(await readFile(path.join(root, "writings/just-this-once/index.html"), "utf8"), originalPage);
    const imageMap = await readFile(path.join(root, "sitemaps/sitemap-images.xml"), "utf8");
    assert.equal(imageMap.split(file).length, 2);

    const collision = document({ slug: "just-this-once" });
    const draft = await saveDraft(root, collision.id, collision, null);
    await assert.rejects(preparePublication(root, collision.id, draft.revision), /already in use/);
    assert.equal(await readFile(path.join(root, "writings/just-this-once/index.html"), "utf8"), originalPage);
});

test("general pages use registered parents with source pages and matching breadcrumbs", async t => {
    const root = await fixture(t);
    const options = new Map((await listPageParents(root)).map(({ section, label }) => [section, label]));
    assert.equal(options.get("/images/"), "Images (/images/)");
    assert.equal(options.get("/images/pictures-of-me/"), "Photos & Portraits (/images/pictures-of-me/)");
    for (const unavailable of ["/assets/", "/images/missing/", "/orphan/nested/"]) {
        assert.equal(options.has(unavailable), false);
    }

    const entry = document({ type: "page", section: "/images/pictures-of-me/", slug: "weekend-photos" });
    const saved = await saveDraft(root, entry.id, entry, null);
    const prepared = await preparePublication(root, entry.id, saved.revision);
    assert.equal(prepared.route, "/images/pictures-of-me/weekend-photos/");
    const html = await readFile(path.join(root, "images/pictures-of-me/weekend-photos/index.html"), "utf8");
    const $ = load(html);
    assert.deepEqual($(".breadcrumbs a").map((_, link) => [$(link).text()]).get(),
        ["Home", "Images", "Photos & Portraits"]);
    assert.equal((await getDocument(root, entry.id)).route, prepared.route);

    const missing = document({ type: "page", section: "/images/missing/", slug: "new-page" });
    const draft = await saveDraft(root, missing.id, missing, null);
    await assert.rejects(preparePublication(root, missing.id, draft.revision), /existing parent page/);
    await assert.rejects(readFile(path.join(root, "images/missing/new-page/index.html")), { code: "ENOENT" });
    await assert.rejects(saveDraft(root, missing.id, { ...missing, section: "/images/../" }, draft.revision),
        /valid parent page/);
});

test("revising a legacy general page keeps its route and content record", async t => {
    const root = await fixture(t);
    const entry = document({ type: "page", section: "education", slug: "study-notes" });
    const saved = await saveDraft(root, entry.id, entry, null);
    const prepared = await preparePublication(root, entry.id, saved.revision);
    const edited = await saveDraft(root, entry.id,
        { ...entry, section: "/education/", title: "Revised study notes" }, prepared.revision);
    const revision = await preparePublication(root, entry.id, edited.revision);
    assert.equal(revision.route, "/education/study-notes/");
    assert.equal(revision.document.section, "education");
    assert.deepEqual(await readdir(path.join(root, "content/pages")), ["education-study-notes.json"]);
});

test("deleting a draft checks the revision and preserves the prepared page", async t => {
    const root = await fixture(t);
    const entry = document();
    const saved = await saveDraft(root, entry.id, entry, null);
    const updated = await saveDraft(root, entry.id, { ...entry, title: "An updated draft" }, saved.revision);
    await assert.rejects(deleteDraft(root, entry.id, saved.revision), { status: 409 });
    assert.deepEqual(await getDocument(root, entry.id), updated);
    assert.equal(await deleteDraft(root, entry.id, updated.revision), null);
    assert.equal(await getDocument(root, entry.id), null);

    const next = await saveDraft(root, entry.id, entry, null);
    const prepared = await preparePublication(root, entry.id, next.revision);
    const pageFile = path.join(root, "writings/editor-test/index.html");
    const pageBefore = await readFile(pageFile, "utf8");
    await assert.rejects(deleteDraft(root, entry.id, prepared.revision), { status: 404 });
    const draft = await saveDraft(root, entry.id, { ...entry, title: "An unpublished revision" }, prepared.revision);
    assert.deepEqual(await deleteDraft(root, entry.id, draft.revision), prepared);
    assert.equal(await readFile(pageFile, "utf8"), pageBefore);
});

test("an interrupted preparation restores source files on restart", async t => {
    const root = await fixture(t);
    const target = "sitemaps/sitemap-pages.xml";
    const original = await readFile(path.join(root, target));
    await mkdir(path.join(root, ".authoring"));
    await writeFile(path.join(root, ".authoring/publish-journal.json"), JSON.stringify([
        { relative: target, before: original.toString("base64") },
        { relative: "writings/interrupted/index.html", before: null }
    ]));
    await writeFile(path.join(root, target), "interrupted");
    await mkdir(path.join(root, "writings/interrupted"));
    await writeFile(path.join(root, "writings/interrupted/index.html"), "incomplete page");
    await recoverPublication(root);
    assert.deepEqual(await readFile(path.join(root, target)), original);
    await assert.rejects(readFile(path.join(root, "writings/interrupted/index.html")), { code: "ENOENT" });
});
