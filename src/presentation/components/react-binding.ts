/**
 * React 19 Binding & Virtual DOM Helpers for DSH Cult Canvas
 *
 * Provides typed access to React runtime supplied by the host module loader
 * with a zero-dependency fallback for headless / server-side unit tests.
 *
 * @module @local/dsh-cult-canvas/presentation/components/react-binding
 */

export type ClientReact = typeof import("react");
export type ClientNode = import("react").ReactNode;

export interface VNode {
	type: unknown;
	props: Record<string, unknown>;
	key?: string | number | null;
	children: unknown[];
}

/** Fallback minimal React implementation when host React is not yet injected. */
const fallbackReact: Record<string, unknown> = {
	Fragment: "dsh-fragment",
	createElement(
		type: unknown,
		props: Record<string, unknown> | null,
		...children: unknown[]
	): VNode {
		const flatChildren = children.flat();
		const p: Record<string, unknown> = { ...props };
		if (flatChildren.length > 0) {
			p["children"] =
				flatChildren.length === 1 ? flatChildren[0] : flatChildren;
		}
		return {
			type,
			props: p,
			key: (props?.["key"] as string | number) ?? null,
			children: flatChildren,
		};
	},
	useState<T>(
		initial: T | (() => T),
	): [T, (val: T | ((prev: T) => T)) => void] {
		const val =
			typeof initial === "function" ? (initial as () => T)() : initial;
		return [val, () => {}];
	},
	useEffect(cb: () => void | (() => void)): void {
		if (typeof cb === "function") {
			try {
				const disposer = cb();
				if (typeof disposer === "function") {
					// disposed on cleanup
				}
			} catch {
				// ignore in fallback
			}
		}
	},
	useCallback<T>(fn: T): T {
		return fn;
	},
	useMemo<T>(fn: () => T): T {
		return fn();
	},
	useRef<T>(initial: T): { current: T } {
		return { current: initial };
	},
};

let activeReact: ClientReact | null = null;

function mergeWithFallback(
	partial: Partial<ClientReact> | null | undefined,
): ClientReact {
	if (!partial) {
		return fallbackReact as unknown as ClientReact;
	}
	return {
		createElement:
			typeof partial.createElement === "function"
				? partial.createElement.bind(partial)
				: fallbackReact.createElement,
		Fragment: partial.Fragment ?? fallbackReact.Fragment,
		useState:
			typeof partial.useState === "function"
				? partial.useState.bind(partial)
				: fallbackReact.useState,
		useEffect:
			typeof partial.useEffect === "function"
				? partial.useEffect.bind(partial)
				: fallbackReact.useEffect,
		useCallback:
			typeof partial.useCallback === "function"
				? partial.useCallback.bind(partial)
				: fallbackReact.useCallback,
		useMemo:
			typeof partial.useMemo === "function"
				? partial.useMemo.bind(partial)
				: fallbackReact.useMemo,
		useRef:
			typeof partial.useRef === "function"
				? partial.useRef.bind(partial)
				: fallbackReact.useRef,
	} as unknown as ClientReact;
}

export function setReact(
	reactInstance: Partial<ClientReact> | null | undefined,
): void {
	if (reactInstance) {
		activeReact = mergeWithFallback(reactInstance);
	}
}

export function getReact(): ClientReact {
	if (activeReact) return activeReact;

	// Check window.React
	if (typeof window !== "undefined") {
		const win = window as unknown as { React?: Partial<ClientReact> };
		if (win.React && typeof win.React.createElement === "function") {
			activeReact = mergeWithFallback(win.React);
			return activeReact;
		}
	}

	// Check globalThis.React
	if (typeof globalThis !== "undefined") {
		const glob = globalThis as unknown as { React?: Partial<ClientReact> };
		if (glob.React && typeof glob.React.createElement === "function") {
			activeReact = mergeWithFallback(glob.React);
			return activeReact;
		}
	}

	return fallbackReact as unknown as ClientReact;
}

/**
 * Convenience createElement helper `h`.
 */
export function h(
	type: unknown,
	props?: Record<string, unknown> | null,
	...children: unknown[]
): ClientNode {
	const r = getReact();
	const createFn = r.createElement as unknown as (
		type: unknown,
		props: unknown,
		...children: unknown[]
	) => ClientNode;
	return createFn(type, props, ...children);
}

export function useState<T>(
	initial: T | (() => T),
): [T, (val: T | ((prev: T) => T)) => void] {
	return getReact().useState(initial);
}

export function useEffect(
	effect: () => void | (() => void),
	deps?: unknown[],
): void {
	getReact().useEffect(effect, deps);
}

export function useCallback<T extends Function>(fn: T, deps: unknown[]): T {
	const cbFn = getReact().useCallback as unknown as (
		fn: Function,
		deps: unknown[],
	) => T;
	return cbFn(fn, deps);
}

export function useMemo<T>(fn: () => T, deps: unknown[]): T {
	return getReact().useMemo(fn, deps);
}

export function useRef<T>(initial: T): { current: T } {
	return getReact().useRef(initial);
}
