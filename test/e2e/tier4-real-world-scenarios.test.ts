/**
 * Tier 4: Real-World Application Scenarios (dsh-cult-canvas)
 * 6 comprehensive end-to-end multi-step workflow scenarios:
 * 1. Full Multimedia Production Pipeline (Idea -> Script -> Storyboard -> Assets -> Video -> FinalCut)
 * 2. Collaborative Whiteboard Annotation & Storyboard Linking
 * 3. JSON Canvas 1.0 Round-Trip Migration with Media Nodes
 * 4. AI Agent Autonomous Directed Canvas Creation & Execution
 * 5. Video Continuation & Seam Stitching Assembly
 * 6. Canvas Disaster Recovery, Undo, & Invalid Operation Protection
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
	createMockHostContext,
	createMockToolExec,
	CanvasStore,
	GraphEngine,
	PipelineEngine,
	buildCanvasTools,
	applyCanvasPlugin,
} from "./helpers/mock-harness.js";

import {
	VALID_JSON_CANVAS_1_0,
	SAMPLE_STORYBOARD_SHOTS,
	SAMPLE_SERIES_BIBLE,
	SAMPLE_SCREENPLAY_SCRIPT,
} from "./helpers/canvas-fixtures.js";

import {
	assertPointInStroke,
	assertTopologicalOrder,
	assertValidJsonCanvas,
} from "./helpers/assertion-helpers.js";

describe("Tier 4: Real-World Application Scenarios", () => {
	// ==========================================================================
	// Scenario 1: Full Multimedia Production Pipeline
	// ==========================================================================
	it("Scenario 1: Full Multimedia Production Pipeline (Idea -> Script -> Storyboard -> Assets -> Video -> FinalCut)", async () => {
		const ctx = createMockHostContext();
		const store = applyCanvasPlugin(ctx);
		store.updateBible(SAMPLE_SERIES_BIBLE);

		// Step 1: Idea in a sticky note
		const ideaSticky = store.createElement({
			id: "scene_idea",
			kind: "sticky",
			type: "text",
			x: 50,
			y: 100,
			width: 220,
			height: 220,
			text: "Cyberpunk Chang'an detective meets poet in rain tavern to crack imperial scroll.",
		});

		// Step 2: Scriptwriting node generating full screenplay draft
		const scriptNode = store.createElement({
			id: "screenplay_act1",
			kind: "script",
			type: "script",
			x: 350,
			y: 100,
			width: 300,
			height: 400,
			data: { output: SAMPLE_SCREENPLAY_SCRIPT, model: "deepseek-chat" },
		});
		store.connect({
			fromNode: ideaSticky.id,
			toNode: scriptNode.id,
			toPort: "prompt",
		});

		// Step 3: Storyboard breakdown node
		const storyboardNode = store.createElement({
			id: "storyboard_breakdown",
			kind: "storyboard",
			type: "storyboard",
			x: 750,
			y: 100,
			width: 400,
			height: 500,
			data: { shots: SAMPLE_STORYBOARD_SHOTS, targetDuration: 10.5 },
		});
		store.connect({
			fromNode: scriptNode.id,
			toNode: storyboardNode.id,
			fromPort: "out",
			toPort: "script",
		});

		// Step 4: Asset reference nodes for character turnaround & scene aesthetic
		const charAssetNode = store.createElement({
			id: "asset_chen_shi",
			kind: "image",
			type: "file",
			file: "assets/turnaround/chen_shi.png",
			x: 750,
			y: 650,
			width: 180,
			height: 180,
			data: { assetId: "asset_char_chen_shi_turnaround" },
		});

		// Step 5: Video shot generation nodes
		const videoShot1 = store.createElement({
			id: "vid_shot_1",
			kind: "video",
			type: "video",
			x: 1250,
			y: 50,
			width: 320,
			height: 200,
			mediaParams: {
				duration: 3.5,
				prompt: "Shot 1 rain alley with @Chen Shi",
				resolution: "1080P",
			},
		});
		const videoShot2 = store.createElement({
			id: "vid_shot_2",
			kind: "video",
			type: "video",
			x: 1250,
			y: 300,
			width: 320,
			height: 200,
			mediaParams: {
				duration: 4.0,
				prompt: "Shot 2 tavern interior @Li Bai",
				resolution: "1080P",
			},
		});

		store.connect({
			fromNode: storyboardNode.id,
			toNode: videoShot1.id,
			fromPort: "out",
			toPort: "prompt",
		});
		store.connect({
			fromNode: charAssetNode.id,
			toNode: videoShot1.id,
			fromPort: "out",
			toPort: "ref",
		});
		store.connect({
			fromNode: storyboardNode.id,
			toNode: videoShot2.id,
			fromPort: "out",
			toPort: "prompt",
		});

		// Step 6: FinalCut assembly node
		const finalCutNode = store.createElement({
			id: "finalcut_master",
			kind: "finalcut",
			type: "finalcut",
			x: 1650,
			y: 200,
			width: 350,
			height: 250,
			mediaParams: { transition: "crossfade", totalDuration: 7.5 },
		});
		store.connect({
			fromNode: videoShot1.id,
			toNode: finalCutNode.id,
			fromPort: "out",
			toPort: "in",
		});
		store.connect({
			fromNode: videoShot2.id,
			toNode: finalCutNode.id,
			fromPort: "out",
			toPort: "in",
		});

		// Verify DAG topological structure
		const graph = new GraphEngine();
		graph.buildGraph(
			store.getAllElements().map((e) => e.id),
			store.getAllEdges(),
		);
		const topo = graph.getTopologicalOrder();
		assert.ok(topo !== null);
		assertTopologicalOrder(topo, store.getAllEdges());

		// Execute full pipeline
		const pipeline = new PipelineEngine();
		const runResult = await pipeline.runWorkflow(store);
		assert.equal(runResult.ok, true);
		assert.equal(runResult.failedNodes.length, 0);

		// Assert all video nodes and finalcut node completed with asset IDs
		const v1 = store.getElementById("vid_shot_1");
		const v2 = store.getElementById("vid_shot_2");
		const fc = store.getElementById("finalcut_master");
		assert.equal(v1?.status, "completed");
		assert.equal(v2?.status, "completed");
		assert.equal(fc?.status, "completed");
		assert.ok(v1?.data?.assetId);
		assert.ok(v2?.data?.assetId);
		assert.ok(fc?.data?.assetId);

		// Assert that non-generative elements were NOT destructively overwritten
		const preservedScript = store.getElementById("screenplay_act1");
		assert.equal(
			preservedScript?.data?.output,
			SAMPLE_SCREENPLAY_SCRIPT,
			"Authored screenplay script must NOT be overwritten by workflow runner",
		);
		const preservedSticky = store.getElementById("scene_idea");
		assert.equal(
			preservedSticky?.data?.output,
			undefined,
			"Sticky note must not have dummy generation output",
		);
		const preservedAsset = store.getElementById("asset_chen_shi");
		assert.equal(
			preservedAsset?.data?.assetId,
			"asset_char_chen_shi_turnaround",
			"Turnaround asset reference must NOT have its assetId clobbered",
		);
	});

	// ==========================================================================
	// Scenario 2: Collaborative Whiteboard Annotation & Storyboard Linking
	// ==========================================================================
	it("Scenario 2: Collaborative Whiteboard Annotation & Storyboard Linking", async () => {
		const ctx = createMockHostContext();
		const store = applyCanvasPlugin(ctx);

		// Storyboard shot card
		const shotCard = store.createElement({
			id: "shot_card_01",
			kind: "storyboard",
			type: "storyboard",
			x: 300,
			y: 200,
			width: 300,
			height: 250,
			mediaParams: { prompt: "Rain alley establishing shot" },
		});

		// Director adds freehand red marker circle annotation around the card
		const markerAnnotation = store.createElement({
			id: "director_marker_circle",
			kind: "stroke",
			type: "text",
			text: "",
			color: "#FF5A3D",
			x: 280,
			y: 180,
			width: 340,
			height: 290,
			gbStroke: {
				v: 1,
				size: 6,
				w: 340,
				h: 290,
				points: [
					[10, 10],
					[330, 10],
					[330, 280],
					[10, 280],
					[10, 10],
				],
			},
		});

		// Director sticks feedback note beside the shot card
		const feedbackNote = store.createElement({
			id: "director_note",
			kind: "sticky",
			type: "text",
			color: "3", // yellow sticky
			x: 650,
			y: 200,
			width: 220,
			height: 220,
			text: "Note for Shot 1: Double the neon reflection puddle caustics and add visible steam.",
		});

		// Connect director note to shot prompt
		store.connect({
			fromNode: feedbackNote.id,
			toNode: shotCard.id,
			fromSide: "left",
			toSide: "right",
			fromEnd: "none",
			toEnd: "arrow",
			toPort: "prompt",
			label: "director revision",
		});

		// Resolve prompt incorporating director's feedback
		const pipeline = new PipelineEngine();
		const resolved = pipeline.resolvePrompt(shotCard, store);
		assert.ok(resolved.includes("Double the neon reflection puddle caustics"));
		assert.ok(resolved.includes("Rain alley establishing shot"));

		// Director sweeps eraser across outdated marker annotation
		const eraserPoint = { x: 290, y: 190 }; // intersects top-left of circle
		assertPointInStroke(eraserPoint, markerAnnotation);

		// Erasing removes marker stroke without touching shot card or director note
		store.deleteElements([markerAnnotation.id]);
		assert.equal(store.getElementById(markerAnnotation.id), undefined);
		assert.ok(store.getElementById(shotCard.id));
		assert.ok(store.getElementById(feedbackNote.id));
		assert.equal(store.getAllEdges().length, 1);
	});

	// ==========================================================================
	// Scenario 3: JSON Canvas 1.0 Round-Trip Migration with Media Nodes
	// ==========================================================================
	it("Scenario 3: JSON Canvas 1.0 Round-Trip Migration with Media Nodes", () => {
		const store = new CanvasStore();

		// Import standard Obsidian JSON Canvas 1.0
		store.importJsonCanvas(VALID_JSON_CANVAS_1_0);
		assert.equal(store.getAllElements().length, 4);

		// Convert one text node to an AI generative video node and add a finalcut node
		const videoNode = store.createElement({
			id: "ai_video_node",
			kind: "video",
			type: "video",
			x: 500,
			y: 400,
			width: 320,
			height: 240,
			mediaParams: { duration: 5.0, resolution: "1080P", model: "seedance-v2" },
		});
		store.connect({
			fromNode: "node_text_1",
			toNode: videoNode.id,
			fromPort: "out",
			toPort: "prompt",
			label: "generates visual",
		});

		// Export to JSON Canvas 1.0 format
		const exportedDoc = store.exportJsonCanvas();

		// Verify strict standard JSON Canvas 1.0 compliance
		assertValidJsonCanvas(exportedDoc);
		assert.equal(exportedDoc.nodes.length, 5);
		assert.equal(exportedDoc.edges.length, 2);

		// Re-import into a pristine canvas instance
		const migratedStore = new CanvasStore();
		migratedStore.importJsonCanvas(exportedDoc);

		// Assert all nodes, edges, and mediaParams migrated with 100% fidelity
		assert.equal(migratedStore.getAllElements().length, 5);
		assert.equal(migratedStore.getAllEdges().length, 2);

		const restoredVideo = migratedStore.getElementById("ai_video_node");
		assert.ok(restoredVideo);
		assert.equal(restoredVideo.kind, "video");
		assert.equal(restoredVideo.mediaParams?.duration as number, 5.0);
	});

	// ==========================================================================
	// Scenario 4: AI Agent Autonomous Directed Canvas Creation & Execution
	// ==========================================================================
	it("Scenario 4: AI Agent Autonomous Directed Canvas Creation & Execution", async () => {
		const ctx = createMockHostContext();
		const store = new CanvasStore();
		const tools = buildCanvasTools(ctx, store);
		for (const t of tools) ctx.tools.register(t);

		const exec = createMockToolExec({ sessionId: "agent_session_autonomous" });

		// 1. Agent updates project bible
		await ctx.tools.execute(
			"canvas_update_bible",
			{ patch: SAMPLE_SERIES_BIBLE },
			exec,
		);

		// 2. Agent creates script node
		const sRes = (await ctx.tools.execute(
			"canvas_create_element",
			{
				kind: "script",
				x: 0,
				y: 100,
				width: 300,
				height: 400,
				text: "Script: Chang'an rain duel",
			},
			exec,
		)) as { elementId: string };

		// 3. Agent creates storyboard node
		const sbRes = (await ctx.tools.execute(
			"canvas_create_element",
			{
				kind: "storyboard",
				x: 350,
				y: 100,
				width: 350,
				height: 400,
				text: "Storyboard Breakdown",
			},
			exec,
		)) as { elementId: string };

		// 4. Agent creates video node
		const vRes = (await ctx.tools.execute(
			"canvas_create_element",
			{
				kind: "video",
				x: 750,
				y: 100,
				width: 320,
				height: 240,
				mediaParams: {
					duration: 4.0,
					prompt: "Rain duel between @Chen Shi and assassin",
				},
			},
			exec,
		)) as { elementId: string };

		// 5. Agent wires directed edges
		await ctx.tools.execute(
			"canvas_connect",
			{
				fromNode: sRes.elementId,
				toNode: sbRes.elementId,
				fromPort: "out",
				toPort: "script",
			},
			exec,
		);

		await ctx.tools.execute(
			"canvas_connect",
			{
				fromNode: sbRes.elementId,
				toNode: vRes.elementId,
				fromPort: "out",
				toPort: "prompt",
			},
			exec,
		);

		// 6. Agent performs layout alignment
		await ctx.tools.execute(
			"canvas_layout_elements",
			{
				layouts: [
					{ id: sRes.elementId, x: 0, y: 0, pinned: true },
					{ id: sbRes.elementId, x: 400, y: 0, pinned: true },
					{ id: vRes.elementId, x: 800, y: 0, pinned: true },
				],
			},
			exec,
		);

		// 7. Agent runs full workflow pipeline
		const runRes = (await ctx.tools.execute(
			"canvas_run_pipeline",
			{ mode: "all" },
			exec,
		)) as { ok: boolean; status: string };
		assert.equal(runRes.ok, true);
		assert.equal(runRes.status, "completed");

		// 8. Agent inspects node status
		const statusRes = (await ctx.tools.execute(
			"canvas_node_status",
			{ nodeId: vRes.elementId },
			exec,
		)) as { ok: boolean; status: string; data: { assetId?: string } };
		assert.equal(statusRes.ok, true);
		assert.equal(statusRes.status, "completed");
		assert.ok(statusRes.data.assetId);
	});

	// ==========================================================================
	// Scenario 5: Video Continuation & Seam Stitching Assembly
	// ==========================================================================
	it("Scenario 5: Video Continuation & Seam Stitching Assembly", async () => {
		const store = new CanvasStore();

		// Video Shot 1 (Opening Shot)
		const shot1 = store.createElement({
			id: "shot1_opening",
			kind: "video",
			type: "video",
			x: 100,
			y: 100,
			width: 320,
			height: 200,
			mediaParams: {
				prompt: "Continuous tracking shot past lantern towards door",
				duration: 3.5,
			},
		});

		// Video Shot 2 (Continuation through door)
		const shot2 = store.createElement({
			id: "shot2_interior",
			kind: "video",
			type: "video",
			x: 500,
			y: 100,
			width: 320,
			height: 200,
			mediaParams: {
				prompt: "Door opens, continuous pan into tavern",
				duration: 4.0,
			},
		});

		// Wire Shot 1 tailpick output to Shot 2 frame input
		store.connect({
			fromNode: shot1.id,
			toNode: shot2.id,
			fromPort: "tailpick",
			toPort: "frame",
			label: "continuity tail frame",
		});

		// Execute Shot 1 to generate tailpick asset
		const pipeline = new PipelineEngine();
		const res1 = await pipeline.executeNode(shot1.id, store, {
			mockGenerator: async (_node) => {
				return {
					assetId: "asset_clip_shot1",
					tailPickAssetId: "asset_tail_frame_shot1_opt",
				};
			},
		});
		assert.equal(res1.ok, true);

		// Execute Shot 2 verifying it receives Shot 1 tail frame via the pipeline DAG edge
		const edge = store
			.getAllEdges()
			.find((e) => e.toNode === shot2.id && e.toPort === "frame");
		assert.ok(edge);
		const upstream = store.getElementById(edge.fromNode);
		assert.equal(upstream?.data?.assetId, "asset_clip_shot1");

		const res2 = await pipeline.executeNode(shot2.id, store, {
			mockGenerator: async (_node, inputs) => {
				assert.equal(
					inputs?.frame,
					"asset_tail_frame_shot1_opt",
					"Shot 2 must automatically receive Shot 1 tail frame through pipeline edge",
				);
				return {
					assetId: "asset_clip_shot2",
					frameInAssetId: inputs?.frame,
				};
			},
		});
		assert.equal(res2.ok, true);
		assert.equal(
			store.getElementById(shot2.id)?.data?.frameInAssetId,
			"asset_tail_frame_shot1_opt",
		);

		// FinalCut assembler chains both clips seamlessly
		const finalCut = store.createElement({
			id: "finalcut_seam",
			kind: "finalcut",
			type: "finalcut",
			x: 900,
			y: 100,
			width: 300,
			height: 200,
		});
		store.connect({
			fromNode: shot1.id,
			toNode: finalCut.id,
			fromPort: "out",
			toPort: "in",
		});
		store.connect({
			fromNode: shot2.id,
			toNode: finalCut.id,
			fromPort: "out",
			toPort: "in",
		});

		const resFc = await pipeline.executeNode(finalCut.id, store);
		assert.equal(resFc.ok, true);
		assert.equal(store.getElementById(finalCut.id)?.status, "completed");
	});

	// ==========================================================================
	// Scenario 6: Canvas Disaster Recovery, Undo, & Invalid Operation Protection
	// ==========================================================================
	it("Scenario 6: Canvas Disaster Recovery, Undo, & Invalid Operation Protection", async () => {
		const ctx = createMockHostContext();
		const store = new CanvasStore();
		const tools = buildCanvasTools(ctx, store);
		for (const t of tools) ctx.tools.register(t);

		// Populate canvas with 10 elements and 5 edges
		const ids: string[] = [];
		for (let i = 0; i < 10; i++) {
			const el = store.createElement({
				id: `node_elem_${i}`,
				type: "text",
				text: `Element ${i}`,
				x: i * 80,
				y: i * 50,
				width: 100,
				height: 100,
			});
			ids.push(el.id);
			if (i > 0 && i % 2 === 1) {
				store.connect({ fromNode: ids[i - 1]!, toNode: ids[i]! });
			}
		}

		assert.equal(store.getAllElements().length, 10);
		assert.equal(store.getAllEdges().length, 5);

		// Disaster: accidental batch deletion of all 10 elements
		await ctx.tools.execute("canvas_delete_element", { ids });
		assert.equal(store.getAllElements().length, 0);
		assert.equal(store.getAllEdges().length, 0);

		// Disaster Recovery: Undo restores exact pre-deletion state
		const recovered = store.undo();
		assert.equal(recovered, true);
		assert.equal(store.getAllElements().length, 10);
		assert.equal(store.getAllEdges().length, 5);

		// Verify elements and edges match original
		for (const id of ids) {
			assert.ok(store.getElementById(id), `Element ${id} should be recovered`);
		}

		// Invalid Operation Protection: Cycle loop insertion
		await assert.rejects(async () => {
			// Connect back from last node to first node creating a cycle
			await ctx.tools.execute("canvas_connect", {
				fromNode: ids[1]!,
				toNode: ids[0]!,
			});
		}, /cycle in the DAG/);

		// Canvas edges remains uncorrupted
		assert.equal(store.getAllEdges().length, 5);

		// Redo stack integrity
		store.redo(); // re-executes disaster delete
		assert.equal(store.getAllElements().length, 0);
		store.undo(); // recovers again
		assert.equal(store.getAllElements().length, 10);
	});
});
