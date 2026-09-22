(() => {
    "use strict";

    const DATA_URL = "/assets/data/favorite-quotes.json";

    const ITALIC_SOURCE_TYPES = new Set([
        "book",
        "film",
        "play",
        "poem",
        "song",
        "speech",
        "television",
        "video-game"
    ]);

    const root = document.querySelector(".favorite-quotes-page");
    if (!root) return;

    const elements = {
        featured: document.querySelector("[data-featured-quotes]"),
        controls: document.querySelector("[data-quote-controls]"),
        search: document.querySelector("[data-quote-search]"),
        clearSearch: document.querySelector("[data-clear-search]"),
        filters: Array.from(document.querySelectorAll("[data-filter]")),
        sort: document.querySelector("[data-quote-sort]"),
        featuredOnly: document.querySelector("[data-featured-only]"),
        resets: Array.from(document.querySelectorAll("[data-reset-filters]")),
        results: document.querySelector("[data-quote-results]"),
        count: document.querySelector("[data-results-count]"),
        empty: document.querySelector("[data-empty-state]"),
        copyResultsLink: document.querySelector("[data-copy-results-link]"),
        context: document.querySelector("[data-context-visual]"),
        contextImage: document.querySelector("[data-context-image]"),
        contextKicker: document.querySelector("[data-context-kicker]"),
        contextTitle: document.querySelector("[data-context-title]"),
        contextCaption: document.querySelector("[data-context-caption]"),
        contextCredit: document.querySelector("[data-context-credit]")
    };

    const state = {
        data: null,
        q: "",
        sourceType: "",
        origin: "",
        format: "",
        theme: "",
        collection: "",
        sort: "original",
        featured: false
    };

    const labelize = (value) => String(value || "")
        .replace(/[-_]+/g, " ")
        .replace(/\b\w/g, (letter) => letter.toUpperCase());

    const normalize = (value) => String(value || "")
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLocaleLowerCase()
        .replace(/[“”„‟]/g, "\"")
        .replace(/[‘’]/g, "'")
        .replace(/\s+/g, " ")
        .trim();

    const element = (tag, className, text) => {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    };

    const uniqueSorted = (values) => Array.from(new Set(values.filter(Boolean)))
        .sort((a, b) => a.localeCompare(b));

    const quoteText = (quote) => quote.kind === "dialogue"
        ? (quote.lines || []).map((line) => `${line.speaker} ${line.text}`).join(" ")
        : quote.text || "";

    const sourceTitle = (quote) => quote.source?.title || "";
    const speakerName = (quote) => quote.attribution?.speaker || "";

    const originsFor = (quote) => {
        const origins = [];
        if (sourceTitle(quote)) origins.push(`work:${sourceTitle(quote)}`);
        if (speakerName(quote)) origins.push(`speaker:${speakerName(quote)}`);
        for (const line of quote.lines || []) {
            if (line.speaker) origins.push(`speaker:${line.speaker}`);
        }
        return origins;
    };

    const searchableText = (quote) => normalize([
        quoteText(quote),
        speakerName(quote),
        quote.attribution?.performer,
        sourceTitle(quote),
        quote.source?.creator,
        quote.source?.location,
        quote.source?.type,
        quote.format,
        ...(quote.themes || []),
        ...(quote.tones || []),
        ...(quote.collections || []),
        quote.note,
        quote.rawAttribution
    ].filter(Boolean).join(" "));

    const appendQuotedText = (container, text) => {
        container.append(
            element("span", "favorite-quote-card__mark", "“"),
            element("span", "italic-text", text),
            element("span", "favorite-quote-card__mark", "”")
        );
    };

    const isExternalUrl = (url) => {
        if (!url) return false;

        try {
            return new URL(url, window.location.origin).origin
                !== window.location.origin;
        } catch {
            return false;
        }
    };

    const appendLinkedText = (
        container,
        text,
        url,
        className = ""
    ) => {
        if (!text) return;

        const node = element(
            url ? "a" : "span",
            className,
            text
        );

        if (url) {
            node.href = url;

            /*
            * ASU links stay in the current tab.
            * Outside websites open in a new tab.
            */
            if (isExternalUrl(url)) {
                node.target = "_blank";
                node.rel = "noopener noreferrer";
            }
        }

        container.append(node);
    };

    const appendDivider = (container) => {
        container.append(document.createTextNode(" · "));
    };

    const visualForQuote = (quote) => {
        if (!quote.visualId) return null;
        return state.data.visuals?.[quote.visualId] || null;
    };

    const createSourceLine = (quote) => {
        const source = quote.source || {};

        const hasContent =
            source.type ||
            source.title ||
            source.creator ||
            source.year ||
            source.location ||
            source.relatedName;

        if (!hasContent) return null;

        const paragraph = element(
            "p",
            "favorite-quote-card__source"
        );

        let hasPart = false;

        const startPart = () => {
            if (hasPart) appendDivider(paragraph);
            hasPart = true;
        };

        /*
        * Example:
        * Film
        */
        if (source.type) {
            startPart();
            paragraph.append(
                document.createTextNode(labelize(source.type))
            );
        }

        /*
        * Named works are italicized.
        *
        * A film becomes:
        * Film · Pokémon: The First Movie (1998)
        *
        * Only the title is italicized; the year is not.
        */
        if (source.title) {
            startPart();

            const titleClasses = [
                ITALIC_SOURCE_TYPES.has(source.type)
                    ? "italic-text"
                    : "",
                source.url
                    ? "underlined-text"
                    : ""
            ].filter(Boolean).join(" ");

            appendLinkedText(
                paragraph,
                source.title,
                source.url,
                titleClasses
            );

            if (source.type === "film" && source.year) {
                paragraph.append(
                    document.createTextNode(` (${source.year})`)
                );
            }
        }

        /*
        * Creators receive their own independent links.
        */
        if (source.creator) {
            startPart();

            appendLinkedText(
                paragraph,
                source.creator,
                source.creatorUrl,
                source.creatorUrl
                    ? "underlined-text"
                    : ""
            );
        }

        /*
        * Non-film years remain their own source part.
        * Film years were already placed in parentheses.
        */
        if (source.year && source.type !== "film") {
            startPart();

            paragraph.append(
                document.createTextNode(String(source.year))
            );
        }

        /*
        * location can be an episode, chapter, website,
        * speech location, or other source detail.
        */
        if (source.location) {
            startPart();

            appendLinkedText(
                paragraph,
                source.location,
                source.locationUrl,
                source.locationUrl
                    ? "underlined-text"
                    : ""
            );
        }

        /*
        * relatedLabel/relatedName supports details such as:
        * Adapted from Arthur O’Shaughnessy
        *
        * The label remains plain text while the person's
        * name can have its own link.
        */
        if (source.relatedName) {
            startPart();

            if (source.relatedLabel) {
                paragraph.append(
                    document.createTextNode(
                        `${source.relatedLabel} `
                    )
                );
            }

            appendLinkedText(
                paragraph,
                source.relatedName,
                source.relatedUrl,
                source.relatedUrl
                    ? "underlined-text"
                    : ""
            );
        }

        return paragraph;
    };

    const copyText = async (text, button, successLabel) => {
        const original = button.textContent;
        try {
            await navigator.clipboard.writeText(text);
            button.textContent = successLabel;
        } catch {
            button.textContent = "Copy failed";
        }
        window.setTimeout(() => {
            button.textContent = original;
        }, 1800);
    };

    const createCard = (quote, options = {}) => {
        const card = element("article", "favorite-quote-card");
        card.id = `quote-${quote.id}`;
        card.dataset.quoteId = quote.id;

        const visual = visualForQuote(quote);
        if (visual && quote.showVisualOnCard) {
            const image = element("img", "favorite-quote-card__image");
            image.src = visual.src;
            image.alt = visual.alt || "";
            image.loading = "lazy";
            image.decoding = "async";
            image.addEventListener(
                "error",
                () => image.remove(),
                { once: true }
            );

            image.addEventListener(
                "load",
                () => queueMasonryLayout(card.parentElement),
                { once: true }
            );

            card.append(image);
        }

        const blockquote = document.createElement("blockquote");

        if (quote.kind === "dialogue") {
            const dialogue = element("div", "favorite-quote-card__dialogue");
            for (const line of quote.lines || []) {
                const paragraph = element(
                    "p",
                    "favorite-quote-card__dialogue-line"
                );

                const speaker = element(
                    "strong",
                    "favorite-quote-card__speaker"
                );

                appendLinkedText(
                    speaker,
                    line.speaker,
                    line.speakerUrl,
                    line.speakerUrl
                        ? "underlined-text"
                        : ""
                );

                speaker.append(
                    document.createTextNode(": ")
                );

                paragraph.append(speaker);
                appendQuotedText(paragraph, line.text);
                dialogue.append(paragraph);
            }
            blockquote.append(dialogue);
        } else {
            const paragraph = element("p", "favorite-quote-card__text");
            appendQuotedText(paragraph, quote.text || "");
            blockquote.append(paragraph);
        }

        card.append(blockquote);

        if (quote.kind !== "dialogue" && speakerName(quote)) {
            const attribution = element(
                "p",
                "favorite-quote-card__attribution"
            );

            /*
            * There is deliberately no space after the em dash.
            * Output: —Mewtwo
            */
            attribution.append(
                document.createTextNode("—")
            );

            appendLinkedText(
                attribution,
                speakerName(quote),
                quote.attribution?.url,
                quote.attribution?.url
                    ? "underlined-text"
                    : ""
            );

            if (quote.attribution?.performer) {
                attribution.append(
                    document.createTextNode(" (")
                );

                appendLinkedText(
                    attribution,
                    quote.attribution.performer,
                    quote.attribution.performerUrl,
                    quote.attribution.performerUrl
                        ? "underlined-text"
                        : ""
                );

                attribution.append(
                    document.createTextNode(")")
                );
            }

            card.append(attribution);
        }

        const sourceLine = createSourceLine(quote);
        if (sourceLine) card.append(sourceLine);

        if (quote.note) {
            const note = element("p", "favorite-quote-card__note");
            note.append(element("strong", "", "Why I saved it: "));
            note.append(document.createTextNode(quote.note));
            card.append(note);
        }

        const visibleTags = uniqueSorted([
            ...(quote.themes || []),
            ...(quote.tones || [])
        ]).slice(0, 5);

        if (visibleTags.length) {
            const list = element("ul", "favorite-quote-card__tags");
            list.setAttribute("aria-label", "Quote themes and tones");
            for (const tag of visibleTags) list.append(element("li", "", labelize(tag)));
            card.append(list);
        }

        if (!options.featuredPreview) {
            const actions = element("div", "favorite-quote-card__actions");
            const copyButton = element("button", "favorite-quote-card__link", "Copy quote link");
            copyButton.type = "button";
            copyButton.addEventListener("click", () => {
                const url = new URL(window.location.href);
                url.hash = `quote-${quote.id}`;
                copyText(url.href, copyButton, "Link copied");
            });
            actions.append(copyButton);
            card.append(actions);
        }

        return card;
    };

    const addOptions = (
        select,
        values,
        formatter = labelize
    ) => {
        const counts = new Map();

        for (const value of values.filter(Boolean)) {
            counts.set(
                value,
                (counts.get(value) || 0) + 1
            );
        }

        for (const value of uniqueSorted(values)) {
            const option = document.createElement("option");
            option.value = value;
            option.textContent =
                `${formatter(value)} (${counts.get(value)})`;

            select.append(option);
        }
    };

    const populateOriginOptions = (quotes) => {
        const select = document.querySelector(
            '[data-filter="origin"]'
        );

        const works = quotes
            .map(sourceTitle)
            .filter(Boolean);

        /*
        * A dialogue containing the same speaker twice should still
        * count as one quotation for that speaker.
        */
        const speakers = quotes.flatMap((quote) =>
            Array.from(
                new Set(
                    originsFor(quote)
                        .filter((value) =>
                            value.startsWith("speaker:")
                        )
                        .map((value) =>
                            value.slice("speaker:".length)
                        )
                )
            )
        );

        const workCounts = new Map();
        const speakerCounts = new Map();

        for (const work of works) {
            workCounts.set(
                work,
                (workCounts.get(work) || 0) + 1
            );
        }

        for (const speaker of speakers) {
            speakerCounts.set(
                speaker,
                (speakerCounts.get(speaker) || 0) + 1
            );
        }

        if (works.length) {
            const group = document.createElement("optgroup");
            group.label = "Works and sources";

            for (const work of uniqueSorted(works)) {
                const option = element(
                    "option",
                    "",
                    `${work} (${workCounts.get(work)})`
                );

                option.value = `work:${work}`;
                group.append(option);
            }

            select.append(group);
        }

        if (speakers.length) {
            const group = document.createElement("optgroup");
            group.label = "People and characters";

            for (const speaker of uniqueSorted(speakers)) {
                const option = element(
                    "option",
                    "",
                    `${speaker} (${speakerCounts.get(speaker)})`
                );

                option.value = `speaker:${speaker}`;
                group.append(option);
            }

            select.append(group);
        }
    };

    const populateControls = () => {
        const quotes = state.data.quotes.filter(
            (quote) => quote.visibility === "public"
        );

        const sourceTypeSelect = document.querySelector(
            '[data-filter="sourceType"]'
        );

        const formatSelect = document.querySelector(
            '[data-filter="format"]'
        );

        const themeSelect = document.querySelector(
            '[data-filter="theme"]'
        );

        const collectionSelect = document.querySelector(
            '[data-filter="collection"]'
        );

        addOptions(
            sourceTypeSelect,
            quotes.map((quote) => quote.source?.type)
        );

        addOptions(
            formatSelect,
            quotes.map((quote) => quote.format)
        );

        addOptions(
            themeSelect,
            quotes.flatMap((quote) =>
                Array.from(new Set(quote.themes || []))
            )
        );

        addOptions(
            collectionSelect,
            quotes.flatMap((quote) =>
                Array.from(new Set(quote.collections || []))
            )
        );

        populateOriginOptions(quotes);
    };

    const readStateFromUrl = () => {
        const params = new URLSearchParams(window.location.search);
        state.q = params.get("q") || "";
        state.sourceType = params.get("source") || "";
        state.origin = params.get("origin") || "";
        state.format = params.get("format") || "";
        state.theme = params.get("theme") || "";
        state.collection = params.get("collection") || "";
        state.sort = params.get("sort") || "original";
        state.featured = params.get("featured") === "1";
    };

    const syncControlsFromState = () => {
        elements.search.value = state.q;
        elements.clearSearch.disabled = !state.q;
        for (const select of elements.filters) {
            select.value = state[select.dataset.filter] || "";
        }
        elements.sort.value = state.sort;
        elements.featuredOnly.checked = state.featured;
    };

    const syncUrl = () => {
        const params = new URLSearchParams();
        if (state.q) params.set("q", state.q);
        if (state.sourceType) params.set("source", state.sourceType);
        if (state.origin) params.set("origin", state.origin);
        if (state.format) params.set("format", state.format);
        if (state.theme) params.set("theme", state.theme);
        if (state.collection) params.set("collection", state.collection);
        if (state.sort !== "original") params.set("sort", state.sort);
        if (state.featured) params.set("featured", "1");

        const query = params.toString();
        const next = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
        window.history.replaceState(null, "", next);
        elements.copyResultsLink.hidden = !query;
    };

    const filteredQuotes = () => {
        const queryWords = normalize(state.q).split(" ").filter(Boolean);
        let quotes = state.data.quotes.filter((quote) => {
            if (quote.visibility !== "public") return false;
            if (state.sourceType && quote.source?.type !== state.sourceType) return false;
            if (state.origin && !originsFor(quote).includes(state.origin)) return false;
            if (state.format && quote.format !== state.format) return false;
            if (state.theme && !(quote.themes || []).includes(state.theme)) return false;
            if (state.collection && !(quote.collections || []).includes(state.collection)) return false;
            if (state.featured && !quote.featured) return false;
            if (queryWords.length && !queryWords.every((word) => searchableText(quote).includes(word))) return false;
            return true;
        });

        const byText = (getter) => (a, b) => normalize(getter(a)).localeCompare(normalize(getter(b)));
        if (state.sort === "speaker") quotes.sort(byText((quote) => speakerName(quote) || quote.lines?.[0]?.speaker));
        if (state.sort === "source") quotes.sort(byText(sourceTitle));
        if (state.sort === "shortest") quotes.sort((a, b) => quoteText(a).length - quoteText(b).length);
        if (state.sort === "longest") quotes.sort((a, b) => quoteText(b).length - quoteText(a).length);
        if (state.sort === "original") quotes.sort((a, b) => (a.order || 99999) - (b.order || 99999));

        return quotes;
    };

    const visualTrigger = () => {
        const candidates = [
            state.origin && `origin:${state.origin}`,
            state.collection && `collection:${state.collection}`,
            state.theme && `theme:${state.theme}`,
            state.sourceType && `sourceType:${state.sourceType}`
        ].filter(Boolean);
        for (const candidate of candidates) {
            const visualId = state.data.filterVisuals?.[candidate];
            if (visualId && state.data.visuals?.[visualId]) return state.data.visuals[visualId];
        }
        return null;
    };

    const renderContextVisual = () => {
        const visual = visualTrigger();
        if (!visual?.src) {
            elements.context.hidden = true;
            elements.contextImage.removeAttribute("src");
            return;
        }

        elements.context.hidden = false;
        elements.contextImage.src = visual.src;
        elements.contextImage.alt = visual.alt || "";
        elements.contextKicker.textContent = visual.kicker || "Collection Artwork";
        elements.contextTitle.textContent = visual.title || "";
        elements.contextCaption.textContent = visual.caption || "";
        elements.contextCredit.replaceChildren();

        if (visual.credit) {
            elements.contextCredit.append(document.createTextNode("Image: "));
            if (visual.creditUrl) {
                const link = element("a", "underlined-text", visual.credit);
                link.href = visual.creditUrl;
                link.target = "_blank";
                link.rel = "noopener noreferrer";
                elements.contextCredit.append(link);
            } else {
                elements.contextCredit.append(document.createTextNode(visual.credit));
            }
        }

        elements.contextImage.onerror = () => {
            elements.context.hidden = true;
        };
    };

    const renderFeatured = () => {
        const featured = state.data.quotes
            .filter(
                (quote) =>
                    quote.visibility === "public" &&
                    quote.featured
            )
            .sort(
                (a, b) =>
                    (a.featuredOrder || 999) -
                    (b.featuredOrder || 999)
            )
            .slice(0, 8);

        elements.featured.replaceChildren(
            ...featured.map((quote) =>
                createCard(
                    quote,
                    { featuredPreview: true }
                )
            )
        );

        if (!featured.length) {
            elements.featured.append(
                element(
                    "p",
                    "favorite-quotes-loading",
                    "Featured favorites will appear here once selected."
                )
            );
        }

        queueMasonryLayout(elements.featured);
    };

    /*
    * Each grid receives its own pending animation frame.
    * This prevents laying out the regular results from accidentally
    * cancelling the Featured Favorites layout.
    */
    const masonryFrames = new WeakMap();

    const layoutMasonry = (container) => {
        if (!container) return;

        const styles =
            window.getComputedStyle(container);

        const rowHeight = Number.parseFloat(
            styles.gridAutoRows
        );

        const rowGap = Number.parseFloat(
            styles.rowGap
        );

        if (
            !rowHeight ||
            Number.isNaN(rowHeight) ||
            Number.isNaN(rowGap)
        ) {
            return;
        }

        for (
            const card of container.querySelectorAll(
                ".favorite-quote-card"
            )
        ) {
            /*
            * Remove the old measurement before measuring again.
            */
            card.style.gridRowEnd = "auto";

            const height =
                card.getBoundingClientRect().height;

            const span = Math.ceil(
                (height + rowGap) /
                (rowHeight + rowGap)
            );

            card.style.gridRowEnd =
                `span ${span}`;
        }
    };

    const queueMasonryLayout = (container) => {
        if (!container) return;

        const pendingFrame =
            masonryFrames.get(container);

        if (pendingFrame) {
            window.cancelAnimationFrame(
                pendingFrame
            );
        }

        const nextFrame =
            window.requestAnimationFrame(() => {
                layoutMasonry(container);
                masonryFrames.delete(container);
            });

        masonryFrames.set(
            container,
            nextFrame
        );
    };

    const render = () => {
        const quotes = filteredQuotes();

        /*
        * Render every matching quotation.
        * There is no pagination or load-more button.
        */
        elements.results.replaceChildren(
            ...quotes.map((quote) =>
                createCard(quote)
            )
        );

        elements.results.setAttribute(
            "aria-busy",
            "false"
        );

        const noun =
            quotes.length === 1
                ? "quote"
                : "quotes";

        elements.count.textContent =
            `${quotes.length} matching ${noun}`;

        elements.empty.hidden =
            quotes.length !== 0;

        elements.results.hidden =
            quotes.length === 0;

        elements.clearSearch.disabled =
            !state.q;

        renderContextVisual();
        syncUrl();
        queueMasonryLayout(elements.results);
    };

    const reset = () => {
        Object.assign(state, {
            q: "",
            sourceType: "",
            origin: "",
            format: "",
            theme: "",
            collection: "",
            sort: "original",
            featured: false
        });

        syncControlsFromState();
        render();
    };

    const bindEvents = () => {
        elements.controls.addEventListener("submit", (event) => {
            event.preventDefault();
        });

        let searchTimer;
        elements.search.addEventListener("input", () => {
            window.clearTimeout(searchTimer);
            searchTimer = window.setTimeout(() => {
                state.q = elements.search.value.trim();
                render();
            }, 120);
        });

        elements.clearSearch.addEventListener("click", () => {
            state.q = "";
            elements.search.value = "";
            render();
            elements.search.focus();
        });

        for (const select of elements.filters) {
            select.addEventListener("change", () => {
                state[select.dataset.filter] = select.value;
                syncControlsFromState();
                render();
            });
        }

        elements.sort.addEventListener("change", () => {
            state.sort = elements.sort.value;
            render();
        });

        elements.featuredOnly.addEventListener("change", () => {
            state.featured = elements.featuredOnly.checked;
            render();
        });

        for (const button of elements.resets) button.addEventListener("click", reset);

        elements.copyResultsLink.addEventListener("click", () => {
            copyText(window.location.href, elements.copyResultsLink, "Filtered link copied");
        });

        window.addEventListener("popstate", () => {
            readStateFromUrl();
            syncControlsFromState();
            render();
        });

        window.addEventListener("resize", () => {
            queueMasonryLayout(elements.featured);
            queueMasonryLayout(elements.results);
        });

        if (document.fonts?.ready) {
            document.fonts.ready.then(() => {
                queueMasonryLayout(elements.featured);
                queueMasonryLayout(elements.results);
            });
        }
    };

    const showLoadError = () => {
        elements.featured.replaceChildren(element("p", "favorite-quotes-loading", "The featured quotes could not be loaded."));
        elements.results.replaceChildren();
        elements.count.textContent = "The quote collection could not be loaded.";
        elements.empty.hidden = false;
        elements.empty.querySelector("h3").textContent = "Unable to load the collection";
        elements.empty.querySelector("p").textContent = "Please refresh the page or try again later.";
        elements.empty.querySelector("button").hidden = true;
    };

    fetch(DATA_URL)
        .then((response) => {
            if (!response.ok) throw new Error(`Quote data returned ${response.status}`);
            return response.json();
        })
        .then((data) => {
            state.data = data;
            readStateFromUrl();
            populateControls();
            syncControlsFromState();
            renderFeatured();
            bindEvents();
            render();
        })
        .catch((error) => {
            console.error("Favorite Quotes:", error);
            showLoadError();
        });
})();