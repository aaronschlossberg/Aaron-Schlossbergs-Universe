// Shared by source cleanup and the Favorite Quotes renderer. Apostrophes are
// part of words; only matched quotation marks delimit quoted text.
export function quotationPositions(text) {
    const positions = [];
    const pending = new Map();
    const closing = new Map([["”", "“"], ["’", "‘"], ["»", "«"], ["›", "‹"]]);
    const word = character => /[\p{L}\p{N}\p{M}]/u.test(character || "");
    for (let index = 0; index < text.length; index++) {
        const character = text[index];
        if (!'“”‘’«»‹›"\''.includes(character)) continue;
        if ("‘’'".includes(character)) {
            if (word(text[index - 1]) && word(text[index + 1])) continue;
            if (!word(text[index - 1]) && /^(?:til|till|tis|twas|em|cause|cuz|bout|round|nuff)\b|^\d{2}(?:s\b|\b)/i.test(text.slice(index + 1))) continue;
        }
        const opener = closing.get(character) || character;
        const symmetric = character === '"' || character === "'";
        if (closing.has(character) || (symmetric && pending.has(opener))) {
            if (pending.has(opener)) {
                const start = pending.get(opener);
                if (index > start + 1) positions.push(start, index);
                pending.delete(opener);
            }
        } else {
            pending.set(opener, index);
        }
    }
    return positions.sort((a, b) => a - b);
}

export function quotationParts(text) {
    const parts = [];
    let start = 0;
    for (const index of quotationPositions(text)) {
        if (index > start) parts.push({ text: text.slice(start, index), quote: false });
        parts.push({ text: text[index], quote: true });
        start = index + 1;
    }
    if (start < text.length) parts.push({ text: text.slice(start), quote: false });
    return parts;
}

export function appendFormattedText(container, text, { className = "", url = "", external = false } = {}) {
    const document = container.ownerDocument;
    for (const part of quotationParts(text)) {
        const node = document.createElement(part.quote || !url ? "span" : "a");
        node.className = part.quote ? "typography-quote" : className;
        node.textContent = part.text;
        if (!part.quote && url) {
            node.href = url;
            if (external) {
                node.target = "_blank";
                node.rel = "noopener noreferrer";
            }
        }
        container.append(node);
    }
}
