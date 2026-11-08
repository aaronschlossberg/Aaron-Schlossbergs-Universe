import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { load } from "cheerio";

const exec = promisify(execFile);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseConfig = JSON.parse(await readFile(path.join(ROOT, "data/config.json"), "utf8"));
const template = await readFile(path.join(ROOT, "_partials/head.html"), "utf8");
const BODY = '<body><main><h1>Original page</h1><p data-value="$&">Keep this &amp; its formatting.</p></main></body>';
const STALE_HEAD = '<title>Old title</title><title>Duplicate title</title><meta property="og:title" content="Old social title"><meta name="twitter:description" content="Old social description"><meta name="obsolete" content="remove"><script type="application/ld+json">invalid old JSON</script>';

function page(title, description) {
    return { title, description, breadcrumbLabel: title };
}

async function fixture(t, metadata = {
    "/": page("Home | ASU", "Home description."),
    "/contact/": page("Contact | ASU", "Contact description.")
}) {
    const root = await mkdtemp(path.join(os.tmpdir(), "asu-heads-"));
    t.after(() => rm(root, { recursive: true, force: true }));
    await symlink(path.join(ROOT, "node_modules"), path.join(root, "node_modules"), "junction");

    async function put(relative, text) {
        const file = path.join(root, relative);
        await mkdir(path.dirname(file), { recursive: true });
        await writeFile(file, text);
    }

    const config = { ...baseConfig, defaultOgImage: `${baseConfig.baseUrl}/share.png` };
    const fileFor = pathname => pathname === "/" ? "index.html" : `${pathname.slice(1)}index.html`;

    await put("data/config.json", JSON.stringify(config));
    await put("data/pages.json", JSON.stringify(metadata));
    await put("_partials/head.html", template);
    await put("share.png", "fixture image");
    await put("scripts/render-heads.mjs", "");
    await copyFile(path.join(ROOT, "scripts/render-heads.mjs"), path.join(root, "scripts/render-heads.mjs"));

    for (const pathname of Object.keys(metadata)) {
        await put(fileFor(pathname), `<!DOCTYPE html>\n<html lang="en"><head>${STALE_HEAD}</head>${BODY}</html>`);
    }

    async function run(...args) {
        try {
            const result = await exec(process.execPath, [path.join(root, "scripts/render-heads.mjs"), ...args]);
            return { ...result, code: 0 };
        } catch (error) {
            return { stdout: error.stdout, stderr: error.stderr, code: error.code };
        }
    }

    return {
        config, metadata, put, run,
        html: pathname => readFile(path.join(root, fileFor(pathname)), "utf8")
    };
}

test("replaces complete heads and shares one title and description across all formats", async t => {
    const metadata = {
        "/": page("Home | ASU", "Home description."),
        "/contact/": { ...page("Contact | ASU", "Contact description."), schemaType: "ContactPage" },
        "/gone/": { ...page("Gone | ASU", "Gone description."), robots: "noindex, nofollow", canonical: false, breadcrumbs: false }
    };
    const f = await fixture(t, metadata);
    assert.equal((await f.run()).code, 0);

    for (const [pathname, expected] of Object.entries(metadata)) {
        const html = await f.html(pathname);
        const $ = load(html);
        assert.equal($("head title").length, 1);
        assert.equal($("head title").text(), expected.title);

        for (const key of ["og:title", "twitter:title"]) {
            const tag = $(`head meta[property='${key}'], head meta[name='${key}']`);
            assert.equal(tag.length, 1);
            assert.equal(tag.attr("content"), expected.title);
        }

        for (const key of ["description", "og:description", "twitter:description"]) {
            const tag = $(`head meta[property='${key}'], head meta[name='${key}']`);
            assert.equal(tag.length, 1);
            assert.equal(tag.attr("content"), expected.description);
        }

        assert.equal($("meta[name='obsolete']").length, 0);
        assert.equal($("script[src*='googletagmanager.com/gtag/js']").length, 1);
        assert.equal($("script[type='application/ld+json']").length, 1);
        const graph = JSON.parse($("script[type='application/ld+json']").text())["@graph"];
        const webpage = graph.find(node => node["@id"].endsWith("#webpage"));
        assert.equal(webpage.name, expected.title);
        assert.equal(webpage.description, expected.description);
        assert.equal($("link[rel='canonical']").length, expected.canonical === false ? 0 : 1);
        assert.equal($("meta[name='robots']").attr("content"), expected.robots || "index, follow");
        assert.equal(html.slice(html.indexOf("</head>") + 7), `${BODY}</html>`);
        assert.ok(html.indexOf('<meta charset="UTF-8">') < html.indexOf("<script"));
    }
});

