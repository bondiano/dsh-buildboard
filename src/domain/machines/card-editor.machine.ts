/**
 * TipTap card editor lifecycle: load editor, debounce save, report status.
 */
import { assign, fromPromise, setup } from "xstate";

export type CardEditorStatus = "idle" | "saving" | "saved" | "error";

export interface CardEditorContext {
	scope: string;
	id: string;
	sessionId?: string;
	title: string;
	body: string;
	status: CardEditorStatus;
	error: string | null;
	tiptapReady: boolean;
}

export type CardEditorEvent =
	| {
			type: "OPEN";
			scope: string;
			id: string;
			sessionId?: string;
			title: string;
			body: string;
	  }
	| { type: "TITLE"; title: string }
	| { type: "BODY"; body: string }
	| { type: "FLUSH" }
	| { type: "TIPTAP_READY" }
	| { type: "TIPTAP_FAIL"; error: string };

export const cardEditorMachine = setup({
	types: {
		context: {} as CardEditorContext,
		events: {} as CardEditorEvent,
	},
	actors: {
		loadTipTap: fromPromise<void, CardEditorContext>(async () => {
			throw new Error("loadTipTap actor must be provided");
		}),
		persistCard: fromPromise<
			{ title: string; body: string },
			CardEditorContext
		>(async () => {
			throw new Error("persistCard actor must be provided");
		}),
	},
	actions: {
		applyOpen: assign(({ event }) => {
			if (event.type !== "OPEN") return {};
			return {
				scope: event.scope,
				id: event.id,
				sessionId: event.sessionId,
				title: event.title,
				body: event.body,
				status: "idle" as CardEditorStatus,
				error: null,
			};
		}),
		setTitle: assign(({ event }) =>
			event.type === "TITLE"
				? { title: event.title, status: "idle" as const }
				: {},
		),
		setBody: assign(({ event }) =>
			event.type === "BODY"
				? { body: event.body, status: "idle" as const }
				: {},
		),
		markTipTapReady: assign({ tiptapReady: true, error: null }),
		markTipTapFail: assign(({ event }) => ({
			tiptapReady: false,
			error: event.type === "TIPTAP_FAIL" ? event.error : "tiptap failed",
		})),
		markSaving: assign({ status: "saving" as const, error: null }),
		markSaved: assign(({ event }) => {
			if (!("output" in event)) return { status: "saved" as const };
			const output = event.output as { title: string; body: string };
			return {
				status: "saved" as const,
				title: output.title,
				body: output.body,
				error: null,
			};
		}),
		markSaveError: assign(({ event }) => {
			const raw =
				"error" in event ? (event as { error: unknown }).error : undefined;
			let message = "save failed";
			if (raw instanceof Error) message = raw.message;
			else if (typeof raw === "string") message = raw;
			else if (raw !== undefined) message = JSON.stringify(raw);
			return {
				status: "error" as const,
				error: message,
			};
		}),
	},
}).createMachine({
	id: "buildboardCardEditor",
	initial: "loading",
	context: {
		scope: "",
		id: "",
		title: "",
		body: "",
		status: "idle",
		error: null,
		tiptapReady: false,
	},
	on: {
		OPEN: { actions: "applyOpen", target: ".loading" },
	},
	states: {
		loading: {
			invoke: {
				src: "loadTipTap",
				input: ({ context }) => context,
				onDone: { target: "editing", actions: "markTipTapReady" },
				onError: {
					target: "editing",
					actions: assign({
						tiptapReady: false,
						error: ({ event }) =>
							event.error instanceof Error
								? event.error.message
								: String(event.error),
					}),
				},
			},
		},
		editing: {
			on: {
				TITLE: { actions: "setTitle", target: "debounce" },
				BODY: { actions: "setBody", target: "debounce" },
				FLUSH: "saving",
			},
		},
		debounce: {
			after: {
				600: "saving",
			},
			on: {
				TITLE: { actions: "setTitle", target: "debounce" },
				BODY: { actions: "setBody", target: "debounce" },
				FLUSH: "saving",
			},
		},
		saving: {
			entry: "markSaving",
			invoke: {
				src: "persistCard",
				input: ({ context }) => context,
				onDone: { target: "editing", actions: "markSaved" },
				onError: { target: "editing", actions: "markSaveError" },
			},
			on: {
				TITLE: { actions: "setTitle" },
				BODY: { actions: "setBody" },
			},
		},
	},
});
