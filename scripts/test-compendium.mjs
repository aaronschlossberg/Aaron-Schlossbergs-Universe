import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { load } from "cheerio";

const exec = promisify(execFile);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const entries = JSON.parse(await readFile(path.join(ROOT, "data/compendium.json"), "utf8"))
    .slice(0, 2).map(({ image, links, ...entry }) => ({ ...entry, related: [] }));

async function fixture(t) {
    const root = await mkdtemp(path.join(os.tmpdir(), "asu-compendium-"));
    t.after(() => rm(root, { recursive: true, force: true }));
    async function put(file, contents) {
        await mkdir(path.dirname(path.join(root, file)), { recursive: true });
        await writeFile(path.join(root, file), contents);
    }
    await put("scripts/render-compendium.mjs", "");
    await copyFile(path.join(ROOT, "scripts/render-compendium.mjs"), path.join(root, "scripts/render-compendium.mjs"));
    await put("data/compendium.json", JSON.stringify(entries));
    await put("data/config.json", JSON.stringify({ baseUrl: "https://example.test", siteName: "Aaron Schlossberg’s Universe" }));
    await put("data/pages.json", JSON.stringify({ "/compendium/": { title: "Compendium" }, "/about-me/": { title: "About Me" } }));
    await put("compendium/index.html", "<!DOCTYPE html><html><head><title>Keep this head</title></head><body></body></html>");
    await put("sitemaps/sitemap-pages.xml", "<urlset>\n    <!-- Compendium sitemap: start -->\n    <!-- Compendium sitemap: end -->\n</urlset>");
    await put("site-map/index.html", "<ol>\n    <!-- Compendium entries: start -->\n    <!-- Compendium entries: end -->\n</ol>");
    return {
        root, put,
        read: file => readFile(path.join(root, file), "utf8"),
        run: () => exec(process.execPath, [path.join(root, "scripts/render-compendium.mjs")])
    };
}

