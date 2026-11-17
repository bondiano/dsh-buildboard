/**
 * Directed Graph & DAG Scheduling Engine
 *
 * Implements:
 * - Directed graph adjacency representation
 * - Kahn's algorithm for topological sorting with cycle detection
 * - Upstream / downstream traversal (transitive and direct)
 * - Cycle path extraction
 * - Semantic port taxonomy validation matching media nodes and whiteboard cards
 * - Auto-layout topological band calculation and non-overlapping coordinate generation
 */

import {
	PORT_TABLE,
	MULTI_INPUT_PORTS,
	isPortCompatible,
} from "../domain/ports.js";
import type {
	CanvasElement,
	NodePortConfiguration,
	PortKind,
} from "../domain/types.js";

export { PORT_TABLE, MULTI_INPUT_PORTS, isPortCompatible };
export type { NodePortConfiguration, PortKind };

export interface GraphEdge {
	fromNode: string;
	toNode: string;
	fromPort?: string;
	toPort?: string;
	id?: string;
	fromSide?: string;
	toSide?: string;
	fromEnd?: string;
	toEnd?: string;
	label?: string;
	color?: string;
}

export interface PortValidationResult {
	valid: boolean;
	ok: boolean;
	reason?: string;
	error?: string;
}

export interface TopologicalBandsResult {
	bands: string[][];
	nodeLevels: Map<string, number>;
	maxLevel: number;
}

export interface AutoLayoutOptions {
	startX?: number;
	startY?: number;
	gapX?: number;
	gapY?: number;
	nodeWidth?: number;
	nodeHeight?: number;
	direction?: "LR" | "TB";
}

/**
 * Validates whether a connection between two ports is semantically compatible
 * according to the port taxonomy table.
 * Accepts either node type string identifiers or full CanvasElement objects.
 */
export function validatePortConnection(
	from: CanvasElement | { kind?: string; type?: string } | string,
	fromPort: string | undefined,
	to: CanvasElement | { kind?: string; type?: string } | string,
	toPort: string | undefined,
): PortValidationResult {
	const fromType =
		typeof from === "string"
			? from
			: from.kind || (from as unknown as { type?: string }).type || "";
	const toType =
		typeof to === "string"
			? to
			: to.kind || (to as unknown as { type?: string }).type || "";

	const fromDef = PORT_TABLE[fromType];
	const toDef = PORT_TABLE[toType];

	if (!fromDef) {
		const reason = `Unknown source node type: ${fromType}`;
		return { valid: false, ok: false, reason, error: reason };
	}
	if (!toDef) {
		const reason = `Unknown target node type: ${toType}`;
		return { valid: false, ok: false, reason, error: reason };
	}

	if (fromDef.outputs.length === 0) {
		const reason = `Source node ${fromType} has no output ports`;
		return { valid: false, ok: false, reason, error: reason };
	}
	if (toDef.inputs.length === 0) {
		const reason = `Target node ${toType} has no input ports`;
		return { valid: false, ok: false, reason, error: reason };
	}

	const dstPort = toPort || toDef.inputs[0]?.id;
	const dstPortDef = dstPort
		? toDef.inputs.find((p) => p.id === dstPort)
		: undefined;

	const matchingOutput = dstPortDef
		? fromDef.outputs.find((p) => p.kind === dstPortDef.kind)
		: undefined;
	const srcPort = fromPort || matchingOutput?.id || fromDef.outputs[0]?.id;

	if (!srcPort) {
		const reason = `Source node ${fromType} has no output ports`;
		return { valid: false, ok: false, reason, error: reason };
	}
	if (!dstPort) {
		const reason = `Target node ${toType} has no input ports`;
		return { valid: false, ok: false, reason, error: reason };
	}

	const srcPortDef = fromDef.outputs.find((p) => p.id === srcPort);
	if (!srcPortDef) {
		const reason = `Invalid output port "${srcPort}" on ${fromType}`;
		return { valid: false, ok: false, reason, error: reason };
	}

	if (!dstPortDef) {
		const reason = `Invalid input port "${dstPort}" on ${toType}`;
		return { valid: false, ok: false, reason, error: reason };
	}

	if (srcPortDef.kind !== dstPortDef.kind) {
		const reason = `Port type mismatch: output port "${srcPort}" (${srcPortDef.kind}) cannot connect to input port "${dstPort}" (${dstPortDef.kind})`;
		return { valid: false, ok: false, reason, error: reason };
	}

	return { valid: true, ok: true };
}

/**
 * Production-grade Directed Acyclic Graph (DAG) Engine.
 */
export class GraphEngine {
	private nodes: Set<string> = new Set();
	private adj: Map<string, Set<string>> = new Map();
	private revAdj: Map<string, Set<string>> = new Map();
	private edges: GraphEdge[] = [];

