(() => {
    const main = document.querySelector(".compendium-main");
    if (!main) return;

    function normalize(text) {
        return text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
    }

    const input = main.querySelector("#compendium-search");
    if (input) {
        const tools = main.querySelector(".compendium-tools");
        const options = tools.querySelector(".compendium-filter-options");
        const count = tools.querySelector(".compendium-result-count");
        const reset = tools.querySelector(".compendium-reset");
        const entries = Array.from(main.querySelectorAll(".compendium-entry"), (entry) => {
            const tags = Array.from(entry.querySelectorAll("[data-compendium-tag]"), (tag) => tag.dataset.compendiumTag);
            return {
                entry,
                tags,
                text: normalize([entry.querySelector(".compendium-summary").textContent, entry.dataset.aliases, ...tags].join(" "))
            };
        });
        const tags = Array.from(new Set(entries.flatMap(entry => entry.tags))).sort((a, b) => a.localeCompare(b));
        const params = new URLSearchParams(window.location.search);
        const selected = new Set(params.getAll("tag").filter(tag => tags.includes(tag)));
        const buttons = [];

        for (const tag of ["All tags", ...tags]) {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "compendium-tag";
            button.textContent = tag;
            button.dataset.filterTag = tag === "All tags" ? "" : tag;
            button.addEventListener("click", () => {
                if (tag === "All tags") selected.clear();
                else if (selected.has(tag)) selected.delete(tag);
                else selected.add(tag);
                filterEntries();
            });
            buttons.push(button);
            options.append(button);
        }

        function filterEntries() {
            const terms = normalize(input.value).split(" ").filter(Boolean);
            let visible = 0;
            for (const { entry, tags, text } of entries) {
                const matchesSearch = terms.every(term => {
                    if (term.length <= 2) return (` ${text} `).includes(` ${term} `);
                    return text.includes(term);
                });
                const matches = matchesSearch
                    && (selected.size === 0 || tags.some(tag => selected.has(tag)));
                entry.hidden = !matches;
                if (matches) visible++;
            }
            for (const button of buttons) {
                const active = button.dataset.filterTag ? selected.has(button.dataset.filterTag) : selected.size === 0;
                button.setAttribute("aria-pressed", String(active));
            }
            count.textContent = visible === 0
                ? "No entries found. Try a different search or clear the tags."
                : `${visible} of ${entries.length} ${entries.length === 1 ? "entry" : "entries"}`;
            reset.hidden = input.value === "" && selected.size === 0;

            const url = new URL(window.location.href);
            url.searchParams.delete("tag");
            for (const tag of tags.filter(tag => selected.has(tag))) url.searchParams.append("tag", tag);
            window.history.replaceState(null, "", url);
        }

        function revealFragment() {
            const target = entries.find(({ entry }) => `#${entry.id}` === window.location.hash)?.entry;
            if (target?.hidden) {
                input.value = "";
                selected.clear();
                filterEntries();
                target.scrollIntoView();
            }
        }

        input.addEventListener("input", filterEntries);
        reset.addEventListener("click", () => {
            input.value = "";
            selected.clear();
            filterEntries();
            input.focus();
        });
        window.addEventListener("hashchange", revealFragment);
        window.addEventListener("pageshow", () => {
            filterEntries();
            revealFragment();
        });
        filterEntries();
        tools.hidden = false;
        revealFragment();
    }

    const dialog = main.querySelector(".compendium-share-dialog");
    if (!dialog || typeof dialog.showModal !== "function") return;

    const title = dialog.querySelector("#compendium-share-title");
    const urlField = dialog.querySelector("#compendium-share-url");
    const copy = dialog.querySelector("[data-compendium-copy]");
    const status = dialog.querySelector(".compendium-share-status");
    const canonical = document.querySelector('link[rel="canonical"]')?.href || window.location.href;

    for (const trigger of main.querySelectorAll("[data-compendium-share]")) {
        trigger.hidden = false;
        trigger.addEventListener("click", () => {
            title.textContent = `Share ${trigger.dataset.shareTerm}`;
            urlField.value = new URL(trigger.dataset.compendiumShare, canonical).href;
            status.textContent = "";
            dialog.showModal();
        });
    }
    urlField.addEventListener("click", () => urlField.select());
    copy.addEventListener("click", async () => {
        const url = urlField.value;
        try {
            await navigator.clipboard.writeText(url);
            if (dialog.open && urlField.value === url) status.textContent = "Link copied.";
        } catch {
            if (!dialog.open || urlField.value !== url) return;
            urlField.focus();
            urlField.select();
            status.textContent = "Select and copy the link above.";
        }
    });
})();
