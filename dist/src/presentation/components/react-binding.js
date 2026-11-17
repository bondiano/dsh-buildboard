/**
 * React 19 Binding & Virtual DOM Helpers for DSH Cult Canvas
 *
 * Provides typed access to React runtime supplied by the host module loader
 * with a zero-dependency fallback for headless / server-side unit tests.
 *
 * @module @local/dsh-cult-canvas/presentation/components/react-binding
 */
/** Fallback minimal React implementation when host React is not yet injected. */
const fallbackReact = {
    Fragment: "dsh-fragment",
    createElement(type, props, ...children) {
        const flatChildren = children.flat();
        const p = { ...props };
        if (flatChildren.length > 0) {
            p["children"] =
                flatChildren.length === 1 ? flatChildren[0] : flatChildren;
        }
        return {
            type,
            props: p,
            key: props?.["key"] ?? null,
            children: flatChildren,
        };
    },
    useState(initial) {
        const val = typeof initial === "function" ? initial() : initial;
        return [val, () => { }];
    },
    useEffect(cb) {
        if (typeof cb === "function") {
            try {
                const disposer = cb();
                if (typeof disposer === "function") {
                    // disposed on cleanup
                }
            }
            catch {
                // ignore in fallback
            }
        }
    },
    useCallback(fn) {
        return fn;
    },
    useMemo(fn) {
        return fn();
    },
    useRef(initial) {
        return { current: initial };
    },
};
let activeReact = null;
function mergeWithFallback(partial) {
    if (!partial) {
        return fallbackReact;
    }
    return {
        createElement: typeof partial.createElement === "function"
            ? partial.createElement.bind(partial)
            : fallbackReact.createElement,
        Fragment: partial.Fragment ?? fallbackReact.Fragment,
        useState: typeof partial.useState === "function"
            ? partial.useState.bind(partial)
            : fallbackReact.useState,
        useEffect: typeof partial.useEffect === "function"
            ? partial.useEffect.bind(partial)
            : fallbackReact.useEffect,
        useCallback: typeof partial.useCallback === "function"
            ? partial.useCallback.bind(partial)
            : fallbackReact.useCallback,
        useMemo: typeof partial.useMemo === "function"
            ? partial.useMemo.bind(partial)
            : fallbackReact.useMemo,
        useRef: typeof partial.useRef === "function"
            ? partial.useRef.bind(partial)
            : fallbackReact.useRef,
    };
}
export function setReact(reactInstance) {
    if (reactInstance) {
        activeReact = mergeWithFallback(reactInstance);
    }
}
export function getReact() {
    if (activeReact)
        return activeReact;
    // Check window.React
    if (typeof window !== "undefined") {
        const win = window;
        if (win.React && typeof win.React.createElement === "function") {
            activeReact = mergeWithFallback(win.React);
            return activeReact;
        }
    }
    // Check globalThis.React
    if (typeof globalThis !== "undefined") {
        const glob = globalThis;
        if (glob.React && typeof glob.React.createElement === "function") {
            activeReact = mergeWithFallback(glob.React);
            return activeReact;
        }
    }
    return fallbackReact;
}
/**
 * Convenience createElement helper `h`.
 */
export function h(type, props, ...children) {
    const r = getReact();
    const createFn = r.createElement;
    return createFn(type, props, ...children);
}
export function useState(initial) {
    return getReact().useState(initial);
}
export function useEffect(effect, deps) {
    getReact().useEffect(effect, deps);
}
export function useCallback(fn, deps) {
    const cbFn = getReact().useCallback;
    return cbFn(fn, deps);
}
export function useMemo(fn, deps) {
    return getReact().useMemo(fn, deps);
}
export function useRef(initial) {
    return getReact().useRef(initial);
}