test("recreates specialized schema, images, article tags, and assets from configuration alone", async t => {
    const metadata = {
        "/": page("Home | ASU", "Home description."),
        "/article/": {
            ...page("Article | ASU", "Article description."),
            ogType: "article",
            article: { published: "2026-01-01", modified: "2026-02-02" },
            image: { url: `${baseConfig.baseUrl}/article.png`, type: "image/png", width: 640, height: 480, alt: "Article illustration" },
            extraStyles: ["/article.css"], extraScripts: ["/article.js"],
            schemaNodes: [{ "@type": "Article", headline: "The work's own title", wordCount: 1234 }]
        }
    };
    const f = await fixture(t, metadata);
    for (const asset of ["article.png", "article.css", "article.js"]) await f.put(asset, "fixture asset");
    await f.put("article/index.html", `<!DOCTYPE html><html><head></head>${BODY}</html>`);
    assert.equal((await f.run()).code, 0);

    const $ = load(await f.html("/article/"));
    const graph = JSON.parse($("script[type='application/ld+json']").text())["@graph"];
    const article = graph.find(node => node["@type"] === "Article");
    assert.equal(article.wordCount, 1234);
    assert.equal(article.headline, "The work's own title");
    assert.equal(graph.find(node => node["@type"] === "WebPage").mainEntity["@id"], article["@id"]);
    assert.equal($("meta[property='og:image']").attr("content"), metadata["/article/"].image.url);
    assert.equal($("meta[name='twitter:image:alt']").attr("content"), "Article illustration");
    assert.equal($("meta[property='article:modified_time']").attr("content"), "2026-02-02");
    assert.equal($("link[href='/article.css']").length, 1);
    assert.equal($("script[src='/article.js'][defer]").length, 1);

    metadata["/article/"].title = "Updated article | ASU";
    metadata["/article/"].description = "Updated article description.";
    metadata["/article/"].schemaNodes[0].wordCount = 1500;
    await f.put("data/pages.json", JSON.stringify(metadata));
    await f.put("article/index.html", `<html><head></head>${BODY}</html>`);
    assert.equal((await f.run()).code, 0);
    const updated = load(await f.html("/article/"));
    assert.equal(updated("meta[property='og:title']").attr("content"), metadata["/article/"].title);
    assert.equal(JSON.parse(updated("script[type='application/ld+json']").text())["@graph"].find(node => node["@type"] === "Article").wordCount, 1500);
});

test("preserves dollar signs and literal template text while escaping HTML and JSON-LD", async t => {
    const title = 'Costs $& and $$ {{TITLE}} </title><script>alert("x")</script>';
    const description = 'Quotes " & <markup> {{DESCRIPTION}} $&';
    const f = await fixture(t, { "/": page(title, description) });
    assert.equal((await f.run()).code, 0);
    const html = await f.html("/");
    const $ = load(html);
    assert.equal($("title").text(), title);
    assert.equal($("meta[property='og:title']").attr("content"), title);
    assert.equal($("meta[name='twitter:description']").attr("content"), description);
    assert.equal($("script").length, 5); // Analytics loader, Analytics setup, theme.js, JSON-LD, main.js.
    const themeScript = $("script[src='/assets/js/theme.js']");
    assert.equal(themeScript.length, 1);
    assert.equal(themeScript.attr("defer"), undefined);
    assert.equal(themeScript.attr("async"), undefined);
    assert.ok(html.indexOf('/assets/js/theme.js') < html.indexOf('/assets/css/main.css'));
    assert.ok(!$("script[type='application/ld+json']").text().includes("<"));
    assert.equal(JSON.parse($("script[type='application/ld+json']").text())["@graph"].find(node => node["@type"] === "WebPage").name, title);
});

test("check mode is read-only and repeated generation makes no changes", async t => {
    const f = await fixture(t);
    const before = await f.html("/");
    assert.equal((await f.run("--check")).code, 1);
    assert.equal(await f.html("/"), before);
    assert.equal((await f.run()).code, 0);
    const rendered = await f.html("/");
    assert.equal((await f.run("--check")).code, 0);
    assert.match((await f.run()).stdout, /0 updated/);
    assert.equal(await f.html("/"), rendered);
});

test("shared template and Analytics changes propagate to every head", async t => {
    const f = await fixture(t);
    f.config.googleAnalyticsId = "G-TEST123";
    await f.put("data/config.json", JSON.stringify(f.config));
    await f.put("_partials/head.html", `${template}\n<meta name="custom-verification" content="new value">`);
    assert.equal((await f.run()).code, 0);
    for (const pathname of Object.keys(f.metadata)) {
        const $ = load(await f.html(pathname));
        assert.equal($("meta[name='custom-verification']").attr("content"), "new value");
        assert.match($("script[src*='googletagmanager.com']").attr("src"), /G-TEST123$/);
    }
    delete f.config.googleAnalyticsId;
    await f.put("data/config.json", JSON.stringify(f.config));
    assert.equal((await f.run()).code, 0);
    for (const pathname of Object.keys(f.metadata)) {
        const html = await f.html(pathname);
        assert.ok(!html.includes("googletagmanager.com"));
        assert.ok(!html.includes('gtag("config"'));
    }
});

