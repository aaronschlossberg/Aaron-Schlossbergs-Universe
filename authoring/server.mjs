import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import sharp from "sharp";
import { StudioError, escape, renderPage } from "./documents.mjs";
import { DOCUMENT_ID, IMAGE_LIMIT } from "./editor-schema.mjs";
import {
    deleteDraft, getDocument, listDocuments, listPageParents, preparePublication, readImage, recoverPublication,
    saveDraft, saveImage
} from "./repository.mjs";

const root = path.resolve(fileURLToPath(new URL("../", import.meta.url)));
const host = "127.0.0.1";
const port = 4175;
const origin = `http://${host}:${port}`;
const mime = {
    ".css": "text/css; charset=utf-8",
    ".gif": "image/gif",
    ".ico": "image/x-icon",
    ".jpeg": "image/jpeg",
    ".jpg": "image/jpeg",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".webp": "image/webp",
    ".woff2": "font/woff2"
};

const [bundle, index, css] = await Promise.all([
    build({
        entryPoints: [path.join(root, "authoring", "app.js")],
        bundle: true,
        format: "esm",
        target: ["es2022"],
        write: false
    }).then(result => result.outputFiles[0].contents),
    readFile(path.join(root, "authoring", "index.html"), "utf8"),
    readFile(path.join(root, "authoring", "studio.css"))
]);

let mutations = Promise.resolve();
let startup = Promise.resolve();

function writeSerially(action) {
    const next = mutations.then(action);
    mutations = next.catch(() => {});
    return next;
}

function send(response, status, type, content) {
    response.writeHead(status, {
        "Content-Type": type,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "Cross-Origin-Resource-Policy": "same-origin",
        "Referrer-Policy": "no-referrer",
        "Content-Security-Policy": "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'self'; form-action 'none'; base-uri 'none'"
    });
    response.end(content);
}

function sendJson(response, status, content) {
    send(response, status, "application/json; charset=utf-8", JSON.stringify(content));
}

async function bytes(request, limit) {
    if (Number(request.headers["content-length"]) > limit) {
        throw new StudioError("This file or draft exceeds the upload limit.", 413);
    }
    const chunks = [];
    let length = 0;
    for await (const chunk of request) {
        length += chunk.length;
        if (length > limit) throw new StudioError("This file or draft exceeds the upload limit.", 413);
        chunks.push(chunk);
    }
    return Buffer.concat(chunks);
}

async function jsonBody(request) {
    if (request.headers["content-type"]?.split(";")[0] !== "application/json") {
        throw new StudioError("Expected a JSON request.", 415);
    }
    const buffer = await bytes(request, 4 * 1024 * 1024);
    try {
        return JSON.parse(buffer);
    } catch {
        throw new StudioError("The request has invalid JSON.");
    }
}

async function upload(request) {
    const contents = await bytes(request, IMAGE_LIMIT);
    let metadata;
    try {
        metadata = await sharp(contents, { limitInputPixels: 40_000_000 }).metadata();
    } catch {
        throw new StudioError("That image could not be read. Choose a JPG, PNG, WebP, or GIF.");
    }
    const extension = { jpeg: "jpg", png: "png", webp: "webp", gif: "gif" }[metadata.format];
    if (!extension) throw new StudioError("Choose a JPG, PNG, WebP, or GIF image.");
    return { file: await saveImage(root, contents, extension) };
}

async function preview(id) {
    const draft = await getDocument(root, id);
    if (!draft) throw new StudioError("Save this draft before previewing it.", 404);
    const [config, pages, header, footer] = await Promise.all([
        readFile(path.join(root, "data/config.json"), "utf8").then(JSON.parse),
        readFile(path.join(root, "data/pages.json"), "utf8").then(JSON.parse),
        readFile(path.join(root, "_partials/header.html"), "utf8"),
        readFile(path.join(root, "_partials/footer.html"), "utf8")
    ]);
    return renderPage(draft.document, { config, pages, preview: true, header, footer }).html;
}

