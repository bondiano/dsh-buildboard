/** Board document: a named map of tldraw store records. */
/**
 * Fill required tldraw shape base fields. Agent tools often omit rotation /
 * opacity / isLocked; the store validator rejects those records.
 */
export function normalizeShapeRecord(record) {
    if (record.typeName !== "shape")
        return record;
    const next = { ...record };
    if (typeof next["x"] !== "number")
        next["x"] = 0;
    if (typeof next["y"] !== "number")
        next["y"] = 0;
    if (typeof next["rotation"] !== "number")
        next["rotation"] = 0;
    if (typeof next["opacity"] !== "number")
        next["opacity"] = 1;
    if (typeof next["isLocked"] !== "boolean")
        next["isLocked"] = false;
    if (typeof next["parentId"] !== "string")
        next["parentId"] = "page:page";
    if (typeof next["index"] !== "string")
        next["index"] = "a1";
    if (typeof next["meta"] !== "object" || next["meta"] === null) {
        next["meta"] = {};
    }
    const props = typeof next["props"] === "object" && next["props"] !== null
        ? { ...next["props"] }
        : {};
    if (next["type"] === "card") {
        if (typeof props["w"] !== "number")
            props["w"] = 260;
        if (typeof props["h"] !== "number")
            props["h"] = 160;
        if (typeof props["title"] !== "string")
            props["title"] = "Card";
        if (typeof props["excerpt"] !== "string")
            props["excerpt"] = "";
        if (typeof props["kind"] !== "string")
            props["kind"] = "note";
        if (typeof props["cardRef"] !== "string")
            props["cardRef"] = "";
        if (typeof props["runStatus"] !== "string")
            props["runStatus"] = "";
    }
    next["props"] = props;
    return next;
}
/** Normalize every shape in a record map (load / snapshot path). */
export function normalizeBoardRecords(records) {
    const next = {};
    for (const [id, record] of Object.entries(records)) {
        next[id] = normalizeShapeRecord(record);
    }
    return next;
}
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
        records[id] = normalizeShapeRecord(stamped);
        putIds.push(id);
    }
    return { putIds, removeIds };
}
