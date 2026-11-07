import { load } from "cheerio";
import { quotationPositions } from "../assets/js/quote-punctuation.mjs";

const INLINE = new Set("a abbr b bdi bdo cite code data del dfn em font i ins kbd label mark q ruby rp rt s samp small span strike strong sub sup time u var wbr".split(" "));
const FORMATTED = new Set("a abbr b cite del dfn em font i ins mark s strike strong sub sup u".split(" "));
const PRESERVE = new Set("script style code pre kbd samp textarea math svg".split(" "));
const LAYOUTS = [
    ["highlight-card", ".highlight-card__title", "div"],
    ["profile-card", ".profile-card__content strong", "div"],
    ["writing-share-option", "span:not([aria-hidden])", "span"]
];
const escapeText = text => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escapeAttribute = text => escapeText(text).replace(/"/g, "&quot;");
const quoteHtml = text => `<span class="typography-quote">${escapeText(text)}</span>`;

function formatted(node) {
    const attrs = node.attribs || {};
    return FORMATTED.has(node.name)
        || /(?:^|\s)(?:italic-text|bold-text|underlined-text|strikethrough-text)(?:\s|$)/.test(attrs.class || "")
        || /(?:font-style|font-weight|text-decoration)(?:\s*:|-)/i.test(attrs.style || "");
}

function normalizeQuotesOnce(html) {
    const $ = load(html, { sourceCodeLocationInfo: true });
    const marks = new Map();
    const markedParents = new Set();
    const edits = [];
    let run = [];
    const raw = node => {
        const location = node.sourceCodeLocation;
        return location ? html.slice(location.startOffset, location.endOffset) : "";
    };

    function flush() {
        const positions = quotationPositions(run.map(node => node.data).join(""));
        let offset = 0;
        for (const node of run) {
            const indices = positions.filter(index => index >= offset && index < offset + node.data.length)
                .map(index => index - offset);
            if (indices.length) {
                marks.set(node, new Set(indices));
                for (let parent = node.parent; parent; parent = parent.parent) markedParents.add(parent);
            }
            offset += node.data.length;
        }
        run = [];
    }

    function visit(node) {
        if (node.type === "text") { run.push(node); return; }
        if (node.type === "comment") return;
        if (PRESERVE.has(node.name) || node.attribs?.["data-typography"] === "preserve"
            || /(?:^|\s)katex(?:\s|$)/.test(node.attribs?.class || "")) { flush(); return; }
        const boundary = !INLINE.has(node.name);
        if (boundary) flush();
        for (const child of node.children || []) visit(child);
        if (boundary) flush();
    }
    visit($.root()[0]);

    function merge(parts) {
        const merged = [];
        for (const part of parts) {
            if (!part.html) continue;
            const previous = merged.at(-1);
            if (previous && !previous.quote && !part.quote) previous.html += part.html;
            else merged.push({ ...part });
        }
        return merged;
    }

    function render(node) {
        if (node.type === "text" && marks.has(node)) {
            const parts = [];
            let start = 0;
            for (const index of marks.get(node)) {
                if (index > start) parts.push({ html: escapeText(node.data.slice(start, index)), quote: false });
                parts.push({ html: quoteHtml(node.data[index]), quote: true });
                start = index + 1;
            }
            if (start < node.data.length) parts.push({ html: escapeText(node.data.slice(start)), quote: false });
            return parts;
        }
        if (!markedParents.has(node)) return [{ html: raw(node), quote: false }];
        const parts = merge((node.children || []).flatMap(render));
        const location = node.sourceCodeLocation;
        if (!location?.startTag || !location.endTag) return parts;
        let opening = html.slice(location.startTag.startOffset, location.startTag.endOffset);
        const closing = html.slice(location.endTag.startOffset, location.endTag.endOffset);
        let wrapped = 0;
        return parts.map(part => {
            if (part.quote && (formatted(node) || node.attribs?.class === "typography-quote")) return part;
            let tag = opening;
            if (wrapped++ && location.attrs?.id) {
                const id = location.attrs.id;
                tag = opening.slice(0, id.startOffset - location.startTag.startOffset)
                    + opening.slice(id.endOffset - location.startTag.startOffset);
            }
            return { html: tag + part.html + closing, quote: part.quote };
        });
    }

    const layoutNodes = new Set();
    $("a").each((_, node) => {
        if (!markedParents.has(node)) return;
        const layout = LAYOUTS.find(([name]) => (node.attribs.class || "").split(/\s+/).includes(name));
        const blockLabel = $(node).find("*").toArray().filter(candidate =>
            markedParents.has(candidate) && !INLINE.has(candidate.name)).at(-1);
        if (!layout && !blockLabel) return;
        const label = layout
            ? $(node).find(layout[1]).toArray().find(candidate => markedParents.has(candidate))
            : blockLabel;
        const tag = layout?.[2] || "div";
        const location = node.sourceCodeLocation;
        const labelLocation = label?.sourceCodeLocation;
        if (!labelLocation?.startTag || !labelLocation.endTag || !location?.endTag) return;
        const replaceLabel = formatted(label);
        const labelParts = replaceLabel ? render(label) : merge((label.children || []).flatMap(render));
        const linkAttrs = Object.fromEntries(Object.entries(node.attribs).filter(([name]) =>
            !["class", "id", "data-carousel-item", "aria-label"].includes(name)));
        linkAttrs.class = "typography-link-target";
        linkAttrs["aria-label"] = $(label).text().replace(/\s+/g, " ").trim();
        const attributes = attrs => Object.entries(attrs).map(([name, value]) => `${name}="${escapeAttribute(value)}"`).join(" ");
        const firstQuote = labelParts.findIndex(part => part.quote);
        const target = labelParts.findIndex((part, index) => index > firstQuote && !part.quote && part.html.trim());
        if (target < 0) return;
        labelParts[target].html = `<a ${attributes(linkAttrs)}>${labelParts[target].html}</a>`;
        const wrapperAttrs = Object.fromEntries(Object.entries(node.attribs).filter(([name]) =>
            !["href", "target", "rel", "download", "hreflang", "referrerpolicy", "ping", "aria-label"].includes(name)
            && !/^data-(?:config-|external|share)/.test(name)));
        wrapperAttrs.class = `${wrapperAttrs.class || ""} typography-link-group`.trim();
        const innerStart = location.startTag.endOffset;
        const labelHtml = labelParts.map(part => part.html).join("");
        const inner = html.slice(innerStart, replaceLabel ? labelLocation.startOffset : labelLocation.startTag.endOffset)
            + (replaceLabel ? `<span class="typography-link-label">${labelHtml}</span>` : labelHtml)
            + html.slice(replaceLabel ? labelLocation.endOffset : labelLocation.endTag.startOffset, location.endTag.startOffset);
        edits.push([location.startOffset, location.endOffset, `<${tag} ${attributes(wrapperAttrs)}>${inner}</${tag}>`]);
        layoutNodes.add(node);
    });

    const roots = new Set();
    for (const node of marks.keys()) {
        const ancestors = [];
        for (let parent = node.parent; parent; parent = parent.parent) ancestors.push(parent);
        if (ancestors.some(parent => layoutNodes.has(parent))) continue;
        let root;
        for (const parent of ancestors) {
            if (!INLINE.has(parent.name)) break;
            if (formatted(parent)) root = parent;
        }
        if (root) roots.add(root);
        else if (!ancestors.some(parent => (parent.attribs?.class || "").split(/\s+/).includes("typography-quote"))
            && ancestors.some(parent => /^h[1-6]$/.test(parent.name) || formatted(parent))) {
            const location = node.sourceCodeLocation;
            if (location) edits.push([location.startOffset, location.endOffset, render(node).map(part => part.html).join("")]);
        }
    }
    for (const root of roots) {
        const location = root.sourceCodeLocation;
        if (location) edits.push([location.startOffset, location.endOffset, render(root).map(part => part.html).join("")]);
    }
    for (const [start, end, replacement] of edits.sort((a, b) => b[0] - a[0])) {
        html = html.slice(0, start) + replacement + html.slice(end);
    }
    return html;
}

export function normalizeQuoteTypography(html) {
    // Layout links become neutral containers first; normalize any remaining
    // emphasis inside those containers before returning the finished result.
    for (let pass = 0; pass < 4; pass++) {
        const normalized = normalizeQuotesOnce(html);
        if (normalized === html) return html;
        html = normalized;
    }
    throw new Error("Quotation cleanup did not settle. Check nested formatting in this HTML.");
}