	/**
	 * Builds internal adjacency matrices and in-degree trackers from node and edge sets.
	 */
	buildGraph(nodeIds: string[], edges: GraphEdge[] = []): void {
		this.nodes = new Set(nodeIds);
		this.adj.clear();
		this.revAdj.clear();
		this.edges = [];

		for (const id of nodeIds) {
			this.adj.set(id, new Set());
			this.revAdj.set(id, new Set());
		}

		for (const edge of edges) {
			if (this.nodes.has(edge.fromNode) && this.nodes.has(edge.toNode)) {
				this.adj.get(edge.fromNode)?.add(edge.toNode);
				this.revAdj.get(edge.toNode)?.add(edge.fromNode);
				this.edges.push(edge);
			}
		}
	}

	/**
	 * Computes topological execution order using Kahn's algorithm (zero-in-degree queue).
	 * Returns null if the graph contains cyclic dependencies.
	 */
	getTopologicalOrder(): string[] | null {
		const inDegree = new Map<string, number>();
		for (const node of this.nodes) {
			inDegree.set(node, this.revAdj.get(node)?.size ?? 0);
		}

		const queue: string[] = [];
		for (const [node, deg] of inDegree.entries()) {
			if (deg === 0) {
				queue.push(node);
			}
		}

		const order: string[] = [];
		while (queue.length > 0) {
			const u = queue.shift()!;
			order.push(u);

			const neighbors = this.adj.get(u);
			if (neighbors) {
				for (const v of neighbors) {
					const newDeg = (inDegree.get(v) ?? 1) - 1;
					inDegree.set(v, newDeg);
					if (newDeg === 0) {
						queue.push(v);
					}
				}
			}
		}

		return order.length === this.nodes.size ? order : null;
	}

	/**
	 * Returns true if the directed graph contains at least one cycle.
	 */
	hasCycles(): boolean {
		return this.getTopologicalOrder() === null;
	}

	/**
	 * Returns the cycle path (e.g. ['A', 'B', 'C', 'A']) if a cycle exists, or null.
	 */
	getCyclePath(): string[] | null {
		const state = new Map<string, 0 | 1 | 2>(); // 0: unvisited, 1: visiting (stack), 2: visited
		const parent = new Map<string, string>();
		let cycle: string[] | null = null;

		for (const node of this.nodes) {
			state.set(node, 0);
		}

		const dfs = (curr: string): boolean => {
			state.set(curr, 1);
			const neighbors = this.adj.get(curr);
			if (neighbors) {
				for (const next of neighbors) {
					if (state.get(next) === 1) {
						// Found cycle
						if (curr === next) {
							cycle = [curr, curr];
							return true;
						}
						const path: string[] = [next, curr];
						let p = parent.get(curr);
						while (p && p !== next) {
							path.push(p);
							p = parent.get(p);
						}
						path.push(next);
						cycle = path.reverse();
						return true;
					}
					if (state.get(next) === 0) {
						parent.set(next, curr);
						if (dfs(next)) return true;
					}
				}
			}
			state.set(curr, 2);
			return false;
		};

		for (const node of this.nodes) {
			if (state.get(node) === 0) {
				if (dfs(node)) break;
			}
		}

		return cycle;
	}

	/**
	 * Traverses transitive ancestors upstream of the given node.
	 */
	getUpstreamNodes(nodeId: string): string[] {
		const visited = new Set<string>();
		const queue: string[] = [nodeId];

		while (queue.length > 0) {
			const curr = queue.shift()!;
			const parents = this.revAdj.get(curr);
			if (parents) {
				for (const up of parents) {
					if (!visited.has(up)) {
						visited.add(up);
						queue.push(up);
					}
				}
			}
		}

		return Array.from(visited);
	}

	/**
	 * Alias for getUpstreamNodes (transitive ancestors).
	 */
	getAncestors(nodeId: string): string[] {
		return this.getUpstreamNodes(nodeId);
	}

	/**
	 * Returns immediate direct predecessors (in-edges only).
	 */
	getDirectUpstream(nodeId: string): string[] {
		return Array.from(this.revAdj.get(nodeId) ?? []);
	}

	/**
	 * Traverses transitive descendants downstream of the given node.
	 */
	getDownstreamNodes(nodeId: string): string[] {
		const visited = new Set<string>();
		const queue: string[] = [nodeId];

		while (queue.length > 0) {
			const curr = queue.shift()!;
			const children = this.adj.get(curr);
			if (children) {
				for (const down of children) {
					if (!visited.has(down)) {
						visited.add(down);
						queue.push(down);
					}
				}
			}
		}

		return Array.from(visited);
	}

	/**
	 * Alias for getDownstreamNodes (transitive descendants).
	 */
	getDescendants(nodeId: string): string[] {
		return this.getDownstreamNodes(nodeId);
	}

	/**
	 * Returns immediate direct successors (out-edges only).
	 */
	getDirectDownstream(nodeId: string): string[] {
		return Array.from(this.adj.get(nodeId) ?? []);
	}

	/**
	 * Returns in-degree of a node.
	 */
	getInDegree(nodeId: string): number {
		return this.revAdj.get(nodeId)?.size ?? 0;
	}

