/**
 * Client board session: load tldraw, then pull/push against the host store.
 * Sync phase status is mirrored through boardSyncMachine helpers.
 */
import { assign, fromCallback, fromPromise, setup } from "xstate";
import { nextSyncStatus } from "./board-sync.machine.js";
function advanceSync(status, event) {
    try {
        return nextSyncStatus(status, event);
    }
    catch {
        return status;
    }
}
export const boardSessionMachine = setup({
    types: {
        context: {},
        events: {},
    },
    actors: {
        loadModule: fromPromise(async () => {
            throw new Error("loadModule actor must be provided");
        }),
        pullOnce: fromPromise(async () => {
            throw new Error("pullOnce actor must be provided");
        }),
        pollTicks: fromCallback(({ input, sendBack }) => {
            const timer = setInterval(() => sendBack({ type: "TICK" }), input.pollIntervalMs);
            return () => clearInterval(timer);
        }),
    },
    guards: {
        isVisible: ({ context }) => context.visible !== false,
        moduleReady: ({ context }) => context.moduleReady,
    },
    actions: {
        applyConfigure: assign(({ context, event }) => {
            if (event.type !== "CONFIGURE")
                return {};
            const boardChanged = event.board !== undefined && event.board !== context.board;
            const sessionChanged = event.sessionId !== undefined && event.sessionId !== context.sessionId;
            return {
                sessionId: event.sessionId ?? context.sessionId,
                board: event.board ?? context.board,
                visible: event.visible ?? context.visible,
                pollIntervalMs: event.pollIntervalMs ?? context.pollIntervalMs,
                ...(boardChanged || sessionChanged
                    ? {
                        sync: "idle",
                        error: null,
                    }
                    : {}),
            };
        }),
        markModuleReady: assign({
            moduleReady: true,
            error: null,
        }),
        markModuleFail: assign(({ event }) => ({
            moduleReady: false,
            error: event.type === "MODULE_FAIL" ? event.error : "module failed",
        })),
        syncPull: assign(({ context }) => ({
            sync: advanceSync(context.sync, "PULL"),
        })),
        syncPush: assign(({ context }) => ({
            sync: advanceSync(context.sync, "PUSH"),
        })),
        syncOk: assign(({ context }) => ({
            sync: advanceSync(context.sync, "OK"),
            error: null,
        })),
        syncFail: assign(({ context, event }) => ({
            sync: advanceSync(context.sync, "FAIL"),
            error: event.type === "PULL_FAIL" || event.type === "PUSH_FAIL"
                ? event.error
                : context.error,
        })),
        syncReconnect: assign(({ context }) => ({
            sync: advanceSync(context.sync, "RECONNECT"),
            error: null,
        })),
    },
}).createMachine({
    id: "buildboardBoardSession",
    initial: "idle",
    context: {
        board: "main",
        visible: true,
        pollIntervalMs: 2000,
        sync: "idle",
        error: null,
        moduleReady: false,
    },
    states: {
        idle: {
            on: {
                CONFIGURE: { actions: "applyConfigure", target: "loadingModule" },
            },
        },
        loadingModule: {
            invoke: {
                src: "loadModule",
                input: ({ context }) => context,
                onDone: { target: "active", actions: "markModuleReady" },
                onError: {
                    target: "failed",
                    actions: assign({
                        error: ({ event }) => event.error instanceof Error
                            ? event.error.message
                            : String(event.error),
                        moduleReady: false,
                    }),
                },
            },
            on: {
                CONFIGURE: { actions: "applyConfigure", target: "loadingModule" },
            },
        },
        active: {
            initial: "idleSync",
            invoke: {
                src: "pollTicks",
                input: ({ context }) => context,
            },
            on: {
                CONFIGURE: [
                    {
                        guard: ({ context, event }) => event.type === "CONFIGURE" &&
                            ((event.board !== undefined && event.board !== context.board) ||
                                (event.sessionId !== undefined &&
                                    event.sessionId !== context.sessionId)),
                        actions: "applyConfigure",
                        target: "loadingModule",
                    },
                    { actions: "applyConfigure" },
                ],
                RECONNECT: { actions: "syncReconnect" },
            },
            states: {
                idleSync: {
                    on: {
                        TICK: { guard: "isVisible", target: "pulling" },
                        PUSH: { target: "pushing", actions: "syncPush" },
                    },
                },
                pulling: {
                    entry: "syncPull",
                    invoke: {
                        src: "pullOnce",
                        input: ({ context }) => context,
                        onDone: { target: "idleSync", actions: "syncOk" },
                        onError: {
                            target: "idleSync",
                            actions: assign({
                                sync: ({ context }) => advanceSync(context.sync, "FAIL"),
                                error: ({ event }) => event.error instanceof Error
                                    ? event.error.message
                                    : String(event.error),
                            }),
                        },
                    },
                    on: {
                        PUSH: { target: "pushing", actions: "syncPush" },
                    },
                },
                pushing: {
                    on: {
                        PUSH_OK: { target: "idleSync", actions: "syncOk" },
                        PUSH_FAIL: { target: "idleSync", actions: "syncFail" },
                        TICK: {},
                    },
                },
            },
        },
        failed: {
            on: {
                CONFIGURE: { actions: "applyConfigure", target: "loadingModule" },
                RECONNECT: { target: "loadingModule", actions: "syncReconnect" },
            },
        },
    },
});
