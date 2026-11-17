/**
 * Assertion & Geometry Helpers for dsh-cult-canvas E2E Test Suite
 */
import assert from "node:assert/strict";
import { strokeHit } from "../../../canvas-model.js";

export interface Box {
	x: number;
	y: number;
	width: number;
	height: number;
}

export interface StrokeData {
	v: number;
	size: number;
	w: number;
	h: number;
	points: Array<[number, number]>;
}

export interface StrokeNodeLike extends Box {
	gbStroke?: StrokeData;
}

/**
 * Recursively strips undefined keys from objects, and converts undefined array entries to null.
 * Replaces NaN and Infinity with null to ensure compliance with DSH snapshotJsonValue validation.
 */
export function stripUndefined<T>(
	value: T,
	seen: WeakSet<object> = new WeakSet(),
): T {
	if (value === undefined) {
		return undefined as unknown as T;
	}
	if (typeof value === "number") {
		if (Number.isNaN(value) || !Number.isFinite(value)) {
			return null as unknown as T;
		}
		return value;
	}
	if (value === null || typeof value !== "object") {
		return value;
	}
	if (seen.has(value)) {
		return null as unknown as T;
	}
	seen.add(value);
	if (Array.isArray(value)) {
		return value.map((item) =>
			item === undefined ? null : stripUndefined(item, seen),
		) as unknown as T;
	}
	const result: Record<string, unknown> = {};
	for (const [key, val] of Object.entries(value)) {
		if (val !== undefined) {
			result[key] = stripUndefined(val, seen);
		}
	}
	return result as T;
}

/**
 * Asserts that an object tree contains zero undefined properties or non-finite numbers.
 */
export function assertNoUndefined(obj: unknown, path = "root"): void {
	if (obj === undefined) {
		assert.fail(`Undefined value detected at path: ${path}`);
	}
	if (typeof obj === "number" && (Number.isNaN(obj) || !Number.isFinite(obj))) {
		assert.fail(`Non-finite number (${obj}) detected at path: ${path}`);
	}
	if (obj === null || typeof obj !== "object") {
		return;
	}
	if (Array.isArray(obj)) {
		obj.forEach((item, index) => {
			assertNoUndefined(item, `${path}[${index}]`);
		});
		return;
	}
	for (const [key, val] of Object.entries(obj)) {
		if (val === undefined) {
			assert.fail(
				`Undefined property "${key}" detected at path: ${path}.${key}`,
			);
		}
		assertNoUndefined(val, `${path}.${key}`);
	}
}

/**
 * Computes minimum Euclidean distance from point P to line segment AB.
 */
export function distToSegment(
	px: number,
	py: number,
	ax: number,
	ay: number,
	bx: number,
	by: number,
): number {
	const dx = bx - ax;
	const dy = by - ay;
	const lenSq = dx * dx + dy * dy;
	if (lenSq === 0) {
		return Math.hypot(px - ax, py - ay);
	}
	let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
	t = Math.max(0, Math.min(1, t));
	const projX = ax + t * dx;
	const projY = ay + t * dy;
	return Math.hypot(px - projX, py - projY);
}

/**
 * Hit testing for freehand strokes: tests if (px, py) is within tolerance of stroke polyline,
 * scaling relative points by container size if resized.
 */
export function isPointInStroke(
	point: { x: number; y: number },
	strokeNode: StrokeNodeLike,
	tolerance = 8,
): boolean {
	const stroke = strokeNode.gbStroke;
	if (!stroke || !stroke.points || stroke.points.length === 0) {
		return false;
	}
	return strokeHit(
		{
			x: strokeNode.x,
			y: strokeNode.y,
			width: strokeNode.width,
			height: strokeNode.height,
		},
		stroke,
		point,
		tolerance,
	);
}

/**
 * Asserts point is in stroke.
 */
export function assertPointInStroke(
	point: { x: number; y: number },
	strokeNode: StrokeNodeLike,
	tolerance = 8,
): void {
	const hits = isPointInStroke(point, strokeNode, tolerance);
	assert.equal(
		hits,
		true,
		`Expected point (${point.x}, ${point.y}) to hit stroke node`,
	);
}

/**
 * Asserts point is NOT in stroke.
 */
