/**
 * Apply Sugiyama prettify to the live tldraw editor.
 * Selection (≥2 shapes) scopes the layout; otherwise the whole page.
 * Cards sitting on frames are bound as children before layout.
 */
import {
	prettifyShapesWithUnderlays,
	type PrettifyEdge,
	type PrettifyOptions,
} from "../../../domain/board-prettify.js";
import type { UnderlayShape } from "../../../domain/board-underlays.js";

/** Minimal shape fields read from the editor (tldraw TLShape is structural). */
export interface PrettifyShape {
	id: string;
	type: string;
	x: number;
	y: number;
	parentId: string;
	props: object;
}

/** Minimal editor surface used by Prettify (avoids pulling full tldraw types). */
export interface PrettifyEditor {
	getSelectedShapeIds(): readonly string[];
	getCurrentPageShapes(): readonly PrettifyShape[];
	updateShapes(partials: readonly object[]): void;
	zoomToFit(opts?: { animation?: { duration: number } }): void;
	markHistoryStoppingPoint?(name: string): void;
}

function shapeSize(shape: PrettifyShape): { w: number; h: number } {
	const props = shape.props as Record<string, unknown>;
	const w =
		typeof props["w"] === "number"
			? props["w"]
			: shape.type === "note"
				? 200
				: shape.type === "text"
					? 160
					: 200;
	const h =
		typeof props["h"] === "number"
			? props["h"]
			: shape.type === "note"
				? 200
				: shape.type === "text"
					? 40
					: 160;
	return { w, h };
}

function bindingId(end: unknown): string | undefined {
	if (typeof end !== "object" || end === null) return undefined;
	const id = (end as { boundShapeId?: unknown }).boundShapeId;
	return typeof id === "string" && id.length > 0 ? id : undefined;
}

export interface ApplyPrettifyResult {
	moved: number;
	bound: number;
	scoped: "selection" | "page";
}

/** Prettify the current page (or selection) in the editor. */
export function applyBoardPrettify(
	editor: PrettifyEditor,
	options: PrettifyOptions = {},
): ApplyPrettifyResult {
	const shapes = editor.getCurrentPageShapes();
	const selected = editor.getSelectedShapeIds().filter((id) => {
		const shape = shapes.find((s) => s.id === id);
		return shape && shape.type !== "arrow";
	});
	const scoped = selected.length >= 2;
	const scopeIds = scoped ? new Set(selected) : undefined;

	const underlays: UnderlayShape[] = [];
	const byId = new Map(shapes.map((s) => [s.id, s] as const));
	for (const shape of shapes) {
		if (shape.type === "arrow") continue;
		const { w, h } = shapeSize(shape);
		underlays.push({
			id: shape.id,
			type: shape.type,
			parentId: String(shape.parentId),
			x: shape.x,
			y: shape.y,
			w,
			h,
		});
	}

	const edges: PrettifyEdge[] = [];
	for (const shape of shapes) {
		if (shape.type !== "arrow") continue;
		const props = shape.props as Record<string, unknown>;
		const from = bindingId(props["start"]);
		const to = bindingId(props["end"]);
		if (!from || !to) continue;
		if (!byId.has(from) || !byId.has(to)) continue;
		if (scopeIds) {
			const fromShape = byId.get(from);
			const toShape = byId.get(to);
			const fromOk =
				scopeIds.has(from) ||
				(fromShape !== undefined && scopeIds.has(String(fromShape.parentId)));
			const toOk =
				scopeIds.has(to) ||
				(toShape !== undefined && scopeIds.has(String(toShape.parentId)));
			if (!fromOk || !toOk) continue;
		}
		edges.push({ from, to });
	}

	const result = prettifyShapesWithUnderlays(underlays, edges, {
		...options,
		onlyIds: scopeIds ? [...scopeIds] : undefined,
	});

	const updates = result.placements.flatMap((p) => {
		const shape = byId.get(p.id);
		if (!shape) return [];
		const patch: Record<string, unknown> = {
			id: p.id,
			type: shape.type,
			x: p.x,
			y: p.y,
		};
		if (p.parentId && p.parentId !== shape.parentId) {
			patch["parentId"] = p.parentId;
		}
		if (shape.type === "frame" && (p.w !== undefined || p.h !== undefined)) {
			const props = { ...(shape.props as Record<string, unknown>) };
			if (p.w !== undefined) props["w"] = p.w;
			if (p.h !== undefined) props["h"] = p.h;
			patch["props"] = props;
		}
		const samePos = shape.x === p.x && shape.y === p.y;
		const sameParent = !p.parentId || p.parentId === shape.parentId;
		const props = shape.props as Record<string, unknown>;
		const sameSize =
			(p.w === undefined || props["w"] === p.w) &&
			(p.h === undefined || props["h"] === p.h);
		if (samePos && sameParent && sameSize) return [];
		return [patch];
	});

	if (updates.length > 0) {
		editor.markHistoryStoppingPoint?.("buildboard-prettify");
		editor.updateShapes(updates);
	}
	try {
		editor.zoomToFit({ animation: { duration: 220 } });
	} catch {
		// ignore zoom failures on empty pages
	}
	return {
		moved: updates.length,
		bound: result.bound,
		scoped: scoped ? "selection" : "page",
	};
}
