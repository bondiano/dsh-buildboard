/**
 * External store wrapper: start an XState actor on first subscribe,
 * stop when the last listener leaves. Safe for useSyncExternalStore.
 */
import { createActor, } from "xstate";
export function createActorStore(logic, options) {
    const listeners = new Set();
    let actor = null;
    let snapshot = createActor(logic, options).getSnapshot();
    const emit = () => {
        for (const listener of listeners)
            listener();
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
