import { createId } from "../domain/ids.js";
function asString(value, fallback = "") {
    return typeof value === "string" ? value : fallback;
}
/**
 * Convert a JSON Canvas 1.0 file into tldraw-like board records.
 * Sticky/text/file/link become note or text shapes; group becomes frame;
 * pipeline-ish nodes become card placeholders; edges become arrows.
 */
export function importJsonCanvas(raw) {
    const file = (raw ?? {});
    const records = {};
    const pageId = "page:page";
    records[pageId] = {
        id: pageId,
        typeName: "page",
        name: "Page 1",
        meta: {},
        index: "a1",
    };
    const nodeIds = new Map();
    for (const node of file.nodes ?? []) {
        const sourceId = asString(node["id"], createId("n"));
        const shapeId = `shape:${sourceId}`;
        nodeIds.set(sourceId, shapeId);
        const x = number(node["x"], 0);
        const y = number(node["y"], 0);
        const w = number(node["width"], 200);
        const h = number(node["height"], 120);
        const text = asString(node["text"]) ||
            asString(node["label"]) ||
            asString(node["file"]);
        const type = asString(node["type"], "text");
        if (type === "group") {
            records[shapeId] = {
                id: shapeId,
                typeName: "shape",
                type: "frame",
                x,
                y,
                props: { w, h, name: text || "Frame" },
                parentId: pageId,
                index: "a1",
                meta: { legacyId: sourceId },
            };
            continue;
        }
        if (isPipelineKind(type) || type === "file" || type === "link") {
            records[shapeId] = {
                id: shapeId,
                typeName: "shape",
                type: "card",
                x,
                y,
                props: {
                    w,
                    h,
                    title: text.slice(0, 80) || type,
                    excerpt: text.slice(0, 160),
                    kind: "note",
                    cardRef: null,
                },
                parentId: pageId,
                index: "a1",
                meta: { legacyId: sourceId, legacyType: type },
            };
            continue;
        }
        if (type === "text" && looksLikeSticky(node)) {
            records[shapeId] = {
                id: shapeId,
                typeName: "shape",
                type: "note",
                x,
                y,
                props: { w, h, text, color: "yellow" },
                parentId: pageId,
                index: "a1",
                meta: { legacyId: sourceId },
            };
            continue;
        }
        records[shapeId] = {
            id: shapeId,
            typeName: "shape",
            type: "text",
            x,
            y,
            props: {
                w,
                h,
                text,
                size: "m",
                font: "draw",
                color: "black",
                textAlign: "start",
            },
            parentId: pageId,
            index: "a1",
            meta: { legacyId: sourceId },
        };
    }
    for (const edge of file.edges ?? []) {
        const from = nodeIds.get(asString(edge["fromNode"]));
        const to = nodeIds.get(asString(edge["toNode"]));
        if (!from || !to)
            continue;
        const arrowId = `shape:${createId("arrow")}`;
        records[arrowId] = {
            id: arrowId,
            typeName: "shape",
            type: "arrow",
            x: 0,
            y: 0,
            props: {
                start: {
                    type: "binding",
                    boundShapeId: from,
                    normalizedAnchor: { x: 0.5, y: 0.5 },
                    isExact: false,
                },
                end: {
                    type: "binding",
                    boundShapeId: to,
                    normalizedAnchor: { x: 0.5, y: 0.5 },
                    isExact: false,
                },
                text: asString(edge["label"]),
            },
            parentId: pageId,
            index: "a1",
            meta: { legacyId: edge["id"] },
        };
    }
    return records;
}
function isPipelineKind(type) {
    return [
        "script",
        "storyboard",
        "image",
        "video",
        "audio",
        "finalcut",
    ].includes(type);
}
function looksLikeSticky(node) {
    const color = asString(node["color"]);
    return color.length > 0 || asString(node["type"]) === "text";
}
function number(value, fallback) {
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
