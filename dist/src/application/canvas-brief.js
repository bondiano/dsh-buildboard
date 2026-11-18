/** Deterministic briefs for /canvas, Research and Implement. */
const DEFAULT_REQUEST = "Explain the architecture of what this session is working on.";
/**
 * Build the agent assignment for a /canvas command.
 * Empty request uses the architecture default.
 */
export function buildCanvasBrief(input) {
    const request = input.request.trim() || DEFAULT_REQUEST;
    return [
        "Buildboard /canvas assignment",
        `Board: ${input.boardSlug}${input.workspace ? ` in ${input.workspace}` : ""}`,
        input.sessionId ? `Session: ${input.sessionId}` : undefined,
        "",
        `Request: ${request}`,
        "",
        "Use this session's history and the workspace code. Build the board with board_* and card_* tools.",
        `Do not dump a long explanation in chat — reply with one short markdown link to the board file so the right sidebar opens Buildboard: [${input.boardSlug}](.buildboard/boards/${input.boardSlug}.board.json)`,
        "",
        "Architecture recipe (use when the request is about architecture or when using the default):",
        "- Create frames for layers or subsystems (these are underlays).",
        "- One card per component: role, key files, [[wiki-links]] to related cards.",
        "- Parent every card onto its frame: board_create_shape with parentId = the frame id and x/y relative to that frame. Spatial-only placement without parentId breaks Prettify grouping.",
        "- Arrows with labels for data flow and dependencies — only via board_connect (both ends bound).",
        "- Every arrow end must touch its target block; unbound or floating arrows are errors.",
        "- Keep WCAG AA contrast for shape colors and card chrome (title/excerpt/kind).",
        "- When a diagram needs an illustration, call board_generate_image (gpt-image-2.6-sunburst by default) and place it on the board; embed the returned markdown in related cards.",
        "- If board_generate_image returns openai_api_key_missing, tell the user to set OPENAI_API_KEY or Buildboard settings openaiApiKey / openaiImageModel — do not invent a key.",
        '- A card titled "What changed in this session".',
        "- Call board_layout (mode prettify) when shapes overlap or arrows tangle; it binds loose cards onto underlays then lays out frames and children. Users can also use burger → Prettify layout.",
        '- Before finishing, call board_validate with recipe "architecture" (use repair true if base fields are missing or cards sit on frames without parentId). Fix contrast, unbound arrows, and non-touching arrow ends, then stop.',
    ]
        .filter((line) => line !== undefined)
        .join("\n");
}
/** Brief for Research / Implement started from selected cards. */
export function buildRunBrief(input) {
    const verb = input.kind === "research" ? "Research" : "Implement";
    const cards = input.cardTitles
        .map((title, i) => {
        const body = (input.cardBodies[i] ?? "").slice(0, 500);
        return `- ${title}${body ? `\n  ${body.replace(/\n/g, "\n  ")}` : ""}`;
    })
        .join("\n");
    return [
        `Buildboard ${verb} assignment`,
        `Board: ${input.boardSlug}${input.workspace ? ` in ${input.workspace}` : ""}`,
        "",
        "Selected cards:",
        cards || "- (none)",
        "",
        input.kind === "research"
            ? "Deep-research the topic. Create finding cards, link them on the board, then call run_report."
            : "Implement the described work in the workspace. Update task cards, then call run_report.",
        "Edits on the board are marked agent until the user touches them.",
        "Arrows must use board_connect; keep WCAG AA contrast; use board_generate_image when an illustration helps.",
    ].join("\n");
}
export { DEFAULT_REQUEST as DEFAULT_CANVAS_REQUEST };
