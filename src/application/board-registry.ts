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
import type { JSONCanvasDocument } from "../domain/types.js";
import { CanvasStore } from "./canvas-store.js";

import { BOARD_FILE_NAME } from "../domain/route.js";

export { BOARD_FILE_NAME } from "../domain/route.js";

/** Delay that folds a burst of edits into one write. */
const AUTOSAVE_DEBOUNCE_MS = 2000;

/** One workspace's board. */
export interface BoardRecord {
	/** The board's store; the same instance for as long as the registry lives. */
	store: CanvasStore;
	/**
	 * Absolute workspace path, or undefined while none is known.
	 *
	 * The first caller able to resolve one attaches it, so a board opened by the
	 * browser before the Host knew the folder still gains its file.
	 */
	workspace: string | undefined;
	/** Settles once the file has been read and merged into the store. */
	ready: Promise<void>;
	/** Write pending changes now. */
	flush(): Promise<void>;
}

/** How the registry finds a session's workspace and writes its board. */
export interface BoardRegistryDeps {
	/** Absolute workspace directory for a session, when one is known. */
	resolveWorkspace(session?: string): string | undefined;
	/** Element cap applied to every board. */
	maxElements?: number;
	/** Diagnostic sink for unreadable or unwritable boards. */
	warn?(message: string): void;
}

interface Entry {
	record: BoardRecord;
	timer: NodeJS.Timeout | undefined;
	pending: Promise<void>;
	unsubscribe: () => void;
	dirty: boolean;
}

/** Key used for sessions without a workspace. */
const DEFAULT_KEY = "default";

export class BoardRegistry {
	private readonly entries = new Map<string, Entry>();
	private readonly deps: BoardRegistryDeps;

	constructor(deps: BoardRegistryDeps) {
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
	record(session?: string, explicit?: string): BoardRecord {
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
		const entry: Entry = {
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
			unsubscribe: () => {},
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
	dispose(): void {
		for (const entry of this.entries.values()) {
			clearTimeout(entry.timer);
			entry.unsubscribe();
		}
		this.entries.clear();
	}

	private async load(entry: Entry): Promise<void> {
		if (entry.record.workspace === undefined) return;
		const path = join(entry.record.workspace, BOARD_FILE_NAME);
		let text: string;
		try {
			text = await readFile(path, "utf8");
		} catch (error) {
			// A missing file is an empty board, not a failure.
			const code =
				typeof error === "object" && error !== null && "code" in error
					? error.code
					: undefined;
			if (code !== "ENOENT") {
				this.deps.warn?.(`cult-canvas: cannot read ${path}: ${String(error)}`);
			}
			return;
		}
		try {
			const doc = JSON.parse(text) as JSONCanvasDocument;
			if (!Array.isArray(doc.nodes)) throw new Error("no nodes array");
			entry.record.store.importJsonCanvas(doc);
			entry.dirty = false;
		} catch (error) {
			this.deps.warn?.(
				`cult-canvas: ignoring invalid board ${path}: ${String(error)}`,
			);
		}
	}

	private async write(entry: Entry): Promise<void> {
		const workspace = entry.record.workspace;
		if (workspace === undefined || !entry.dirty) return;
		const path = join(workspace, BOARD_FILE_NAME);
		const tmp = `${path}.tmp`;
		try {
			await writeFile(
				tmp,
				`${JSON.stringify(entry.record.store.exportJsonCanvas(), null, 2)}\n`,
				"utf8",
			);
			await rename(tmp, path);
			entry.dirty = false;
		} catch (error) {
			this.deps.warn?.(`cult-canvas: cannot write ${path}: ${String(error)}`);
		}
	}
}
