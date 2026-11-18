import * as React from "react";
import {
	BUILDBOARD_API_ROUTE,
	WORKSPACE_REQUIRED,
} from "../../domain/route.js";
import { BoardView } from "../board/BoardView.js";
import { CardEditor } from "../cards/CardEditor.js";

export interface BuildboardAppProps {
	sessionId?: string;
	compact?: boolean;
	visible?: boolean;
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

interface BoardSummary {
	id: string;
	slug: string;
	title: string;
	updatedAt: number;
}

interface CardSummary {
	id: string;
	scope: string;
	title: string;
	excerpt: string;
	updatedAt: number;
}

interface RunSummary {
	id: string;
	kind: string;
	status: string;
	boardSlug: string;
	updatedAt: number;
}

function label(
	t: BuildboardAppProps["t"],
	key: string,
	fallback: string,
): string {
	return t ? t(key) : fallback;
}

export function BuildboardApp(props: BuildboardAppProps): React.ReactElement {
	const [boards, setBoards] = React.useState<BoardSummary[]>([]);
	const [cards, setCards] = React.useState<CardSummary[]>([]);
	const [runs, setRuns] = React.useState<RunSummary[]>([]);
	const [board, setBoard] = React.useState("main");
	const [selectedCard, setSelectedCard] = React.useState<CardSummary | null>(
		null,
	);
	const [cardBody, setCardBody] = React.useState("");
	const [cardTitle, setCardTitle] = React.useState("");
	const [workspace, setWorkspace] = React.useState<string | null | undefined>(
		undefined,
	);
	const [ensureError, setEnsureError] = React.useState<string | null>(null);

	const sessionQuery = props.sessionId
		? `session=${encodeURIComponent(props.sessionId)}`
		: "";

	const applyWorkspacePayload = React.useCallback(
		(body: {
			workspace?: string | null;
			boards?: BoardSummary[];
			cards?: CardSummary[];
			runs?: RunSummary[];
		}) => {
			setWorkspace(
				typeof body.workspace === "string"
					? body.workspace
					: body.workspace === null
						? null
						: undefined,
			);
			if (body.boards) setBoards(body.boards);
			if (body.cards) setCards(body.cards);
			if (body.runs) setRuns(body.runs);
		},
		[],
	);

	const ensureLocalWorkspace = React.useCallback(async (): Promise<boolean> => {
		setEnsureError(null);
		try {
			const response = await fetch(
				`${BUILDBOARD_API_ROUTE}/workspace/ensure?${sessionQuery}`,
				{ method: "POST" },
			);
			const body = (await response.json()) as {
				workspace?: string;
				boards?: BoardSummary[];
				message?: string;
			};
			if (!response.ok) {
				setEnsureError(body.message ?? `HTTP ${response.status}`);
				setWorkspace(null);
				return false;
			}
			applyWorkspacePayload(body);
			setBoard("main");
			return true;
		} catch (error) {
			setEnsureError(String(error));
			setWorkspace(null);
			return false;
		}
	}, [applyWorkspacePayload, sessionQuery]);

	React.useEffect(() => {
		if (props.visible === false) return;
		let cancelled = false;
		async function refresh(): Promise<void> {
			try {
				const metaRes = await fetch(
					`${BUILDBOARD_API_ROUTE}/meta?${sessionQuery}`,
				);
				if (cancelled) return;
				const meta = (await metaRes.json()) as {
					workspace?: string | null;
					error?: string;
				};
				const missingWorkspace =
					metaRes.status === 409 ||
					meta.error === WORKSPACE_REQUIRED ||
					meta.workspace == null;
				if (missingWorkspace) {
					const ok = await ensureLocalWorkspace();
					if (cancelled || !ok) return;
				} else {
					setWorkspace(
						typeof meta.workspace === "string" ? meta.workspace : null,
					);
				}
				const [bRes, cRes, rRes] = await Promise.all([
					fetch(`${BUILDBOARD_API_ROUTE}/boards?${sessionQuery}`),
					fetch(`${BUILDBOARD_API_ROUTE}/cards?${sessionQuery}`),
					fetch(`${BUILDBOARD_API_ROUTE}/runs`),
				]);
				if (cancelled) return;
				const b = (await bRes.json()) as {
					boards?: BoardSummary[];
					workspace?: string | null;
				};
				const c = (await cRes.json()) as { cards?: CardSummary[] };
				const r = (await rRes.json()) as { runs?: RunSummary[] };
				applyWorkspacePayload({
					workspace: b.workspace ?? meta.workspace,
					boards: b.boards ?? [],
					cards: c.cards ?? [],
					runs: r.runs ?? [],
				});
			} catch {
				// host may be temporarily unavailable
			}
		}
		void refresh();
		const timer = setInterval(
			() => void refresh(),
			props.pollIntervalMs ?? 2000,
		);
		return () => {
			cancelled = true;
			clearInterval(timer);
		};
	}, [
		props.sessionId,
		props.visible,
		props.pollIntervalMs,
		sessionQuery,
		ensureLocalWorkspace,
		applyWorkspacePayload,
	]);

	React.useEffect(() => {
		if (!selectedCard) {
			setCardBody("");
			setCardTitle("");
			return;
		}
		let cancelled = false;
		void fetch(
			`${BUILDBOARD_API_ROUTE}/cards/${selectedCard.scope}:${selectedCard.id}?${sessionQuery}`,
		)
			.then((r) => r.json())
			.then((body: { card?: { body?: string; title?: string } }) => {
				if (cancelled) return;
				setCardBody(body.card?.body ?? "");
				setCardTitle(body.card?.title ?? selectedCard.title);
			})
			.catch(() => {
				if (!cancelled) {
					setCardBody("");
					setCardTitle(selectedCard.title);
				}
			});
		return () => {
			cancelled = true;
		};
	}, [selectedCard, sessionQuery]);

	React.useEffect(() => {
		if (boards.length === 0) return;
		const preferred =
			[...boards].sort((a, b) => b.updatedAt - a.updatedAt).find((item) =>
				item.slug.startsWith("session-"),
			) ??
			[...boards].sort((a, b) => b.updatedAt - a.updatedAt)[0];
		if (!preferred) return;
		setBoard((current) => {
			if (boards.some((item) => item.slug === current) && current !== "main") {
				return current;
			}
			return preferred.slug;
		});
	}, [boards]);

	const startRun = async (kind: "research" | "implement"): Promise<void> => {
		const brief = `Buildboard ${kind} on board ${board}. Use board_* and card_* tools, then run_report.`;
		try {
			const response = await fetch(
				`${BUILDBOARD_API_ROUTE}/runs?${sessionQuery}`,
				{
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ kind, boardSlug: board, brief }),
				},
			);
			const body = (await response.json()) as { run?: { id?: string } };
			const runId = body.run?.id;
			const prompt = runId
				? `${brief}\n\nRun id: ${runId}. Open board slug: ${board}.`
				: brief;
			props.onStartRun?.(kind, board, prompt);
		} catch {
			props.onStartRun?.(kind, board, brief);
		}
	};

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

	if (workspace === null) {
		return (
			<div
				className="dsh-bb-root"
				data-buildboard-app=""
				data-empty="workspace"
				style={rootStyle}
			>
				<div className="dsh-bb-empty" role="status" style={{ padding: 16 }}>
					<strong>
						{ensureError
							? label(
									props.t,
									"empty.noWorkspace",
									"У сессии нет workspace — доску сохранить некуда.",
								)
							: label(props.t, "empty.creating", "Создаём локальную доску…")}
					</strong>
					{ensureError ? (
						<>
							<p className="dsh-bb-empty-error" role="alert">
								{ensureError}
							</p>
							<button type="button" onClick={() => void ensureLocalWorkspace()}>
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
						{boards.map((item) => (
							<div
								key={item.id}
								className={`dsh-bb-list-item${item.slug === board ? " is-active" : ""}`}
								onClick={() => setBoard(item.slug)}
								onKeyDown={(event) => {
									if (event.key === "Enter") setBoard(item.slug);
								}}
								role="button"
								tabIndex={0}
							>
								{item.title}
								<div className="meta">{item.slug}</div>
							</div>
						))}
						<strong>{label(props.t, "library.title", "Cards")}</strong>
						{cards.map((item) => (
							<div
								key={`${item.scope}:${item.id}`}
								className={`dsh-bb-list-item${selectedCard?.id === item.id ? " is-active" : ""}`}
								onClick={() => setSelectedCard(item)}
								onKeyDown={(event) => {
									if (event.key === "Enter") setSelectedCard(item);
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
				{workspace === undefined ? (
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
						board={board}
						licenseKey={props.licenseKey}
						pollIntervalMs={props.pollIntervalMs}
						visible={props.visible}
						researchLabel={label(props.t, "toolbar.research", "Research")}
						implementLabel={label(
							props.t,
							"toolbar.implement",
							"Implement",
						)}
						onResearch={() => {
							void startRun("research");
						}}
						onImplement={() => {
							void startRun("implement");
						}}
					/>
				)}
				{props.compact ? null : (
					<aside className="dsh-bb-detail">
						{selectedCard ? (
							<CardEditor
								scope={selectedCard.scope}
								id={selectedCard.id}
								title={cardTitle || selectedCard.title}
								body={cardBody}
								sessionId={props.sessionId}
								onSaved={(next) => {
									setCardBody(next.body);
									setCardTitle(next.title);
									setSelectedCard({
										...selectedCard,
										title: next.title,
										excerpt: next.body.split("\n").find((l) => l.trim()) ?? "",
									});
								}}
							/>
						) : (
							<strong>{label(props.t, "runs.title", "Runs")}</strong>
						)}
						{runs.map((run) => (
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