test("FAQ schema follows visible answers, links, and edits without changing the body", async t => {
    const f = await fixture(t, {
        "/": page("Home | ASU", "Home description."),
        "/faq/": { ...page("FAQ | ASU", "FAQ description."), schemaType: "FAQPage", aboutPerson: true }
    });
    const body = `<body><main>
        <details id="contact" data-faq-item><summary>How can I contact Aaron?</summary>
            <div data-faq-answer><p>Use the <a href="/contact/">Contact page</a>.</p></div>
            <a href="#contact">Link to this answer</a>
        </details>
        <details id="education" data-faq-item open><summary>Where did Aaron study?</summary>
            <div data-faq-answer><p>At Muhlenberg College.</p></div>
        </details>
    </main></body>`;
    await f.put("faq/index.html", `<html><head></head>${body}</html>`);
    assert.equal((await f.run()).code, 0);

    const html = await f.html("/faq/");
    const $ = load(html);
    const graph = JSON.parse($("script[type='application/ld+json']").text())["@graph"];
    const faq = graph.find(node => node["@type"] === "FAQPage");
    assert.equal(graph.filter(node => node["@type"] === "FAQPage").length, 1);
    assert.equal(faq.about["@id"], `${baseConfig.baseUrl}/#person`);
    assert.equal(faq.mainEntity.length, 2);
    assert.equal(faq.mainEntity[0]["@id"], `${baseConfig.baseUrl}/faq/#contact`);
    assert.equal(faq.mainEntity[0].name, "How can I contact Aaron?");
    const answer = load(faq.mainEntity[0].acceptedAnswer.text);
    assert.equal(answer("body").text(), "Use the Contact page.");
    assert.equal(answer("a").attr("href"), `${baseConfig.baseUrl}/contact/`);
    assert.ok(!faq.mainEntity[0].acceptedAnswer.text.includes("Link to this answer"));
    assert.equal(html.slice(html.indexOf("</head>") + 7), `${body}</html>`);
    assert.equal((await f.run("--check")).code, 0);

    await f.put("faq/index.html", html.replace("At Muhlenberg College.</p>", "At Muhlenberg College in Pennsylvania.</p>"));
    assert.equal((await f.run("--check")).code, 1);
    assert.equal((await f.run()).code, 0);
    const updated = load(await f.html("/faq/"));
    const updatedFaq = JSON.parse(updated("script[type='application/ld+json']").text())["@graph"].find(node => node["@type"] === "FAQPage");
    assert.match(updatedFaq.mainEntity[1].acceptedAnswer.text, /in Pennsylvania/);
    assert.equal((await f.run("--check")).code, 0);
});

test("missing or malformed FAQ answers fail before changing source pages", async t => {
    const cases = [
        "<main></main>",
        '<main><details data-faq-item><summary>Question?</summary><div data-faq-answer>Answer.</div></details></main>',
        '<main><details id="one" data-faq-item><summary>Question?</summary><div data-faq-answer></div></details></main>',
        '<main><details id="one" data-faq-item><summary>Question?</summary><div data-faq-answer>Answer.</div></details><details id="one" data-faq-item><summary>Another?</summary><div data-faq-answer>Another answer.</div></details></main>'
    ];
    for (const body of cases) {
        const f = await fixture(t, {
            "/": page("Home | ASU", "Home description."),
            "/faq/": { ...page("FAQ | ASU", "FAQ description."), schemaType: "FAQPage" }
        });
        const before = await f.html("/");
        await f.put("faq/index.html", `<html><head></head><body>${body}</body></html>`);
        const result = await f.run();
        assert.equal(result.code, 1);
        assert.match(result.stderr, /FAQ/);
        assert.equal(await f.html("/"), before);
    }
});

test("invalid metadata or templates fail before changing any page", async t => {
    const cases = [
        ["separate social title", async f => { f.metadata["/contact/"].socialTitle = "Override"; }, /remove socialTitle/],
        ["separate social description", async f => { f.metadata["/contact/"].socialDescription = "Override"; }, /remove socialDescription/],
        ["invalid schema", async f => { f.metadata["/contact/"].schemaNodes = [{ name: "No type" }]; }, /needs an @type/],
        ["duplicate schema ID", async f => { f.metadata["/contact/"].schemaNodes = [{ "@type": "Article", "@id": `${baseConfig.baseUrl}/#person` }]; }, /duplicates the structured-data ID/],
        ["unregistered page", async f => { await f.put("new/index.html", `<html><head></head>${BODY}</html>`); }, /Add \/new\/ to data\/pages.json/],
        ["missing head", async f => { await f.put("contact/index.html", `<html>${BODY}</html>`); }, /needs a <head> element/],
        ["unknown template token", async f => { await f.put("_partials/head.html", `${template}\n{{UNKNOWN_TOKEN}}`); }, /Unresolved head token/]
    ];

    for (const [label, change, expected] of cases) {
        await t.test(label, async sub => {
            const f = await fixture(sub);
            const before = await f.html("/");
            await change(f);
            await f.put("data/pages.json", JSON.stringify(f.metadata));
            const result = await f.run();
            assert.equal(result.code, 1);
            assert.match(result.stderr, expected);
            assert.equal(await f.html("/"), before);
        });
    }
});
