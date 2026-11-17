/**
 * Recursively strips undefined keys and normalizes NaN/Infinity to null
 * for DSH snapshotJsonValue compliance.
 * Handles circular references by detecting already-visited objects and returning null.
 */
export function stripUndefined<T>(
	value: T,
	seen: WeakSet<object> = new WeakSet(),
): T {
	if (value === undefined) {
		return undefined as unknown as T;
	}
	if (typeof value === "number") {
		if (Number.isNaN(value) || !Number.isFinite(value)) {
			return null as unknown as T;
		}
		return value;
	}
	if (value === null || typeof value !== "object") {
		return value;
	}
	if (seen.has(value)) {
		return null as unknown as T;
	}
	seen.add(value);
	if (Array.isArray(value)) {
		return value.map((item) =>
			item === undefined ? null : stripUndefined(item, seen),
		) as unknown as T;
	}
	const result: Record<string, unknown> = {};
	for (const [key, val] of Object.entries(value)) {
		if (val !== undefined) {
			result[key] = stripUndefined(val, seen);
		}
	}
	return result as T;
}
