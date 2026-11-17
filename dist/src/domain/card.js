/** Extract [[wiki-links]] targets from markdown. */
export function extractWikiLinks(body) {
    const out = new Set();
    const re = /\[\[([^\]|#]+)(?:\|[^\]]+)?\]\]/g;
    for (const match of body.matchAll(re)) {
        const target = match[1]?.trim();
        if (target)
            out.add(target);
    }
    return [...out];
}
/** First non-empty paragraph as an excerpt. */
export function excerptOf(body, max = 140) {
    const line = body
        .split(/\r?\n/)
        .map((s) => s.trim())
        .find((s) => s.length > 0 && !s.startsWith("#")) ?? "";
    return line.length <= max ? line : `${line.slice(0, max - 1)}…`;
}