async function getStatic(pathname, response) {
    if (pathname === "/") {
        const parents = await listPageParents(root);
        const options = parents.map(({ section, label }) =>
            `<option value="${escape(section)}">${escape(label)}</option>`
        ).join("\n");
        return send(response, 200, "text/html; charset=utf-8",
            index.replace("<!-- parent-page-options -->", () => options));
    }
    if (pathname === "/studio.css") return send(response, 200, mime[".css"], css);
    if (pathname === "/studio.js") return send(response, 200, "text/javascript; charset=utf-8", bundle);
    if (pathname.startsWith("/media/")) {
        const file = pathname.slice("/media/".length);
        const image = await readImage(root, file);
        if (image) return send(response, 200, mime[path.extname(file)], image);
    }
    if (pathname.startsWith("/assets/") || pathname === "/favicon.ico") {
        const assets = path.join(root, "assets") + path.sep;
        const target = path.resolve(root, "." + pathname);
        const type = mime[path.extname(target).toLowerCase()];
        if ((target.startsWith(assets) || target === path.join(root, "favicon.ico")) && type) {
            try {
                return send(response, 200, type, await readFile(target));
            } catch (error) {
                if (error.code !== "ENOENT") throw error;
            }
        }
    }
    throw new StudioError("This address is unavailable in the local editor.", 404);
}

async function handle(request, response) {
    if (request.headers.host !== `${host}:${port}`) {
        throw new StudioError(`Open the editor at ${origin}.`, 403);
    }
    const { method } = request;
    if (method !== "GET" && (request.headers.origin !== origin || request.headers["x-asu-editor"] !== "1")) {
        throw new StudioError("Write requests must come from the local editor.", 403);
    }
    const pathname = decodeURIComponent(new URL(request.url, origin).pathname);
    if (pathname === "/api/documents" && method === "GET") {
        return sendJson(response, 200, await listDocuments(root));
    }
    if (pathname === "/api/media" && method === "POST") {
        return sendJson(response, 201, await upload(request));
    }
    const [, id, action] = pathname.match(/^\/api\/documents\/([^/]+)(\/prepare)?$/) || [];
    if (id && DOCUMENT_ID.test(id)) {
        if (method === "GET" && !action) {
            const draft = await getDocument(root, id);
            if (!draft) throw new StudioError("This draft could not be found.", 404);
            return sendJson(response, 200, draft);
        }
        if (method === "PUT" && !action) {
            const { document, revision } = await jsonBody(request) || {};
            const result = await writeSerially(() => saveDraft(root, id, document, revision));
            return sendJson(response, 200, result);
        }
        if (method === "DELETE" && !action) {
            const { revision } = await jsonBody(request) || {};
            const result = await writeSerially(() => deleteDraft(root, id, revision));
            return sendJson(response, 200, result);
        }
        if (method === "POST" && action) {
            const { revision } = await jsonBody(request) || {};
            const result = await writeSerially(() => preparePublication(root, id, revision));
            return sendJson(response, 200, result);
        }
    }
    if (method === "GET" && pathname.startsWith("/preview/")) {
        const previewId = pathname.slice("/preview/".length);
        if (DOCUMENT_ID.test(previewId)) {
            return send(response, 200, "text/html; charset=utf-8", await preview(previewId));
        }
    }
    if (method === "GET") return getStatic(pathname, response);
    throw new StudioError("This editor action is unavailable.", 404);
}

const server = createServer((request, response) => {
    startup.then(() => handle(request, response)).catch(error => {
        if (!error.status) console.error(error);
        sendJson(response, error.status || 500, {
            message: error.status ? error.message : "The editor encountered a file error. See the terminal for details."
        });
    });
});
await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, resolve);
});
startup = recoverPublication(root);
try {
    await startup;
} catch (error) {
    server.close();
    throw error;
}
console.log(`\nSite Desk is ready at ${origin}\nPress Ctrl+C in this terminal to stop it.\n`);
