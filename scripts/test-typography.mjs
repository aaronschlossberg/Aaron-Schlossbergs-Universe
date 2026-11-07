import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { load } from "cheerio";
import { normalizeSiteTypography } from "./normalize-typography.mjs";
import { normalizeHtmlTypography, normalizeJsonTypography, normalizeSlashSpacing } from "./site-typography.mjs";
import { quotationParts, quotationPositions, appendFormattedText } from "../assets/js/quote-punctuation.mjs";

function assertPlainQuotes($) {
    $(".typography-quote").each((_, quote) => {
        assert.equal($(quote).parents("a, strong, b, em, i, u, s, del, ins, mark, cite, .italic-text, .underlined-text").length, 0);
    });
}

test("moves matched quotation marks outside combined links and formatting", () => {
    for (const pair of [["“", "”"], ["‘", "’"], ['"', '"'], ["'", "'"], ["«", "»"]]) {
        const original = `<p>Read <strong><a href="/page/" title="Keep &quot;this&quot;"><em><u><mark>${pair[0]}Title${pair[1]}</mark></u></em></a></strong>.</p>`;
        const normalized = normalizeHtmlTypography(original);
        const $ = load(normalized);
        assert.equal($("p").text(), `Read ${pair[0]}Title${pair[1]}.`);
        assert.equal($("strong a em u mark").text(), "Title");
        assert.equal($("a").attr("href"), "/page/");
        assert.equal($("a").attr("title"), 'Keep "this"');
        assertPlainQuotes($);
        assert.equal(normalizeHtmlTypography(normalized), normalized);
    }
});

test("handles quotes in separate nodes, nested quotations and escaped punctuation", () => {
    const original = '<p><b>“</b><b><span class="italic-text">Title</span></b><b>”</b> <em>Read &quot;a ‘quoted’ title&quot;.</em></p>';
    const normalized = normalizeHtmlTypography(original);
    const $ = load(normalized);
    assert.equal($("p").text(), load(original)("p").text());
    assert.equal($("b .italic-text").text(), "Title");
    assert.equal($(".typography-quote").length, 6);
    assertPlainQuotes($);
    assert.equal(normalizeHtmlTypography(normalized), normalized);
});

test("separates interior quotation marks without duplicating IDs or changing word styling", () => {
    const original = '<p><strong id="label">The “Uncanny” and Marvin’s ‘til tomorrow</strong></p>';
    const $ = load(normalizeHtmlTypography(original));
    assert.equal($("#label").length, 1);
    assert.equal($("strong").text(), "The Uncanny and Marvin’s ‘til tomorrow");
    assert.equal($("p").text(), load(original)("p").text());
    assertPlainQuotes($);
});

test("keeps layout links as one accessible destination, with quotes outside the link", () => {
    const fixtures = [
        '<a class="highlight-card" data-carousel-item href="/news/" target="_blank"><img src="/photo.png"><div><h3 class="highlight-card__title">“<strong>Aaron</strong> Named Student Leader”</h3><p>News</p></div></a>',
        '<a class="profile-card" data-config-link="x" data-external href="https://x.com/example"><span class="profile-card__content"><strong>Twitter/“X”</strong><span>Updates</span></span></a>',
        '<a class="writing-share-option" data-share-x href="https://twitter.com/intent/tweet"><span aria-hidden="true">Icon</span><span>Twitter/“X”</span></a>',
        '<a class="new-card" href="/news/"><div><h3>“Another title”</h3></div></a>'
    ];
    for (const original of fixtures) {
        const normalized = normalizeHtmlTypography(original);
        const $ = load(normalized);
        assert.equal($("body").text(), load(original)("body").text());
        assert.equal($(".typography-link-group").length, 1);
        assert.equal($("a").length, 1);
        assert.ok($("a").attr("aria-label"));
        assert.equal($("a").attr("href"), load(original)("a").attr("href"));
        assert.equal($("a a").length, 0);
        if (original.includes("data-share-x")) assert.equal($("a[data-share-x]").length, 1);
        if (original.includes("data-config-link")) assert.equal($("a[data-config-link='x']").length, 1);
        if (original.includes("data-carousel-item")) assert.equal($("[data-carousel-item].typography-link-group").length, 1);
        assertPlainQuotes($);
        assert.equal(normalizeHtmlTypography(normalized), normalized);
    }
});

