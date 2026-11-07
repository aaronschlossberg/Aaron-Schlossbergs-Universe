export function createParentPicker(field) {
    const select = field.querySelector("select");
    const search = field.querySelector("#parent-search");
    const popup = field.querySelector(".parent-popup");
    const results = field.querySelector("#parent-results");
    const empty = field.querySelector(".parent-empty");
    let activeIndex = -1;

    function highlight(index) {
        activeIndex = index;
        const active = results.children[index];
        for (const option of results.children) {
            option.setAttribute("aria-selected", String(option === active));
        }
        if (active) {
            search.setAttribute("aria-activedescendant", active.id);
            active.scrollIntoView({ block: "nearest" });
        } else {
            search.removeAttribute("aria-activedescendant");
        }
    }

    function showResults() {
        const terms = search.value.toLowerCase().trim().split(/\s+/).filter(Boolean);
        const matches = [...select.options].filter(option => {
            const label = option.text.toLowerCase();
            return !option.disabled && terms.every(term => label.includes(term));
        });
        results.replaceChildren(...matches.map((option, index) => {
            const item = document.createElement("li");
            item.id = `parent-result-${index}`;
            item.dataset.section = option.value;
            item.setAttribute("role", "option");
            item.textContent = option.text;
            return item;
        }));
        popup.hidden = false;
        results.hidden = matches.length === 0;
        empty.hidden = matches.length > 0;
        search.setAttribute("aria-expanded", String(matches.length > 0));
        highlight(terms.length && matches.length ? 0 : matches.findIndex(option => option.value === select.value));
    }

    function open() {
        search.value = "";
        showResults();
    }

    function close() {
        popup.hidden = true;
        search.setAttribute("aria-expanded", "false");
        search.removeAttribute("aria-activedescendant");
        search.value = select.selectedOptions[0]?.text ?? "";
        activeIndex = -1;
    }

    function choose(option) {
        const value = option.dataset.section;
        const changed = select.value !== value;
        select.value = value;
        close();
        search.select();
        if (changed) select.dispatchEvent(new Event("input", { bubbles: true }));
    }

    search.addEventListener("focus", open);
    search.addEventListener("click", () => {
        if (popup.hidden) open();
    });
    search.addEventListener("input", showResults);
    search.addEventListener("blur", close);

    search.addEventListener("keydown", event => {
        if (event.isComposing || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
        const { key } = event;
        if (key === "ArrowDown" || key === "ArrowUp") {
            event.preventDefault();
            const forward = key === "ArrowDown";
            if (popup.hidden) open();
            const count = results.children.length;
            if (count === 0) return;
            if (activeIndex === -1) {
                highlight(forward ? 0 : count - 1);
            } else {
                const next = activeIndex + (forward ? 1 : -1);
                highlight(Math.max(0, Math.min(next, count - 1)));
            }
        } else if (key === "Enter" && !popup.hidden && activeIndex !== -1) {
            event.preventDefault();
            choose(results.children[activeIndex]);
        } else if (key === "Escape" && !popup.hidden) {
            event.preventDefault();
            close();
            search.select();
        }
    });

    // Keep focus in the search field until the clicked option has been chosen.
    results.addEventListener("mousedown", event => {
        if (event.target.closest("[role=option]")) event.preventDefault();
    });
    results.addEventListener("click", event => {
        const option = event.target.closest("[role=option]");
        if (option) choose(option);
    });

    return {
        update(visible, locked) {
            field.hidden = !visible;
            search.disabled = locked;
            if (!visible || locked || popup.hidden) close();
        }
    };
}
