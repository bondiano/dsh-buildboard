import * as React from "react";
import { createBoardSessionStore } from "../../../application/board-session-store.js";
import type { BoardSummary } from "../../../domain/board.js";
import { useActorStore } from "../hooks/useActorStore.js";
import {
	BoardChromeContext,
	BUILDBOARD_TLDRAW_COMPONENTS,
	type BoardChromeValue,
} from "./BoardChromeContext.js";
import { CardShapeUtil } from "./CardShape.js";

export interface BoardViewProps {
	sessionId?: string;
	board?: string;
	boards?: BoardSummary[];
	licenseKey?: string;
	pollIntervalMs?: number;
	visible?: boolean;
	researchLabel?: string;
	implementLabel?: string;
	prettifyLabel?: string;
	boardsLabel?: string;
	newBoardLabel?: string;
	onResearch?: () => void;
	onImplement?: () => void;
	onSelectBoard?: (slug: string) => void;
	onCreateBoard?: () => void;
}

function useBoardConfigure(
	store: {
		send: (event: {
			type: "CONFIGURE";
			sessionId?: string;
			board?: string;
			visible?: boolean;
			pollIntervalMs?: number;
		}) => void;
	},
	props: BoardViewProps,
): void {
	const board = props.board ?? "main";
	const key = `${props.sessionId ?? ""}:${board}:${props.visible !== false}:${props.pollIntervalMs ?? 2000}`;
	const last = React.useRef("");
	if (last.current !== key) {
		last.current = key;
		queueMicrotask(() => {
			store.send({
				type: "CONFIGURE",
				sessionId: props.sessionId,
				board,
				visible: props.visible !== false,
				pollIntervalMs: props.pollIntervalMs ?? 2000,
			});
		});
	}
}

/**
 * Collaborative board: durable TLStore, user→host diffs, host→store merges.
 */
export function BoardView(props: BoardViewProps): React.ReactElement {
	const store = React.useState(() => createBoardSessionStore(CardShapeUtil))[0];
	const snapshot = useActorStore(store);
	const context = snapshot.context;
	const runtime = store.runtime;
	useBoardConfigure(store, props);

	const boardStyle: React.CSSProperties = {
		position: "relative",
		flex: 1,
		minHeight: 240,
		width: "100%",
		height: "100%",
		background: "#111",
		color: "#eee",
	};

	const mod = runtime.mod;
	const tlStore = runtime.store;
	const shapeUtils = React.useMemo(
		() => (mod ? [...mod.defaultShapeUtils, CardShapeUtil] : null),
		[mod],
	);

	const chromeValue = React.useMemo<BoardChromeValue>(
		() => ({
			mod,
			boards: props.boards ?? [],
			currentSlug: props.board ?? context.board,
			researchLabel: props.researchLabel ?? "Research",
			implementLabel: props.implementLabel ?? "Implement",
			prettifyLabel: props.prettifyLabel ?? "Prettify layout",
			boardsLabel: props.boardsLabel,
			newBoardLabel: props.newBoardLabel,
			onResearch: props.onResearch,
			onImplement: props.onImplement,
			onSelectBoard: props.onSelectBoard,
			onCreateBoard: props.onCreateBoard,
		}),
		[
			mod,
			props.boards,
			props.board,
			context.board,
			props.researchLabel,
			props.implementLabel,
			props.prettifyLabel,
			props.boardsLabel,
			props.newBoardLabel,
			props.onResearch,
			props.onImplement,
			props.onSelectBoard,
			props.onCreateBoard,
		],
	);

	if (mod && tlStore && shapeUtils && snapshot.matches("active")) {
		return (
			<div
				className="dsh-bb-board"
				data-buildboard-board={context.board}
				style={boardStyle}
			>
				<div className="dsh-bb-sync" data-sync={context.sync}>
					sync: {context.sync}
				</div>
				<BoardChromeContext.Provider value={chromeValue}>
					<TldrawCanvas
						mod={mod}
						tlStore={tlStore}
						shapeUtils={shapeUtils}
						licenseKey={props.licenseKey}
						onEditor={(editor) => {
							store.setEditor(editor);
						}}
					/>
				</BoardChromeContext.Provider>
				{context.error ? (
					<p className="dsh-bb-board-error" role="status">
						{context.error}
					</p>
				) : Object.keys(tlStore.serialize("document") ?? {}).filter((id) =>
						id.startsWith("shape:"),
				  ).length === 0 ? (
					<p className="dsh-bb-board-error" role="status">
						Board empty — run /canvas or draw shapes
					</p>
				) : null}
			</div>
		);
	}

	const fallback = runtime.fallback;
	return (
		<div
			className="dsh-bb-board"
			data-buildboard-board={context.board}
			style={boardStyle}
		>
			<div className="dsh-bb-fallback" style={{ padding: 16 }}>
				<strong>{fallback?.title ?? context.board}</strong>
				{context.error ? <p role="status">{context.error}</p> : null}
				{!context.error && !fallback ? (
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

interface TldrawCanvasProps {
	mod: typeof import("tldraw");
	tlStore: NonNullable<
		ReturnType<typeof createBoardSessionStore>["runtime"]["store"]
	>;
	shapeUtils: unknown[];
	licenseKey?: string;
	onEditor: (editor: {
		zoomToFit?(opts?: { animation?: { duration: number } }): void;
	}) => void;
}

/** Isolate Tldraw so parent catalog/sync churn does not recreate its props bag needlessly. */
function TldrawCanvas(props: TldrawCanvasProps): React.ReactElement {
	const { Tldraw } = props.mod;
	const fitted = React.useRef(false);
	const onEditor = props.onEditor;
	const tlStore = props.tlStore;

	const handleMount = React.useCallback(
		(editor: {
			zoomToFit?(opts?: { animation?: { duration: number } }): void;
		}) => {
			onEditor(editor);
			if (fitted.current) return;
			const shapeCount = Object.keys(
				tlStore.serialize("document") ?? {},
			).filter((id) => id.startsWith("shape:")).length;
			if (shapeCount === 0) return;
			fitted.current = true;
			try {
				editor.zoomToFit?.({ animation: { duration: 0 } });
			} catch {
				// ignore
			}
		},
		[onEditor, tlStore],
	);

	return (
		<Tldraw
			licenseKey={props.licenseKey || undefined}
			store={props.tlStore}
			inferDarkMode
			shapeUtils={props.shapeUtils as never}
			components={BUILDBOARD_TLDRAW_COMPONENTS}
			onMount={handleMount as never}
		/>
	);
}
