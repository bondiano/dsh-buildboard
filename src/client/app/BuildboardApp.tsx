import * as React from "react";
import { BUILDBOARD_API_ROUTE } from "../../domain/route.js";
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

	const sessionQuery = props.sessionId
		? `session=${encodeURIComponent(props.sessionId)}`
		: "";

	React.useEffect(() => {
		if (props.visible === false) return;
		let cancelled = false;
		async function refresh(): Promise<void> {
			try {
				const [b, c, r] = await Promise.all([
					fetch(`${BUILDBOARD_API_ROUTE}/boards?${sessionQuery}`).then((x) =>
						x.json(),
					),
					fetch(`${BUILDBOARD_API_ROUTE}/cards?${sessionQuery}`).then((x) =>
						x.json(),
					),
					fetch(`${BUILDBOARD_API_ROUTE}/runs`).then((x) => x.json()),
				]);
				if (cancelled) return;
				setBoards((b as { boards: BoardSummary[] }).boards ?? []);
				setCards((c as { cards: CardSummary[] }).cards ?? []);
				setRuns((r as { runs: RunSummary[] }).runs ?? []);
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
	}, [props.sessionId, props.visible, props.pollIntervalMs, sessionQuery]);

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

	return (
		<div className="dsh-bb-root" data-buildboard-app="">
			<div className="dsh-bb-toolbar">
				<button type="button" onClick={() => void startRun("research")}>
					{label(props.t, "toolbar.research", "Research")}
				</button>
				<button type="button" onClick={() => void startRun("implement")}>
					{label(props.t, "toolbar.implement", "Implement")}
				</button>
				{props.onFullscreen ? (
					<button type="button" onClick={props.onFullscreen}>
						{label(props.t, "toolbar.fullscreen", "Fullscreen")}
					</button>
				) : null}
			</div>
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
				<BoardView
					sessionId={props.sessionId}
					board={board}
					licenseKey={props.licenseKey}
					pollIntervalMs={props.pollIntervalMs}
					visible={props.visible}
				/>
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
