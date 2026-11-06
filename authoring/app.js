import { Editor } from "@tiptap/core";
import { FileHandler } from "@tiptap/extension-file-handler";
import { EditorState } from "@tiptap/pm/state";
import {
    IMAGE_LIMIT, TYPES, editorExtensions, emptyBody, mathHtml, routeFor, safeHref, sectionPath, slugify
} from "./editor-schema.mjs";
import { createParentPicker } from "./parent-picker.js";

const byId = id => document.getElementById(id);
const fields = byId("page-fields").elements;
const parentPicker = createParentPicker(byId("section-field"));
const insertFields = byId("insert-form").elements;
const insertDialog = byId("insert-dialog");
const previewDialog = byId("preview-dialog");
const statuses = { draft: "Draft", prepared: "Prepared", revision: "Revised draft" };
const actions = ["new-draft", "save-draft", "preview-page", "prepare-page", "delete-draft"].map(byId);

let active;
let library = [];
let dirty = false;
let changeNumber = 0;
let slugEdited = false;
let busy = false;
let inserting = false;
let pendingInsert;

const specialNodes = {
    studioFigure: "image",
    studioFootnote: "footnote",
    studioInlineMath: "equation",
    studioDisplayMath: "equation"
};
const insertLabels = { link: "link", image: "image", footnote: "footnote", equation: "equation" };

const editor = new Editor({
    element: byId("editor"),
    extensions: [
        ...editorExtensions,
        FileHandler.configure({
            allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
            onPaste: (_editor, files) => openInsert("image", { file: files[0] }),
            onDrop: (_editor, files, pos) => openInsert("image", { file: files[0], pos })
        })
    ],
    content: emptyBody,
    enableContentCheck: true,
    editorProps: {
        attributes: { "aria-label": "Page body", role: "textbox", "aria-multiline": "true" },
        handleDoubleClickOn(_view, _pos, node, nodePos, _event, direct) {
            const kind = specialNodes[node.type.name];
            if (!direct || !kind) return false;
            openInsert(kind, { node, pos: nodePos });
            return true;
        }
    },
    onUpdate({ editor }) {
        markDirty();
        updateWordCount(editor);
    },
    onTransaction({ editor }) {
        updateToolbar(editor);
    }
});

function blankState() {
    return {
        document: {
            id: crypto.randomUUID(), type: "writing", section: "root", title: "", subtitle: "",
            slug: "", description: "", context: "", date: "", writingType: "Essay", tags: "",
            entityType: "", aliases: "", relatedTerms: "", relatedLinks: "", body: emptyBody
        },
        revision: null,
        status: "draft",
        route: ""
    };
}

async function request(url, { method = "GET", body } = {}) {
    const headers = { "X-ASU-Editor": "1" };
    if (body && !(body instanceof Blob)) {
        headers["Content-Type"] = "application/json";
        body = JSON.stringify(body);
    }
    const response = await fetch(url, { method, headers, body });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message);
    return result;
}

function showStatus(message, tone = "") {
    byId("status").textContent = message;
    byId("status").dataset.tone = tone;
}

function markDirty() {
    if (!active) return;
    changeNumber++;
    if (!dirty) showStatus("Unsaved changes.");
    dirty = true;
    updatePageDetails();
}

function updateWordCount(instance) {
    const text = instance.getText().trim();
    const words = text ? text.split(/\s+/).length : 0;
    byId("word-count").textContent = `${words.toLocaleString()} ${words === 1 ? "word" : "words"}`;
}

function updatePageDetails() {
    const type = fields.type.value;
    const isInfo = type === "info";
    parentPicker.update(type === "page", Boolean(active.route));
    byId("date-field").hidden = type === "page";
    byId("writing-type-field").hidden = type !== "writing";
    byId("context-field").hidden = type !== "writing";
    byId("tags-field").hidden = type === "page";
    for (const id of ["entity-field", "aliases-field", "terms-field", "related-field"]) {
        byId(id).hidden = !isInfo;
    }
    byId("tags-label").textContent = isInfo ? "Topics" : "Tags";
    fields.type.disabled = fields.section.disabled = fields.slug.disabled = Boolean(active.route);
    byId("address").textContent = fields.slug.value
        ? routeFor({ type, section: fields.section.value, slug: fields.slug.value })
        : "Your page address will appear here.";
    const label = active.revision ? statuses[active.status] : "New draft";
    byId("document-state").textContent = dirty ? `${label} · Unsaved changes` : label;
    byId("delete-draft").hidden = !active.revision || active.status === "prepared";
}

