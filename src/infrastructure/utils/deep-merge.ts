/**
 * Deep merges two objects cleanly preserving unmentioned nested keys.
 * Guards against circular references using WeakSet.
 */
export function deepMerge<
	T extends Record<string, unknown>,
	S extends Record<string, unknown>,
>(target: T, source: S, seen: WeakSet<object> = new WeakSet()): T & S {
	const output: Record<string, unknown> = { ...target };
	if (seen.has(source)) {
		return output as T & S;
	}
	seen.add(source);
	for (const key of Object.keys(source)) {
		const sVal = source[key];
		const tVal = (target as Record<string, unknown>)[key];
		if (
			sVal &&
			typeof sVal === "object" &&
			!Array.isArray(sVal) &&
			tVal &&
			typeof tVal === "object" &&
			!Array.isArray(tVal)
		) {
			output[key] = deepMerge(
				tVal as Record<string, unknown>,
				sVal as Record<string, unknown>,
				seen,
			);
		} else if (sVal !== undefined) {
			output[key] = sVal;
		}
	}
	return output as T & S;
}
