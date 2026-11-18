/**
 * Board session store: tldraw module/store lifecycle + host pull/push.
 */
import { fromCallback, fromPromise } from "xstate";
import {
	BUILDBOARD_API_ROUTE,
	WORKSPACE_REQUIRED,
	WORKSPACE_REQUIRED_HINT,
} from "../domain/route.js";
import { boardSessionMachine } from "../domain/machines/board-session.machine.js";
import { createActorStore, type ActorStore } from "./actor-store.js";

export type TldrawModule = typeof import("tldraw");
export type TLStore = ReturnType<TldrawModule["createTLStore"]>;

export interface BoardSessionRuntime {
	mod: TldrawModule | null;
	store: TLStore | null;
	editor: {
		zoomToFit?(opts?: { animation?: { duration: number } }): void;
	} | null;
	revision: number;
	dirty: boolean;
	applyingRemote: boolean;
	fallback: BoardSnapshot | null;
	/** Fit camera once per board load — never on every poll (that flickers the UI). */
	didInitialFit: boolean;
}

export interface BoardSnapshot {
	id: string;
	slug: string;
	title: string;
	revision: number;
	records: Record<string, Record<string, unknown>>;
}

function syncUrl(sessionId: string | undefined, board: string): string {
	const params = new URLSearchParams();
	if (sessionId) params.set("session", sessionId);
	params.set("board", board);
	return `${BUILDBOARD_API_ROUTE}/state?${params.toString()}`;
}

/** Client-side guard: incomplete agent shapes must not hit tldraw validation. */
export function normalizeClientShape(
	record: Record<string, unknown>,
): Record<string, unknown> {
	if (record.typeName !== "shape") return record;
	const props =
		typeof record.props === "object" && record.props !== null
			? { ...(record.props as Record<string, unknown>) }
			: {};
	if (record.type === "card") {
		if (typeof props.w !== "number") props.w = 260;
		if (typeof props.h !== "number") props.h = 160;
		if (typeof props.title !== "string") props.title = "Card";
		if (typeof props.excerpt !== "string") props.excerpt = "";
		if (typeof props.kind !== "string") props.kind = "note";
		if (typeof props.cardRef !== "string") props.cardRef = "";
		if (typeof props.runStatus !== "string") props.runStatus = "";
	}
	return {
		...record,
		x: typeof record.x === "number" ? record.x : 0,
		y: typeof record.y === "number" ? record.y : 0,
		rotation: typeof record.rotation === "number" ? record.rotation : 0,
		opacity: typeof record.opacity === "number" ? record.opacity : 1,
		isLocked: typeof record.isLocked === "boolean" ? record.isLocked : false,
		parentId:
			typeof record.parentId === "string" ? record.parentId : "page:page",
		index: typeof record.index === "string" ? record.index : "a1",
		meta:
			typeof record.meta === "object" && record.meta !== null
				? record.meta
				: {},
		props,
	};
}

function ensureTldrawCss(): void {
	if (typeof document === "undefined") return;
	if (document.querySelector('link[data-dsh-bb-tldraw-css="1"]')) return;
	const link = document.createElement("link");
	link.rel = "stylesheet";
	link.href = `${BUILDBOARD_API_ROUTE}/assets/tldraw.css`;
	link.setAttribute("data-dsh-bb-tldraw-css", "1");
	link.onerror = () => {
		link.href = "https://unpkg.com/tldraw@3.15.1/tldraw.css";
	};
	document.head?.append(link);
}

export interface BoardSessionStore extends ActorStore<
	ReturnType<typeof provideMachine>
> {
	runtime: BoardSessionRuntime;
	setEditor(editor: BoardSessionRuntime["editor"]): void;
	attachPushListener(CardShapeUtil: unknown): () => void;
}

function provideMachine(runtime: BoardSessionRuntime, CardShapeUtil: unknown) {
	return boardSessionMachine.provide({
		actors: {
			loadModule: fromPromise(async () => {
				ensureTldrawCss();
				const loaded = await import("tldraw");
				if (!runtime.store) {
					runtime.store = loaded.createTLStore({
						shapeUtils: [...loaded.defaultShapeUtils, CardShapeUtil as never],
					});
				}
				runtime.mod = loaded;
			}),
			pullOnce: fromPromise(async ({ input }) => {
				if (runtime.dirty) return;
				const store = runtime.store;
				const url = syncUrl(input.sessionId, input.board);
				const response = await fetch(`${url}&since=${runtime.revision}`);
				const body = (await response.json()) as
					| BoardSnapshot
					| { revision: number }
					| { error?: string; message?: string };
				if (
					response.status === 409 ||
					(typeof body === "object" &&
						body !== null &&
						"error" in body &&
						body.error === WORKSPACE_REQUIRED)
				) {
					throw new Error(
						(typeof body === "object" &&
						body !== null &&
						"message" in body &&
						typeof body.message === "string"
							? body.message
							: null) ?? WORKSPACE_REQUIRED_HINT,
					);
				}
				if (!response.ok) throw new Error(`HTTP ${response.status}`);
				if (!("records" in body)) return;
				runtime.revision = body.revision;
				runtime.fallback = body;
				if (!store) return;
				runtime.applyingRemote = true;
				try {
					store.mergeRemoteChanges(() => {
						const existing = new Set(Object.keys(store.serialize("document")));
						const nextIds = new Set(Object.keys(body.records));
						for (const id of existing) {
							if (!nextIds.has(id)) store.remove([id as never]);
						}
						const put = Object.values(body.records)
							.filter(
								(record) =>
									record &&
									typeof record === "object" &&
									typeof record.id === "string",
							)
							.map(normalizeClientShape);
						if (put.length > 0) store.put(put as never[]);
					});
				} finally {
					runtime.applyingRemote = false;
				}
				const shapeCount = Object.values(body.records).filter(
					(record) => record?.typeName === "shape",
				).length;
				if (shapeCount > 0 && !runtime.didInitialFit) {
					runtime.didInitialFit = true;
					try {
						runtime.editor?.zoomToFit?.({
							animation: { duration: 200 },
						});
					} catch {
						// editor may not be mounted yet
					}
				}
			}),
			pollTicks: fromCallback(({ input, sendBack }) => {
				const timer = setInterval(
					() => sendBack({ type: "TICK" }),
					input.pollIntervalMs,
				);
				return () => clearInterval(timer);
			}),
		},
	});
}

