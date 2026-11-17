import type { CardRunState, RunKind, RunStatus } from "../domain/card.js";
import { createId } from "../domain/ids.js";
import {
	nextRunStatus,
	type RunEvent,
} from "../domain/machines/run.machine.js";
import type { CardLibrary } from "./card-library.js";

export interface RunRecord extends CardRunState {
	boardSlug: string;
	cardRef?: string;
	brief: string;
}

/** In-memory run ledger; card frontmatter is the durable copy when a card is bound. */
export class RunService {
	readonly #cards: CardLibrary;
	readonly #runs = new Map<string, RunRecord>();

	constructor(cards: CardLibrary) {
		this.#cards = cards;
	}

	list(): RunRecord[] {
		return [...this.#runs.values()].sort((a, b) => b.updatedAt - a.updatedAt);
	}

	get(id: string): RunRecord | undefined {
		return this.#runs.get(id);
	}

	async create(input: {
		kind: RunKind;
		boardSlug: string;
		brief: string;
		cardRef?: string;
		sessionId?: string;
	}): Promise<RunRecord> {
		const now = Date.now();
		const run: RunRecord = {
			id: createId("run"),
			kind: input.kind,
			status: "draft",
			boardSlug: input.boardSlug,
			cardRef: input.cardRef,
			brief: input.brief,
			sessionId: input.sessionId,
			updatedAt: now,
		};
		this.#runs.set(run.id, run);
		await this.#persistToCard(run);
		return run;
	}

	async transition(
		id: string,
		event: RunEvent,
		patch?: Partial<RunRecord>,
	): Promise<RunRecord> {
		const run = this.#runs.get(id);
		if (!run) throw new Error(`run not found: ${id}`);
		const status: RunStatus = nextRunStatus(run.status, event);
		const next: RunRecord = {
			...run,
			...patch,
			status,
			updatedAt: Date.now(),
		};
		this.#runs.set(id, next);
		await this.#persistToCard(next);
		return next;
	}

	async report(
		id: string,
		input: { ok: boolean; summary: string; error?: string },
	): Promise<RunRecord> {
		if (input.ok) {
			return this.transition(id, "REVIEW", { error: undefined });
		}
		return this.transition(id, "FAIL", { error: input.error ?? input.summary });
	}

	async #persistToCard(run: RunRecord): Promise<void> {
		if (!run.cardRef) return;
		const [scope, id] = run.cardRef.split(":") as [
			"project" | "global",
			string,
		];
		const card = this.#cards.get(scope, id);
		if (!card) return;
		await this.#cards.write({
			id: card.id,
			scope: card.scope,
			title: card.title,
			kind: card.kind,
			tags: card.tags,
			body: card.body,
			updatedBy: "agent",
			run: {
				id: run.id,
				kind: run.kind,
				status: run.status,
				sessionId: run.sessionId,
				brief: run.brief,
				error: run.error,
				updatedAt: run.updatedAt,
			},
		});
	}
}