test("generates linked summaries, tags, entry pages, and references from one source", async t => {
    const f = await fixture(t);
    const modified = entries.map((entry, i) => i === 0 ? { ...entry, term: 'A & B <test>', tags: ["Art & Writing"] } : entry);
    await f.put("data/compendium.json", JSON.stringify(modified));
    await f.run();
    const $ = load(await f.read("compendium/index.html"));
    assert.equal($(".compendium-entry").length, 2);
    assert.equal($(".compendium-term").first().text(), 'A & B <test>');
    assert.equal($("test").length, 0);
    assert.equal($(".compendium-term").first().attr("href"), "/compendium/anemoia/");
    assert.equal($(".compendium-entry a[href^='https:']").length, 0);
    assert.equal($(".compendium-index").length, 0);
    assert.equal($("[data-compendium-tag]").first().text(), "Art & Writing");
    assert.equal($("head title").text(), "Keep this head");

    const detail = load(await f.read("compendium/anemoia/index.html"));
    assert.equal(detail("#compendium-title").text(), 'A & B <test>');
    assert.equal(detail("#examples-title").length, 1);
    assert.equal(detail("#references-title").length, 1);
    assert.equal(detail("[data-compendium-share]").attr("data-compendium-share"), "/compendium/anemoia/");
    const pages = JSON.parse(await f.read("data/pages.json"));
    assert.equal(pages["/compendium/anemoia/"].description, entries[0].definition);
    assert.equal(pages["/about-me/"].title, "About Me");
    assert.match(await f.read("sitemaps/sitemap-pages.xml"), /https:\/\/example.test\/compendium\/anemoia\//);
});

test("repeated generation is stable and removes only obsolete generated pages", async t => {
    const f = await fixture(t);
    await f.run();
    const first = await f.read("compendium/index.html");
    assert.match((await f.run()).stdout, /0 files updated/);
    assert.equal(await f.read("compendium/index.html"), first);

    await f.put("compendium/manual/index.html", "<h1>Manually maintained page</h1>");
    await f.put("data/compendium.json", JSON.stringify([entries[0]]));
    await f.run();
    await assert.rejects(stat(path.join(f.root, "compendium/backrooms/index.html")), { code: "ENOENT" });
    assert.equal(await f.read("compendium/manual/index.html"), "<h1>Manually maintained page</h1>");
    const pages = JSON.parse(await f.read("data/pages.json"));
    assert.equal(pages["/compendium/backrooms/"], undefined);
    assert.doesNotMatch(await f.read("site-map/index.html"), /\/compendium\/backrooms\//);
});

test("invalid data fails before changing generated pages or the registry", async t => {
    const f = await fixture(t);
    const original = await f.read("data/pages.json");
    await f.put("data/compendium.json", JSON.stringify([entries[0], { ...entries[1], slug: entries[0].slug }]));
    await assert.rejects(f.run(), /unique, lowercase slug/);
    assert.equal(await f.read("data/pages.json"), original);
    await f.put("data/compendium.json", JSON.stringify([{ ...entries[0], related: ["missing-term"] }]));
    await assert.rejects(f.run(), /invalid related entry/);
    assert.equal(await f.read("data/pages.json"), original);
});

test("a slug collision with a manually maintained page leaves the page intact", async t => {
    const f = await fixture(t);
    await f.put("compendium/anemoia/index.html", "<h1>My own page</h1>");
    const original = await f.read("data/pages.json");
    await assert.rejects(f.run(), /manually maintained content/);
    assert.equal(await f.read("compendium/anemoia/index.html"), "<h1>My own page</h1>");
    assert.equal(await f.read("data/pages.json"), original);
});

test("links names and work titles without nested links or interpreting plain text as HTML", async t => {
    const f = await fixture(t);
    const content = {
        ...entries[0],
        definition: 'Read <script> in this example.',
        context: ['Kane Parsons’s The Backrooms (Found Footage) builds on the Backrooms. Up goes up.'],
        links: [
            { text: 'Kane Parsons', href: 'https://example.test/kane/' },
            { text: 'The Backrooms', href: '/compendium/backrooms/' },
            { text: 'The Backrooms (Found Footage)', href: 'https://example.test/film/', quote: true, cite: true },
            { text: 'Up', href: 'https://example.test/up/', cite: true, caseSensitive: true }
        ]
    };
    await f.put('data/compendium.json', JSON.stringify([content, entries[1]]));
    await f.run();
    const $ = load(await f.read('compendium/anemoia/index.html'));
    assert.equal($('.compendium-definition script').length, 0);
    assert.equal($('.compendium-definition').text(), content.definition);
    assert.equal($('.compendium-section a a').length, 0);
    assert.equal($('a[href="https://example.test/kane/"]').text(), 'Kane Parsons');
    const film = $('a[href="https://example.test/film/"]');
    assert.equal(film.text(), 'The Backrooms (Found Footage)');
    assert.equal(film.find('cite').text(), 'The Backrooms (Found Footage)');
    assert.ok(film[0].prev.data.endsWith('“'));
    assert.ok(film[0].next.data.startsWith('”'));
    assert.equal($('a[href="https://example.test/up/"]').length, 1);
    assert.equal($('a[href="https://example.test/up/"] cite').text(), 'Up');
});

test("invalid inline URLs and image paths fail before writing source files", async t => {
    const f = await fixture(t);
    const registry = await f.read('data/pages.json');
    await f.put('data/compendium.json', JSON.stringify([{ ...entries[0], links: [{ text: 'unsafe', href: 'javascript:alert(1)' }] }]));
    await assert.rejects(f.run(), /invalid or duplicate inline link/);
    assert.equal(await f.read('data/pages.json'), registry);
    await f.put('data/compendium.json', JSON.stringify([{ ...entries[0], image: { src: '/assets/../../outside.png', alt: 'Example', caption: 'Example', width: 1, height: 1 } }]));
    await assert.rejects(f.run(), /valid local image/);
    assert.equal(await f.read('data/pages.json'), registry);
});
