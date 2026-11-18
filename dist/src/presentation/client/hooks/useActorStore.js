import * as React from "react";
/** Bind an ActorStore with useSyncExternalStore. */
export function useActorStore(store) {
    const subscribe = React.useCallback((listener) => store.subscribe(listener), [store]);
    const getSnapshot = React.useCallback(() => store.getSnapshot(), [store]);
    return React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
/** Subscribe to a Cordis config form snapshot via useSyncExternalStore. */
export function useExternalSnapshot(subscribe, getSnapshot, fallback) {
    const emptySubscribe = React.useCallback((listener) => {
        void listener;
        return () => { };
    }, []);
    const read = React.useCallback(() => (getSnapshot ? getSnapshot() : fallback), [getSnapshot, fallback]);
    return React.useSyncExternalStore(subscribe ?? emptySubscribe, read, read);
}