export function createBoardSessionStore(
	CardShapeUtil: unknown,
): BoardSessionStore {
	const runtime: BoardSessionRuntime = {
		mod: null,
		store: null,
		editor: null,
		revision: 0,
		dirty: false,
		applyingRemote: false,
		fallback: null,
		didInitialFit: false,
	};
	const machine = provideMachine(runtime, CardShapeUtil);
	const base = createActorStore(machine);

	const send: typeof base.send = (event) => {
		if (event.type === "CONFIGURE") {
			const snap = base.getSnapshot().context;
			const boardChanged =
				event.board !== undefined && event.board !== snap.board;
			const sessionChanged =
				event.sessionId !== undefined && event.sessionId !== snap.sessionId;
			if (boardChanged || sessionChanged) {
				runtime.revision = 0;
				runtime.dirty = false;
				runtime.fallback = null;
				runtime.didInitialFit = false;
			}
		}
		base.send(event);
	};

	const attachPushListener = (): (() => void) => {
		const store = runtime.store;
		const actor = base.getActor();
		if (!store || !actor) return () => {};
		let timer: ReturnType<typeof setTimeout> | undefined;
		const pendingPut = new Map<string, Record<string, unknown>>();
		const pendingRemove = new Set<string>();

		const flush = (): void => {
			if (pendingPut.size === 0 && pendingRemove.size === 0) {
				runtime.dirty = false;
				return;
			}
			const put = [...pendingPut.values()];
			const remove = [...pendingRemove];
			pendingPut.clear();
			pendingRemove.clear();
			const snap = actor.getSnapshot().context;
			actor.send({ type: "PUSH" });
			void fetch(syncUrl(snap.sessionId, snap.board), {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					put,
					remove,
					actor: "user",
					clientTime: Date.now(),
				}),
			})
				.then(async (response) => {
					if (!response.ok) throw new Error(`HTTP ${response.status}`);
					const body = (await response.json()) as { revision?: number };
					if (typeof body.revision === "number") {
						runtime.revision = body.revision;
					}
					runtime.dirty = pendingPut.size > 0 || pendingRemove.size > 0;
					actor.send({ type: "PUSH_OK" });
				})
				.catch((err: unknown) => {
					runtime.dirty = true;
					actor.send({
						type: "PUSH_FAIL",
						error: err instanceof Error ? err.message : String(err),
					});
				});
		};

		const unlisten = store.listen(
			(entry) => {
				if (runtime.applyingRemote) return;
				if (entry.source !== "user") return;
				runtime.dirty = true;
				for (const [id, change] of Object.entries(entry.changes.added)) {
					pendingPut.set(id, change as unknown as Record<string, unknown>);
					pendingRemove.delete(id);
				}
				for (const [id, [, next]] of Object.entries(entry.changes.updated)) {
					pendingPut.set(id, next as unknown as Record<string, unknown>);
					pendingRemove.delete(id);
				}
				for (const id of Object.keys(entry.changes.removed)) {
					pendingPut.delete(id);
					pendingRemove.add(id);
				}
				if (timer) clearTimeout(timer);
				timer = setTimeout(flush, 400);
			},
			{ source: "user", scope: "document" },
		);

		return () => {
			unlisten();
			if (timer) clearTimeout(timer);
		};
	};

	// Attach push listener when module becomes ready (first transition to active).
	let detachPush: (() => void) | undefined;
	const originalSubscribe = base.subscribe.bind(base);
	return {
		...base,
		send,
		runtime,
		setEditor(editor) {
			runtime.editor = editor;
		},
		attachPushListener,
		subscribe(listener) {
			const unsubscribe = originalSubscribe(() => {
				const snap = base.getSnapshot();
				if (snap.matches("active") && runtime.store && !detachPush) {
					detachPush = attachPushListener();
				}
				if (!snap.matches("active") && detachPush) {
					detachPush();
					detachPush = undefined;
					runtime.revision = 0;
					runtime.dirty = false;
					runtime.fallback = null;
				}
				listener();
			});
			return () => {
				detachPush?.();
				detachPush = undefined;
				unsubscribe();
			};
		},
	};
}
