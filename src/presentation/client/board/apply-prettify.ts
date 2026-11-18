/**
 * Apply Sugiyama prettify to the live tldraw editor.
 * Selection (≥2 shapes) scopes the layout; otherwise the whole page.
 */
import {
	prettifyGraph,
	type PrettifyNode,
	type PrettifyEdge,
	type PrettifyOptions,
} from "../../../domain/board-prettify.js";

/** Minimal editor surface used by Prettify (avoids pulling full tldraw types). */
export interface PrettifyEditor {
	getSelectedShapeIds(): string[];
	getCurrentPageShapes(): Array<{
		id: string;
		type: string;
		x: number;
		y: number;
		parentId: string;
		props: Record<string, unknown>;
	}>;
	updateShapes(
		partials: Array<{ id: string; type: string; x: number; y: number }>,
	): void;
	zoomToFit(opts?: { animation?: { duration: number } }): void;
	markHistoryStoppingPoint?(name: string): void;
}

function shapeSize(shape: {
	type: string;
	props: Record<string, unknown>;
}): { w: number; h: number } {
	const w =
		typeof shape.props["w"] === "number"
			? shape.props["w"]
			: shape.type === "note"
				? 200
				: shape.type === "text"
					? 160
					: 200;
	const h =
		typeof shape.props["h"] === "number"
			? shape.props["h"]
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

	const nodes: PrettifyNode[] = [];
	const edges: PrettifyEdge[] = [];
	const byId = new Map(shapes.map((s) => [s.id, s] as const));

	for (const shape of shapes) {
		if (shape.type === "arrow") continue;
		if (!String(shape.parentId).startsWith("page:")) continue;
		if (scopeIds && !scopeIds.has(shape.id)) continue;
		const { w, h } = shapeSize(shape);
		nodes.push({ id: shape.id, w, h });
	}

	for (const shape of shapes) {
		if (shape.type !== "arrow") continue;
		const from = bindingId(shape.props["start"]);
		const to = bindingId(shape.props["end"]);
		if (!from || !to) continue;
		if (scopeIds && (!scopeIds.has(from) || !scopeIds.has(to))) continue;
		if (!byId.has(from) || !byId.has(to)) continue;
		edges.push({ from, to });
	}

	const originX = scoped
		? Math.min(
				...nodes.map((n) => byId.get(n.id)?.x ?? 0),
				Number.POSITIVE_INFINITY,
			)
		: 0;
	const originY = scoped
		? Math.min(
				...nodes.map((n) => byId.get(n.id)?.y ?? 0),
				Number.POSITIVE_INFINITY,
			)
		: 0;

	const result = prettifyGraph(nodes, edges, {
		...options,
		originX: Number.isFinite(originX) ? originX : 0,
		originY: Number.isFinite(originY) ? originY : 0,
	});

	const updates = result.placements.flatMap((p) => {
		const shape = byId.get(p.id);
		if (!shape) return [];
		if (shape.x === p.x && shape.y === p.y) return [];
		return [{ id: p.id, type: shape.type, x: p.x, y: p.y }];
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
		scoped: scoped ? "selection" : "page",
	};
}
