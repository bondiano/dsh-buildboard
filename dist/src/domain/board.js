/** Board document: a named map of tldraw store records. */
/** Apply a diff to a mutable record map; returns touched ids. */
export function applyBoardDiff(records, diff) {
    const putIds = [];
    const removeIds = [];
    for (const id of diff.remove ?? []) {
        if (id in records) {
            delete records[id];
            removeIds.push(id);
        }
    }
    for (const record of diff.put ?? []) {
        const id = typeof record.id === "string" ? record.id : undefined;
        if (!id)
            continue;
        const prevMeta = typeof record["meta"] === "object" &&
            record["meta"] !== null &&
            !Array.isArray(record["meta"])
            ? record["meta"]
            : {};
        const stamped = diff.actor === undefined
            ? record
            : {
                ...record,
                meta: {
                    ...prevMeta,
                    updatedBy: diff.actor,
                    updatedAt: diff.clientTime ?? Date.now(),
                },
            };
        records[id] = stamped;
        putIds.push(id);
    }
    return { putIds, removeIds };
}
