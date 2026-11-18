import * as React from "react";
import { createAppShellStore } from "../../../application/app-shell-store.js";
import { BUILDBOARD_API_ROUTE } from "../../../domain/route.js";
import { BoardView } from "../board/BoardView.js";
import { CardEditor } from "../cards/CardEditor.js";
import { useActorStore } from "../hooks/useActorStore.js";

export interface BuildboardAppProps {
	sessionId?: string;
	compact?: boolean;
	visible?: boolean;
	/** Board slug from a sidebar resource open (chat markdown link). */
	initialBoard?: string;
	/** Changes when sidebar navigates to another board address. */
	navigationKey?: string;
	licenseKey?: string;
	pollIntervalMs?: number;
	t?: (key: string) => string;
	onFullscreen?: () => void;
	canStartSession?: boolean;
	onStartRun?: (
		kind: "research" | "implement",
		board: string,
		prompt?: string,
	) => void;
}

function label(
	t: BuildboardAppProps["t"],
	key: string,
	fallback: string,
): string {
	return t ? t(key) : fallback;
}

function useConfigure(
	store: {
		send: (event: {
			type: "CONFIGURE";
			sessionId?: string;
			visible?: boolean;
			pollIntervalMs?: number;
		}) => void;
	},
	sessionId: string | undefined,
	visible: boolean,
	pollIntervalMs: number,
): void {
	const key = `${sessionId ?? ""}:${visible}:${pollIntervalMs}`;
	const last = React.useRef("");
	if (last.current !== key) {
		last.current = key;
		queueMicrotask(() => {
			store.send({
				type: "CONFIGURE",
				sessionId,
				visible,
				pollIntervalMs,
			});
		});
	}
}

