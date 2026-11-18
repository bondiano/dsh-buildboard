/**
 * Bind cards/notes to frame underlays by parentId or spatial containment.
 * Prettify must keep those groups together.
 */
import { shapeAabb, type Aabb } from "./arrow-geometry.js";
import type { BoardRecord } from "./board.js";

export const FRAME_PAD = 24;
export const FRAME_TITLE_PAD = 40;

export interface UnderlayShape {
	id: string;
	type: string;
	parentId: string;
	x: number;
	y: number;
	w: number;
	h: number;
}

function propsOf(record: BoardRecord): Record<string, unknown> {
	const props = record["props"];
	return typeof props === "object" && props !== null && !Array.isArray(props)
		? (props as Record<string, unknown>)
		: {};
}

export function recordToUnderlayShape(
	record: BoardRecord,
): UnderlayShape | undefined {
	if (record.typeName !== "shape") return undefined;
	const id = typeof record.id === "string" ? record.id : "";
	if (!id) return undefined;
	const type = typeof record["type"] === "string" ? record["type"] : "";
	if (type === "arrow") return undefined;
	const box = shapeAabb(record);
	if (!box) return undefined;
	const parentId =
		typeof record["parentId"] === "string" ? record["parentId"] : "page:page";
	return {
		id,
		type,
		parentId,
		x: box.x,
		y: box.y,
		w: box.w,
		h: box.h,
	};
}

function center(box: Pick<UnderlayShape, "x" | "y" | "w" | "h">): {
	x: number;
	y: number;
} {
	return { x: box.x + box.w / 2, y: box.y + box.h / 2 };
}

function contains(
	frame: Pick<UnderlayShape, "x" | "y" | "w" | "h">,
	point: { x: number; y: number },
): boolean {
	return (
		point.x >= frame.x &&
		point.x <= frame.x + frame.w &&
		point.y >= frame.y &&
		point.y <= frame.y + frame.h
	);
}

/** Absolute page AABB for a shape (children are relative to parent frame). */
export function absoluteBox(
	shape: UnderlayShape,
	byId: Map<string, UnderlayShape>,
): Aabb {
	let x = shape.x;
	let y = shape.y;
	let parentId = shape.parentId;
	const guard = new Set<string>();
	while (parentId.startsWith("shape:") && !guard.has(parentId)) {
		guard.add(parentId);
		const parent = byId.get(parentId);
		if (!parent) break;
		x += parent.x;
		y += parent.y;
		parentId = parent.parentId;
	}
	return { x, y, w: shape.w, h: shape.h };
}

/**
 * Resolve the frame a content shape belongs to: explicit parent frame, else
 * the smallest page-level frame whose AABB contains the shape center.
 */
export function resolveUnderlayParent(
	shape: UnderlayShape,
	frames: UnderlayShape[],
	byId: Map<string, UnderlayShape>,
): string | undefined {
	if (shape.type === "frame") return undefined;
	if (shape.parentId.startsWith("shape:")) {
		const parent = byId.get(shape.parentId);
		if (parent?.type === "frame") return parent.id;
	}
	const abs = absoluteBox(shape, byId);
	const point = center(abs);
	let best: UnderlayShape | undefined;
	let bestArea = Number.POSITIVE_INFINITY;
	for (const frame of frames) {
		if (frame.id === shape.id) continue;
		if (!frame.parentId.startsWith("page:")) continue;
		if (!contains(frame, point)) continue;
		const area = frame.w * frame.h;
		if (area < bestArea) {
			best = frame;
			bestArea = area;
		}
	}
	return best?.id;
}

export interface UnderlayBinding {
	id: string;
	parentId: string;
	/** Absolute page coords before reparent. */
	absX: number;
	absY: number;
	/** Relative to the frame after bind. */
	x: number;
	y: number;
}

/**
 * Compute parentId + relative coords so every content shape sitting on a frame
 * becomes a child of that frame.
 */
export function bindShapesToUnderlays(
	shapes: UnderlayShape[],
): UnderlayBinding[] {
	const byId = new Map(shapes.map((s) => [s.id, s] as const));
	const frames = shapes.filter((s) => s.type === "frame");
	const bindings: UnderlayBinding[] = [];
	for (const shape of shapes) {
		if (shape.type === "frame") continue;
		const frameId = resolveUnderlayParent(shape, frames, byId);
		if (!frameId) continue;
		const frame = byId.get(frameId);
		if (!frame) continue;
		const abs = absoluteBox(shape, byId);
		const alreadyChild = shape.parentId === frameId;
		const relX = abs.x - frame.x;
		const relY = abs.y - frame.y;
		if (
			alreadyChild &&
			Math.abs(shape.x - relX) < 0.5 &&
			Math.abs(shape.y - relY) < 0.5
		) {
			continue;
		}
		bindings.push({
			id: shape.id,
			parentId: frameId,
			absX: abs.x,
			absY: abs.y,
			x: relX,
			y: relY,
		});
	}
	return bindings;
}

/** Apply underlay bindings onto board records (host / tool path). */
export function applyUnderlayBindings(
	records: Record<string, BoardRecord>,
	bindings: UnderlayBinding[],
): BoardRecord[] {
	const put: BoardRecord[] = [];
	for (const binding of bindings) {
		const prev = records[binding.id];
		if (!prev) continue;
		put.push({
			...prev,
			parentId: binding.parentId,
			x: binding.x,
			y: binding.y,
		});
	}
	return put;
}

/** Collect shapes from board records for underlay math. */
export function underlayShapesFromRecords(
	records: Record<string, BoardRecord>,
): UnderlayShape[] {
	const out: UnderlayShape[] = [];
	for (const record of Object.values(records)) {
		const shape = recordToUnderlayShape(record);
		if (shape) out.push(shape);
	}
	return out;
}

/** Fit a frame around its children (relative coords) with padding. */
export function fitFrameToChildren(
	children: Array<{ x: number; y: number; w: number; h: number }>,
	minW = 200,
	minH = 120,
): { w: number; h: number } {
	if (children.length === 0) return { w: minW, h: minH };
	let maxX = 0;
	let maxY = 0;
	for (const child of children) {
		maxX = Math.max(maxX, child.x + child.w);
		maxY = Math.max(maxY, child.y + child.h);
	}
	return {
		w: Math.max(minW, maxX + FRAME_PAD),
		h: Math.max(minH, maxY + FRAME_PAD),
	};
}

export function isFrameRecord(record: BoardRecord): boolean {
	return record.typeName === "shape" && record["type"] === "frame";
}

export function frameName(record: BoardRecord): string {
	const props = propsOf(record);
	const name = props["name"];
	return typeof name === "string" && name.trim() ? name : "Frame";
}
