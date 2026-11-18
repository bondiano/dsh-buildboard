import * as React from "react";
import { createBoardSessionStore } from "../../../application/board-session-store.js";
import type { BoardSummary } from "../../../domain/board.js";
import { useActorStore } from "../hooks/useActorStore.js";
import { BuildboardMainMenu } from "./BuildboardMenu.js";
import { BuildboardPageMenu } from "./BuildboardPageMenu.js";
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
	if (mod && tlStore && snapshot.matches("active")) {
		const { Tldraw, defaultShapeUtils } = mod;
		const researchLabel = props.researchLabel ?? "Research";
		const implementLabel = props.implementLabel ?? "Implement";
		const prettifyLabel = props.prettifyLabel ?? "Prettify layout";
		return (
			<div
				className="dsh-bb-board"
				data-buildboard-board={context.board}
				style={boardStyle}
			>
				<div className="dsh-bb-sync" data-sync={context.sync}>
					sync: {context.sync}
				</div>
				<Tldraw
					licenseKey={props.licenseKey || undefined}
					store={tlStore}
					inferDarkMode
					shapeUtils={[...defaultShapeUtils, CardShapeUtil]}
					components={{
						MainMenu: () => (
							<BuildboardMainMenu
								mod={mod}
								researchLabel={researchLabel}
								implementLabel={implementLabel}
								prettifyLabel={prettifyLabel}
								onResearch={props.onResearch}
								onImplement={props.onImplement}
							/>
						),
						PageMenu: () => (
							<BuildboardPageMenu
								boards={props.boards ?? []}
								currentSlug={props.board ?? context.board}
								boardsLabel={props.boardsLabel}
								newBoardLabel={props.newBoardLabel}
								onSelectBoard={(slug) => props.onSelectBoard?.(slug)}
								onCreateBoard={props.onCreateBoard}
							/>
						),
					}}
					onMount={(editor) => {
						store.setEditor(editor);
						const shapeCount = Object.keys(
							tlStore.serialize("document") ?? {},
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
