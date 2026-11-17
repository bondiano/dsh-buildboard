import { createId } from "../domain/ids.js";
import { nextRunStatus, } from "../domain/machines/run.machine.js";
/** In-memory run ledger; card frontmatter is the durable copy when a card is bound. */
export class RunService {
    #cards;
    #runs = new Map();
    constructor(cards) {
        this.#cards = cards;
    }
    list() {
        return [...this.#runs.values()].sort((a, b) => b.updatedAt - a.updatedAt);
    }
    get(id) {
        return this.#runs.get(id);
    }
    async create(input) {
        const now = Date.now();
        const run = {
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
    async transition(id, event, patch) {
        const run = this.#runs.get(id);
        if (!run)
            throw new Error(`run not found: ${id}`);
        const status = nextRunStatus(run.status, event);
        const next = {
            ...run,
            ...patch,
            status,
            updatedAt: Date.now(),
        };
        this.#runs.set(id, next);
        await this.#persistToCard(next);
        return next;
    }
    async report(id, input) {
        if (input.ok) {
            return this.transition(id, "REVIEW", { error: undefined });
        }
        return this.transition(id, "FAIL", { error: input.error ?? input.summary });
    }
    async #persistToCard(run) {
        if (!run.cardRef)
            return;
        const [scope, id] = run.cardRef.split(":");
        const card = this.#cards.get(scope, id);
        if (!card)
            return;
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
