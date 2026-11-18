/**
 * External store wrapper: start an XState actor on first subscribe,
 * stop when the last listener leaves. Safe for useSyncExternalStore.
 */
import {
	type Actor,
	type AnyActorLogic,
	type SnapshotFrom,
	createActor,
} from "xstate";

export interface ActorStore<TLogic extends AnyActorLogic> {
	subscribe(listener: () => void): () => void;
	getSnapshot(): SnapshotFrom<TLogic>;
	send: Actor<TLogic>["send"];
	getActor(): Actor<TLogic> | null;
}

export function createActorStore<TLogic extends AnyActorLogic>(
	logic: TLogic,
	options?: Parameters<typeof createActor<TLogic>>[1],
): ActorStore<TLogic> {
	const listeners = new Set<() => void>();
	let actor: Actor<TLogic> | null = null;
	let snapshot: SnapshotFrom<TLogic> = createActor(
		logic,
		options,
	).getSnapshot();

	const emit = (): void => {
		for (const listener of listeners) listener();
	};

	return {
		subscribe(listener) {
			listeners.add(listener);
			if (listeners.size === 1) {
				actor = createActor(logic, options);
				actor.subscribe((next) => {
					snapshot = next;
					emit();
				});
				actor.start();
				snapshot = actor.getSnapshot();
				emit();
			}
			return () => {
				listeners.delete(listener);
				if (listeners.size === 0 && actor) {
					actor.stop();
					actor = null;
				}
			};
		},
		getSnapshot() {
			return actor ? actor.getSnapshot() : snapshot;
		},
		send(event) {
			actor?.send(event);
		},
		getActor() {
			return actor;
		},
	};
}
