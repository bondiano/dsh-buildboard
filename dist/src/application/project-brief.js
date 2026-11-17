/**
 * Prompt brief built from a board.
 *
 * "Start project" hands the agent the board itself, so the session begins from
 * what the user already drew instead of a blank prompt. The text is
 * deterministic: the same board always produces the same brief.
 *
 * @module @local/dsh-cult-canvas/application/project-brief
 */
/** Longest brief accepted by the session draft. */
const MAX_BRIEF_LENGTH = 4000;
/** Longest quoted element text. */
const MAX_TEXT_LENGTH = 80;
/** Most element lines the brief lists. */
const MAX_ELEMENT_LINES = 20;
/** Most series-bible entries the brief quotes. */
const MAX_BIBLE_LINES = 10;
/** Media pipeline node kinds, which the statistics call out separately. */
const PIPELINE_KIND = {
    script: true,
    storyboard: true,
    image: true,
    video: true,
    audio: true,
    finalcut: true,
};
/** One line per element kind present, in first-seen order. */
function kindSummary(elements) {
    const counts = new Map();
    for (const element of elements) {
        const kind = typeof element.kind === "string" ? element.kind : "element";
        counts.set(kind, (counts.get(kind) ?? 0) + 1);
    }
    const parts = [];
    for (const [kind, count] of counts) {
        parts.push(PIPELINE_KIND[kind] ? `pipeline ${kind}=${count}` : `${kind}=${count}`);
    }
    return parts.join(", ") || "empty";
}
/** Quote element text on one line, shortened to keep the brief readable. */
function quote(element) {
    const raw = element.text ?? element.label ?? "";
    const flat = raw.replace(/\s+/g, " ").trim();
    if (flat.length === 0)
        return "";
    return flat.length > MAX_TEXT_LENGTH
        ? `"${flat.slice(0, MAX_TEXT_LENGTH)}…"`
        : `"${flat}"`;
}
/** `key: value` lines for the series bible, one level deep. */
function bibleLines(bible) {
    if (bible === undefined)
        return [];
    const lines = [];
    for (const [key, value] of Object.entries(bible)) {
        if (lines.length >= MAX_BIBLE_LINES)
            break;
        if (value === undefined || value === null)
            continue;
        if (Array.isArray(value)) {
            if (value.length === 0)
                continue;
            lines.push(`- ${key}: ${value.length} entries`);
            continue;
        }
        if (typeof value === "object")
            continue;
        if (typeof value !== "string" &&
            typeof value !== "number" &&
            typeof value !== "boolean") {
            continue;
        }
        lines.push(`- ${key}: ${String(value)}`);
    }
    return lines;
}
/**
 * Build the prompt a "Start project" session receives.
 *
 * @param snapshot - the board as the user sees it.
 * @param workspace - absolute project directory, when the board has one.
 * @returns the brief, at most 4000 characters.
 */
export function buildProjectBrief(snapshot, workspace) {
    const elements = snapshot.elements;
    const edges = snapshot.edges;
    const board = workspace ?? "shared board";
    const lines = [
        "Cult Canvas project brief",
        `Board: ${board}`,
        `Contents: ${elements.length} elements (${kindSummary(elements)}); ${edges.length} edges`,
    ];
    const bible = bibleLines(snapshot.bible);
    if (bible.length > 0)
        lines.push("", "Series bible:", ...bible);
    if (elements.length > 0) {
        lines.push("", "Elements:");
        for (const element of elements.slice(0, MAX_ELEMENT_LINES)) {
            const kind = typeof element.kind === "string" ? element.kind : "element";
            const text = quote(element);
            const position = `@ (${Math.round(element.x)}, ${Math.round(element.y)})`;
            lines.push(`- ${kind}${text === "" ? "" : ` ${text}`} ${position}`);
        }
        if (elements.length > MAX_ELEMENT_LINES) {
            lines.push(`- … ${elements.length - MAX_ELEMENT_LINES} more`);
        }
    }
    lines.push("", "Work with this board through the cult-canvas tools: canvas_get_state first, then canvas_create_element, canvas_update_element, canvas_delete_element and canvas_connect for targeted changes.", "Your edits show up live in the user's open board and are marked as agent edits.", `The board is stored at <workspace>/cult-canvas.canvas and is saved automatically.`);
    const brief = lines.join("\n");
    return brief.length > MAX_BRIEF_LENGTH
        ? `${brief.slice(0, MAX_BRIEF_LENGTH - 1)}…`
        : brief;
}
