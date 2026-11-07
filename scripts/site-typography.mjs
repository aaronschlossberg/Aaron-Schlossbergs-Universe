import { load } from "cheerio";
import { normalizeQuoteTypography } from "./quote-typography.mjs";

// Treat slashes between words as typography. URLs, paths, code and math have
// their own syntax and are deliberately kept out of this transformation.
const PAIRED_SLASH = /(?<=[\p{L}\p{N}\p{M})\]’”'"])\s*\/\s*(?=[\p{L}\p{N}(\[‘“'"])/gu;
const REFERENCE = /(?:[a-z][a-z\d+.-]*:\/\/|mailto:|tel:|www\.)[^\s<>"']*|(?<![\p{L}\p{N}])\/(?:[^\s/<>"']+\/)+[^\s<>"']*|(?<!\S)\.{1,2}\/[^\s<>"']+|(?<![\p{L}\p{N}])\/[^\s<>"']+\.[a-z\d]{1,8}(?=[\s,;.)]|$)/giu;
const INLINE = new Set("a abbr b bdi bdo cite data del dfn em i ins label mark q ruby rp rt s small span strong sub sup time u var wbr".split(" "));
const PRESERVE = new Set("script style code pre kbd samp textarea math svg".split(" "));
const TEXT_ATTRIBUTES = new Set(["alt", "title", "aria-label", "aria-description", "placeholder", "label"]);
const SYNTAX_KEYS = /^(?:href|src|srcset|url|uri|@id|@context|canonical|baseUrl|slug|latex|file|path|route)$/i;

function whitespaceRanges(text) {
    const references = [...text.matchAll(REFERENCE)].map(match => [match.index, match.index + match[0].length]);
    const ranges = [];
    for (const match of text.matchAll(PAIRED_SLASH)) {
        const slash = match.index + match[0].indexOf("/");
        if (match[0] === "/" || references.some(([start, end]) => slash >= start && slash < end)) continue;
        if (slash > match.index) ranges.push([match.index, slash]);
        const end = match.index + match[0].length;
        if (end > slash + 1) ranges.push([slash + 1, end]);
    }
    return ranges;
}

function removeRanges(text, ranges) {
    for (const [start, end] of ranges.slice().sort((a, b) => b[0] - a[0])) {
        text = text.slice(0, start) + text.slice(end);
    }
    return text;
}

export function normalizeSlashSpacing(text) {
    return removeRanges(text, whitespaceRanges(text));
}

// Replace only changed JSON string values, preserving indentation, key names,
// URL fields and the rest of the file byte for byte.
export function normalizeJsonTypography(json) {
    JSON.parse(json);
    let property;
    return json.replace(/"(?:\\.|[^"\\])*"/g, (token, offset) => {
        const end = offset + token.length;
        if (/^\s*:/.test(json.slice(end))) {
            property = { name: JSON.parse(token), end };
            return token;
        }
        if (property && json.slice(property.end, offset).trim() === ":" && SYNTAX_KEYS.test(property.name)) return token;
        const value = JSON.parse(token);
        const normalized = normalizeSlashSpacing(value);
        return value === normalized ? token : JSON.stringify(normalized).replace(/</g, "\\u003c");
    });
}

function escapeText(text) {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Work on text nodes and selected human-readable attributes, never on the raw
// HTML syntax. Source locations let us keep unrelated markup exactly as written.
export function normalizeHtmlTypography(html) {
    const $ = load(html, { sourceCodeLocationInfo: true });
    const edits = [];
    let run = [];

    function flush() {
        const text = run.map(node => node.data).join("");
        const ranges = whitespaceRanges(text);
        let offset = 0;
        for (const node of run) {
            const end = offset + node.data.length;
            const local = ranges.filter(([a, b]) => a < end && b > offset)
                .map(([a, b]) => [Math.max(a, offset) - offset, Math.min(b, end) - offset]);
            if (local.length && node.sourceCodeLocation) {
                const { startOffset, endOffset } = node.sourceCodeLocation;
                edits.push([startOffset, endOffset, escapeText(removeRanges(node.data, local))]);
            }
            offset = end;
        }
        run = [];
    }

    function visit(node) {
        if (node.type === "text") {
            run.push(node);
            return;
        }
        if (node.type === "comment") return;
        const attrs = node.attribs || {};
        if (attrs["data-typography"] === "preserve") {
            flush();
            return;
        }
        for (const [name, value] of Object.entries(attrs)) {
            const location = node.sourceCodeLocation?.attrs?.[name];
            const humanReadable = TEXT_ATTRIBUTES.has(name) || name.startsWith("data-")
                || (node.name === "meta" && name === "content")
                || (node.name === "input" && /^(submit|reset|button)$/.test(attrs.type) && name === "value");
            if (!location || !humanReadable) continue;
            const normalized = normalizeSlashSpacing(value);
            if (normalized !== value) {
                edits.push([location.startOffset, location.endOffset, `${name}="${escapeText(normalized).replace(/"/g, "&quot;")}"`]);
            }
        }
        if (PRESERVE.has(node.name) || /(?:^|\s)katex(?:\s|$)/.test(attrs.class || "")) {
            flush();
            if (node.name === "script" && attrs.type === "application/ld+json") {
                for (const child of node.children || []) {
                    if (child.type !== "text" || !child.sourceCodeLocation) continue;
                    let normalized;
                    try { normalized = normalizeJsonTypography(child.data); } catch { continue; }
                    if (normalized !== child.data) {
                        const { startOffset, endOffset } = child.sourceCodeLocation;
                        edits.push([startOffset, endOffset, normalized]);
                    }
                }
            }
            return;
        }
        const boundary = !INLINE.has(node.name);
        if (boundary) flush();
        for (const child of node.children || []) visit(child);
        if (boundary) flush();
    }

    visit($.root()[0]);
    for (const [start, end, replacement] of edits.sort((a, b) => b[0] - a[0])) {
        html = html.slice(0, start) + replacement + html.slice(end);
    }
    return normalizeQuoteTypography(html);
}
