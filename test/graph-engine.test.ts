import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	GraphEngine,
	validatePortConnection,
	PORT_TABLE,
	MULTI_INPUT_PORTS,
	isPortCompatible,
} from "../graph-engine.js";

function assertTopologicalOrder(
	order: string[],
	edges: Array<{ fromNode: string; toNode: string }>,
): void {
	const pos = new Map<string, number>();
	order.forEach((id, idx) => pos.set(id, idx));

	for (const edge of edges) {
		const uPos = pos.get(edge.fromNode);
		const vPos = pos.get(edge.toNode);
		if (uPos !== undefined && vPos !== undefined) {
			assert.ok(
				uPos < vPos,
				`Topological violation: ${edge.fromNode} (pos ${uPos}) must precede ${edge.toNode} (pos ${vPos})`,
			);
		}
	}
}

describe("Milestone 2: GraphEngine Unit Test Suite", () => {
	// =========================================================================
	// 1. Graph Construction & Topologies
	// =========================================================================
	describe("1. Graph Construction & Topologies", () => {
		it("builds empty graph safely", () => {
			const engine = new GraphEngine();
			engine.buildGraph([], []);
			assert.deepEqual(engine.getTopologicalOrder(), []);
			assert.equal(engine.hasCycles(), false);
			assert.equal(engine.getCyclePath(), null);
			const bands = engine.computeTopologicalBands();
			assert.deepEqual(bands.bands, []);
			assert.equal(bands.maxLevel, 0);
		});

		it("handles single node without edges", () => {
			const engine = new GraphEngine();
			engine.buildGraph(["isolated"]);
			assert.deepEqual(engine.getTopologicalOrder(), ["isolated"]);
			assert.equal(engine.hasCycles(), false);
			assert.equal(engine.getInDegree("isolated"), 0);
			assert.equal(engine.getOutDegree("isolated"), 0);
			assert.deepEqual(engine.getUpstreamNodes("isolated"), []);
			assert.deepEqual(engine.getDownstreamNodes("isolated"), []);
		});

		it("orders linear chain A -> B -> C -> D", () => {
			const engine = new GraphEngine();
			const edges = [
				{ fromNode: "A", toNode: "B" },
				{ fromNode: "B", toNode: "C" },
				{ fromNode: "C", toNode: "D" },
			];
			engine.buildGraph(["A", "B", "C", "D"], edges);
			const order = engine.getTopologicalOrder();
			assert.ok(order !== null);
			assert.deepEqual(order, ["A", "B", "C", "D"]);
			assertTopologicalOrder(order, edges);
		});

		it("orders branching tree: root with multiple children", () => {
			const engine = new GraphEngine();
			const edges = [
				{ fromNode: "root", toNode: "child_1" },
				{ fromNode: "root", toNode: "child_2" },
				{ fromNode: "child_1", toNode: "leaf_1" },
				{ fromNode: "child_2", toNode: "leaf_2" },
			];
			engine.buildGraph(
				["root", "child_1", "child_2", "leaf_1", "leaf_2"],
				edges,
			);
			const order = engine.getTopologicalOrder();
			assert.ok(order !== null);
			assert.equal(order[0], "root");
			assertTopologicalOrder(order, edges);
		});

		it("orders diamond DAG: A -> B, A -> C, B -> D, C -> D", () => {
			const engine = new GraphEngine();
			const edges = [
				{ fromNode: "A", toNode: "B" },
				{ fromNode: "A", toNode: "C" },
				{ fromNode: "B", toNode: "D" },
				{ fromNode: "C", toNode: "D" },
			];
			engine.buildGraph(["A", "B", "C", "D"], edges);
			const order = engine.getTopologicalOrder();
			assert.ok(order !== null);
			assert.equal(order[0], "A");
			assert.equal(order[3], "D");
			assertTopologicalOrder(order, edges);
		});

		it("orders disconnected components with multiple independent roots", () => {
			const engine = new GraphEngine();
			const edges = [
				{ fromNode: "A1", toNode: "A2" },
				{ fromNode: "B1", toNode: "B2" },
			];
			engine.buildGraph(["A1", "A2", "B1", "B2", "C_isolated"], edges);
			const order = engine.getTopologicalOrder();
			assert.ok(order !== null);
			assert.equal(order.length, 5);
			assertTopologicalOrder(order, edges);
		});

		it("scales to deep sequential chain of 50 nodes without recursion limit", () => {
			const nodeIds: string[] = [];
			const edges: Array<{ fromNode: string; toNode: string }> = [];
			for (let i = 0; i < 50; i++) {
				nodeIds.push(`n_${i}`);
				if (i > 0) {
					edges.push({ fromNode: `n_${i - 1}`, toNode: `n_${i}` });
				}
			}
			const engine = new GraphEngine();
			engine.buildGraph(nodeIds, edges);
			const order = engine.getTopologicalOrder();
			assert.ok(order !== null);
			assert.equal(order.length, 50);
			assert.equal(order[0], "n_0");
			assert.equal(order[49], "n_49");
			assertTopologicalOrder(order, edges);
		});
	});

	// =========================================================================
	// 2. Cycle Detection & Extraction
	// =========================================================================
	describe("2. Cycle Detection & Extraction", () => {
		it("detects immediate self-loop A -> A", () => {
			const engine = new GraphEngine();
			engine.buildGraph(["A"], [{ fromNode: "A", toNode: "A" }]);
			assert.equal(engine.hasCycles(), true);
			assert.equal(engine.getTopologicalOrder(), null);
			const cycle = engine.getCyclePath();
			assert.ok(cycle !== null);
			assert.deepEqual(cycle, ["A", "A"]);
		});

		it("returns canonical 2-element self-loop cycle path ['A', 'A']", () => {
			const engine = new GraphEngine();
			engine.buildGraph(["A"], [{ fromNode: "A", toNode: "A" }]);
			const cycle = engine.getCyclePath();
			assert.deepEqual(cycle, ["A", "A"]);
		});

		it("detects 2-node cycle A -> B -> A", () => {
			const engine = new GraphEngine();
			engine.buildGraph(
				["A", "B"],
				[
					{ fromNode: "A", toNode: "B" },
					{ fromNode: "B", toNode: "A" },
				],
			);
			assert.equal(engine.hasCycles(), true);
			assert.equal(engine.getTopologicalOrder(), null);
			const cycle = engine.getCyclePath();
			assert.ok(cycle !== null);
			assert.equal(cycle[0], cycle[cycle.length - 1]);
		});

		it("detects 3-node cycle embedded in larger DAG", () => {
			const engine = new GraphEngine();
			engine.buildGraph(
				["root", "A", "B", "C", "leaf"],
				[
					{ fromNode: "root", toNode: "A" },
					{ fromNode: "A", toNode: "B" },
					{ fromNode: "B", toNode: "C" },
					{ fromNode: "C", toNode: "A" }, // cycle!
					{ fromNode: "C", toNode: "leaf" },
				],
			);
			assert.equal(engine.hasCycles(), true);
			assert.equal(engine.getTopologicalOrder(), null);
			const cycle = engine.getCyclePath();
			assert.ok(cycle !== null);
			assert.equal(cycle[0], cycle[cycle.length - 1]);
		});

		it("returns null cycle path for acyclic DAG", () => {
			const engine = new GraphEngine();
			engine.buildGraph(
				["A", "B", "C"],
				[
					{ fromNode: "A", toNode: "B" },
					{ fromNode: "B", toNode: "C" },
				],
			);
			assert.equal(engine.hasCycles(), false);
			assert.equal(engine.getCyclePath(), null);
		});
	});

	// =========================================================================
	// 3. Upstream and Downstream Traversal
	// =========================================================================
	describe("3. Upstream and Downstream Traversal", () => {
		it("traverses transitive upstream ancestors", () => {
			const engine = new GraphEngine();
			engine.buildGraph(
				["A", "B", "C", "D"],
				[
					{ fromNode: "A", toNode: "B" },
					{ fromNode: "B", toNode: "C" },
					{ fromNode: "C", toNode: "D" },
				],
			);
			assert.deepEqual(engine.getUpstreamNodes("D").sort(), ["A", "B", "C"]);
			assert.deepEqual(engine.getAncestors("D").sort(), ["A", "B", "C"]);
			assert.deepEqual(engine.getDirectUpstream("D"), ["C"]);
			assert.equal(engine.getInDegree("D"), 1);
		});

		it("traverses transitive downstream descendants", () => {
			const engine = new GraphEngine();
			engine.buildGraph(
				["A", "B", "C", "D"],
				[
					{ fromNode: "A", toNode: "B" },
					{ fromNode: "B", toNode: "C" },
					{ fromNode: "C", toNode: "D" },
				],
			);
			assert.deepEqual(engine.getDownstreamNodes("A").sort(), ["B", "C", "D"]);
			assert.deepEqual(engine.getDescendants("A").sort(), ["B", "C", "D"]);
			assert.deepEqual(engine.getDirectDownstream("A"), ["B"]);
			assert.equal(engine.getOutDegree("A"), 1);
		});

		it("correctly handles branching multiple parents and children", () => {
			const engine = new GraphEngine();
			engine.buildGraph(
				["P1", "P2", "Child", "GC1", "GC2"],
				[
					{ fromNode: "P1", toNode: "Child" },
					{ fromNode: "P2", toNode: "Child" },
					{ fromNode: "Child", toNode: "GC1" },
					{ fromNode: "Child", toNode: "GC2" },
				],
			);
			assert.deepEqual(engine.getDirectUpstream("Child").sort(), ["P1", "P2"]);
			assert.equal(engine.getInDegree("Child"), 2);
			assert.deepEqual(engine.getDirectDownstream("Child").sort(), [
				"GC1",
				"GC2",
			]);
			assert.equal(engine.getOutDegree("Child"), 2);
			assert.deepEqual(engine.getDownstreamNodes("P1").sort(), [
				"Child",
				"GC1",
				"GC2",
			]);
		});

		it("returns empty arrays for non-existent node queries", () => {
			const engine = new GraphEngine();
			engine.buildGraph(["A"], []);
			assert.deepEqual(engine.getUpstreamNodes("ghost"), []);
			assert.deepEqual(engine.getDownstreamNodes("ghost"), []);
			assert.deepEqual(engine.getDirectUpstream("ghost"), []);
			assert.deepEqual(engine.getDirectDownstream("ghost"), []);
			assert.equal(engine.getInDegree("ghost"), 0);
			assert.equal(engine.getOutDegree("ghost"), 0);
		});
	});

	// =========================================================================
	// 4. Port Taxonomy & Connection Validation
	// =========================================================================
	describe("4. Port Taxonomy & Connection Validation", () => {
		it("validates compatible standard media pipeline connections", () => {
			const engine = new GraphEngine();

			// storyboard out (text) -> video prompt (text)
			const res1 = engine.validatePortConnection(
				"storyboard",
				"out",
				"video",
				"prompt",
			);
			assert.equal(res1.valid, true);

			// video out (video) -> finalcut in (video)
			const res2 = engine.validatePortConnection(
				"video",
				"out",
				"finalcut",
				"in",
			);
			assert.equal(res2.valid, true);

			// audio out (audio) -> finalcut audio (audio)
			const res3 = engine.validatePortConnection(
				"audio",
				"out",
				"finalcut",
				"audio",
			);
			assert.equal(res3.valid, true);

			// image out (image) -> video frame (image)
			const res4 = engine.validatePortConnection(
				"image",
				"out",
				"video",
				"frame",
			);
			assert.equal(res4.valid, true);

			// sticky note out (text) -> image prompt (text)
			const res5 = engine.validatePortConnection(
				"sticky",
				"out",
				"image",
				"prompt",
			);
			assert.equal(res5.valid, true);
		});

		it("automatically infers matching ports when undefined", () => {
			// Infer output matching destination kind
			const res = validatePortConnection("image", undefined, "video", "frame");
			assert.equal(res.valid, true);
		});

		it("rejects incompatible port types with clear error message", () => {
			const res = validatePortConnection(
				"video",
				"out",
				"storyboard",
				"script",
			);
			assert.equal(res.valid, false);
			assert.ok(res.reason?.includes("Port type mismatch"));
			assert.ok(res.reason?.includes("video"));
			assert.ok(res.reason?.includes("text"));
		});

		it("rejects unknown source or destination node types", () => {
			const res1 = validatePortConnection("ghost_src", "out", "video", "in");
			assert.equal(res1.valid, false);
			assert.ok(res1.reason?.includes("Unknown source node type"));

			const res2 = validatePortConnection("video", "out", "ghost_dst", "in");
			assert.equal(res2.valid, false);
			assert.ok(res2.reason?.includes("Unknown target node type"));
		});

		it("validates port connections directly on CanvasElement objects with dual ok/valid signature", () => {
			const imgElem = {
				id: "elem_img_1",
				kind: "image" as const,
				x: 0,
				y: 0,
				width: 200,
				height: 150,
			};
			const vidElem = {
				id: "elem_vid_1",
				kind: "video" as const,
				x: 300,
				y: 0,
				width: 200,
				height: 150,
			};

			const validRes = validatePortConnection(imgElem, "out", vidElem, "frame");
			assert.equal(validRes.ok, true);
			assert.equal(validRes.valid, true);

			const invalidRes = validatePortConnection(
				vidElem,
				"out",
				imgElem,
				"prompt",
			);
			assert.equal(invalidRes.ok, false);
			assert.equal(invalidRes.valid, false);
			assert.ok(invalidRes.error?.includes("Port type mismatch"));
			assert.ok(invalidRes.reason?.includes("Port type mismatch"));
		});

		it("rejects nodes without input or output ports", () => {
			const res1 = validatePortConnection("group", "out", "video", "prompt");
			assert.equal(res1.valid, false);
			assert.ok(res1.reason?.includes("has no output ports"));

			const res2 = validatePortConnection("video", "out", "group", "in");
			assert.equal(res2.valid, false);
			assert.ok(res2.reason?.includes("has no input ports"));
		});

		it("rejects non-existent port IDs on valid node types", () => {
			const res1 = validatePortConnection(
				"video",
				"fake_port",
				"finalcut",
				"in",
			);
			assert.equal(res1.valid, false);
			assert.ok(res1.reason?.includes('Invalid output port "fake_port"'));

			const res2 = validatePortConnection(
				"video",
				"out",
				"finalcut",
				"fake_in",
			);
			assert.equal(res2.valid, false);
			assert.ok(res2.reason?.includes('Invalid input port "fake_in"'));
		});

		it("re-exports port tables and taxonomy helpers", () => {
			assert.ok(PORT_TABLE.script);
			assert.ok(PORT_TABLE.video);
			assert.ok(MULTI_INPUT_PORTS.has("ref"));
			assert.ok(MULTI_INPUT_PORTS.has("in"));
			assert.equal(isPortCompatible("image", "image"), true);
			assert.equal(isPortCompatible("image", "text"), false);
		});
	});

	// =========================================================================
	// 5. Auto-Layout & Topological Bands
	// =========================================================================
	describe("5. Auto-Layout & Topological Bands", () => {
		it("computes levels in linear pipeline: script(0) -> storyboard(1) -> video(2) -> finalcut(3)", () => {
			const engine = new GraphEngine();
			engine.buildGraph(
				["script_1", "storyboard_1", "video_1", "finalcut_1"],
				[
					{ fromNode: "script_1", toNode: "storyboard_1" },
					{ fromNode: "storyboard_1", toNode: "video_1" },
					{ fromNode: "video_1", toNode: "finalcut_1" },
				],
			);
			const { bands, nodeLevels, maxLevel } = engine.computeTopologicalBands();
			assert.equal(maxLevel, 3);
			assert.equal(nodeLevels.get("script_1"), 0);
			assert.equal(nodeLevels.get("storyboard_1"), 1);
			assert.equal(nodeLevels.get("video_1"), 2);
			assert.equal(nodeLevels.get("finalcut_1"), 3);
			assert.deepEqual(bands[0], ["script_1"]);
			assert.deepEqual(bands[1], ["storyboard_1"]);
			assert.deepEqual(bands[2], ["video_1"]);
			assert.deepEqual(bands[3], ["finalcut_1"]);
		});

		it("places parallel diamond branches at same level: B and C at level 1", () => {
			const engine = new GraphEngine();
			engine.buildGraph(
				["A", "B", "C", "D"],
				[
					{ fromNode: "A", toNode: "B" },
					{ fromNode: "A", toNode: "C" },
					{ fromNode: "B", toNode: "D" },
					{ fromNode: "C", toNode: "D" },
				],
			);
			const { bands, nodeLevels, maxLevel } = engine.computeTopologicalBands();
			assert.equal(maxLevel, 2);
			assert.equal(nodeLevels.get("A"), 0);
			assert.equal(nodeLevels.get("B"), 1);
			assert.equal(nodeLevels.get("C"), 1);
			assert.equal(nodeLevels.get("D"), 2);
			assert.deepEqual(bands[0], ["A"]);
			assert.deepEqual(bands[1], ["B", "C"]);
			assert.deepEqual(bands[2], ["D"]);
		});

		it("generates non-overlapping coordinates in Left-to-Right auto-layout", () => {
			const engine = new GraphEngine();
			engine.buildGraph(
				["A", "B", "C", "D"],
				[
					{ fromNode: "A", toNode: "B" },
					{ fromNode: "A", toNode: "C" },
					{ fromNode: "B", toNode: "D" },
					{ fromNode: "C", toNode: "D" },
				],
			);
			const coords = engine.computeAutoLayoutCoordinates({
				startX: 100,
				startY: 50,
				gapX: 100,
				gapY: 80,
				nodeWidth: 200,
				nodeHeight: 120,
				direction: "LR",
			});

			const aCoord = coords.get("A")!;
			const bCoord = coords.get("B")!;
			const cCoord = coords.get("C")!;
			const dCoord = coords.get("D")!;

			assert.equal(aCoord.x, 100);
			assert.equal(aCoord.y, 50);

			// Level 1: x = 100 + 1 * (200 + 100) = 400
			assert.equal(bCoord.x, 400);
			assert.equal(cCoord.x, 400);
			assert.notEqual(bCoord.y, cCoord.y); // Parallel nodes have distinct Y

			// Level 2: x = 100 + 2 * 300 = 700
			assert.equal(dCoord.x, 700);
		});

		it("generates non-overlapping coordinates in Top-to-Bottom auto-layout", () => {
			const engine = new GraphEngine();
			engine.buildGraph(["A", "B"], [{ fromNode: "A", toNode: "B" }]);
			const coords = engine.computeAutoLayoutCoordinates({
				startX: 0,
				startY: 0,
				direction: "TB",
				nodeHeight: 100,
				gapY: 50,
			});
			assert.equal(coords.get("A")!.y, 0);
			assert.equal(coords.get("B")!.y, 150);
		});

		it("computes topological bands on cyclic graph with root connected to cycle (root -> A -> B -> A) without hanging (<10ms)", () => {
			const engine = new GraphEngine();
			engine.buildGraph(
				["root", "A", "B"],
				[
					{ fromNode: "root", toNode: "A" },
					{ fromNode: "A", toNode: "B" },
					{ fromNode: "B", toNode: "A" },
				],
			);
			const start = performance.now();
			const result = engine.computeTopologicalBands();
			const elapsed = performance.now() - start;

			assert.ok(elapsed < 10, `Expected elapsed < 10ms, got ${elapsed}ms`);
			assert.ok(result.bands.length > 0);
			assert.equal(result.nodeLevels.get("root"), 0);
			assert.ok(result.nodeLevels.has("A"));
			assert.ok(result.nodeLevels.has("B"));

			// Also verify auto-layout coordinates terminate safely
			const coords = engine.computeAutoLayoutCoordinates();
			assert.equal(coords.size, 3);
		});
	});
});
