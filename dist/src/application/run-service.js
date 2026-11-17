import { createId } from "../domain/ids.js";
import { nextRunStatus, } from "../domain/machines/run.machine.js";
/** In-memory run ledger; card frontmatter is the durable copy when a card is bound. */
export class RunService {
    #cards;
    #runs = new Map();
    #listeners = new Set();
    constructor(cards) {
        this.#cards = cards;
    }
    subscribe(listener) {
        this.#listeners.add(listener);
        return () => this.#listeners.delete(listener);
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
            status: input.status ?? "draft",
            boardSlug: input.boardSlug,
            cardRef: input.cardRef,
            brief: input.brief,
            sessionId: input.sessionId,
            updatedAt: now,
        };
        this.#runs.set(run.id, run);
        await this.#persistToCard(run);
        this.#emit();
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
        this.#emit();
        return next;
    }
    async report(id, input) {
        if (input.ok) {
            return this.transition(id, "REVIEW", { error: undefined });
        }
        return this.transition(id, "FAIL", { error: input.error ?? input.summary });
    }
    /** Attach a live DSH session to a run (or the newest unbound run). */
    bindSession(sessionId, runId) {
        if (runId) {
            const run = this.#runs.get(runId);
            if (!run)
                return undefined;
            if (run.sessionId === sessionId)
                return run;
            const next = { ...run, sessionId, updatedAt: Date.now() };
            this.#runs.set(runId, next);
            void this.#persistToCard(next);
            this.#emit();
            return next;
        }
        const candidate = this.list().find((run) => !run.sessionId &&
            (run.status === "draft" ||
                run.status === "queued" ||
                run.status === "running"));
        if (!candidate)
            return undefined;
        return this.bindSession(sessionId, candidate.id);
    }
    /**
     * Drive run.machine from DSH agent/status events for the bound session.
     * idle after running → review (awaiting run_report or human accept).
     */
    async onAgentStatus(sessionId, status) {
        this.bindSession(sessionId);
        const matched = this.list().filter((run) => run.sessionId === sessionId);
        for (const run of matched) {
            try {
                if (status === "running") {
                    if (run.status === "draft") {
                        await this.transition(run.id, "QUEUE");
                        await this.transition(run.id, "START");
                    }
                    else if (run.status === "queued") {
                        await this.transition(run.id, "START");
                    }
                }
                else if (status === "idle" && run.status === "running") {
                    await this.transition(run.id, "REVIEW");
                }
            }
            catch {
                // illegal transitions are ignored; run_report remains authoritative
            }
        }
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
    #emit() {
        for (const listener of this.#listeners)
            listener();
    }
}
