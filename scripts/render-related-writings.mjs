import { readFile, writeFile } from "node:fs/promises";
import { load } from "cheerio";

const SECTION = 'section[aria-labelledby="related-writing-title"]';
const MAX_RECOMMENDATIONS = 6;

function writingKey(href, origin) {
    const url = new URL(href, origin);
    return url.origin === origin
        ? decodeURIComponent(url.pathname).replace(/\/(?:index\.html)?$/, "")
        : url.href;
}

function labelKey(label) {
    return label.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function relatedScore(page, candidate) {
    const sharedTags = candidate.tags.filter(tag => page.tags.includes(tag)).length;
    const sameType = candidate.piece.types.some(type => page.piece.types.includes(type));
    const sameGroup = candidate.groups.some(group => page.groups.includes(group));
    const linksBack = candidate.picks.has(page.key);

    return 2 * sharedTags + Number(sameType) + 4 * Number(sameGroup) + 3 * Number(linksBack);
}

function escapeHtml(value) {
    const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
    return value.replace(/[&<>"]/g, character => entities[character]);
}

function recommendationCard({ piece, summary }, compact) {
    const { Form, Genre, "Reading Time": readingTime } = piece.metadata;
    const tags = [
        Form,
        Genre?.split(/[|•]/).at(-1).trim(),
        ...piece.tags.map(tag => tag.replace(/^#/, "").replace(/([a-z])([A-Z])/g, "$1 $2"))
    ].filter(Boolean);
    const labels = Array.from(new Map(tags.map(tag => [labelKey(tag), tag])).values())
        .slice(0, 2)
        .map(escapeHtml);
    const title = escapeHtml(piece.title);
    const href = escapeHtml(piece.url);

    if (compact) {
        return `<a class="info-connection-card" data-carousel-item href="${href}">
            <span>${labels.join(" · ")}</span>
            <strong>${title}</strong>
        </a>`;
    }

    const description = escapeHtml(summary);
    return `<article class="writing-related-card" data-carousel-item>
        <div class="writing-related-tags" aria-label="Writing types">${labels.map(label => `<span>${label}</span>`).join("")}</div>
        <h3>${title}</h3>
        <p class="writing-related-summary">${description}</p>
        ${readingTime ? `<dl class="writing-related-meta"><div><dt>Reading Time</dt><dd>${escapeHtml(readingTime)}</dd></div></dl>` : ""}
        <a class="writings-button writings-button-secondary writing-related-link" href="${href}" aria-label="Read ${title}">Read This Piece</a>
    </article>`;
}

async function readPage(page, origin) {
    const html = await readFile(page.file, "utf8");
    const $ = load(html, { sourceCodeLocationInfo: true });
    const section = $(SECTION).first();
    const key = writingKey(page.piece.url, origin);
    const picks = new Map();

    section.find(".writing-related-card, .info-connection-card").each((_, element) => {
        const card = $(element);
        const href = card.attr("href") || card.find(".writing-related-link[href]").attr("href");
        if (!href) return;

        const target = writingKey(href, origin);
        if (target !== key && !picks.has(target)) picks.set(target, card);
    });

    const tags = [...new Set(page.piece.tags.flatMap(tag => tag.split(/[|•]/).map(labelKey)))].filter(Boolean);
    const groups = [page.piece.context, page.piece.project].map(labelKey).filter(Boolean);
    return { ...page, html, $, section, key, picks, tags, groups };
}

export async function renderRelatedWritings(pages, origin) {
    const documents = await Promise.all(pages.map(page => readPage(page, origin)));

    for (const page of documents) {
        const { $, html, file, picks } = page;
        const extra = documents
            .filter(candidate => candidate.key !== page.key && !picks.has(candidate.key))
            .map(candidate => ({ candidate, score: relatedScore(page, candidate) }))
            .sort((first, second) => second.score - first.score)
            .slice(0, Math.max(0, MAX_RECOMMENDATIONS - picks.size));

        if (!picks.size && !extra.length) continue;

        const compact = page.section.parent().hasClass("info-connections-grid");
        const section = page.section.length ? page.section : $(`<section class="writing-related" aria-labelledby="related-writing-title">
            <div class="writing-related-heading"><h2 id="related-writing-title">Related Writing</h2></div>
            <a class="writings-button writings-button-secondary writing-related-browse" href="/writings/">Browse All Writings</a>
        </section>`);
        const carousel = $(`<div class="carousel writing-related-carousel${compact ? " writing-related-carousel--compact" : ""}" data-carousel>
            <button class="carousel-btn carousel-btn-prev" type="button" aria-label="Previous recommendation" aria-controls="related-writing-cards" hidden>‹</button>
            <button class="carousel-btn carousel-btn-next" type="button" aria-label="Next recommendation" aria-controls="related-writing-cards" hidden>›</button>
            <div class="carousel-track${compact ? "" : " writing-related-grid"}" id="related-writing-cards"
                role="group" aria-label="Related writing recommendations" tabindex="0"></div>
        </div>`);
        const track = carousel.find(".carousel-track");

        for (const card of picks.values()) {
            track.append(card.clone().attr("data-carousel-item", ""));
        }
        for (const { candidate } of extra) {
            track.append(recommendationCard(candidate, compact));
        }

        const grid = section.children(".writing-related-grid");
        if (grid.length) {
            grid.replaceWith(carousel);
        } else {
            section.children(".info-connection-card").remove();
            section.children(".writing-related-heading, h3").first().after(carousel);
        }

        // Keep recommendations out of the source pages and preserve the rest of the built HTML.
        const location = page.section[0]?.sourceCodeLocation;
        if (location) {
            const { startOffset, endOffset } = location;
            await writeFile(file, html.slice(0, startOffset) + section.toString() + html.slice(endOffset), "utf8");
        } else {
            const container = $(".writing-piece-container, .info-detail-container, main").last()[0];
            const end = container?.sourceCodeLocation?.endTag?.startOffset;
            if (end !== undefined) {
                await writeFile(file, html.slice(0, end) + section.toString() + "\n" + html.slice(end), "utf8");
            }
        }
    }
}
