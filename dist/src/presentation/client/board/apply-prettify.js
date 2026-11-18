/**
 * Apply Sugiyama prettify to the live tldraw editor.
 * Selection (≥2 shapes) scopes the layout; otherwise the whole page.
 */
import { prettifyGraph, } from "../../../domain/board-prettify.js";
function shapeSize(shape) {
    const props = shape.props;
    const w = typeof props["w"] === "number"
        ? props["w"]
        : shape.type === "note"
            ? 200
            : shape.type === "text"
                ? 160
                : 200;
    const h = typeof props["h"] === "number"
        ? props["h"]
        : shape.type === "note"
            ? 200
            : shape.type === "text"
                ? 40
                : 160;
    return { w, h };
}
function bindingId(end) {
    if (typeof end !== "object" || end === null)
        return undefined;
    const id = end.boundShapeId;
    return typeof id === "string" && id.length > 0 ? id : undefined;
}
/** Prettify the current page (or selection) in the editor. */
export function applyBoardPrettify(editor, options = {}) {
    const shapes = editor.getCurrentPageShapes();
    const selected = editor.getSelectedShapeIds().filter((id) => {
        const shape = shapes.find((s) => s.id === id);
        return shape && shape.type !== "arrow";
    });
    const scoped = selected.length >= 2;
    const scopeIds = scoped ? new Set(selected) : undefined;
    const nodes = [];
    const edges = [];
    const byId = new Map(shapes.map((s) => [s.id, s]));
    for (const shape of shapes) {
        if (shape.type === "arrow")
            continue;
        if (!String(shape.parentId).startsWith("page:"))
            continue;
        if (scopeIds && !scopeIds.has(shape.id))
            continue;
        const { w, h } = shapeSize(shape);
        nodes.push({ id: shape.id, w, h });
    }
    for (const shape of shapes) {
        if (shape.type !== "arrow")
            continue;
        const props = shape.props;
        const from = bindingId(props["start"]);
        const to = bindingId(props["end"]);
        if (!from || !to)
            continue;
        if (scopeIds && (!scopeIds.has(from) || !scopeIds.has(to)))
            continue;
        if (!byId.has(from) || !byId.has(to))
            continue;
        edges.push({ from, to });
    }
    const originX = scoped
        ? Math.min(...nodes.map((n) => byId.get(n.id)?.x ?? 0), Number.POSITIVE_INFINITY)
        : 0;
    const originY = scoped
        ? Math.min(...nodes.map((n) => byId.get(n.id)?.y ?? 0), Number.POSITIVE_INFINITY)
        : 0;
    const result = prettifyGraph(nodes, edges, {
        ...options,
        originX: Number.isFinite(originX) ? originX : 0,
        originY: Number.isFinite(originY) ? originY : 0,
    });
    const updates = result.placements.flatMap((p) => {
        const shape = byId.get(p.id);
        if (!shape)
            return [];
        if (shape.x === p.x && shape.y === p.y)
            return [];
        return [{ id: p.id, type: shape.type, x: p.x, y: p.y }];
    });
    if (updates.length > 0) {
        editor.markHistoryStoppingPoint?.("buildboard-prettify");
        editor.updateShapes(updates);
    }
    try {
        editor.zoomToFit({ animation: { duration: 220 } });
    }
    catch {
        // ignore zoom failures on empty pages
    }
    return {
        moved: updates.length,
        scoped: scoped ? "selection" : "page",
    };
}
