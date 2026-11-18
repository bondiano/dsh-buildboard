/**
 * Client app shell: workspace resolve, ensure, and catalog refresh.
 */
import { assign, fromCallback, fromPromise, setup } from "xstate";
import type { BoardSummary } from "../board.js";
import type { CardSummary } from "../card.js";

export type { BoardSummary, CardSummary };

export interface RunSummary {
	id: string;
	kind: string;
	status: string;
	boardSlug: string;
}

export interface AppShellCatalog {
	workspace: string | null;
	boards: BoardSummary[];
	cards: CardSummary[];
	runs: RunSummary[];
}

export interface AppShellContext {
	sessionId?: string;
	visible: boolean;
	pollIntervalMs: number;
	workspace: string | null | undefined;
	boards: BoardSummary[];
	cards: CardSummary[];
	runs: RunSummary[];
	board: string;
	selectedCard: CardSummary | null;
	cardBody: string;
	cardTitle: string;
	ensureError: string | null;
}

export type AppShellEvent =
	| {
			type: "CONFIGURE";
			sessionId?: string;
			visible?: boolean;
			pollIntervalMs?: number;
	  }
	| { type: "ENSURE" }
	| { type: "SET_BOARD"; board: string }
	| { type: "SELECT_CARD"; card: CardSummary }
	| { type: "CLEAR_CARD" }
	| { type: "CARD_SAVED"; title: string; body: string }
	| { type: "TICK" }
	| { type: "CATALOG"; catalog: AppShellCatalog };

