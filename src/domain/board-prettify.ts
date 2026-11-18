/**
 * Sugiyama-style board prettifier for tldraw shapes + arrows.
 * Inspired by ComfyUI Prettifier (MIT) layered flow layout — adapted for
 * Buildboard: columns by arrow flow, crossing reduction, spaced packing.
 */
import { bindingTargetId, shapeAabb } from "./arrow-geometry.js";
import type { BoardRecord } from "./board.js";

export interface PrettifyOptions {
	/** Left-to-right (default) or top-to-bottom. */
	direction?: "LR" | "TB";
	/** Gap between columns / ranks. */
	rankGap?: number;
	/** Gap between siblings in a rank. */
	nodeGap?: number;
	/** Crossing-reduction barycenter passes. */
	orderingPasses?: number;
	/** Origin of the laid-out cluster. */
	originX?: number;
	originY?: number;
}

export interface PrettifyNode {
	id: string;
	w: number;
	h: number;
}

export interface PrettifyEdge {
	from: string;
	to: string;
}

export interface PrettifyPlacement {
	id: string;
	x: number;
	y: number;
}

export interface PrettifyResult {
	placements: PrettifyPlacement[];
	/** Rank index per node id. */
	ranks: Record<string, number>;
}

const DEFAULTS = {
	direction: "LR" as const,
	rankGap: 96,
	nodeGap: 48,
	orderingPasses: 8,
	originX: 0,
	originY: 0,
};

/**
 * Layered layout: assign ranks by longest-path, order to cut crossings,
 * pack into columns (LR) or rows (TB).
 */
export function prettifyGraph(
	nodes: PrettifyNode[],
	edges: PrettifyEdge[],
	options: PrettifyOptions = {},
): PrettifyResult {
	const opts = { ...DEFAULTS, ...options };
	if (nodes.length === 0) return { placements: [], ranks: {} };

	const ids = nodes.map((n) => n.id);
	const idSet = new Set(ids);
	const size = new Map(nodes.map((n) => [n.id, n] as const));
	const forward = edges.filter((e) => idSet.has(e.from) && idSet.has(e.to));

	const rank = assignRanks(ids, forward);
	const rankGroups = groupByRank(ids, rank);
	orderRanks(rankGroups, forward, opts.orderingPasses);

	const placements: PrettifyPlacement[] = [];
	const ranksOut: Record<string, number> = {};
	let cursor = opts.direction === "LR" ? opts.originX : opts.originY;

	const sortedRanks = [...rankGroups.keys()].sort((a, b) => a - b);
	for (const r of sortedRanks) {
		const group = rankGroups.get(r) ?? [];
		let cross = opts.direction === "LR" ? opts.originY : opts.originX;
		let maxExtent = 0;
		for (const id of group) {
			const node = size.get(id)!;
			ranksOut[id] = r;
			if (opts.direction === "LR") {
				placements.push({ id, x: cursor, y: cross });
				cross += node.h + opts.nodeGap;
				maxExtent = Math.max(maxExtent, node.w);
			} else {
				placements.push({ id, x: cross, y: cursor });
				cross += node.w + opts.nodeGap;
				maxExtent = Math.max(maxExtent, node.h);
			}
		}
		cursor += maxExtent + opts.rankGap;
	}

	// Isolated nodes (no edges) already ranked 0; pack any missing at the end.
	const placed = new Set(placements.map((p) => p.id));
	let orphanX = opts.originX;
	let orphanY =
		(opts.direction === "LR"
			? Math.max(0, ...placements.map((p) => p.y + (size.get(p.id)?.h ?? 0)))
			: Math.max(0, ...placements.map((p) => p.x + (size.get(p.id)?.w ?? 0)))) +
		opts.nodeGap;
	for (const node of nodes) {
		if (placed.has(node.id)) continue;
		placements.push({ id: node.id, x: orphanX, y: orphanY });
		ranksOut[node.id] = -1;
		if (opts.direction === "LR") orphanX += node.w + opts.nodeGap;
		else orphanY += node.h + opts.nodeGap;
	}

	return { placements, ranks: ranksOut };
}

