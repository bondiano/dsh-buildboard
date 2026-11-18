/**
 * Sugiyama-style board prettifier for tldraw shapes + arrows.
 * Inspired by ComfyUI Prettifier (MIT) layered flow layout — adapted for
 * Buildboard: columns by arrow flow, crossing reduction, spaced packing.
 * Frames (underlays) keep their children; prettify binds loose cards first.
 */
import { bindingTargetId } from "./arrow-geometry.js";
import { FRAME_PAD, FRAME_TITLE_PAD, applyUnderlayBindings, bindShapesToUnderlays, fitFrameToChildren, underlayShapesFromRecords, } from "./board-underlays.js";
const DEFAULTS = {
    direction: "LR",
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
export function prettifyGraph(nodes, edges, options = {}) {
    const opts = { ...DEFAULTS, ...options };
    if (nodes.length === 0)
        return { placements: [], ranks: {}, bound: 0 };
    const ids = nodes.map((n) => n.id);
    const idSet = new Set(ids);
    const size = new Map(nodes.map((n) => [n.id, n]));
    const forward = edges.filter((e) => idSet.has(e.from) && idSet.has(e.to));
    const rank = assignRanks(ids, forward);
    const rankGroups = groupByRank(ids, rank);
    orderRanks(rankGroups, forward, opts.orderingPasses);
    const placements = [];
    const ranksOut = {};
    let cursor = opts.direction === "LR" ? opts.originX : opts.originY;
    const sortedRanks = [...rankGroups.keys()].sort((a, b) => a - b);
    for (const r of sortedRanks) {
        const group = rankGroups.get(r) ?? [];
        let cross = opts.direction === "LR" ? opts.originY : opts.originX;
        let maxExtent = 0;
        for (const id of group) {
            const node = size.get(id);
            ranksOut[id] = r;
            if (opts.direction === "LR") {
                placements.push({ id, x: cursor, y: cross });
                cross += node.h + opts.nodeGap;
                maxExtent = Math.max(maxExtent, node.w);
            }
            else {
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
    let orphanY = (opts.direction === "LR"
        ? Math.max(0, ...placements.map((p) => p.y + (size.get(p.id)?.h ?? 0)))
        : Math.max(0, ...placements.map((p) => p.x + (size.get(p.id)?.w ?? 0)))) +
        opts.nodeGap;
    for (const node of nodes) {
        if (placed.has(node.id))
            continue;
        placements.push({ id: node.id, x: orphanX, y: orphanY });
        ranksOut[node.id] = -1;
        if (opts.direction === "LR")
            orphanX += node.w + opts.nodeGap;
        else
            orphanY += node.h + opts.nodeGap;
    }
    return { placements, ranks: ranksOut, bound: 0 };
}
/** Longest-path layering from sources; cycles get a stable fallback rank. */
function assignRanks(ids, edges) {
    const outs = new Map();
    const ins = new Map();
    for (const id of ids) {
        outs.set(id, []);
        ins.set(id, []);
    }
    for (const e of edges) {
        outs.get(e.from)?.push(e.to);
        ins.get(e.to)?.push(e.from);
    }
    const rank = new Map();
    const visiting = new Set();
    const visit = (id) => {
        const cached = rank.get(id);
        if (cached !== undefined)
            return cached;
        if (visiting.has(id))
            return 0;
        visiting.add(id);
        const preds = ins.get(id) ?? [];
        let best = 0;
        for (const p of preds)
            best = Math.max(best, visit(p) + 1);
        visiting.delete(id);
        rank.set(id, best);
        return best;
    };
    for (const id of ids)
        visit(id);
    return rank;
}
function groupByRank(ids, rank) {
    const groups = new Map();
    for (const id of ids) {
        const r = rank.get(id) ?? 0;
        const list = groups.get(r) ?? [];
        list.push(id);
        groups.set(r, list);
    }
    return groups;
}
/** Barycenter heuristic: reorder each rank from neighbors in adjacent ranks. */
function orderRanks(rankGroups, edges, passes) {
    const ranks = [...rankGroups.keys()].sort((a, b) => a - b);
    if (ranks.length < 2)
        return;
    for (let pass = 0; pass < passes; pass += 1) {
        const forward = pass % 2 === 0;
        const sequence = forward ? ranks : [...ranks].reverse();
        for (let i = 1; i < sequence.length; i += 1) {
            const current = sequence[i];
            const neighbor = sequence[i - 1];
            const order = new Map((rankGroups.get(neighbor) ?? []).map((id, index) => [id, index]));
            const group = rankGroups.get(current) ?? [];
            const scored = group.map((id) => {
                const links = edges
                    .filter((e) => forward
                    ? e.to === id && order.has(e.from)
                    : e.from === id && order.has(e.to))
                    .map((e) => order.get(forward ? e.from : e.to));
                const bary = links.length === 0
                    ? (order.get(id) ?? group.indexOf(id))
                    : links.reduce((a, b) => a + b, 0) / links.length;
                return { id, bary };
            });
            scored.sort((a, b) => a.bary - b.bary || a.id.localeCompare(b.id));
            rankGroups.set(current, scored.map((s) => s.id));
        }
    }
}
function propsOf(record) {
    const props = record["props"];
    return typeof props === "object" && props !== null && !Array.isArray(props)
        ? props
        : {};
}
function upsertPlacement(byId, next) {
    const prev = byId.get(next.id);
    if (!prev) {
        byId.set(next.id, next);
        return;
    }
    byId.set(next.id, {
        ...prev,
        ...next,
        parentId: next.parentId ?? prev.parentId,
        w: next.w ?? prev.w,
        h: next.h ?? prev.h,
    });
}
function containerOf(id, byId) {
    const shape = byId.get(id);
    if (!shape)
        return id;
    if (shape.type === "frame")
        return id;
    if (shape.parentId.startsWith("shape:")) {
        const parent = byId.get(shape.parentId);
        if (parent?.type === "frame")
            return parent.id;
    }
    return id;
}
/**
 * Bind underlays, layout children inside each frame, then layout frames +
 * page-level orphans. Cross-frame arrows become frame→frame edges.
 */
export function prettifyShapesWithUnderlays(shapesIn, edges, options = {}) {
    const only = options.onlyIds ? new Set(options.onlyIds) : undefined;
    const byId = new Map(shapesIn.map((s) => [s.id, { ...s }]));
    const bindings = bindShapesToUnderlays([...byId.values()]);
    for (const binding of bindings) {
        const prev = byId.get(binding.id);
        if (!prev)
            continue;
        byId.set(binding.id, {
            ...prev,
            parentId: binding.parentId,
            x: binding.x,
            y: binding.y,
        });
    }
    const placementMap = new Map();
    for (const binding of bindings) {
        upsertPlacement(placementMap, {
            id: binding.id,
            x: binding.x,
            y: binding.y,
            parentId: binding.parentId,
        });
    }
    const shapes = [...byId.values()];
    const frames = shapes.filter((s) => s.type === "frame" && s.parentId.startsWith("page:"));
    const ranksOut = {};
    for (const frame of frames) {
        const children = shapes.filter((s) => s.parentId === frame.id && s.type !== "arrow");
        const frameSelected = only?.has(frame.id) ?? false;
        const selectedChildren = only
            ? children.filter((c) => only.has(c.id))
            : children;
        const shouldLayoutInner = !only || frameSelected || selectedChildren.length > 0;
        if (!shouldLayoutInner)
            continue;
        const layoutChildren = !only || frameSelected ? children : selectedChildren;
        if (layoutChildren.length === 0) {
            upsertPlacement(placementMap, {
                id: frame.id,
                x: frame.x,
                y: frame.y,
                w: frame.w,
                h: frame.h,
            });
            continue;
        }
        const childIds = new Set(layoutChildren.map((c) => c.id));
        const innerEdges = edges.filter((e) => childIds.has(e.from) && childIds.has(e.to));
        const inner = prettifyGraph(layoutChildren.map((c) => ({ id: c.id, w: c.w, h: c.h })), innerEdges, {
            ...options,
            originX: FRAME_PAD,
            originY: FRAME_TITLE_PAD,
            rankGap: options.rankGap ?? 64,
            nodeGap: options.nodeGap ?? 32,
        });
        Object.assign(ranksOut, inner.ranks);
        for (const p of inner.placements) {
            const child = byId.get(p.id);
            if (child) {
                byId.set(p.id, { ...child, x: p.x, y: p.y, parentId: frame.id });
            }
            upsertPlacement(placementMap, {
                id: p.id,
                x: p.x,
                y: p.y,
                parentId: frame.id,
            });
        }
        const sizedChildren = children.map((c) => {
            const laid = placementMap.get(c.id);
            return {
                x: laid?.x ?? c.x,
                y: laid?.y ?? c.y,
                w: c.w,
                h: c.h,
            };
        });
        const fitted = fitFrameToChildren(sizedChildren, frame.w, frame.h);
        byId.set(frame.id, { ...frame, w: fitted.w, h: fitted.h });
        upsertPlacement(placementMap, {
            id: frame.id,
            x: frame.x,
            y: frame.y,
            w: fitted.w,
            h: fitted.h,
        });
    }
    const topShapes = [...byId.values()].filter((s) => s.parentId.startsWith("page:") && s.type !== "arrow");
    const topCandidates = only
        ? topShapes.filter((s) => {
            if (only.has(s.id))
                return true;
            if (s.type !== "frame")
                return false;
            return [...byId.values()].some((c) => c.parentId === s.id && only.has(c.id));
        })
        : topShapes;
    const topIds = new Set(topCandidates.map((s) => s.id));
    const topEdges = [];
    const seen = new Set();
    for (const edge of edges) {
        const from = containerOf(edge.from, byId);
        const to = containerOf(edge.to, byId);
        if (from === to)
            continue;
        if (!topIds.has(from) || !topIds.has(to))
            continue;
        const key = `${from}->${to}`;
        if (seen.has(key))
            continue;
        seen.add(key);
        topEdges.push({ from, to });
    }
    const originX = options.originX ??
        (only
            ? Math.min(...topCandidates.map((s) => s.x), Number.POSITIVE_INFINITY)
            : 0);
    const originY = options.originY ??
        (only
            ? Math.min(...topCandidates.map((s) => s.y), Number.POSITIVE_INFINITY)
            : 0);
    const top = prettifyGraph(topCandidates.map((s) => {
        const fitted = placementMap.get(s.id);
        return {
            id: s.id,
            w: fitted?.w ?? s.w,
            h: fitted?.h ?? s.h,
        };
    }), topEdges, {
        ...options,
        originX: Number.isFinite(originX) ? originX : 0,
        originY: Number.isFinite(originY) ? originY : 0,
    });
    Object.assign(ranksOut, top.ranks);
    for (const p of top.placements) {
        const prev = byId.get(p.id);
        upsertPlacement(placementMap, {
            id: p.id,
            x: p.x,
            y: p.y,
            parentId: prev?.parentId,
            w: placementMap.get(p.id)?.w,
            h: placementMap.get(p.id)?.h,
        });
    }
    return {
        placements: [...placementMap.values()],
        ranks: ranksOut,
        bound: bindings.length,
    };
}
/**
 * Build a prettify model from board records.
 * Binds cards onto frames they sit on, then lays out hierarchically.
 */
export function prettifyBoardRecords(records, options = {}) {
    const shapes = underlayShapesFromRecords(records);
    const edges = [];
    const only = options.onlyIds ? new Set(options.onlyIds) : undefined;
    for (const record of Object.values(records)) {
        if (record.typeName !== "shape")
            continue;
        if (record["type"] !== "arrow")
            continue;
        const props = propsOf(record);
        const from = bindingTargetId(props["start"]);
        const to = bindingTargetId(props["end"]);
        if (!from || !to)
            continue;
        if (only && (!only.has(from) || !only.has(to))) {
            // Still allow cross edges when both containers are in scope via remap
            const fromShape = shapes.find((s) => s.id === from);
            const toShape = shapes.find((s) => s.id === to);
            const fromOk = only.has(from) ||
                (fromShape?.parentId !== undefined && only.has(fromShape.parentId));
            const toOk = only.has(to) ||
                (toShape?.parentId !== undefined && only.has(toShape.parentId));
            if (!fromOk || !toOk)
                continue;
        }
        edges.push({ from, to });
    }
    return prettifyShapesWithUnderlays(shapes, edges, options);
}
/** Apply placements onto a mutable copy of records (host tool path). */
export function applyPrettifyPlacements(records, result) {
    const put = [];
    for (const placement of result.placements) {
        const prev = records[placement.id];
        if (!prev)
            continue;
        const next = {
            ...prev,
            x: placement.x,
            y: placement.y,
        };
        if (placement.parentId)
            next["parentId"] = placement.parentId;
        if ((placement.w !== undefined || placement.h !== undefined) &&
            prev["type"] === "frame") {
            const props = propsOf(prev);
            next["props"] = {
                ...props,
                ...(placement.w !== undefined ? { w: placement.w } : {}),
                ...(placement.h !== undefined ? { h: placement.h } : {}),
            };
        }
        const changed = prev["x"] !== next["x"] ||
            prev["y"] !== next["y"] ||
            prev["parentId"] !== next["parentId"] ||
            JSON.stringify(prev["props"]) !== JSON.stringify(next["props"]);
        if (changed)
            put.push(next);
    }
    return put;
}
/**
 * Bind underlays only (no layout). Used by board_validate repair and agents.
 */
export function bindBoardUnderlays(records) {
    const shapes = underlayShapesFromRecords(records);
    const bindings = bindShapesToUnderlays(shapes);
    return applyUnderlayBindings(records, bindings);
}
