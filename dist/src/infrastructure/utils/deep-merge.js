/**
 * Deep merges two objects cleanly preserving unmentioned nested keys.
 * Guards against circular references using WeakSet.
 */
export function deepMerge(target, source, seen = new WeakSet()) {
    const output = { ...target };
    if (seen.has(source)) {
        return output;
    }
    seen.add(source);
    for (const key of Object.keys(source)) {
        const sVal = source[key];
        const tVal = target[key];
        if (sVal &&
            typeof sVal === "object" &&
            !Array.isArray(sVal) &&
            tVal &&
            typeof tVal === "object" &&
            !Array.isArray(tVal)) {
            output[key] = deepMerge(tVal, sVal, seen);
        }
        else if (sVal !== undefined) {
            output[key] = sVal;
        }
    }
    return output;
}