function showDocument(state) {
    const body = editor.schema.nodeFromJSON(state.document.body);
    body.check();
    editor.view.updateState(EditorState.create({ doc: body, plugins: editor.state.plugins }));
    active = state;
    dirty = false;
    slugEdited = Boolean(state.document.slug && state.document.slug !== slugify(state.document.title));
    const { section } = state.document;
    if (!Array.from(fields.section.options).some(option => option.value === section)) {
        const unavailable = new Option(`${sectionPath(section)} (unavailable)`, section);
        unavailable.disabled = true;
        fields.section.add(unavailable);
    }
    for (const [key, value] of Object.entries(state.document)) {
        if (fields.namedItem(key)) fields.namedItem(key).value = value;
    }
    updatePageDetails();
    updateWordCount(editor);
    updateToolbar(editor);
    renderLibrary();
}

function snapshot() {
    const document = { id: active.document.id };
    for (const field of fields) {
        if (field.name) document[field.name] = field.value;
    }
    document.body = editor.getJSON();
    return document;
}

function renderLibrary() {
    byId("library-empty").hidden = Boolean(library.length);
    const rows = library.map(item => {
        const row = document.createElement("li");
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.documentId = item.id;
        button.disabled = busy;
        if (item.id === active.document.id) button.setAttribute("aria-current", "true");
        const title = document.createElement("span");
        title.textContent = item.title || "Untitled draft";
        const label = document.createElement("small");
        label.textContent = `${TYPES[item.type]} · ${statuses[item.status]}`;
        button.append(title, label);
        row.append(button);
        return row;
    });
    byId("documents").replaceChildren(...rows);
}

async function refreshLibrary() {
    library = await request("/api/documents");
    renderLibrary();
}

function setBusy(value) {
    busy = value;
    for (const button of actions) button.disabled = value;
    for (const button of byId("documents").querySelectorAll("button")) button.disabled = value;
}

async function run(action) {
    if (busy) return;
    setBusy(true);
    try {
        await action();
    } catch (error) {
        showStatus(error.message, "error");
    } finally {
        setBusy(false);
    }
}

async function saveCurrent() {
    const snapshotNumber = changeNumber;
    const result = await request(`/api/documents/${active.document.id}`, {
        method: "PUT",
        body: { document: snapshot(), revision: active.revision }
    });
    active = result;
    dirty = snapshotNumber !== changeNumber;
    updatePageDetails();
    await refreshLibrary();
    return result;
}

function allowSwitch() {
    return !dirty || window.confirm("Leave this page and discard its unsaved changes?");
}

byId("page-fields").addEventListener("input", event => {
    if (!event.target.name) return;
    if (event.target === fields.slug) slugEdited = Boolean(fields.slug.value);
    if (event.target === fields.title && !slugEdited && !active.route) fields.slug.value = slugify(fields.title.value);
    if (event.target === fields.type && fields.type.value === "info") byId("settings").open = true;
    markDirty();
});
byId("page-fields").addEventListener("submit", event => event.preventDefault());

byId("new-draft").addEventListener("click", () => {
    if (!allowSwitch()) return;
    showDocument(blankState());
    byId("settings").open = false;
    showStatus("Pick a page type and start writing.");
    fields.title.focus();
});

byId("documents").addEventListener("click", event => {
    const button = event.target.closest("[data-document-id]");
    if (!button || button.dataset.documentId === active.document.id || !allowSwitch()) return;
    run(async () => {
        showDocument(await request(`/api/documents/${button.dataset.documentId}`));
        byId("settings").open = fields.type.value === "info";
        showStatus(active.route ? "Opened saved page. Edit here to prepare a new revision." : "Opened saved draft.");
    });
});

byId("save-draft").addEventListener("click", () => run(async () => {
    await saveCurrent();
    showStatus(dirty ? "Draft saved. Newer edits are still unsaved." : "Draft saved on this computer.", "success");
}));

byId("delete-draft").addEventListener("click", () => {
    const title = active.document.title || "Untitled draft";
    const prompt = active.route
        ? `Delete the draft of “${title}” and reopen the last prepared version?`
        : `Delete the draft “${title}” from this computer?`;
    if (!window.confirm(prompt)) return;
    run(async () => {
        const prepared = await request(`/api/documents/${active.document.id}`, {
            method: "DELETE",
            body: { revision: active.revision }
        });
        showDocument(prepared || blankState());
        byId("settings").open = fields.type.value === "info";
        await refreshLibrary();
        showStatus(prepared ? "Draft deleted. Reopened the last prepared version." : "Draft deleted.", "success");
        fields.title.focus();
    });
});

