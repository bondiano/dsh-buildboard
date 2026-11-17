/**
 * Assertion & Geometry Helpers for dsh-cult-canvas E2E Test Suite
 */
import assert from "node:assert/strict";
import { strokeHit } from "../../../canvas-model.js";
/**
 * Recursively strips undefined keys from objects, and converts undefined array entries to null.
 * Replaces NaN and Infinity with null to ensure compliance with DSH snapshotJsonValue validation.
 */
export function stripUndefined(value, seen = new WeakSet()) {
    if (value === undefined) {
        return undefined;
    }
    if (typeof value === "number") {
        if (Number.isNaN(value) || !Number.isFinite(value)) {
            return null;
        }
        return value;
    }
    if (value === null || typeof value !== "object") {
        return value;
    }
    if (seen.has(value)) {
        return null;
    }
    seen.add(value);
    if (Array.isArray(value)) {
        return value.map((item) => item === undefined ? null : stripUndefined(item, seen));
    }
    const result = {};
    for (const [key, val] of Object.entries(value)) {
        if (val !== undefined) {
            result[key] = stripUndefined(val, seen);
        }
    }
    return result;
}
/**
 * Asserts that an object tree contains zero undefined properties or non-finite numbers.
 */
export function assertNoUndefined(obj, path = "root") {
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
            assert.fail(`Undefined property "${key}" detected at path: ${path}.${key}`);
        }
        assertNoUndefined(val, `${path}.${key}`);
    }
}
/**
 * Computes minimum Euclidean distance from point P to line segment AB.
 */
