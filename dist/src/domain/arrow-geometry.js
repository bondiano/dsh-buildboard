/** Max distance (px) from bound shape AABB for an arrow end to “touch”. */
export const ARROW_TOUCH_TOLERANCE_PX = 8;
function propsOf(record) {
    const props = record["props"];
    return typeof props === "object" && props !== null && !Array.isArray(props)
        ? props
        : {};
}
function num(value, fallback = 0) {
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
/** Best-effort axis-aligned box for common tldraw shape types. */
export function shapeAabb(record) {
    if (record.typeName !== "shape")
        return undefined;
    const x = num(record["x"]);
    const y = num(record["y"]);
    const props = propsOf(record);
    const type = typeof record["type"] === "string" ? record["type"] : "";
    let w = num(props["w"], Number.NaN);
    let h = num(props["h"], Number.NaN);
    if (!Number.isFinite(w) || !Number.isFinite(h)) {
        if (type === "note") {
            w = Number.isFinite(w) ? w : 200;
            h = Number.isFinite(h) ? h : 200;
        }
        else if (type === "text") {
            w = Number.isFinite(w) ? w : 160;
            h = Number.isFinite(h) ? h : 40;
        }
        else if (type === "geo" || type === "frame" || type === "image") {
            w = Number.isFinite(w) ? w : 200;
            h = Number.isFinite(h) ? h : 200;
        }
        else if (type === "card") {
            w = Number.isFinite(w) ? w : 260;
            h = Number.isFinite(h) ? h : 160;
        }
        else {
            return undefined;
        }
    }
    return { x, y, w, h };
}
export function expandAabb(box, pad) {
    return {
        x: box.x - pad,
        y: box.y - pad,
        w: box.w + pad * 2,
        h: box.h + pad * 2,
    };
}
export function pointInAabb(point, box) {
    return (point.x >= box.x &&
        point.x <= box.x + box.w &&
        point.y >= box.y &&
        point.y <= box.y + box.h);
}
/** Distance from point to closest point on AABB (0 if inside). */
export function distanceToAabb(point, box) {
    const cx = Math.min(Math.max(point.x, box.x), box.x + box.w);
    const cy = Math.min(Math.max(point.y, box.y), box.y + box.h);
    const dx = point.x - cx;
    const dy = point.y - cy;
    return Math.hypot(dx, dy);
}
export function bindingTargetId(end) {
    if (typeof end !== "object" || end === null)
        return undefined;
    const bound = end.boundShapeId;
    return typeof bound === "string" && bound.length > 0 ? bound : undefined;
}
export function normalizedAnchor(end) {
    if (typeof end !== "object" || end === null)
        return { x: 0.5, y: 0.5 };
    const anchor = end.normalizedAnchor;
    if (typeof anchor !== "object" || anchor === null)
        return { x: 0.5, y: 0.5 };
    return {
        x: num(anchor.x, 0.5),
        y: num(anchor.y, 0.5),
    };
}
/** World-space point for a binding end on a target shape. */
export function bindingWorldPoint(end, target) {
    const box = shapeAabb(target);
    if (!box)
        return undefined;
    const anchor = normalizedAnchor(end);
    return {
        x: box.x + box.w * anchor.x,
        y: box.y + box.h * anchor.y,
    };
}
/**
 * Require a boundShapeId that exists and whose AABB is touched by the
 * normalized anchor (within ARROW_TOUCH_TOLERANCE_PX).
 */
export function checkArrowEnd(side, end, records, arrowId) {
    const boundId = bindingTargetId(end);
    if (!boundId) {
        return {
            ok: false,
            code: side === "start" ? "unbound_arrow_start" : "unbound_arrow_end",
            message: `arrow ${arrowId}: ${side} must bind to a shape (boundShapeId)`,
        };
    }
    const target = records[boundId];
    if (!target) {
        return {
            ok: false,
            code: side === "start" ? "orphan_arrow_start" : "orphan_arrow_end",
            message: `arrow ${arrowId}: ${side} boundShapeId ${boundId} missing`,
        };
    }
    const box = shapeAabb(target);
    const point = bindingWorldPoint(end, target);
    if (!box || !point) {
        return {
            ok: false,
            code: "arrow_end_not_touching",
            message: `arrow ${arrowId}: ${side} target ${boundId} has no measurable bounds`,
        };
    }
    const dist = distanceToAabb(point, box);
    if (dist > ARROW_TOUCH_TOLERANCE_PX) {
        return {
            ok: false,
            code: "arrow_end_not_touching",
            message: `arrow ${arrowId}: ${side} anchor is ${dist.toFixed(1)}px from ${boundId} (tolerance ${ARROW_TOUCH_TOLERANCE_PX}px)`,
        };
    }
    // Anchor must also sit inside the expanded AABB (rejects wild normalizedAnchor).
    if (!pointInAabb(point, expandAabb(box, ARROW_TOUCH_TOLERANCE_PX))) {
        return {
            ok: false,
            code: "arrow_end_not_touching",
            message: `arrow ${arrowId}: ${side} anchor does not touch ${boundId}`,
        };
    }
    return { ok: true };
}
