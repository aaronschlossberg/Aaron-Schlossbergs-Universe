import { Node } from "@tiptap/core";
import { StarterKit } from "@tiptap/starter-kit";
import { Subscript } from "@tiptap/extension-subscript";
import { Superscript } from "@tiptap/extension-superscript";
import katex from "katex";

export const IMAGE_LIMIT = 10 * 1024 * 1024;
export const IMAGE_FILE = /^[a-f0-9]{64}\.(jpg|png|webp|gif)$/;
export const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const DOCUMENT_ID = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
export const TYPES = {
    writing: "Writing",
    info: "Info Sprawling",
    page: "General page"
};
const SECTION_PATHS = {
    root: "/",
    projects: "/projects/",
    education: "/education/"
};
export const RESERVED_ROOT = new Set(["assets", "authoring", "content", "data", "scripts", "sitemaps"]);
export const WRITING_TYPES = [
    "Essay", "Fiction", "Nonfiction", "Technical", "Poetry", "Script", "Reflection"
];

export const emptyBody = {
    type: "doc",
    content: [{ type: "paragraph" }]
};

export function slugify(title) {
    return title.normalize("NFKD")
        .replace(/\p{Mark}/gu, "")
        .toLowerCase()
        .replace(/['’]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .slice(0, 80)
        .replace(/^-|-$/g, "");
}

export function sectionPath(section) {
    return typeof section === "string" && Object.hasOwn(SECTION_PATHS, section)
        ? SECTION_PATHS[section]
        : section;
}

export function sectionValue(pathname) {
    return Object.keys(SECTION_PATHS).find(section => SECTION_PATHS[section] === pathname) ?? pathname;
}

export function isPagePath(pathname) {
    return typeof pathname === "string" && pathname.startsWith("/") && pathname.endsWith("/")
        && (pathname === "/" || pathname.slice(1, -1).split("/").every(segment => SLUG.test(segment)));
}

export function routeFor({ type, section, slug }) {
    const parent = {
        writing: "/writings/",
        info: "/projects/info-sprawlings/",
        page: sectionPath(section)
    }[type];
    return `${parent}${slug}/`;
}

export function safeHref(value) {
    if (typeof value !== "string" || !value || /[\s\\\p{Cc}]/u.test(value)) {
        return "";
    }
    if (value.startsWith("#") || (value.startsWith("/") && !value.startsWith("//"))) {
        return value;
    }
    if (/^(https?:\/\/|mailto:|tel:)/i.test(value)) {
        try {
            return new URL(value).href;
        } catch {
            return "";
        }
    }
    return "";
}

export function mathHtml(latex, displayMode) {
    return katex.renderToString(latex, {
        displayMode,
        output: "mathml",
        trust: false,
        maxExpand: 500,
        maxSize: 12
    });
}

function dataAttributes(defaults) {
    return Object.fromEntries(Object.entries(defaults).map(([name, defaultValue]) => [
        name,
        {
            default: defaultValue,
            parseHTML: element => element.getAttribute(`data-${name}`) ?? defaultValue,
            renderHTML: attributes => ({ [`data-${name}`]: attributes[name] })
        }
    ]));
}

const Figure = Node.create({
    name: "studioFigure",
    group: "block",
    atom: true,
    draggable: true,
    addAttributes() {
        return dataAttributes({ file: "", alt: "", caption: "" });
    },
    parseHTML() {
        return [{ tag: "figure[data-studio-figure]" }];
    },
    renderHTML({ node, HTMLAttributes }) {
        const { file, alt, caption } = node.attrs;
        return [
            "figure",
            { ...HTMLAttributes, "data-studio-figure": "", class: "editor-figure" },
            ["img", { src: IMAGE_FILE.test(file) ? `/media/${file}` : "", alt }],
            ...(caption ? [["figcaption", {}, caption]] : [])
        ];
    }
});

const Footnote = Node.create({
    name: "studioFootnote",
    group: "inline",
    inline: true,
    atom: true,
    addAttributes() {
        return dataAttributes({ note: "", source: "" });
    },
    parseHTML() {
        return [{ tag: "span[data-studio-footnote]" }];
    },
    renderHTML({ node, HTMLAttributes }) {
        return [
            "span",
            { ...HTMLAttributes, "data-studio-footnote": "", title: node.attrs.note },
            "†"
        ];
    }
});

function equationNode(display) {
    const tag = display ? "div" : "span";
    const attribute = display ? "data-studio-display-math" : "data-studio-inline-math";
    return Node.create({
        name: display ? "studioDisplayMath" : "studioInlineMath",
        group: display ? "block" : "inline",
        inline: !display,
        atom: true,
        addAttributes() {
            return dataAttributes({ latex: "" });
        },
        parseHTML() {
            return [{ tag: `${tag}[${attribute}]` }];
        },
        renderHTML({ node, HTMLAttributes }) {
            return [tag, { ...HTMLAttributes, [attribute]: "" }, node.attrs.latex];
        },
        addNodeView() {
            return ({ node }) => {
                const dom = document.createElement(tag);
                dom.setAttribute(attribute, "");
                dom.contentEditable = "false";
                try {
                    dom.innerHTML = mathHtml(node.attrs.latex, display);
                } catch {
                    dom.textContent = node.attrs.latex;
                }
                return { dom };
            };
        }
    });
}

export const editorExtensions = [
    StarterKit.configure({
        heading: { levels: [2, 3, 4] },
        link: {
            defaultProtocol: "https",
            openOnClick: false,
            isAllowedUri: href => Boolean(safeHref(href)),
            HTMLAttributes: { target: null, rel: null, class: null }
        }
    }),
    Subscript.extend({ excludes: "superscript" }),
    Superscript.extend({ excludes: "subscript" }),
    Figure,
    Footnote,
    equationNode(false),
    equationNode(true)
];
