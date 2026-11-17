/**
 * Lifecycle of one research / implement / canvas run.
 * Status names match CardRunState.status.
 */
import { createMachine, transition } from "xstate";
import type { RunStatus } from "../card.js";

export const runMachine = createMachine({
	id: "buildboardRun",
	initial: "draft",
	description:
		"Agent run started from the board: draft through review to a terminal state.",
	states: {
		draft: { on: { QUEUE: "queued", CANCEL: "cancelled" } },
		queued: { on: { START: "running", CANCEL: "cancelled" } },
		running: {
			on: {
				NEED_INPUT: "needsInput",
				REVIEW: "review",
				FAIL: "failed",
				CANCEL: "cancelled",
			},
		},
		needsInput: {
			on: {
				RESUME: "running",
				FAIL: "failed",
				CANCEL: "cancelled",
			},
		},
		review: {
			on: {
				ACCEPT: "done",
				RESUME: "running",
				FAIL: "failed",
				CANCEL: "cancelled",
			},
		},
		done: { type: "final" },
		failed: { type: "final" },
		cancelled: { type: "final" },
	},
});

export type RunEvent =
	| "QUEUE"
	| "START"
	| "NEED_INPUT"
	| "RESUME"
	| "REVIEW"
	| "ACCEPT"
	| "FAIL"
	| "CANCEL";

/** Pure step; illegal transitions throw. */
export function nextRunStatus(status: RunStatus, event: RunEvent): RunStatus {
	const snapshot = runMachine.resolveState({ value: status });
	if (!snapshot.can({ type: event })) {
		throw new Error(`illegal transition: ${status} --${event}-->`);
	}
	return transition(runMachine, snapshot, { type: event })[0]
		.value as RunStatus;
}