test("keeps heading punctuation plain and preserves code, math, metadata and explicit exceptions", () => {
    const original = '<h2>“A title”</h2><p><code>"code"</code> <span data-typography="preserve"><b>“Exact”</b></span><math><mtext>“math”</mtext></math></p><script>const title="quoted";</script>';
    const normalized = normalizeHtmlTypography(original);
    const $ = load(normalized);
    assert.equal($("h2 .typography-quote").length, 2);
    assert.equal($("code").html(), '"code"');
    assert.equal($("[data-typography] b").text(), "“Exact”");
    assert.equal($("math .typography-quote").length, 0);
    assert.equal($("script").text(), 'const title="quoted";');
    assertPlainQuotes($);
});

test("identifies quotations without treating apostrophes, elisions or decade abbreviations as quotes", () => {
    for (const text of ["Marvin’s Friend", "O’Shaughnessy", "‘til morning", "'90s", "‘tis the season", "Don't stop", "James’ book"]) {
        assert.deepEqual(quotationPositions(text), []);
    }
    const text = '“Let’s go ‘til dawn,” she said. Then ‘off’ and "on".';
    assert.equal(quotationParts(text).map(part => part.text).join(""), text);
    assert.equal(quotationParts(text).filter(part => part.quote).length, 6);
});

test("browser renderer creates sibling punctuation and keeps text out of HTML parsing", () => {
    const document = { createElement: tagName => ({ tagName, ownerDocument: document, children: [], append(child) { this.children.push(child); } }) };
    const container = document.createElement("p");
    appendFormattedText(container, 'Tuco “the <Ugly>”', { url: "https://example.test/", className: "italic-text underlined-text", external: true });
    assert.equal(container.children.map(node => node.textContent).join(""), 'Tuco “the <Ugly>”');
    assert.equal(container.children.filter(node => node.tagName === "a").length, 2);
    for (const node of container.children) {
        if (node.className === "typography-quote") assert.equal(node.href, undefined);
        else {
            assert.equal(node.className, "italic-text underlined-text");
            assert.equal(node.href, "https://example.test/");
            assert.equal(node.rel, "noopener noreferrer");
        }
    }
});

test("joins paired terms with either-sided, Unicode, and multiline spaces", () => {
    for (const text of ["XP / EXP", "XP /EXP", "XP/ EXP", "XP\u00a0/\u202fEXP", "XP\n/\nEXP"]) {
        assert.equal(normalizeSlashSpacing(text), "XP/EXP");
    }
    assert.equal(normalizeSlashSpacing("writer / developer / artist; Pokémon / games"), "writer/developer/artist; Pokémon/games");
    assert.equal(normalizeSlashSpacing("(writer) / (developer)"), "(writer)/(developer)");
    assert.equal(normalizeSlashSpacing("already/compact"), "already/compact");
});

test("preserves URLs and path references in prose", () => {
    const text = "Visit /about-me/ or /projects/info-sprawlings/blender/ and /assets/file.pdf or ./data/config.json. Read https://example.com/ next. See /x/, too.";
    assert.equal(normalizeSlashSpacing(text), text);
    assert.equal(normalizeSlashSpacing(`${text} Either / or.`), `${text} Either/or.`);
});

test("preserves markup while joining terms across inline formatting and entities", () => {
    const html = '<!DOCTYPE html>\n<p class="keep">Read <strong>A</strong>&nbsp;&#47;&#32;<em>B</em> &amp; C.</p>\n<!-- Keep / this comment -->';
    const expected = '<!DOCTYPE html>\n<p class="keep">Read <strong>A</strong>/<em>B</em> &amp; C.</p>\n<!-- Keep / this comment -->';
    assert.equal(normalizeHtmlTypography(html), expected);
    const split = '<p><b>A </b><span>/</span><i> B</i></p>';
    assert.equal(normalizeHtmlTypography(split), '<p><b>A</b><span>/</span><i>B</i></p>');
    assert.equal(normalizeHtmlTypography(expected), expected);
});

