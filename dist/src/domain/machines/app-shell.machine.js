/**
 * Client app shell: workspace resolve, ensure, and catalog refresh.
 */
import { assign, fromCallback, fromPromise, setup } from "xstate";
/** Keep an existing selection; otherwise prefer the newest session board. */
export function preferBoard(boards, current) {
    if (boards.length === 0)
        return current || "main";
    // Keep whatever the user (or /canvas) already selected, including "main".
    if (current && boards.some((item) => item.slug === current)) {
        return current;
    }
    const sorted = [...boards].sort((a, b) => b.updatedAt - a.updatedAt);
    const preferred = sorted.find((item) => item.slug.startsWith("session-")) ?? sorted[0];
    return preferred?.slug ?? (current || "main");
}
function errorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}
export const appShellMachine = setup({
    types: {
        context: {},
        events: {},
    },
    actors: {
        refreshCatalog: fromPromise(async () => {
            throw new Error("refreshCatalog actor must be provided");
        }),
        ensureWorkspace: fromPromise(async () => {
            throw new Error("ensureWorkspace actor must be provided");
        }),
        loadCard: fromPromise(async () => {
            throw new Error("loadCard actor must be provided");
        }),
        pollTicks: fromCallback(({ input, sendBack }) => {
            const timer = setInterval(() => sendBack({ type: "TICK" }), input.pollIntervalMs);
            return () => clearInterval(timer);
        }),
    },
    guards: {
        isVisible: ({ context }) => context.visible !== false,
        workspaceMissing: ({ event }) => {
            if (!("output" in event))
                return false;
            return event.output.workspace == null;
        },
    },
    actions: {
        applyConfigure: assign(({ context, event }) => {
            if (event.type !== "CONFIGURE")
                return {};
            return {
                sessionId: event.sessionId ?? context.sessionId,
                visible: event.visible ?? context.visible,
                pollIntervalMs: event.pollIntervalMs ?? context.pollIntervalMs,
            };
        }),
        applyCatalog: assign(({ context, event }) => {
            if (!("output" in event))
                return {};
            const output = event.output;
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
            workspace: null,
            ensureError: "error" in event ? errorMessage(event.error) : "ensure failed",
        })),
        setBoard: assign(({ event }) => event.type === "SET_BOARD" ? { board: event.board } : {}),
        selectCard: assign(({ event }) => event.type === "SELECT_CARD"
            ? {
                selectedCard: event.card,
                cardTitle: event.card.title,
                cardBody: "",
            }
            : {}),
        clearCard: assign({
            selectedCard: null,
            cardBody: "",
            cardTitle: "",
        }),
        applyCard: assign(({ event }) => {
            if (!("output" in event))
                return {};
            const output = event.output;
            return { cardTitle: output.title, cardBody: output.body };
        }),
        applyCardSaved: assign(({ context, event }) => {
            if (event.type !== "CARD_SAVED" || !context.selectedCard)
                return {};
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
            invoke: {
                src: "pollTicks",
                input: ({ context }) => context,
            },
            on: {
                TICK: "refreshing",
                ENSURE: "ensuring",
                SELECT_CARD: { actions: "selectCard", target: "loadingCard" },
                CONFIGURE: { actions: "applyConfigure", target: "bootstrapping" },
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
