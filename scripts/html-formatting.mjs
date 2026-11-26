import { load } from "cheerio";

const EMPHASIS = new Map([
    ["b", "bold-text"], ["strong", "bold-text"],
    ["i", "italic-text"], ["em", "italic-text"],
    ["u", "underlined-text"]
]);
const INLINE = new Set("a abbr b bdi bdo br cite code data del dfn em i input ins kbd mark q ruby rp rt s samp small span strike strong sub sup time u var wbr".split(" "));
const PROSE = new Set("blockquote button caption dd dt figcaption h1 h2 h3 h4 h5 h6 label li p summary td th".split(" "));
const MEDIA = new Set("audio iframe img picture source track video".split(" "));
const PRESERVE = new Set("script style code pre kbd samp textarea math svg".split(" "));
const LINE_BREAK = /[ \t\f]*[\r\n][ \t\f\r\n]*/g;

export function preservesHtmlTypography(node) {
    return PRESERVE.has(node.name) || node.attribs?.["data-typography"] === "preserve"
        || /(?:^|\s)katex(?:\s|$)/.test(node.attribs?.class || "");
}

function proseBounds(html, start, end) {
    const content = html.slice(start, end);
    const leading = content.match(/^[ \t\f\r\n]*/)[0].length;
    const trailing = content.match(/[ \t\f\r\n]*$/)[0].length;
    return [start + leading, end - trailing];
}

function compactOpeningTag(opening) {
    return opening.replace(/("[^"]*"|'[^']*')|[ \t\f]*[\r\n][ \t\f\r\n]*/g, (part, quoted, offset) => {
        if (quoted) return quoted.replace(/\r\n?|\n/g, "&#10;");
        return opening[offset + part.length] === ">" ? "" : " ";
    });
}

function spanOpeningTag(opening, node, className) {
    const location = node.sourceCodeLocation;
    const classAttribute = location.attrs?.class;
    if (!classAttribute) return opening.replace(/^<[a-z]+/i, `<span class="${className}"`);

    const classes = new Set(node.attribs.class.split(/[ \t\f\r\n]+/).filter(Boolean));
    classes.add(className);
    const value = [...classes].join(" ").replace(/&/g, "&amp;").replace(/"/g, "&quot;");
    return (opening.slice(0, classAttribute.startOffset - location.startTag.startOffset)
        + `class="${value}"` + opening.slice(classAttribute.endOffset - location.startTag.startOffset))
        .replace(/^<[a-z]+/i, "<span");
}

export function normalizeHtmlFormatting(html) {
    const $ = load(html, { sourceCodeLocationInfo: true, scriptingEnabled: false });
    const edits = new Map();

    function edit(start, end, normalized) {
        if (html.slice(start, end) !== normalized) edits.set(start, [end, normalized]);
    }

    function fitsProseLine(node) {
        if (node.type === "text") return true;
        if (INLINE.has(node.name) && !preservesHtmlTypography(node)) return node.children.every(fitsProseLine);
        const location = node.sourceCodeLocation;
        return (node.type === "comment" || INLINE.has(node.name)) && location
            && !/[\r\n]/.test(html.slice(location.startOffset, location.endOffset));
    }

    function visit(node, bounds) {
        if (preservesHtmlTypography(node)) return;
        const location = node.sourceCodeLocation;
        if (node.type === "text") {
            if (!bounds || !location) return;
            const start = Math.max(location.startOffset, bounds[0]);
            const end = Math.min(location.endOffset, bounds[1]);
            if (start < end) edit(start, end, html.slice(start, end).replace(LINE_BREAK, " "));
            return;
        }

        const prose = INLINE.has(node.name) || PROSE.has(node.name);
        const { startTag, endTag } = location || {};
        if (startTag && (prose || MEDIA.has(node.name))) {
            const className = endTag && EMPHASIS.get(node.name);
            let opening = html.slice(startTag.startOffset, startTag.endOffset);
            if (className) opening = spanOpeningTag(opening, node, className);
            edit(startTag.startOffset, startTag.endOffset, compactOpeningTag(opening));
            if (endTag) {
                const closing = className ? "</span>" : html.slice(endTag.startOffset, endTag.endOffset).replace(LINE_BREAK, "");
                edit(endTag.startOffset, endTag.endOffset, closing);
            }
        }
        if (!bounds && prose && startTag && endTag && node.children.every(fitsProseLine)) {
            bounds = proseBounds(html, startTag.endOffset, endTag.startOffset);
        }
        for (const child of node.children || []) {
            // An anchor or list item can also be a layout wrapper. Keep its
            // child elements on separate lines while joining wrapped prose.
            const childBounds = bounds || (prose && child.type === "text" && child.sourceCodeLocation
                ? proseBounds(html, child.sourceCodeLocation.startOffset, child.sourceCodeLocation.endOffset)
                : undefined);
            visit(child, childBounds);
        }
    }

    visit($.root()[0]);
    for (const [start, [end, replacement]] of [...edits].sort(([a], [b]) => b - a)) {
        html = html.slice(0, start) + replacement + html.slice(end);
    }
    return html;
}
