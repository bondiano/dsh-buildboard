import type { CardScope } from "./ids.js";

/** Kind of document card. */
export type CardKind = "note" | "research" | "task";

/** Lifecycle of a research / implement / canvas run attached to a card. */
export type RunStatus =
	| "draft"
	| "queued"
	| "running"
	| "needsInput"
	| "review"
	| "done"
	| "failed"
	| "cancelled";

/** Kind of agent run started from the board. */
export type RunKind = "research" | "implement" | "canvas";

/** Frontmatter + body of one card document. */
export interface CardDocument {
	id: string;
	scope: CardScope;
	title: string;
	kind: CardKind;
	tags: string[];
	body: string;
	createdAt: number;
	updatedAt: number;
	updatedBy?: "user" | "agent";
	run?: CardRunState;
}

/** Persisted run state living in card frontmatter. */
export interface CardRunState {
	id: string;
	kind: RunKind;
	status: RunStatus;
	sessionId?: string;
	brief?: string;
	error?: string;
	updatedAt: number;
}

/** Lightweight listing row. */
export interface CardSummary {
	id: string;
	scope: CardScope;
	title: string;
	kind: CardKind;
	tags: string[];
	updatedAt: number;
	excerpt: string;
	runStatus?: RunStatus;
}

/** Extract [[wiki-links]] targets from markdown. */
export function extractWikiLinks(body: string): string[] {
	const out = new Set<string>();
	const re = /\[\[([^\]|#]+)(?:\|[^\]]+)?\]\]/g;
	for (const match of body.matchAll(re)) {
		const target = match[1]?.trim();
		if (target) out.add(target);
	}
	return [...out];
}

/** First non-empty paragraph as an excerpt. */
export function excerptOf(body: string, max = 140): string {
	const line =
		body
			.split(/\r?\n/)
			.map((s) => s.trim())
			.find((s) => s.length > 0 && !s.startsWith("#")) ?? "";
	return line.length <= max ? line : `${line.slice(0, max - 1)}…`;
}
