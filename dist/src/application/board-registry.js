/**
 * One board per workspace.
 *
 * A board is a JSON Canvas 1.0 file at `<workspace>/cult-canvas.canvas`. The
 * registry keeps one store per resolved workspace and autosaves it after each
 * mutation, so a restart finds the board as it was left.
 *
 * @module @local/dsh-cult-canvas/application/board-registry
 */
import { readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { CanvasStore } from "./canvas-store.js";
import { BOARD_FILE_NAME } from "../domain/route.js";
export { BOARD_FILE_NAME } from "../domain/route.js";
/** Delay that folds a burst of edits into one write. */
const AUTOSAVE_DEBOUNCE_MS = 2000;
/** Key used for sessions without a workspace. */
const DEFAULT_KEY = "default";
export class BoardRegistry {
    entries = new Map();
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    /**
     * The board of one session, created and loaded on first use.
     *
     * The session identity is the key, so the browser tab and the agent tools of
     * that session always land on the same store even though only one of them
     * can resolve the workspace. The first resolution that names a directory
     * attaches the file to the board that already exists.
     *
     * @param session - session id whose board this is.
     * @param explicit - absolute workspace path from the caller, preferred over
     * the session's own; lets a browser name a workspace the Host has not seen.
     * @returns the stable board record for that session.
     */
    record(session, explicit) {
        const workspace = explicit || this.deps.resolveWorkspace(session);
        const key = session ?? workspace ?? DEFAULT_KEY;
        const existing = this.entries.get(key);
        if (existing !== undefined) {
            const record = existing.record;
            if (record.workspace === undefined && workspace !== undefined) {
                record.workspace = workspace;
                record.ready = this.load(existing);
            }
            return record;
        }
        const store = new CanvasStore({ maxElements: this.deps.maxElements });
        const entry = {
            record: {
                store,
                workspace,
                ready: Promise.resolve(),
                flush: async () => {
                    await entry.record.ready;
                    await this.write(entry);
                },
            },
            timer: undefined,
            pending: Promise.resolve(),
            unsubscribe: () => { },
            dirty: false,
        };
        entry.record.ready = this.load(entry);
        entry.unsubscribe = store.subscribe(() => {
            entry.dirty = true;
            clearTimeout(entry.timer);
            entry.timer = setTimeout(() => {
                entry.timer = undefined;
                entry.pending = entry.pending.then(() => this.write(entry));
            }, AUTOSAVE_DEBOUNCE_MS);
        });
        this.entries.set(key, entry);
        return entry.record;
    }
    /** Stop autosave timers and release listeners. */
    dispose() {
        for (const entry of this.entries.values()) {
            clearTimeout(entry.timer);
            entry.unsubscribe();
        }
        this.entries.clear();
    }
    async load(entry) {
        if (entry.record.workspace === undefined)
            return;
        const path = join(entry.record.workspace, BOARD_FILE_NAME);
        let text;
        try {
            text = await readFile(path, "utf8");
        }
        catch (error) {
            // A missing file is an empty board, not a failure.
            const code = typeof error === "object" && error !== null && "code" in error
                ? error.code
                : undefined;
            if (code !== "ENOENT") {
                this.deps.warn?.(`cult-canvas: cannot read ${path}: ${String(error)}`);
            }
            return;
        }
        try {
            const doc = JSON.parse(text);
            if (!Array.isArray(doc.nodes))
                throw new Error("no nodes array");
            entry.record.store.importJsonCanvas(doc);
            entry.dirty = false;
        }
        catch (error) {
            this.deps.warn?.(`cult-canvas: ignoring invalid board ${path}: ${String(error)}`);
        }
    }
    async write(entry) {
        const workspace = entry.record.workspace;
        if (workspace === undefined || !entry.dirty)
            return;
        const path = join(workspace, BOARD_FILE_NAME);
        const tmp = `${path}.tmp`;
        try {
            await writeFile(tmp, `${JSON.stringify(entry.record.store.exportJsonCanvas(), null, 2)}\n`, "utf8");
            await rename(tmp, path);
            entry.dirty = false;
        }
        catch (error) {
            this.deps.warn?.(`cult-canvas: cannot write ${path}: ${String(error)}`);
        }
    }
}