/** Longest-path layering from sources; cycles get a stable fallback rank. */
function assignRanks(
	ids: string[],
	edges: PrettifyEdge[],
): Map<string, number> {
	const outs = new Map<string, string[]>();
	const ins = new Map<string, string[]>();
	for (const id of ids) {
		outs.set(id, []);
		ins.set(id, []);
	}
	for (const e of edges) {
		outs.get(e.from)?.push(e.to);
		ins.get(e.to)?.push(e.from);
	}

	const rank = new Map<string, number>();
	const visiting = new Set<string>();
	const visit = (id: string): number => {
		const cached = rank.get(id);
		if (cached !== undefined) return cached;
		if (visiting.has(id)) return 0;
		visiting.add(id);
		const preds = ins.get(id) ?? [];
		let best = 0;
		for (const p of preds) best = Math.max(best, visit(p) + 1);
		visiting.delete(id);
		rank.set(id, best);
		return best;
	};
	for (const id of ids) visit(id);
	return rank;
}

function groupByRank(
	ids: string[],
	rank: Map<string, number>,
): Map<number, string[]> {
	const groups = new Map<number, string[]>();
	for (const id of ids) {
		const r = rank.get(id) ?? 0;
		const list = groups.get(r) ?? [];
		list.push(id);
		groups.set(r, list);
	}
	return groups;
}

/** Barycenter heuristic: reorder each rank from neighbors in adjacent ranks. */
function orderRanks(
	rankGroups: Map<number, string[]>,
	edges: PrettifyEdge[],
	passes: number,
): void {
	const ranks = [...rankGroups.keys()].sort((a, b) => a - b);
	if (ranks.length < 2) return;

	for (let pass = 0; pass < passes; pass += 1) {
		const forward = pass % 2 === 0;
		const sequence = forward ? ranks : [...ranks].reverse();
		for (let i = 1; i < sequence.length; i += 1) {
			const current = sequence[i]!;
			const neighbor = sequence[i - 1]!;
			const order = new Map(
				(rankGroups.get(neighbor) ?? []).map((id, index) => [id, index]),
			);
			const group = rankGroups.get(current) ?? [];
			const scored = group.map((id) => {
				const links = edges
					.filter((e) =>
						forward
							? e.to === id && order.has(e.from)
							: e.from === id && order.has(e.to),
					)
					.map((e) => order.get(forward ? e.from : e.to)!);
				const bary =
					links.length === 0
						? (order.get(id) ?? group.indexOf(id))
						: links.reduce((a, b) => a + b, 0) / links.length;
				return { id, bary };
			});
			scored.sort((a, b) => a.bary - b.bary || a.id.localeCompare(b.id));
			rankGroups.set(
				current,
				scored.map((s) => s.id),
			);
		}
	}
}

function propsOf(record: BoardRecord): Record<string, unknown> {
	const props = record["props"];
	return typeof props === "object" && props !== null && !Array.isArray(props)
		? (props as Record<string, unknown>)
		: {};
}

/**
 * Build a prettify model from board records.
 * Only top-level non-arrow shapes (parent page) participate; arrows supply edges.
 */
export function prettifyBoardRecords(
	records: Record<string, BoardRecord>,
	options: PrettifyOptions & { onlyIds?: string[] } = {},
): PrettifyResult {
	const only = options.onlyIds ? new Set(options.onlyIds) : undefined;
	const nodes: PrettifyNode[] = [];
	const edges: PrettifyEdge[] = [];

	for (const record of Object.values(records)) {
		if (record.typeName !== "shape") continue;
		const id = typeof record.id === "string" ? record.id : "";
		if (!id) continue;
		const type = typeof record["type"] === "string" ? record["type"] : "";
		if (type === "arrow") continue;
		const parent =
			typeof record["parentId"] === "string" ? record["parentId"] : "";
		if (!parent.startsWith("page:")) continue;
		if (only && !only.has(id)) continue;
		const box = shapeAabb(record);
		if (!box) continue;
		nodes.push({ id, w: box.w, h: box.h });
	}

	for (const record of Object.values(records)) {
		if (record.typeName !== "shape") continue;
		if (record["type"] !== "arrow") continue;
		const props = propsOf(record);
		const from = bindingTargetId(props["start"]);
		const to = bindingTargetId(props["end"]);
		if (!from || !to) continue;
		if (only && (!only.has(from) || !only.has(to))) continue;
		edges.push({ from, to });
	}

	return prettifyGraph(nodes, edges, options);
}

/** Apply placements onto a mutable copy of records (host tool path). */
export function applyPrettifyPlacements(
	records: Record<string, BoardRecord>,
	result: PrettifyResult,
): BoardRecord[] {
	const put: BoardRecord[] = [];
	for (const placement of result.placements) {
		const prev = records[placement.id];
		if (!prev) continue;
		put.push({ ...prev, x: placement.x, y: placement.y });
	}
	return put;
}