export function assertPointNotInStroke(
	point: { x: number; y: number },
	strokeNode: StrokeNodeLike,
	tolerance = 8,
): void {
	const hits = isPointInStroke(point, strokeNode, tolerance);
	assert.equal(
		hits,
		false,
		`Expected point (${point.x}, ${point.y}) to miss stroke node`,
	);
}

/**
 * Tests 2D axis-aligned bounding box intersection.
 */
export function boxesOverlap(a: Box, b: Box): boolean {
	return !(
		a.x + a.width <= b.x ||
		b.x + b.width <= a.x ||
		a.y + a.height <= b.y ||
		b.y + b.height <= a.y
	);
}

export function assertBoundingBoxOverlap(
	a: Box,
	b: Box,
	expected = true,
): void {
	assert.equal(
		boxesOverlap(a, b),
		expected,
		`Bounding boxes overlap check failed (expected: ${expected})`,
	);
}

/**
 * Computes bounding union of an array of boxes.
 */
export function unionBounds(boxes: Box[]): {
	minX: number;
	minY: number;
	maxX: number;
	maxY: number;
	width: number;
	height: number;
} {
	if (boxes.length === 0) {
		return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
	}
	let minX = Infinity;
	let minY = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;
	for (const b of boxes) {
		if (b.x < minX) minX = b.x;
		if (b.y < minY) minY = b.y;
		if (b.x + b.width > maxX) maxX = b.x + b.width;
		if (b.y + b.height > maxY) maxY = b.y + b.height;
	}
	return {
		minX,
		minY,
		maxX,
		maxY,
		width: maxX - minX,
		height: maxY - minY,
	};
}

/**
 * Asserts topological order: for every directed edge u -> v, u must appear strictly before v.
 * Hardened against empty or incomplete orders, missing edge endpoints, and duplicate node IDs.
 */
export function assertTopologicalOrder(
	order: string[],
	edges: Array<{ fromNode: string; toNode: string }>,
	expectedNodes?: string[],
): void {
	assert.ok(Array.isArray(order), "Topological order must be an array");
	assert.equal(
		new Set(order).size,
		order.length,
		`Topological order contains duplicate node IDs: ${order.join(", ")}`,
	);

	const pos = new Map<string, number>();
	order.forEach((id, idx) => pos.set(id, idx));

	if (expectedNodes) {
		assert.equal(
			order.length,
			expectedNodes.length,
			`Topological order length (${order.length}) does not match expected node count (${expectedNodes.length})`,
		);
		for (const id of expectedNodes) {
			assert.ok(
				pos.has(id),
				`Topological order missing expected node: "${id}"`,
			);
		}
	}

	for (const edge of edges) {
		assert.ok(
			pos.has(edge.fromNode),
			`Edge source "${edge.fromNode}" is missing from topological order`,
		);
		assert.ok(
			pos.has(edge.toNode),
			`Edge target "${edge.toNode}" is missing from topological order`,
		);

		const uPos = pos.get(edge.fromNode)!;
		const vPos = pos.get(edge.toNode)!;
		assert.ok(
			uPos < vPos,
			`Topological dependency violated: "${edge.fromNode}" (pos ${uPos}) must strictly precede "${edge.toNode}" (pos ${vPos})`,
		);
	}
}

/**
 * Asserts cycle status.
 */
export function assertCycleDetected(hasCycle: boolean): void {
	assert.equal(
		hasCycle,
		true,
		"Expected graph to contain a cycle, but none detected",
	);
}

export function assertNoCycles(hasCycle: boolean): void {
	assert.equal(
		hasCycle,
		false,
		"Expected graph to be a valid DAG without cycles, but cycle detected",
	);
}

/**
 * Validates document against JSON Canvas 1.0 Specification.
 * Hardened against dangling edges, duplicate edge IDs, and invalid sides/ends.
 */
