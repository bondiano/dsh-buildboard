/**
 * Arrow binding + AABB touch checks for board validation.
 */
import type { BoardRecord } from "./board.js";

/** Max distance (px) from bound shape AABB for an arrow end to “touch”. */
export const ARROW_TOUCH_TOLERANCE_PX = 8;

export interface Aabb {
	x: number;
	y: number;
	w: number;
	h: number;
}

export interface Vec2 {
	x: number;
	y: number;
}

function propsOf(record: BoardRecord): Record<string, unknown> {
	const props = record["props"];
	return typeof props === "object" && props !== null && !Array.isArray(props)
		? (props as Record<string, unknown>)
		: {};
}

function num(value: unknown, fallback = 0): number {
	return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/** Best-effort axis-aligned box for common tldraw shape types. */
export function shapeAabb(record: BoardRecord): Aabb | undefined {
	if (record.typeName !== "shape") return undefined;
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
		} else if (type === "text") {
			w = Number.isFinite(w) ? w : 160;
			h = Number.isFinite(h) ? h : 40;
		} else if (type === "geo" || type === "frame" || type === "image") {
			w = Number.isFinite(w) ? w : 200;
			h = Number.isFinite(h) ? h : 200;
		} else if (type === "card") {
			w = Number.isFinite(w) ? w : 260;
			h = Number.isFinite(h) ? h : 160;
		} else {
			return undefined;
		}
	}
	return { x, y, w, h };
}

export function expandAabb(box: Aabb, pad: number): Aabb {
	return {
		x: box.x - pad,
		y: box.y - pad,
		w: box.w + pad * 2,
		h: box.h + pad * 2,
	};
}

export function pointInAabb(point: Vec2, box: Aabb): boolean {
	return (
		point.x >= box.x &&
		point.x <= box.x + box.w &&
		point.y >= box.y &&
		point.y <= box.y + box.h
	);
}

/** Distance from point to closest point on AABB (0 if inside). */
export function distanceToAabb(point: Vec2, box: Aabb): number {
	const cx = Math.min(Math.max(point.x, box.x), box.x + box.w);
	const cy = Math.min(Math.max(point.y, box.y), box.y + box.h);
	const dx = point.x - cx;
	const dy = point.y - cy;
	return Math.hypot(dx, dy);
}

export function bindingTargetId(end: unknown): string | undefined {
	if (typeof end !== "object" || end === null) return undefined;
	const bound = (end as { boundShapeId?: unknown }).boundShapeId;
	return typeof bound === "string" && bound.length > 0 ? bound : undefined;
}

export function normalizedAnchor(end: unknown): Vec2 {
	if (typeof end !== "object" || end === null) return { x: 0.5, y: 0.5 };
	const anchor = (end as { normalizedAnchor?: unknown }).normalizedAnchor;
	if (typeof anchor !== "object" || anchor === null) return { x: 0.5, y: 0.5 };
	return {
		x: num((anchor as { x?: unknown }).x, 0.5),
		y: num((anchor as { y?: unknown }).y, 0.5),
	};
}

/** World-space point for a binding end on a target shape. */
export function bindingWorldPoint(
	end: unknown,
	target: BoardRecord,
): Vec2 | undefined {
	const box = shapeAabb(target);
	if (!box) return undefined;
	const anchor = normalizedAnchor(end);
	return {
		x: box.x + box.w * anchor.x,
		y: box.y + box.h * anchor.y,
	};
}

export interface ArrowEndCheck {
	ok: boolean;
	code?: string;
	message?: string;
}

/**
 * Require a boundShapeId that exists and whose AABB is touched by the
 * normalized anchor (within ARROW_TOUCH_TOLERANCE_PX).
 */
export function checkArrowEnd(
	side: "start" | "end",
	end: unknown,
	records: Record<string, BoardRecord>,
	arrowId: string,
): ArrowEndCheck {
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
