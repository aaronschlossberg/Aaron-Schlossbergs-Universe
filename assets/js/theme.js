/* Apply the saved appearance before CSS loads, then connect either header form. */
(() => {
    const storageKey = "asu:appearance";
    const root = document.documentElement;
    const deviceTheme = window.matchMedia("(prefers-color-scheme: dark)");
    const labels = { light: "Light", dark: "Dark", system: "Use device setting" };

    function validPreference(value) {
        return Object.hasOwn(labels, value) ? value : "system";
    }

    function readPreference() {
        try {
            return validPreference(window.localStorage.getItem(storageKey));
        } catch {
            return "system";
        }
    }

    let preference = readPreference();

    function updateControls() {
        document.querySelectorAll("[data-theme-option]").forEach((button) => {
            button.setAttribute("aria-pressed", String(button.dataset.themeOption === preference));
        });
        document.querySelectorAll("[data-theme-control]").forEach((control) => {
            control.hidden = false;
            const toggle = control.querySelector(".appearance-toggle");
            const description = preference === "system"
                ? `Use device setting (currently ${labels[root.dataset.theme].toLowerCase()})`
                : labels[preference];
            toggle.setAttribute("aria-label", `Appearance: ${description}`);
            toggle.setAttribute("title", `Appearance: ${description}`);
        });
    }

    function applyTheme() {
        const theme = preference === "system"
            ? (deviceTheme.matches ? "dark" : "light")
            : preference;
        root.dataset.theme = theme;
        root.dataset.themePreference = preference;
        const themeColor = document.querySelector('meta[name="theme-color"]');
        if (themeColor) {
            // Preserve the configured brand color for light mode.
            themeColor.dataset.lightColor ||= themeColor.content;
            themeColor.content = theme === "dark" ? "#19171b" : themeColor.dataset.lightColor;
        }
        updateControls();
    }

    applyTheme();
    document.addEventListener("DOMContentLoaded", applyTheme);
    document.addEventListener("asu:partials-loaded", updateControls);

    document.addEventListener("click", (event) => {
        const button = event.target.closest("[data-theme-option]");
        if (!button) return;
        preference = validPreference(button.dataset.themeOption);
        try {
            if (preference === "system") window.localStorage.removeItem(storageKey);
            else window.localStorage.setItem(storageKey, preference);
        } catch {
            // The preference still applies to this page when storage is unavailable.
        }
        applyTheme();

        const control = button.closest("[data-theme-control]");
        if (control) {
            const toggle = control.querySelector(".nav-dropdown-toggle");
            control.removeAttribute("data-open");
            toggle.setAttribute("aria-expanded", "false");
            toggle.focus();
        }
        const status = document.querySelector("[data-theme-status]");
        if (status) status.textContent = `${labels[preference]} selected. Current appearance: ${labels[root.dataset.theme]}.`;
    });

    deviceTheme.addEventListener("change", () => {
        if (preference === "system") applyTheme();
    });

    window.addEventListener("storage", (event) => {
        if (event.key !== storageKey && event.key !== null) return;
        try {
            if (event.storageArea !== window.localStorage) return;
        } catch {
            return;
        }
        preference = validPreference(event.newValue);
        applyTheme();
    });

    window.addEventListener("pageshow", (event) => {
        if (event.persisted) {
            preference = readPreference();
            applyTheme();
        }
    });
})();
