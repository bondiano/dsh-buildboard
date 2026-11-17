/**
 * Client-side sync state for one open board.
 */
import { createMachine, transition } from "xstate";
export const boardSyncMachine = createMachine({
    id: "buildboardSync",
    initial: "idle",
    description: "Client board sync: idle, pushing local diffs, pulling remote, or offline.",
    states: {
        idle: { on: { PUSH: "pushing", PULL: "pulling", DROP: "offline" } },
        pushing: {
            on: { OK: "idle", PULL: "pulling", DROP: "offline", FAIL: "offline" },
        },
        pulling: {
            on: { OK: "idle", PUSH: "pushing", DROP: "offline", FAIL: "offline" },
        },
        offline: { on: { RECONNECT: "idle" } },
    },
});
export function nextSyncStatus(status, event) {
    const snapshot = boardSyncMachine.resolveState({ value: status });
    if (!snapshot.can({ type: event })) {
        throw new Error(`illegal transition: ${status} --${event}-->`);
    }
    return transition(boardSyncMachine, snapshot, { type: event })[0]
        .value;
}