byId("preview-page").addEventListener("click", () => run(async () => {
    const saved = await saveCurrent();
    byId("preview-frame").src = `/preview/${saved.document.id}`;
    previewDialog.showModal();
    showStatus(dirty ? "Preview opened for the last saved draft." : "Draft saved and preview opened.", "success");
}));

byId("prepare-page").addEventListener("click", () => run(async () => {
    showStatus("Saving and preparing your page…");
    const snapshotNumber = changeNumber;
    const saved = await saveCurrent();
    const result = await request(`/api/documents/${saved.document.id}/prepare`, {
        method: "POST",
        body: { revision: saved.revision }
    });
    if (snapshotNumber === changeNumber) {
        showDocument(result);
    } else {
        active = result;
        for (const key of ["type", "section", "slug"]) fields[key].value = result.document[key];
        updatePageDetails();
    }
    await refreshLibrary();
    showStatus(dirty
        ? "The saved version is prepared. Save and prepare again to include your newer edits."
        : `Prepared ${result.route} Run npm run build, then review your changes in Git.`, "success");
}));

byId("close-preview").addEventListener("click", () => previewDialog.close());
previewDialog.addEventListener("close", () => byId("preview-frame").removeAttribute("src"));
for (const button of previewDialog.querySelectorAll("[data-preview-size]")) {
    button.addEventListener("click", () => {
        previewDialog.dataset.size = button.dataset.previewSize;
        for (const choice of previewDialog.querySelectorAll("[data-preview-size]")) {
            choice.setAttribute("aria-pressed", String(choice === button));
        }
    });
}

const commands = {
    bold: chain => chain.toggleBold(),
    italic: chain => chain.toggleItalic(),
    underline: chain => chain.toggleUnderline(),
    strike: chain => chain.toggleStrike(),
    subscript: chain => chain.unsetSuperscript().toggleSubscript(),
    superscript: chain => chain.unsetSubscript().toggleSuperscript(),
    bulletList: chain => chain.toggleBulletList(),
    orderedList: chain => chain.toggleOrderedList(),
    blockquote: chain => chain.toggleBlockquote(),
    codeBlock: chain => chain.toggleCodeBlock(),
    divider: chain => chain.setHorizontalRule(),
    undo: chain => chain.undo(),
    redo: chain => chain.redo()
};

function updateToolbar(instance) {
    for (const button of byId("toolbar").querySelectorAll("[aria-pressed][data-command]")) {
        button.setAttribute("aria-pressed", String(instance.isActive(button.dataset.command)));
    }
    byId("block-style").value = instance.getAttributes("heading").level || "paragraph";
}

byId("toolbar").addEventListener("click", event => {
    const button = event.target.closest("button");
    if (!button) return;
    const { command, insert } = button.dataset;
    if (command) commands[command](editor.chain().focus()).run();
    if (insert) {
        const { node, from } = editor.state.selection;
        openInsert(insert, specialNodes[node?.type.name] === insert ? { node, pos: from } : {});
    }
});

byId("block-style").addEventListener("change", event => {
    const chain = editor.chain().focus();
    const style = event.target.value;
    if (style === "paragraph") chain.setParagraph().run();
    else chain.setHeading({ level: Number(style) }).run();
});

function openInsert(kind, { node, pos, file } = {}) {
    if (insertDialog.open) return;
    const { from, to } = editor.state.selection;
    const isLink = kind === "link" && editor.isActive("link");
    pendingInsert = { kind, node, pos, file, from, to, isLink };
    byId("insert-form").reset();
    byId("insert-error").textContent = "";
    byId("chosen-file").textContent = file?.name || (node?.attrs.file ? "Keep the current file, or choose a replacement." : "JPG, PNG, WebP, or GIF up to 10 MB.");
    for (const panel of insertDialog.querySelectorAll("[data-fields]")) panel.hidden = panel.dataset.fields !== kind;
    for (const [key, value] of Object.entries(node?.attrs || {})) {
        if (key !== "file" && insertFields.namedItem(key)) insertFields.namedItem(key).value = value;
    }
    insertFields.href.value = isLink ? editor.getAttributes("link").href : "";
    insertFields.display.checked = node?.type.name === "studioDisplayMath";
    const editing = Boolean(node || isLink);
    byId("remove-insert").hidden = !editing;
    byId("insert-title").textContent = `${editing ? "Edit" : "Insert"} ${insertLabels[kind]}`;
    byId("submit-insert").textContent = editing ? "Apply" : "Insert";
    updateEquationExample();
    insertDialog.showModal();
    const first = insertDialog.querySelector("[data-fields]:not([hidden]) input, [data-fields]:not([hidden]) textarea");
    first?.focus();
}