export function BuildboardApp(props: BuildboardAppProps): React.ReactElement {
	const store = React.useState(() => createAppShellStore())[0];
	const snapshot = useActorStore(store);
	const context = snapshot.context;
	useConfigure(
		store,
		props.sessionId,
		props.visible !== false,
		props.pollIntervalMs ?? 2000,
	);

	const navKey = props.navigationKey ?? "";
	const lastNav = React.useRef("");
	if (
		props.initialBoard &&
		navKey &&
		lastNav.current !== navKey &&
		props.initialBoard !== context.board
	) {
		lastNav.current = navKey;
		queueMicrotask(() => {
			store.send({ type: "SET_BOARD", board: props.initialBoard! });
		});
	}

	const onStartRun = props.onStartRun;
	const sessionId = props.sessionId;
	const boardSlug = context.board;
	const startRun = React.useCallback(
		async (kind: "research" | "implement"): Promise<void> => {
			const brief = `Buildboard ${kind} on board ${boardSlug}. Use board_* and card_* tools, then run_report.`;
			const sessionQuery = sessionId
				? `session=${encodeURIComponent(sessionId)}`
				: "";
			try {
				const response = await fetch(
					`${BUILDBOARD_API_ROUTE}/runs?${sessionQuery}`,
					{
						method: "POST",
						headers: { "content-type": "application/json" },
						body: JSON.stringify({ kind, boardSlug, brief }),
					},
				);
				const body = (await response.json()) as { run?: { id?: string } };
				const runId = body.run?.id;
				const prompt = runId
					? `${brief}\n\nRun id: ${runId}. Open board slug: ${boardSlug}.`
					: brief;
				onStartRun?.(kind, boardSlug, prompt);
			} catch {
				onStartRun?.(kind, boardSlug, brief);
			}
		},
		[boardSlug, onStartRun, sessionId],
	);

	const onResearch = React.useCallback(() => {
		void startRun("research");
	}, [startRun]);
	const onImplement = React.useCallback(() => {
		void startRun("implement");
	}, [startRun]);
	const onSelectBoard = React.useCallback(
		(slug: string) => {
			store.send({ type: "SET_BOARD", board: slug });
		},
		[store],
	);
	const boardCount = context.boards.length;
	const visible = props.visible !== false;
	const pollIntervalMs = props.pollIntervalMs ?? 2000;
	const onCreateBoard = React.useCallback(() => {
		void (async () => {
			const sessionQuery = sessionId
				? `session=${encodeURIComponent(sessionId)}`
				: "";
			try {
				const response = await fetch(
					`${BUILDBOARD_API_ROUTE}/boards?${sessionQuery}`,
					{
						method: "POST",
						headers: { "content-type": "application/json" },
						body: JSON.stringify({
							title: `Board ${boardCount + 1}`,
						}),
					},
				);
				const body = (await response.json()) as { slug?: string };
				if (typeof body.slug === "string") {
					store.send({ type: "SET_BOARD", board: body.slug });
				}
				store.send({
					type: "CONFIGURE",
					sessionId,
					visible,
					pollIntervalMs,
				});
			} catch {
				// catalog poll will catch up
			}
		})();
	}, [boardCount, pollIntervalMs, sessionId, store, visible]);

	const rootStyle: React.CSSProperties = {
		display: "flex",
		flexDirection: "column",
		position: "absolute",
		inset: 0,
		width: "100%",
		height: "100%",
		minHeight: 240,
		boxSizing: "border-box",
		background: "#111",
		color: "#eee",
	};

	if (context.workspace === null) {
		return (
			<div
				className="dsh-bb-root"
				data-buildboard-app=""
				data-empty="workspace"
				style={rootStyle}
			>
				<div className="dsh-bb-empty" role="status" style={{ padding: 16 }}>
					<strong>
						{context.ensureError
							? label(
									props.t,
									"empty.noWorkspace",
									"У сессии нет workspace — доску сохранить некуда.",
								)
							: label(props.t, "empty.creating", "Создаём локальную доску…")}
					</strong>
					{context.ensureError ? (
						<>
							<p className="dsh-bb-empty-error" role="alert">
								{context.ensureError}
							</p>
							<button
								type="button"
								onClick={() => store.send({ type: "ENSURE" })}
							>
								{label(props.t, "empty.createLocal", "Создать локальную доску")}
							</button>
						</>
					) : null}
				</div>
			</div>
		);
	}

	return (
		<div className="dsh-bb-root" data-buildboard-app="" style={rootStyle}>
			<div className={`dsh-bb-shell${props.compact ? " is-compact" : ""}`}>
				{props.compact ? null : (
					<aside className="dsh-bb-side">
						<strong>{label(props.t, "boards.title", "Boards")}</strong>
						{context.boards.map((item) => (
							<div
								key={item.id}
								className={`dsh-bb-list-item${item.slug === context.board ? " is-active" : ""}`}
								onClick={() =>
									store.send({ type: "SET_BOARD", board: item.slug })
								}
								onKeyDown={(event) => {
									if (event.key === "Enter") {
										store.send({ type: "SET_BOARD", board: item.slug });
									}
								}}
								role="button"
								tabIndex={0}
							>
								{item.title}
								<div className="meta">{item.slug}</div>
							</div>
						))}
						<strong>{label(props.t, "library.title", "Cards")}</strong>
						{context.cards.map((item) => (
							<div
								key={`${item.scope}:${item.id}`}
								className={`dsh-bb-list-item${context.selectedCard?.id === item.id ? " is-active" : ""}`}
								onClick={() => store.send({ type: "SELECT_CARD", card: item })}
								onKeyDown={(event) => {
									if (event.key === "Enter") {
										store.send({ type: "SELECT_CARD", card: item });
									}
								}}
								role="button"
								tabIndex={0}
							>
								{item.title}
								<div className="meta">
									{item.scope} · {item.excerpt}
								</div>
							</div>
						))}
					</aside>
				)}
				{context.workspace === undefined ? (
					<div
						className="dsh-bb-board dsh-bb-fallback"
						role="status"
						style={{ padding: 16, color: "#eee" }}
					>
						{label(props.t, "empty.loading", "Загрузка доски…")}
					</div>
				) : (
					<BoardView
						sessionId={props.sessionId}
						board={context.board}
						boards={context.boards}
						licenseKey={props.licenseKey}
						pollIntervalMs={props.pollIntervalMs}
						visible={props.visible}
						researchLabel={label(props.t, "toolbar.research", "Research")}
						implementLabel={label(props.t, "toolbar.implement", "Implement")}
						prettifyLabel={label(
							props.t,
							"toolbar.prettify",
							"Prettify layout",
						)}
						boardsLabel={label(props.t, "boards.title", "Boards")}
						newBoardLabel={label(props.t, "boards.new", "New board")}
						onResearch={onResearch}
						onImplement={onImplement}
						onSelectBoard={onSelectBoard}
						onCreateBoard={onCreateBoard}
					/>
				)}
				{props.compact ? null : (
					<aside className="dsh-bb-detail">
						{context.selectedCard ? (
							<CardEditor
								scope={context.selectedCard.scope}
								id={context.selectedCard.id}
								title={context.cardTitle || context.selectedCard.title}
								body={context.cardBody}
								sessionId={props.sessionId}
								onSaved={(next) => {
									store.send({
										type: "CARD_SAVED",
										title: next.title,
										body: next.body,
									});
								}}
							/>
						) : (
							<strong>{label(props.t, "runs.title", "Runs")}</strong>
						)}
						{context.runs.map((run) => (
							<div key={run.id} className="dsh-bb-list-item">
								{run.kind} · {run.status}
								<div className="meta">{run.boardSlug}</div>
							</div>
						))}
					</aside>
				)}
			</div>
		</div>
	);
}