export function assertValidJsonCanvas(doc: unknown): void {
	assert.ok(doc && typeof doc === "object", "JSON Canvas must be an object");
	const root = doc as Record<string, unknown>;
	assert.ok(
		Array.isArray(root.nodes),
		"JSON Canvas root must have a 'nodes' array",
	);
	assert.ok(
		Array.isArray(root.edges),
		"JSON Canvas root must have an 'edges' array",
	);

	const validTypes = new Set(["text", "file", "link", "group"]);
	const validSides = new Set(["top", "right", "bottom", "left"]);
	const validEnds = new Set(["none", "arrow"]);
	const nodeIds = new Set<string>();

	for (const node of root.nodes as Array<Record<string, unknown>>) {
		assert.ok(
			typeof node.id === "string" && node.id.length > 0,
			"Node must have a non-empty string id",
		);
		assert.ok(!nodeIds.has(node.id as string), `Duplicate node ID: ${node.id}`);
		nodeIds.add(node.id as string);

		assert.ok(
			validTypes.has(node.type as string),
			`Node ${node.id as string} has invalid type: ${String(node.type)}`,
		);
		assert.ok(
			typeof node.x === "number" && Number.isFinite(node.x),
			`Node ${node.id as string} missing valid x`,
		);
		assert.ok(
			typeof node.y === "number" && Number.isFinite(node.y),
			`Node ${node.id as string} missing valid y`,
		);
		assert.ok(
			typeof node.width === "number" &&
				Number.isFinite(node.width) &&
				(node.width as number) > 0,
			`Node ${node.id as string} missing positive width`,
		);
		assert.ok(
			typeof node.height === "number" &&
				Number.isFinite(node.height) &&
				(node.height as number) > 0,
			`Node ${node.id as string} missing positive height`,
		);

		if (node.type === "text") {
			assert.ok(
				typeof node.text === "string",
				`Text node ${node.id as string} must have a 'text' string`,
			);
		} else if (node.type === "file") {
			assert.ok(
				typeof node.file === "string",
				`File node ${node.id as string} must have a 'file' string`,
			);
		} else if (node.type === "link") {
			assert.ok(
				typeof node.url === "string",
				`Link node ${node.id as string} must have a 'url' string`,
			);
		}
	}

	const edgeIds = new Set<string>();
	for (const edge of root.edges as Array<Record<string, unknown>>) {
		assert.ok(
			typeof edge.id === "string" && edge.id.length > 0,
			"Edge must have a non-empty string id",
		);
		assert.ok(
			!edgeIds.has(edge.id as string),
			`Duplicate edge ID in JSON Canvas: "${edge.id}"`,
		);
		edgeIds.add(edge.id as string);

		assert.ok(
			typeof edge.fromNode === "string",
			`Edge ${edge.id as string} missing fromNode`,
		);
		assert.ok(
			typeof edge.toNode === "string",
			`Edge ${edge.id as string} missing toNode`,
		);

		// JSON Canvas 1.0 Spec requirement: edges must connect valid nodes in document
		assert.ok(
			nodeIds.has(edge.fromNode as string),
			`Dangling edge ${edge.id as string}: fromNode "${edge.fromNode}" does not exist in nodes`,
		);
		assert.ok(
			nodeIds.has(edge.toNode as string),
			`Dangling edge ${edge.id as string}: toNode "${edge.toNode}" does not exist in nodes`,
		);

		if (edge.fromSide !== undefined) {
			const sideStr = typeof edge.fromSide === "string" ? edge.fromSide : "";
			assert.ok(
				validSides.has(sideStr),
				`Edge ${edge.id as string} has invalid fromSide: ${sideStr}`,
			);
		}
		if (edge.toSide !== undefined) {
			const sideStr = typeof edge.toSide === "string" ? edge.toSide : "";
			assert.ok(
				validSides.has(sideStr),
				`Edge ${edge.id as string} has invalid toSide: ${sideStr}`,
			);
		}
		if (edge.fromEnd !== undefined) {
			const endStr = typeof edge.fromEnd === "string" ? edge.fromEnd : "";
			assert.ok(
				validEnds.has(endStr),
				`Edge ${edge.id as string} has invalid fromEnd: ${endStr}`,
			);
		}
		if (edge.toEnd !== undefined) {
			const endStr = typeof edge.toEnd === "string" ? edge.toEnd : "";
			assert.ok(
				validEnds.has(endStr),
				`Edge ${edge.id as string} has invalid toEnd: ${endStr}`,
			);
		}
	}
}
