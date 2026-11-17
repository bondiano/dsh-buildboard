/** Deterministic briefs for /canvas, Research and Implement. */

export interface CanvasBriefInput {
	request: string;
	boardSlug: string;
	workspace?: string;
	sessionId?: string;
}

const DEFAULT_REQUEST =
	"Explain the architecture of what this session is working on.";

/**
 * Build the agent assignment for a /canvas command.
 * Empty request uses the architecture default.
 */
export function buildCanvasBrief(input: CanvasBriefInput): string {
	const request = input.request.trim() || DEFAULT_REQUEST;
	return [
		"Buildboard /canvas assignment",
		`Board: ${input.boardSlug}${input.workspace ? ` in ${input.workspace}` : ""}`,
		input.sessionId ? `Session: ${input.sessionId}` : undefined,
		"",
		`Request: ${request}`,
		"",
		"Use this session's history and the workspace code. Build the board with board_* and card_* tools.",
		"Do not dump a long explanation in chat — reply with one short line linking to the board.",
		"",
		"Architecture recipe (use when the request is about architecture or when using the default):",
		"- Create frames for layers or subsystems.",
		"- One card per component: role, key files, [[wiki-links]] to related cards.",
		"- Arrows with labels for data flow and dependencies.",
		'- A card titled "What changed in this session".',
		"- Call board_layout when shapes overlap.",
	]
		.filter((line) => line !== undefined)
		.join("\n");
}

export interface RunBriefInput {
	kind: "research" | "implement";
	boardSlug: string;
	cardTitles: string[];
	cardBodies: string[];
	workspace?: string;
}

/** Brief for Research / Implement started from selected cards. */
export function buildRunBrief(input: RunBriefInput): string {
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
	].join("\n");
}

export { DEFAULT_REQUEST as DEFAULT_CANVAS_REQUEST };
