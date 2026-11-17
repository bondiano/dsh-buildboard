/**
 * Canvas element execution machine (mirrors
 * extensions/dsh/machines/machines/dsh-cult-canvas.mjs).
 *
 * Models one PipelineEngine.executeNode run: a queued element becomes running,
 * then completed or failed. Kept dependency-free (xstate only).
 */
import { createMachine, transition } from "xstate";
export const canvasElementMachine = createMachine({
    id: "canvasElement",
    initial: "idle",
    description: "Single-node execution: queued element becomes running, then completed or failed.",
    states: {
        idle: { on: { EXECUTE: "running" } },
        running: { on: { COMPLETE: "completed", FAIL: "failed" } },
        completed: { type: "final" },
        failed: { type: "final" },
    },
});
/**
 * Pure machine step (no actors); illegal transitions throw so model drift
 * fails in tests instead of silently corrupting element status.
 */
export function nextElementStatus(status, event) {
    const snapshot = canvasElementMachine.resolveState({ value: status });
    if (!snapshot.can({ type: event })) {
        throw new Error(`illegal transition: ${status} --${event}-->`);
    }
    return transition(canvasElementMachine, snapshot, { type: event })[0]
        .value;
}