test("normalizes accessible text, social metadata, share labels and JSON-LD", () => {
    const html = `<head><title>A / B</title><meta property="og:title" content="A / B">
<script type="application/ld+json">{ "name": "A / B", "url": "https://example.com/" }</script></head>
<img src="/assets/a-b.png" alt="A / B"><button aria-label="Share A / B" data-share-term="A / B">A / B</button>`;
    const normalized = normalizeHtmlTypography(html);
    const $ = load(normalized);
    assert.equal($("title").text(), "A/B");
    assert.equal($("meta").attr("content"), "A/B");
    assert.equal($("img").attr("alt"), "A/B");
    assert.equal($("img").attr("src"), "/assets/a-b.png");
    assert.equal($("button").attr("aria-label"), "Share A/B");
    assert.equal($("button").attr("data-share-term"), "A/B");
    assert.equal(JSON.parse($("script").text()).name, "A/B");
    assert.equal(normalizeHtmlTypography(normalized), normalized);
});

test("leaves code, math, CSS, scripts, explicit exceptions and block boundaries intact", () => {
    const html = `<script>const ratio = left / right;</script><style>.x { grid-column: 1 / -1; }</style>
<p>Code <code>left / right</code>, <kbd>A / B</kbd>, and <samp>A / B</samp>.</p>
<pre>A / B</pre><textarea>A / B</textarea><math><mtext>A / B</mtext></math>
<span class="katex">A / B</span><svg><text>A / B</text></svg>
<p data-typography="preserve" title="A / B"><b>A / B</b></p>
<p>Left </p><p>/ right</p><p>A<br>/ B</p>`;
    assert.equal(normalizeHtmlTypography(html), html);
});

test("JSON changes only prose values and keeps syntax fields and formatting", () => {
    const json = '{\n    "A / B": "XP / EXP",\n    "href": "/some / invalid / path",\n    "latex": "x / y",\n    "examples": ["writer / developer"],\n    "description": "\\u003ctag> A / B"\n}\n';
    const expected = '{\n    "A / B": "XP/EXP",\n    "href": "/some / invalid / path",\n    "latex": "x / y",\n    "examples": ["writer/developer"],\n    "description": "\\u003ctag> A/B"\n}\n';
    assert.equal(normalizeJsonTypography(json), expected);
    assert.equal(normalizeJsonTypography(expected), expected);
});

test("site check is read-only; cleanup updates sources and data but skips dependencies, drafts and output", async t => {
    const root = await mkdtemp(path.join(os.tmpdir(), "asu-typography-"));
    t.after(() => rm(root, { recursive: true, force: true }));
    const files = {
        "index.html": "<h1>A / B</h1>",
        "_partials/footer.html": "<p>A / B</p>",
        "data/compendium.json": '{"term":"XP / EXP"}',
        "assets/data/search.json": '{"title":"A / B"}',
        "content/draft.json": '{"text":"code / sample"}',
        "_site/index.html": "<p>Old / output</p>",
        "node_modules/example/index.html": "<p>Dependency / example</p>",
        ".authoring/draft.json": '{"text":"Draft / sample"}',
        "assets/js/example.js": 'const ratio = a / b;'
    };
    for (const [relative, contents] of Object.entries(files)) {
        await mkdir(path.dirname(path.join(root, relative)), { recursive: true });
        await writeFile(path.join(root, relative), contents);
    }
    const changed = ["_partials/footer.html", "assets/data/search.json", "data/compendium.json", "index.html"];
    assert.deepEqual(await normalizeSiteTypography(root, { check: true }), changed);
    for (const [relative, contents] of Object.entries(files)) {
        assert.equal(await readFile(path.join(root, relative), "utf8"), contents);
    }
    assert.deepEqual(await normalizeSiteTypography(root), changed);
    assert.deepEqual(await normalizeSiteTypography(root, { check: true }), []);
    for (const [relative, contents] of Object.entries(files)) {
        if (!changed.includes(relative)) assert.equal(await readFile(path.join(root, relative), "utf8"), contents);
    }
});