function updateEquationExample() {
    const example = byId("equation-example");
    const formula = insertFields.latex.value.trim();
    example.replaceChildren();
    if (!formula) return;
    try {
        example.innerHTML = mathHtml(formula, insertFields.display.checked);
    } catch {
        example.textContent = "Waiting for valid LaTeX…";
    }
}

function requireHref(value) {
    const href = safeHref(value.trim());
    if (!href) throw new Error("Enter a valid URL, site path, or #section.");
    return href;
}

async function nodeToInsert({ kind, node, file }) {
    if (kind === "image") {
        const alt = insertFields.alt.value.trim();
        if (!alt) throw new Error("Describe the image in the alt text field.");
        const chosen = insertFields.file.files[0] || file;
        if (!chosen && !node) throw new Error("Choose an image file.");
        if (chosen?.size > IMAGE_LIMIT) throw new Error("Choose an image under 10 MB.");
        const stored = chosen ? (await request("/api/media", { method: "POST", body: chosen })).file : node.attrs.file;
        return { type: "studioFigure", attrs: { file: stored, alt, caption: insertFields.caption.value.trim() } };
    }
    if (kind === "footnote") {
        const note = insertFields.note.value.trim();
        const source = insertFields.source.value.trim();
        if (!note) throw new Error("Write the footnote before inserting it.");
        return { type: "studioFootnote", attrs: { note, source: source ? requireHref(source) : "" } };
    }
    const latex = insertFields.latex.value.trim();
    const display = insertFields.display.checked;
    if (!latex) throw new Error("Enter a LaTeX equation.");
    mathHtml(latex, display);
    return { type: display ? "studioDisplayMath" : "studioInlineMath", attrs: { latex } };
}

function rangeForInsert({ kind, node, pos, from, to }) {
    if (node) return { from: pos, to: pos + node.nodeSize };
    if (kind === "footnote") return to;
    return pos ?? { from, to };
}

byId("insert-form").addEventListener("submit", async event => {
    event.preventDefault();
    if (inserting) return;
    inserting = true;
    byId("submit-insert").disabled = true;
    byId("cancel-insert").disabled = true;
    byId("remove-insert").disabled = true;
    const pending = pendingInsert;
    try {
        if (pending.kind === "link") {
            const href = requireHref(insertFields.href.value);
            insertDialog.close();
            const chain = editor.chain().focus();
            if (pending.isLink || pending.from !== pending.to) chain.extendMarkRange("link").setLink({ href }).run();
            else chain.insertContent({
                type: "text",
                text: href,
                marks: [{ type: "link", attrs: { href } }]
            }).run();
        } else {
            const node = await nodeToInsert(pending);
            insertDialog.close();
            editor.chain().focus().insertContentAt(rangeForInsert(pending), node).run();
        }
    } catch (error) {
        byId("insert-error").textContent = error.message;
    } finally {
        inserting = false;
        byId("submit-insert").disabled = false;
        byId("cancel-insert").disabled = false;
        byId("remove-insert").disabled = false;
    }
});

byId("remove-insert").addEventListener("click", () => {
    insertDialog.close();
    const chain = editor.chain().focus();
    if (pendingInsert.kind === "link") chain.extendMarkRange("link").unsetLink().run();
    else chain.deleteRange(rangeForInsert(pendingInsert)).run();
});
byId("cancel-insert").addEventListener("click", () => insertDialog.close());
insertDialog.addEventListener("cancel", event => {
    if (inserting) event.preventDefault();
});
insertFields.latex.addEventListener("input", updateEquationExample);
insertFields.display.addEventListener("change", updateEquationExample);

window.addEventListener("keydown", event => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (!insertDialog.open && !previewDialog.open) byId("save-draft").click();
    }
});
window.addEventListener("beforeunload", event => {
    if (dirty) event.preventDefault();
});

showDocument(blankState());
refreshLibrary().catch(error => showStatus(error.message, "error"));
