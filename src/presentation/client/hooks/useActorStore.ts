import * as React from "react";
import type { ActorStore } from "../../../application/actor-store.js";
import type { AnyActorLogic, SnapshotFrom } from "xstate";

/** Bind an ActorStore with useSyncExternalStore. */
export function useActorStore<TLogic extends AnyActorLogic>(
	store: ActorStore<TLogic>,
): SnapshotFrom<TLogic> {
	const subscribe = React.useCallback(
		(listener: () => void) => store.subscribe(listener),
		[store],
	);
	const getSnapshot = React.useCallback(() => store.getSnapshot(), [store]);
	return React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Subscribe to a Cordis config form snapshot via useSyncExternalStore. */
export function useExternalSnapshot<T>(
	subscribe: ((listener: () => void) => () => void) | undefined,
	getSnapshot: (() => T) | undefined,
	fallback: T,
): T {
	const emptySubscribe = React.useCallback((listener: () => void) => {
		void listener;
		return () => {};
	}, []);
	const read = React.useCallback(
		() => (getSnapshot ? getSnapshot() : fallback),
		[getSnapshot, fallback],
	);
	return React.useSyncExternalStore(subscribe ?? emptySubscribe, read, read);
}