/** Keep an existing selection; otherwise prefer the newest session board. */
export function preferBoard(boards: BoardSummary[], current: string): string {
	if (boards.length === 0) return current || "main";
	// Keep whatever the user (or /canvas) already selected, including "main".
	if (current && boards.some((item) => item.slug === current)) {
		return current;
	}
	const sorted = [...boards].sort((a, b) => b.updatedAt - a.updatedAt);
	const preferred =
		sorted.find((item) => item.slug.startsWith("session-")) ?? sorted[0];
	return preferred?.slug ?? (current || "main");
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

export const appShellMachine = setup({
	types: {
		context: {} as AppShellContext,
		events: {} as AppShellEvent,
	},
	actors: {
		refreshCatalog: fromPromise<AppShellCatalog, AppShellContext>(async () => {
			throw new Error("refreshCatalog actor must be provided");
		}),
		ensureWorkspace: fromPromise<AppShellCatalog, AppShellContext>(async () => {
			throw new Error("ensureWorkspace actor must be provided");
		}),
		loadCard: fromPromise<{ title: string; body: string }, AppShellContext>(
			async () => {
				throw new Error("loadCard actor must be provided");
			},
		),
		pollTicks: fromCallback<AppShellEvent, AppShellContext>(
			({ input, sendBack }) => {
				const timer = setInterval(
					() => sendBack({ type: "TICK" }),
					input.pollIntervalMs,
				);
				return () => clearInterval(timer);
			},
		),
	},
	guards: {
		isVisible: ({ context }) => context.visible !== false,
		workspaceMissing: ({ event }) => {
			if (!("output" in event)) return false;
			return (event.output as AppShellCatalog).workspace == null;
		},
	},
	actions: {
		applyConfigure: assign(({ context, event }) => {
			if (event.type !== "CONFIGURE") return {};
			return {
				sessionId: event.sessionId ?? context.sessionId,
				visible: event.visible ?? context.visible,
				pollIntervalMs: event.pollIntervalMs ?? context.pollIntervalMs,
			};
		}),
		applyCatalog: assign(({ context, event }) => {
			const output =
				event.type === "CATALOG"
					? event.catalog
					: "output" in event
						? (event.output as AppShellCatalog)
						: undefined;
			if (!output) return {};
			return {
				workspace: output.workspace,
				boards: output.boards,
				cards: output.cards,
				runs: output.runs,
				board: preferBoard(output.boards, context.board),
				ensureError: null,
			};
		}),
		applyEnsureFail: assign(({ event }) => ({
			workspace: null as string | null,
			ensureError:
				"error" in event ? errorMessage(event.error) : "ensure failed",
		})),
		setBoard: assign(({ event }) =>
			event.type === "SET_BOARD" ? { board: event.board } : {},
		),
		selectCard: assign(({ event }) =>
			event.type === "SELECT_CARD"
				? {
						selectedCard: event.card,
						cardTitle: event.card.title,
						cardBody: "",
					}
				: {},
		),
		clearCard: assign({
			selectedCard: null as CardSummary | null,
			cardBody: "",
			cardTitle: "",
		}),
		applyCard: assign(({ event }) => {
			if (!("output" in event)) return {};
			const output = event.output as { title: string; body: string };
			return { cardTitle: output.title, cardBody: output.body };
		}),
		applyCardSaved: assign(({ context, event }) => {
			if (event.type !== "CARD_SAVED" || !context.selectedCard) return {};
			const excerpt = event.body.split("\n").find((line) => line.trim()) ?? "";
			return {
				cardTitle: event.title,
				cardBody: event.body,
				selectedCard: {
					...context.selectedCard,
					title: event.title,
					excerpt,
				},
			};
		}),
	},
}).createMachine({
	id: "buildboardAppShell",
	initial: "idle",
	context: {
		visible: true,
		pollIntervalMs: 2000,
		workspace: undefined,
		boards: [],
		cards: [],
		runs: [],
		board: "main",
		selectedCard: null,
		cardBody: "",
		cardTitle: "",
		ensureError: null,
	},
	on: {
		SET_BOARD: { actions: "setBoard" },
		CLEAR_CARD: { actions: "clearCard" },
		CARD_SAVED: { actions: "applyCardSaved" },
	},
	states: {
		idle: {
			on: {
				CONFIGURE: { actions: "applyConfigure", target: "bootstrapping" },
			},
		},
		bootstrapping: {
			always: [
				{ guard: "isVisible", target: "refreshing" },
				{ target: "paused" },
			],
		},
		paused: {
			on: {
				CONFIGURE: { actions: "applyConfigure", target: "bootstrapping" },
			},
		},
		refreshing: {
			invoke: {
				src: "refreshCatalog",
				input: ({ context }) => context,
				onDone: [
					{
						guard: "workspaceMissing",
						target: "ensuring",
						actions: "applyCatalog",
					},
					{ target: "ready", actions: "applyCatalog" },
				],
				onError: { target: "ready" },
			},
		},
		ensuring: {
			invoke: {
				src: "ensureWorkspace",
				input: ({ context }) => context,
				onDone: { target: "ready", actions: "applyCatalog" },
				onError: { target: "missingWorkspace", actions: "applyEnsureFail" },
			},
		},
		missingWorkspace: {
			on: {
				ENSURE: "ensuring",
				CONFIGURE: { actions: "applyConfigure", target: "bootstrapping" },
			},
		},
		ready: {
			initial: "idle",
			invoke: {
				src: "pollTicks",
				input: ({ context }) => context,
			},
			on: {
				CATALOG: { actions: "applyCatalog" },
				ENSURE: "ensuring",
				SELECT_CARD: { actions: "selectCard", target: "loadingCard" },
				CONFIGURE: { actions: "applyConfigure", target: "bootstrapping" },
			},
			states: {
				idle: {
					on: {
						// Refresh in a child state so we never leave `ready` (leaving
						// remounts BoardView chrome every pollIntervalMs).
						TICK: "polling",
					},
				},
				polling: {
					invoke: {
						src: "refreshCatalog",
						input: ({ context }) => context,
						onDone: { target: "idle", actions: "applyCatalog" },
						onError: { target: "idle" },
					},
					on: {
						TICK: {},
					},
				},
			},
		},
		loadingCard: {
			invoke: {
				src: "loadCard",
				input: ({ context }) => context,
				onDone: { target: "ready", actions: "applyCard" },
				onError: { target: "ready" },
			},
			on: {
				SELECT_CARD: { actions: "selectCard", target: "loadingCard" },
				CLEAR_CARD: { actions: "clearCard", target: "ready" },
			},
		},
	},
});
