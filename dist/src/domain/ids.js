/** Identity helpers for cards, boards and runs. */
const ID_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
/** Create a short opaque id (12 chars). */
export function createId(prefix = "") {
    const bytes = new Uint8Array(12);
    crypto.getRandomValues(bytes);
    let out = "";
    for (const byte of bytes) {
        out += ID_ALPHABET[byte % ID_ALPHABET.length];
    }
    return prefix ? `${prefix}_${out}` : out;
}
/** Parse `scope:id`; returns undefined when the form is wrong. */
export function parseCardRef(raw) {
    const match = /^(project|global):([a-z0-9_-]+)$/i.exec(raw.trim());
    if (!match)
        return undefined;
    return { scope: match[1].toLowerCase(), id: match[2] };
}
/** Format a card address. */
export function formatCardRef(scope, id) {
    return `${scope}:${id}`;
}
/** Slugify a title for board filenames. */
export function slugify(input, fallback = "board") {
    const slug = input
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 48);
    return slug || fallback;
}