	/**
	 * Returns out-degree of a node.
	 */
	getOutDegree(nodeId: string): number {
		return this.adj.get(nodeId)?.size ?? 0;
	}

	/**
	 * Validates port compatibility between two node types (or elements) and ports.
	 */
	validatePortConnection(
		from: CanvasElement | { kind?: string; type?: string } | string,
		fromPort: string | undefined,
		to: CanvasElement | { kind?: string; type?: string } | string,
		toPort: string | undefined,
	): PortValidationResult {
		return validatePortConnection(from, fromPort, to, toPort);
	}

	/**
	 * Partitions the DAG into topological bands (levels), where root nodes are level 0
	 * and each downstream node is placed at max(parent_levels) + 1.
	 */
	computeTopologicalBands(
		nodeIds?: string[],
		edges?: GraphEdge[],
	): TopologicalBandsResult {
		if (nodeIds !== undefined && edges !== undefined) {
			const tempGraph = new GraphEngine();
			tempGraph.buildGraph(nodeIds, edges);
			return tempGraph.computeTopologicalBands();
		}

		const nodeLevels = new Map<string, number>();
		for (const node of this.nodes) {
			nodeLevels.set(node, 0);
		}

		const topoOrder = this.getTopologicalOrder();
		if (topoOrder) {
			for (const u of topoOrder) {
				const currentLvl = nodeLevels.get(u) ?? 0;
				const neighbors = this.adj.get(u);
				if (neighbors) {
					for (const v of neighbors) {
						const prevLvl = nodeLevels.get(v) ?? 0;
						if (currentLvl + 1 > prevLvl) {
							nodeLevels.set(v, currentLvl + 1);
						}
					}
				}
			}
		} else {
			// Fallback for cyclic graphs: compute levels using bounded BFS from zero-in-degree roots
			const inDegree = new Map<string, number>();
			for (const node of this.nodes) {
				inDegree.set(node, this.revAdj.get(node)?.size ?? 0);
			}
			const queue: string[] = [];
			const visited = new Set<string>();
			for (const [node, deg] of inDegree.entries()) {
				if (deg === 0) {
					queue.push(node);
					visited.add(node);
				}
			}

			// If pure cycles have no 0-in-degree roots, seed with any unvisited node
			if (queue.length === 0 && this.nodes.size > 0) {
				for (const node of this.nodes) {
					if (!visited.has(node)) {
						queue.push(node);
						visited.add(node);
						break;
					}
				}
			}

			while (queue.length > 0) {
				const u = queue.shift()!;
				const currentLvl = nodeLevels.get(u) ?? 0;
				const neighbors = this.adj.get(u);
				if (neighbors) {
					for (const v of neighbors) {
						const prevLvl = nodeLevels.get(v) ?? 0;
						if (currentLvl + 1 > prevLvl) {
							nodeLevels.set(v, currentLvl + 1);
						}
						if (!visited.has(v)) {
							visited.add(v);
							queue.push(v);
						}
					}
				}
				// If queue emptied but some nodes are still unvisited (e.g. disconnected pure cycle component)
				if (queue.length === 0 && visited.size < this.nodes.size) {
					for (const node of this.nodes) {
						if (!visited.has(node)) {
							queue.push(node);
							visited.add(node);
							break;
						}
					}
				}
			}
		}

		let maxLevel = 0;
		for (const lvl of nodeLevels.values()) {
			if (lvl > maxLevel) maxLevel = lvl;
		}

		const bands: string[][] = [];
		if (this.nodes.size > 0) {
			for (let i = 0; i <= maxLevel; i++) {
				bands.push([]);
			}
			for (const [node, lvl] of nodeLevels.entries()) {
				bands[lvl]?.push(node);
			}
			for (const band of bands) {
				band.sort();
			}
		}

		return { bands, nodeLevels, maxLevel };
	}

	/**
	 * Computes spatial coordinates for auto-layout based on topological bands.
	 */
	computeAutoLayoutCoordinates(
		options: AutoLayoutOptions = {},
	): Map<string, { x: number; y: number }> {
		const {
			startX = 0,
			startY = 0,
			gapX = 80,
			gapY = 60,
			nodeWidth = 240,
			nodeHeight = 160,
			direction = "LR",
		} = options;

		const { bands } = this.computeTopologicalBands();
		const coords = new Map<string, { x: number; y: number }>();

		for (let level = 0; level < bands.length; level++) {
			const band = bands[level]!;
			for (let indexInBand = 0; indexInBand < band.length; indexInBand++) {
				const nodeId = band[indexInBand]!;
				if (direction === "LR") {
					coords.set(nodeId, {
						x: startX + level * (nodeWidth + gapX),
						y: startY + indexInBand * (nodeHeight + gapY),
					});
				} else {
					coords.set(nodeId, {
						x: startX + indexInBand * (nodeWidth + gapX),
						y: startY + level * (nodeHeight + gapY),
					});
				}
			}
		}

		return coords;
	}
}
