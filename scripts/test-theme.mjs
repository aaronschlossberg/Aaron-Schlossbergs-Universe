import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(new URL("../assets/js/theme.js", import.meta.url), "utf8");

function fixture({ saved = null, dark = false, blocked = false, writeBlocked = false, delayedHeader = false } = {}) {
    const handlers = new Map();
    const mediaHandlers = new Map();
    let headerPresent = !delayedHeader;
    let stored = saved;
    const root = { dataset: {} };
    const meta = { content: "#8a2f3f", dataset: {} };
    const status = {};
    const toggle = {
        focused: false,
        attributes: {},
        setAttribute(name, value) { this.attributes[name] = value; },
        focus() { this.focused = true; }
    };
    const control = { hidden: true, querySelector: () => toggle, removeAttribute() {} };
    const buttons = ["light", "dark", "system"].map(value => ({
        dataset: { themeOption: value },
        attributes: {},
        setAttribute(name, value) { this.attributes[name] = value; },
        closest(selector) { return selector === "[data-theme-option]" ? this : control; }
    }));
    function addEventListener(name, callback) {
        handlers.set(name, [...(handlers.get(name) || []), callback]);
    }
    const storage = {
        getItem() { if (blocked) throw new Error("Storage blocked"); return stored; },
        setItem(key, value) { if (blocked || writeBlocked) throw new Error("Storage blocked"); stored = value; },
        removeItem() { if (blocked || writeBlocked) throw new Error("Storage blocked"); stored = null; }
    };
    const media = {
        matches: dark,
        addEventListener(name, callback) { mediaHandlers.set(name, callback); }
    };
    const document = {
        documentElement: root,
        addEventListener,
        querySelector: selector => selector.includes("theme-color") ? meta : status,
        querySelectorAll(selector) {
            if (!headerPresent) return [];
            return {
                "[data-theme-option]": buttons,
                "[data-theme-control]": [control]
            }[selector] || [];
        }
    };
    vm.runInNewContext(source, {
        document,
        window: { matchMedia: () => media, localStorage: storage, addEventListener }
    });
    function emit(name, event = {}) {
        for (const callback of handlers.get(name) || []) callback(event);
    }
    return {
        root, meta, buttons, control, toggle, status, storage, emit,
        stored: () => stored,
        choose: value => emit("click", { target: buttons.find(button => button.dataset.themeOption === value) }),
        changeDevice(value) { media.matches = value; mediaHandlers.get("change")(); },
        injectHeader() { headerPresent = true; emit("asu:partials-loaded"); }
    };
}

test("first visit follows the device before DOMContentLoaded, without storing a preference", () => {
    const f = fixture({ dark: true });
    assert.equal(f.root.dataset.theme, "dark");
    assert.equal(f.root.dataset.themePreference, "system");
    assert.equal(f.toggle.attributes["aria-label"], "Appearance: Use device setting (currently dark)");
    assert.equal(f.stored(), null);
    assert.equal(f.meta.content, "#19171b");
    f.changeDevice(false);
    assert.equal(f.root.dataset.theme, "light");
    assert.equal(f.meta.content, "#8a2f3f");
});

test("an explicit choice persists across visits and overrides later device changes", () => {
    const f = fixture({ dark: false });
    f.choose("dark");
    f.changeDevice(true);
    f.changeDevice(false);
    assert.equal(f.root.dataset.theme, "dark");
    assert.equal(f.stored(), "dark");
    assert.equal(f.buttons[1].attributes["aria-pressed"], "true");
    assert.equal(f.toggle.attributes["aria-label"], "Appearance: Dark");
    assert.ok(f.toggle.focused);
    assert.match(f.status.textContent, /Dark selected/);
    assert.equal(fixture({ saved: f.stored(), dark: false }).root.dataset.theme, "dark");
    f.choose("light");
    assert.equal(fixture({ saved: f.stored(), dark: true }).root.dataset.theme, "light");
});

test("Use device setting clears the override and resumes following the device", () => {
    const f = fixture({ saved: "light", dark: true });
    f.choose("system");
    assert.equal(f.stored(), null);
    assert.equal(f.root.dataset.theme, "dark");
    assert.equal(f.root.dataset.themePreference, "system");
    f.changeDevice(false);
    assert.equal(f.root.dataset.theme, "light");
});

test("blocked or full storage keeps the controls and current-page theme usable", () => {
    for (const options of [{ blocked: true }, { writeBlocked: true }]) {
        const f = fixture(options);
        f.choose("dark");
        assert.equal(f.root.dataset.theme, "dark");
        assert.equal(f.stored(), null);
        assert.equal(f.control.hidden, false);
        assert.equal(f.toggle.attributes["aria-label"], "Appearance: Dark");
    }
});

test("invalid saved values fall back to the device; fetched headers receive the current selection", () => {
    const f = fixture({ saved: "unexpected", dark: true, delayedHeader: true });
    assert.equal(f.root.dataset.themePreference, "system");
    assert.equal(f.root.dataset.theme, "dark");
    assert.equal(f.control.hidden, true);
    f.injectHeader();
    assert.equal(f.control.hidden, false);
    assert.equal(f.buttons[2].attributes["aria-pressed"], "true");
    assert.equal(f.buttons[0].attributes["aria-pressed"], "false");
    assert.equal(f.toggle.attributes["aria-label"], "Appearance: Use device setting (currently dark)");
});

test("other tabs synchronize the appearance and clearing browser storage restores the device setting", () => {
    const f = fixture({ saved: "light", dark: true });
    f.emit("storage", { key: "unrelated", newValue: "dark", storageArea: f.storage });
    assert.equal(f.root.dataset.theme, "light");
    f.emit("storage", { key: "asu:appearance", newValue: "dark", storageArea: {} });
    assert.equal(f.root.dataset.theme, "light");
    f.emit("storage", { key: "asu:appearance", newValue: "dark", storageArea: f.storage });
    assert.equal(f.root.dataset.theme, "dark");
    f.emit("storage", { key: null, newValue: null, storageArea: f.storage });
    assert.equal(f.root.dataset.themePreference, "system");
    f.changeDevice(false);
    assert.equal(f.root.dataset.theme, "light");
});
