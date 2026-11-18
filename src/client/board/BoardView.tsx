import * as React from "react";
import {
	BUILDBOARD_API_ROUTE,
	WORKSPACE_REQUIRED,
	WORKSPACE_REQUIRED_HINT,
} from "../../domain/route.js";
import {
	nextSyncStatus,
	type SyncStatus,
} from "../../domain/machines/board-sync.machine.js";
import { BuildboardMainMenu } from "./BuildboardMenu.js";
import { CardShapeUtil } from "./CardShape.js";

export interface BoardViewProps {
	sessionId?: string;
	board?: string;
	licenseKey?: string;
	pollIntervalMs?: number;
	visible?: boolean;
	researchLabel?: string;
	implementLabel?: string;
	onResearch?: () => void;
	onImplement?: () => void;
}

interface BoardSnapshot {
	id: string;
	slug: string;
	title: string;
	revision: number;
	records: Record<string, Record<string, unknown>>;
}

type TldrawModule = typeof import("tldraw");

function syncUrl(sessionId: string | undefined, board: string): string {
	const params = new URLSearchParams();
	if (sessionId) params.set("session", sessionId);
	params.set("board", board);
	return `${BUILDBOARD_API_ROUTE}/state?${params.toString()}`;
}

/** Client-side guard: incomplete agent shapes must not hit tldraw validation. */
function normalizeClientShape(
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

/**
 * Collaborative board: durable TLStore, user→host diffs, host→store merges.
 */
export function BoardView(props: BoardViewProps): React.ReactElement {
	const board = props.board ?? "main";
	const pollIntervalMs = props.pollIntervalMs ?? 2000;
	const [mod, setMod] = React.useState<TldrawModule | null>(null);
	const [error, setError] = React.useState<string | null>(null);
	const [fallback, setFallback] = React.useState<BoardSnapshot | null>(null);
	const [sync, setSync] = React.useState<SyncStatus>("idle");
	const revisionRef = React.useRef(0);
	const applyingRemote = React.useRef(false);
	const dirtyRef = React.useRef(false);
	const syncRef = React.useRef<SyncStatus>("idle");
	const storeRef = React.useRef<ReturnType<
		TldrawModule["createTLStore"]
	> | null>(null);
	const editorRef = React.useRef<{
		zoomToFit?(opts?: { animation?: { duration: number } }): void;
	} | null>(null);

	React.useEffect(() => {
		revisionRef.current = 0;
		dirtyRef.current = false;
		setFallback(null);
		setError(null);
		setSync("idle");
		syncRef.current = "idle";
	}, [props.sessionId, board]);

	const setSyncStatus = React.useCallback(
		(event: Parameters<typeof nextSyncStatus>[1]) => {
			try {
				const next = nextSyncStatus(syncRef.current, event);
				syncRef.current = next;
				setSync(next);
			} catch {
				// illegal sync transitions are ignored
			}
		},
		[],
	);

	React.useEffect(() => {
		ensureTldrawCss();
		let cancelled = false;
		void import("tldraw")
			.then((loaded) => {
				if (cancelled) return;
				if (!storeRef.current) {
					storeRef.current = loaded.createTLStore({
						shapeUtils: [...loaded.defaultShapeUtils, CardShapeUtil],
					});
				}
				setMod(loaded);
			})
			.catch((err: unknown) => {
				if (!cancelled) setError(`tldraw unavailable: ${String(err)}`);
			});
		return () => {
			cancelled = true;
		};
	}, []);

	React.useEffect(() => {
		if (props.visible === false) return;
		const store = storeRef.current;
		let cancelled = false;
		const url = syncUrl(props.sessionId, board);

		async function pull(): Promise<void> {
			if (dirtyRef.current) return;
			setSyncStatus("PULL");
			try {
				const response = await fetch(`${url}&since=${revisionRef.current}`);
				const body = (await response.json()) as
					| BoardSnapshot
					| { revision: number }
					| { error?: string; message?: string };
				if (cancelled) return;
				if (
					response.status === 409 ||
					(typeof body === "object" &&
						body !== null &&
						"error" in body &&
						body.error === WORKSPACE_REQUIRED)
				) {
					setError(
						(typeof body === "object" &&
						body !== null &&
						"message" in body &&
						typeof body.message === "string"
							? body.message
							: null) ?? WORKSPACE_REQUIRED_HINT,
					);
					setSyncStatus("FAIL");
					return;
				}
				if (!response.ok) throw new Error(`HTTP ${response.status}`);
				if (!("records" in body)) {
					setSyncStatus("OK");
					return;
				}
				revisionRef.current = body.revision;
				setFallback(body);
				setError(null);
				if (!store) {
					setSyncStatus("OK");
					return;
				}
				applyingRemote.current = true;
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
					applyingRemote.current = false;
				}
				const shapeCount = Object.values(body.records).filter(
					(record) => record?.typeName === "shape",
				).length;
				if (shapeCount > 0) {
					try {
						editorRef.current?.zoomToFit?.({
							animation: { duration: 200 },
						});
					} catch {
						// editor may not be mounted yet
					}
				}
				setSyncStatus("OK");
			} catch (err) {
				if (!cancelled) {
					setError(String(err));
					setSyncStatus("FAIL");
				}
			}
		}

		void pull();
		const timer = setInterval(() => void pull(), pollIntervalMs);
		return () => {
			cancelled = true;
			clearInterval(timer);
		};
	}, [
		props.sessionId,
		board,
		pollIntervalMs,
		props.visible,
		mod,
		setSyncStatus,
	]);

	React.useEffect(() => {
		const store = storeRef.current;
		if (!store) return;
		let timer: ReturnType<typeof setTimeout> | undefined;
		const pendingPut = new Map<string, Record<string, unknown>>();
		const pendingRemove = new Set<string>();

		const flush = (): void => {
			if (pendingPut.size === 0 && pendingRemove.size === 0) {
				dirtyRef.current = false;
				return;
			}
			const put = [...pendingPut.values()];
			const remove = [...pendingRemove];
			pendingPut.clear();
			pendingRemove.clear();
			setSyncStatus("PUSH");
			void fetch(syncUrl(props.sessionId, board), {
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
						revisionRef.current = body.revision;
					}
					dirtyRef.current = pendingPut.size > 0 || pendingRemove.size > 0;
					setSyncStatus("OK");
				})
				.catch(() => {
					dirtyRef.current = true;
					setSyncStatus("FAIL");
				});
		};

		const unlisten = store.listen(
			(entry) => {
				if (applyingRemote.current) return;
				if (entry.source !== "user") return;
				dirtyRef.current = true;
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
	}, [props.sessionId, board, mod, setSyncStatus]);

	const boardStyle: React.CSSProperties = {
		position: "relative",
		flex: 1,
		minHeight: 240,
		width: "100%",
		height: "100%",
		background: "#111",
		color: "#eee",
	};

	if (mod && storeRef.current) {
		const { Tldraw, defaultShapeUtils } = mod;
		const researchLabel = props.researchLabel ?? "Research";
		const implementLabel = props.implementLabel ?? "Implement";
		return (
			<div
				className="dsh-bb-board"
				data-buildboard-board={board}
				style={boardStyle}
			>
				<div className="dsh-bb-sync" data-sync={sync}>
					sync: {sync}
				</div>
				<Tldraw
					licenseKey={props.licenseKey || undefined}
					store={storeRef.current}
					shapeUtils={[...defaultShapeUtils, CardShapeUtil]}
					components={{
						MainMenu: () => (
							<BuildboardMainMenu
								mod={mod}
								researchLabel={researchLabel}
								implementLabel={implementLabel}
								onResearch={props.onResearch}
								onImplement={props.onImplement}
							/>
						),
					}}
					onMount={(editor) => {
						editorRef.current = editor;
						const shapeCount = Object.keys(
							storeRef.current?.serialize("document") ?? {},
						).filter((id) => id.startsWith("shape:")).length;
						if (shapeCount > 0) {
							try {
								editor.zoomToFit({ animation: { duration: 0 } });
							} catch {
								// ignore
							}
						}
					}}
				/>
				{error ? (
					<p className="dsh-bb-board-error" role="status">
						{error}
					</p>
				) : null}
			</div>
		);
	}

	return (
		<div
			className="dsh-bb-board"
			data-buildboard-board={board}
			style={boardStyle}
		>
			<div className="dsh-bb-fallback" style={{ padding: 16 }}>
				<strong>{fallback?.title ?? board}</strong>
				{error ? <p role="status">{error}</p> : null}
				{!error && !fallback ? (
					<p role="status">Loading canvas…</p>
				) : null}
				<ul>
					{Object.values(fallback?.records ?? {})
						.filter((r) => r.typeName === "shape")
						.slice(0, 40)
						.map((record) => (
							<li key={String(record.id)}>
								{typeof record.type === "string" ? record.type : "shape"} ·{" "}
								{typeof record.id === "string" ? record.id : "?"}
								{(record.meta as { updatedBy?: string } | undefined)
									?.updatedBy === "agent" ? (
									<span className="dsh-bb-agent-chip">agent</span>
								) : null}
							</li>
						))}
				</ul>
			</div>
		</div>
	);
}