export function distToSegment(px, py, ax, ay, bx, by) {
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
export function isPointInStroke(point, strokeNode, tolerance = 8) {
    const stroke = strokeNode.gbStroke;
    if (!stroke || !stroke.points || stroke.points.length === 0) {
        return false;
    }
    return strokeHit({
        x: strokeNode.x,
        y: strokeNode.y,
        width: strokeNode.width,
        height: strokeNode.height,
    }, stroke, point, tolerance);
}
/**
 * Asserts point is in stroke.
 */
export function assertPointInStroke(point, strokeNode, tolerance = 8) {
    const hits = isPointInStroke(point, strokeNode, tolerance);
    assert.equal(hits, true, `Expected point (${point.x}, ${point.y}) to hit stroke node`);
}
/**
 * Asserts point is NOT in stroke.
 */
export function assertPointNotInStroke(point, strokeNode, tolerance = 8) {
    const hits = isPointInStroke(point, strokeNode, tolerance);
    assert.equal(hits, false, `Expected point (${point.x}, ${point.y}) to miss stroke node`);
}
/**
 * Tests 2D axis-aligned bounding box intersection.
 */
export function boxesOverlap(a, b) {
    return !(a.x + a.width <= b.x ||
        b.x + b.width <= a.x ||
        a.y + a.height <= b.y ||
        b.y + b.height <= a.y);
}
export function assertBoundingBoxOverlap(a, b, expected = true) {
    assert.equal(boxesOverlap(a, b), expected, `Bounding boxes overlap check failed (expected: ${expected})`);
}
/**
 * Computes bounding union of an array of boxes.
 */
export function unionBounds(boxes) {
    if (boxes.length === 0) {
        return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
    }
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const b of boxes) {
        if (b.x < minX)
            minX = b.x;
        if (b.y < minY)
            minY = b.y;
        if (b.x + b.width > maxX)
            maxX = b.x + b.width;
        if (b.y + b.height > maxY)
            maxY = b.y + b.height;
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
export function assertTopologicalOrder(order, edges, expectedNodes) {
    assert.ok(Array.isArray(order), "Topological order must be an array");
    assert.equal(new Set(order).size, order.length, `Topological order contains duplicate node IDs: ${order.join(", ")}`);
    const pos = new Map();
    order.forEach((id, idx) => pos.set(id, idx));
    if (expectedNodes) {
        assert.equal(order.length, expectedNodes.length, `Topological order length (${order.length}) does not match expected node count (${expectedNodes.length})`);
        for (const id of expectedNodes) {
            assert.ok(pos.has(id), `Topological order missing expected node: "${id}"`);
        }
    }
    for (const edge of edges) {
        assert.ok(pos.has(edge.fromNode), `Edge source "${edge.fromNode}" is missing from topological order`);
        assert.ok(pos.has(edge.toNode), `Edge target "${edge.toNode}" is missing from topological order`);
        const uPos = pos.get(edge.fromNode);
        const vPos = pos.get(edge.toNode);
        assert.ok(uPos < vPos, `Topological dependency violated: "${edge.fromNode}" (pos ${uPos}) must strictly precede "${edge.toNode}" (pos ${vPos})`);
    }
}
/**
 * Asserts cycle status.
 */
export function assertCycleDetected(hasCycle) {
    assert.equal(hasCycle, true, "Expected graph to contain a cycle, but none detected");
}
export function assertNoCycles(hasCycle) {
    assert.equal(hasCycle, false, "Expected graph to be a valid DAG without cycles, but cycle detected");
}
/**
 * Validates document against JSON Canvas 1.0 Specification.
 * Hardened against dangling edges, duplicate edge IDs, and invalid sides/ends.
 */
export function assertValidJsonCanvas(doc) {
    assert.ok(doc && typeof doc === "object", "JSON Canvas must be an object");
    const root = doc;
    assert.ok(Array.isArray(root.nodes), "JSON Canvas root must have a 'nodes' array");
    assert.ok(Array.isArray(root.edges), "JSON Canvas root must have an 'edges' array");
    const validTypes = new Set(["text", "file", "link", "group"]);
    const validSides = new Set(["top", "right", "bottom", "left"]);
    const validEnds = new Set(["none", "arrow"]);
    const nodeIds = new Set();
    for (const node of root.nodes) {
        assert.ok(typeof node.id === "string" && node.id.length > 0, "Node must have a non-empty string id");
        assert.ok(!nodeIds.has(node.id), `Duplicate node ID: ${node.id}`);
        nodeIds.add(node.id);
        assert.ok(validTypes.has(node.type), `Node ${node.id} has invalid type: ${String(node.type)}`);
        assert.ok(typeof node.x === "number" && Number.isFinite(node.x), `Node ${node.id} missing valid x`);
        assert.ok(typeof node.y === "number" && Number.isFinite(node.y), `Node ${node.id} missing valid y`);
        assert.ok(typeof node.width === "number" &&
            Number.isFinite(node.width) &&
            node.width > 0, `Node ${node.id} missing positive width`);
        assert.ok(typeof node.height === "number" &&
            Number.isFinite(node.height) &&
            node.height > 0, `Node ${node.id} missing positive height`);
        if (node.type === "text") {
            assert.ok(typeof node.text === "string", `Text node ${node.id} must have a 'text' string`);
        }
        else if (node.type === "file") {
            assert.ok(typeof node.file === "string", `File node ${node.id} must have a 'file' string`);
        }
        else if (node.type === "link") {
            assert.ok(typeof node.url === "string", `Link node ${node.id} must have a 'url' string`);
        }
    }
    const edgeIds = new Set();
    for (const edge of root.edges) {
        assert.ok(typeof edge.id === "string" && edge.id.length > 0, "Edge must have a non-empty string id");
        assert.ok(!edgeIds.has(edge.id), `Duplicate edge ID in JSON Canvas: "${edge.id}"`);
        edgeIds.add(edge.id);
        assert.ok(typeof edge.fromNode === "string", `Edge ${edge.id} missing fromNode`);
        assert.ok(typeof edge.toNode === "string", `Edge ${edge.id} missing toNode`);
        // JSON Canvas 1.0 Spec requirement: edges must connect valid nodes in document
        assert.ok(nodeIds.has(edge.fromNode), `Dangling edge ${edge.id}: fromNode "${edge.fromNode}" does not exist in nodes`);
        assert.ok(nodeIds.has(edge.toNode), `Dangling edge ${edge.id}: toNode "${edge.toNode}" does not exist in nodes`);
        if (edge.fromSide !== undefined) {
            const sideStr = typeof edge.fromSide === "string" ? edge.fromSide : "";
            assert.ok(validSides.has(sideStr), `Edge ${edge.id} has invalid fromSide: ${sideStr}`);
        }
        if (edge.toSide !== undefined) {
            const sideStr = typeof edge.toSide === "string" ? edge.toSide : "";
            assert.ok(validSides.has(sideStr), `Edge ${edge.id} has invalid toSide: ${sideStr}`);
        }
        if (edge.fromEnd !== undefined) {
            const endStr = typeof edge.fromEnd === "string" ? edge.fromEnd : "";
            assert.ok(validEnds.has(endStr), `Edge ${edge.id} has invalid fromEnd: ${endStr}`);
        }
        if (edge.toEnd !== undefined) {
            const endStr = typeof edge.toEnd === "string" ? edge.toEnd : "";
            assert.ok(validEnds.has(endStr), `Edge ${edge.id} has invalid toEnd: ${endStr}`);
        }
    }
}
