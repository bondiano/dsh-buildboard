/**
 * Card editor external store: TipTap load + debounced persist via machine.
 */
import { fromPromise } from "xstate";
import { BUILDBOARD_API_ROUTE } from "../domain/route.js";
import { cardEditorMachine } from "../domain/machines/card-editor.machine.js";
import { createActorStore, type ActorStore } from "./actor-store.js";

export type TipTapReact = typeof import("@tiptap/react");
export type TipTapStarter = typeof import("@tiptap/starter-kit");

export interface CardEditorRuntime {
	tiptap: {
		react: TipTapReact;
		starter: TipTapStarter["default"];
	} | null;
	onSaved?: (next: { title: string; body: string }) => void;
}

export type CardEditorStore = ActorStore<ReturnType<typeof provideMachine>> & {
	runtime: CardEditorRuntime;
};

function provideMachine(runtime: CardEditorRuntime) {
	return cardEditorMachine.provide({
		actors: {
			loadTipTap: fromPromise(async () => {
				const [react, starter] = await Promise.all([
					import("@tiptap/react"),
					import("@tiptap/starter-kit"),
				]);
				runtime.tiptap = {
					react,
					starter: starter.default,
				};
			}),
			persistCard: fromPromise(async ({ input }) => {
				const params = new URLSearchParams();
				if (input.sessionId) params.set("session", input.sessionId);
				const response = await fetch(
					`${BUILDBOARD_API_ROUTE}/cards/${input.scope}:${input.id}?${params}`,
					{
						method: "PUT",
						headers: { "content-type": "application/json" },
						body: JSON.stringify({ title: input.title, body: input.body }),
					},
				);
				if (!response.ok) throw new Error(`HTTP ${response.status}`);
				const next = { title: input.title, body: input.body };
				runtime.onSaved?.(next);
				return next;
			}),
		},
	});
}

export function createCardEditorStore(
	onSaved?: (next: { title: string; body: string }) => void,
): CardEditorStore {
	const runtime: CardEditorRuntime = { tiptap: null, onSaved };
	const machine = provideMachine(runtime);
	const base = createActorStore(machine);
	return { ...base, runtime };
}
