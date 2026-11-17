/**
 * Tier 3: Cross-Feature Interaction Test Suite (dsh-cult-canvas)
 * Pairwise combinatorial integration tests across major feature boundaries:
 * ≥15 tests covering critical feature intersections.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createMockHostContext, createMockToolExec, CanvasStore, GraphEngine, PipelineEngine, buildCanvasTools, applyCanvasPlugin, } from "./helpers/mock-harness.js";
import { SAMPLE_STORYBOARD_SHOTS } from "./helpers/canvas-fixtures.js";
import { assertNoUndefined, assertTopologicalOrder, assertValidJsonCanvas, boxesOverlap, } from "./helpers/assertion-helpers.js";
import { getShapePaddingCompensation, eraserSweep, } from "../../canvas-model.js";
describe("Tier 3: Cross-Feature Interaction Test Suite", () => {
    it("3.1 [F3 x F8] Sticky note text wired into script node propagates to storyboard prompt resolution", () => {
        const store = new CanvasStore();
        const sticky = store.createElement({
            id: "sticky_idea",
            kind: "sticky",
            type: "text",
            text: "Theme: Cyberpunk Tang Dynasty mystery with heavy rain aesthetic.",
        });
        const script = store.createElement({
            id: "script_node",
            kind: "script",
            type: "script",
            data: { output: "Scene 1: Detective Chen Shi enters the neon tavern." },
        });
        const storyboard = store.createElement({
            id: "storyboard_node",
            kind: "storyboard",
            type: "storyboard",
            mediaParams: { prompt: "Wide establishing shot of tavern interior" },
        });
        // Wire sticky -> script -> storyboard
        store.connect({ fromNode: sticky.id, toNode: script.id });
        store.connect({
            fromNode: script.id,
            toNode: storyboard.id,
            toPort: "prompt",
        });
        const pipeline = new PipelineEngine();
        const resolvedPrompt = pipeline.resolvePrompt(storyboard, store);
        assert.ok(resolvedPrompt.includes("Theme: Cyberpunk Tang Dynasty mystery with heavy rain aesthetic."), "Sticky note theme text must propagate upstream through script into storyboard prompt");
        assert.ok(resolvedPrompt.includes("Detective Chen Shi enters the neon tavern."));
        assert.ok(resolvedPrompt.includes("Wide establishing shot of tavern interior"));
    });
    it("3.2 [F5 x F7] Freehand marker strokes overlapping media nodes do NOT disrupt DAG topological sorting", () => {
        const store = new CanvasStore();
        const videoA = store.createElement({
            id: "vid_A",
            kind: "video",
            type: "video",
            x: 100,
            y: 100,
            width: 200,
            height: 150,
        });
        const videoB = store.createElement({
            id: "vid_B",
            kind: "video",
            type: "video",
            x: 400,
            y: 100,
            width: 200,
            height: 150,
        });
        store.connect({
            fromNode: videoA.id,
            toNode: videoB.id,
            fromPort: "out",
            toPort: "frame",
        });
        // Stroke physically drawn across both nodes in coordinate space
        const stroke = store.createElement({
            id: "red_marker_line",
            kind: "stroke",
            type: "text",
            text: "",
            x: 50,
            y: 80,
            width: 600,
            height: 50,
            gbStroke: {
                v: 1,
                size: 5,
                w: 600,
                h: 50,
                points: [
                    [0, 25],
                    [600, 25],
                ],
            },
        });
        // Verify spatial overlap
        assert.ok(boxesOverlap(stroke, videoA));
        assert.ok(boxesOverlap(stroke, videoB));
        // DAG topological sort should ignore strokes and only schedule media edges
        const graph = new GraphEngine();
        const mediaNodes = store
            .getAllElements()
            .filter((e) => e.kind !== "stroke")
            .map((e) => e.id);
        graph.buildGraph(mediaNodes, store.getAllEdges());
        const order = graph.getTopologicalOrder();
        assert.ok(order !== null);
        assert.deepEqual(order, ["vid_A", "vid_B"]);
    });
    it("3.3 [F4 x F7] JSON Canvas export and re-import preserves pipeline ports and DAG topological order", () => {
        const storeA = new CanvasStore();
        storeA.createElement({
            id: "script_1",
            kind: "script",
            type: "script",
            x: 0,
            y: 0,
            width: 100,
            height: 100,
        });
        storeA.createElement({
            id: "image_1",
            kind: "image",
            type: "image",
            x: 200,
            y: 0,
            width: 100,
            height: 100,
        });
        storeA.connect({
            fromNode: "script_1",
            toNode: "image_1",
            fromPort: "out",
            toPort: "prompt",
        });
        const exported = storeA.exportJsonCanvas();
        assertValidJsonCanvas(exported);
        const storeB = new CanvasStore();
        storeB.importJsonCanvas(exported);
        const graph = new GraphEngine();
        graph.buildGraph(storeB.getAllElements().map((e) => e.id), storeB.getAllEdges());
        const order = graph.getTopologicalOrder();
        assert.ok(order !== null);
        assertTopologicalOrder(order, storeB.getAllEdges());
        assert.equal(storeB.getAllEdges()[0]?.toPort, "prompt");
    });
    it("3.4 [F8 x F9] Storyboard shot updates cascade to multi-segment video execution", async () => {
        const store = new CanvasStore();
        const storyboard = store.createElement({
            id: "sb_shots",
            kind: "storyboard",
            type: "storyboard",
            data: { shots: SAMPLE_STORYBOARD_SHOTS },
        });
        const videoNode = store.createElement({
            id: "vid_target",
            kind: "video",
            type: "video",
        });
        store.connect({ fromNode: storyboard.id, toNode: videoNode.id });
        const pipeline = new PipelineEngine();
        const segments = pipeline.planShotSegments(SAMPLE_STORYBOARD_SHOTS);
        assert.ok(segments.length > 0);
        const execRes = await pipeline.executeNode(videoNode.id, store);
        assert.equal(execRes.ok, true);
        assert.equal(execRes.status, "completed");
    });
    it("3.5 [F10 x F11] Authenticated web route exposes state matching canvas_get_state while blocking unauthorized callers", async () => {
        const ctx = createMockHostContext({
            connection: {
                allowsRemoteAuthorities: true,
                requestRejection: (req) => {
                    if (req.headers.authorization !== "Bearer secret-token")
                        return 401;
                },
            },
        });
        const store = applyCanvasPlugin(ctx);
        store.createElement({
            id: "sync_node",
            type: "text",
            text: "Secret Sync",
            x: 10,
            y: 10,
            width: 100,
            height: 100,
        });
        // 1. Tool execution (internal DSH host agent) works directly
        const toolRes = (await ctx.tools.execute("canvas_get_state", {}));
        assert.equal(toolRes.count, 1);
        // 2. Unauthenticated external web request is rejected 401
        const route = ctx.webServer.routes.find((r) => r.path === "/plugin-api/cult-canvas");
        const unauthorizedReq = new Request("http://192.168.1.50:3344/plugin-api/cult-canvas/state", {
            headers: { host: "192.168.1.50:3344" },
        });
        const unauthRes = await route.resource(unauthorizedReq);
        assert.equal(unauthRes.status, 401);
        // 3. Authenticated external web request receives matching JSON state
        const authorizedReq = new Request("http://192.168.1.50:3344/plugin-api/cult-canvas/state", {
            headers: {
                host: "192.168.1.50:3344",
                authorization: "Bearer secret-token",
            },
        });
        const authRes = await route.resource(authorizedReq);
        assert.equal(authRes.status, 200);
        const body = (await authRes.json());
        assert.equal(body.nodes.length, 1);
        assert.equal(body.nodes[0].id, "sync_node");
    });
    it("3.6 [F11 x F12] Element created via canvas_create_element is immediately queryable via spatial bounding box", async () => {
        const ctx = createMockHostContext();
        const store = new CanvasStore();
        const tools = buildCanvasTools(ctx, store);
        for (const t of tools)
            ctx.tools.register(t);
        // Create element in region [300, 300, 200, 200]
        const createRes = (await ctx.tools.execute("canvas_create_element", {
            kind: "shape",
            shape: "diamond",
            x: 350,
            y: 350,
            width: 100,
            height: 100,
            text: "Decision Node",
        }));
        // Query region covering [300, 300] to [500, 500]
        const queryRes = (await ctx.tools.execute("canvas_get_state", {
            boundingBox: { minX: 300, minY: 300, maxX: 500, maxY: 500 },
        }));
        assert.equal(queryRes.count, 1);
        assert.equal(queryRes.elements[0].id, createRes.elementId);
        assert.equal(queryRes.elements[0].shape, "diamond");
    });
    it("3.7 [F12 x F7] Deleting upstream node cascades edge cleanup and unblocks downstream topological order", async () => {
        const ctx = createMockHostContext();
        const store = new CanvasStore();
        const a = store.createElement({
            id: "blocker_A",
            type: "script",
            kind: "script",
        });
        const b = store.createElement({
            id: "worker_B",
            type: "video",
            kind: "video",
        });
        store.connect({ fromNode: a.id, toNode: b.id });
        const tools = buildCanvasTools(ctx, store);
        for (const t of tools)
            ctx.tools.register(t);
        assert.equal(store.getAllEdges().length, 1);
        // Delete blocker_A
        await ctx.tools.execute("canvas_delete_element", { ids: [a.id] });
        assert.equal(store.getAllEdges().length, 0);
        assert.equal(store.getAllElements().length, 1);
        // Now worker_B has 0 in-degree and sorts immediately
        const graph = new GraphEngine();
        graph.buildGraph([b.id], store.getAllEdges());
        assert.deepEqual(graph.getTopologicalOrder(), [b.id]);
    });
    it("3.8 [F6 x F12] Mutating shape to diamond dynamically applies 22% inset padding", async () => {
        const ctx = createMockHostContext();
        const store = new CanvasStore();
        const card = store.createElement({
            id: "shape_card",
            kind: "shape",
            shape: "rect",
            x: 0,
            y: 0,
            width: 220,
            height: 120,
            text: "Before",
        });
        const tools = buildCanvasTools(ctx, store);
        for (const t of tools)
            ctx.tools.register(t);
        await ctx.tools.execute("canvas_update_element", {
            id: card.id,
            patch: { shape: "diamond" },
        });
        const updated = store.getElementById(card.id);
        assert.equal(updated?.shape, "diamond");
        // Verify geometric padding calculation via canvas-model
        const comp = getShapePaddingCompensation(updated.shape);
        assert.equal(comp.paddingInlinePercent, 22);
        const paddingPx = (updated.width * comp.paddingInlinePercent) / 100;
        assert.equal(Math.round(paddingPx * 10) / 10, 48.4);
    });
    it("3.9 [F9 x F13] AbortSignal cooperative cancellation halts canvas_run_pipeline cleanly", async () => {
        const ctx = createMockHostContext();
        const store = new CanvasStore();
        store.createElement({ id: "long_task", type: "video", kind: "video" });
        const tools = buildCanvasTools(ctx, store);
        for (const t of tools)
            ctx.tools.register(t);
        const exec = createMockToolExec();
        exec.abortController.abort(); // pre-emptively abort
        await assert.rejects(async () => {
            await ctx.tools.execute("canvas_run_pipeline", { nodeId: "long_task" }, exec);
        }, /aborted|Aborted/);
    });
    it("3.10 [F4 x F13] canvas_import_export round-trip preserves whiteboard strokes alongside generation nodes", async () => {
        const ctx = createMockHostContext();
        const store = new CanvasStore();
        store.createElement({
            id: "stroke_annot",
            kind: "stroke",
            type: "text",
            text: "",
            x: 10,
            y: 10,
            width: 100,
            height: 50,
            gbStroke: {
                v: 1,
                size: 5,
                w: 100,
                h: 50,
                points: [
                    [0, 0],
                    [100, 50],
                ],
            },
        });
        store.createElement({
            id: "pipeline_video",
            kind: "video",
            type: "video",
            x: 200,
            y: 10,
            width: 320,
            height: 240,
            mediaParams: { duration: 5.0, resolution: "1080P" },
        });
        const tools = buildCanvasTools(ctx, store);
        for (const t of tools)
            ctx.tools.register(t);
        const exp = (await ctx.tools.execute("canvas_import_export", {
            action: "export",
        }));
        assertValidJsonCanvas(exp.document);
        // Import into fresh store
        const freshStore = new CanvasStore();
        const freshTools = buildCanvasTools(ctx, freshStore);
        for (const t of freshTools)
            ctx.tools.register(t);
        await freshTools
            .find((t) => t.name === "canvas_import_export")
            .execute({
            action: "import",
            document: exp.document,
        });
        assert.equal(freshStore.getAllElements().length, 2);
        const restoredStroke = freshStore.getElementById("stroke_annot");
        const restoredVideo = freshStore.getElementById("pipeline_video");
        assert.equal(restoredStroke?.gbStroke?.v, 1);
        assert.equal(restoredVideo?.mediaParams?.duration, 5.0);
    });
    it("3.11 [F7 x F12] canvas_connect rejects cycle creation and preserves DAG acyclicity", async () => {
        const ctx = createMockHostContext();
        const store = new CanvasStore();
        const s = store.createElement({
            id: "node_s",
            kind: "storyboard",
            type: "storyboard",
        });
        const v = store.createElement({
            id: "node_v",
            kind: "video",
            type: "video",
        });
        store.connect({
            fromNode: s.id,
            toNode: v.id,
            fromPort: "out",
            toPort: "prompt",
        });
        const tools = buildCanvasTools(ctx, store);
        for (const t of tools)
            ctx.tools.register(t);
        // Attempt reverse edge creating loop v -> s
        await assert.rejects(async () => {
            await ctx.tools.execute("canvas_connect", {
                fromNode: v.id,
                toNode: s.id,
            });
        }, /cycle in the DAG/);
        assert.equal(store.getAllEdges().length, 1);
    });
    it("3.12 [F8 x F13] Updating bible via canvas_update_bible immediately alters subsequent prompt resolutions", async () => {
        const ctx = createMockHostContext();
        const store = new CanvasStore();
        const charNode = store.createElement({
            id: "mention_node",
            type: "image",
            kind: "image",
            mediaParams: { prompt: "Close up of @PoetMaster laughing" },
        });
        const tools = buildCanvasTools(ctx, store);
        for (const t of tools)
            ctx.tools.register(t);
        const pipeline = new PipelineEngine();
        // Initially @PoetMaster is unresolved
        assert.ok(pipeline.resolvePrompt(charNode, store).includes("@PoetMaster"));
        // Update bible via agent tool
        await ctx.tools.execute("canvas_update_bible", {
            patch: {
                characters: [
                    {
                        name: "PoetMaster",
                        description: "Cyber-bard wielding electric lute",
                    },
                ],
            },
        });
        // Now prompt resolves dynamically
        const resolved = pipeline.resolvePrompt(charNode, store);
        assert.ok(!resolved.includes("@PoetMaster"));
        assert.ok(resolved.includes("Cyber-bard wielding electric lute"));
    });
    it("3.13 [F14 x F11] Plugin reload via Cordis lifecycle disposes old state and re-registers inspection tools", () => {
        const ctx = createMockHostContext();
        const store1 = applyCanvasPlugin(ctx);
        store1.createElement({ id: "old_item", type: "text" });
        // Verify tool sees old item
        assert.equal(store1.getAllElements().length, 1);
        // Reload plugin: dispose old, apply new
        ctx.dispose();
        assert.equal(ctx.tools.list().length, 0);
        const store2 = applyCanvasPlugin(ctx);
        assert.equal(store2.getAllElements().length, 0);
        assert.equal(ctx.tools.list().length > 0, true);
    });
    it("3.14 [F10 x F9] Authenticated web server route accesses assets produced by pipeline execution", async () => {
        const ctx = createMockHostContext();
        const store = applyCanvasPlugin(ctx);
        const node = store.createElement({
            id: "prod_video",
            kind: "video",
            type: "video",
        });
        const pipeline = new PipelineEngine();
        const execRes = await pipeline.executeNode(node.id, store);
        assert.ok(execRes.assetId);
        // State endpoint reflects updated node status and assetId
        const route = ctx.webServer.routes.find((r) => r.path === "/plugin-api/cult-canvas");
        const req = new Request("http://127.0.0.1:3344/plugin-api/cult-canvas/state", {
            headers: { host: "127.0.0.1:3344" },
        });
        const res = await route.resource(req);
        const body = (await res.json());
        const match = body.nodes.find((n) => n.id === "prod_video");
        assert.equal(match?.status, "completed");
        assert.equal(match?.data?.assetId, execRes.assetId);
    });
    it("3.15 [F5 x F6] Freehand eraser trajectory removes overlapping strokes without deleting underlying shape cards", () => {
        const store = new CanvasStore();
        const shape = store.createElement({
            id: "database_card",
            kind: "shape",
            shape: "database",
            x: 100,
            y: 100,
            width: 220,
            height: 170,
        });
        const stroke = store.createElement({
            id: "red_cross_stroke",
            kind: "stroke",
            type: "text",
            text: "",
            x: 120,
            y: 120,
            width: 80,
            height: 80,
            gbStroke: {
                v: 1,
                size: 5,
                w: 80,
                h: 80,
                points: [
                    [0, 0],
                    [80, 80],
                ],
            },
        });
        assert.equal(store.getAllElements().length, 2);
        // Eraser sweeps through (140, 140) where stroke passes using canvas-model eraserSweep
        const hitStrokeIds = eraserSweep([
            {
                id: stroke.id,
                box: {
                    x: stroke.x,
                    y: stroke.y,
                    width: stroke.width,
                    height: stroke.height,
                },
                stroke: stroke.gbStroke,
            },
        ], { x: 130, y: 130 }, { x: 150, y: 150 }, 10);
        assert.deepEqual(hitStrokeIds, [stroke.id]);
        // Eraser deletes stroke element only
        store.deleteElements(hitStrokeIds);
        assert.equal(store.getAllElements().length, 1);
        assert.ok(store.getElementById(shape.id));
        assert.equal(store.getElementById(stroke.id), undefined);
    });
    it("3.16 [F3 x F15] Client module renders toolview cards with presentation metadata for all element types", () => {
        const ctx = createMockHostContext();
        const store = new CanvasStore();
        const tools = buildCanvasTools(ctx, store);
        for (const tool of tools) {
            assert.ok(typeof tool.output.presentationMeta === "function", `Tool ${tool.name} missing presentationMeta`);
            const meta = tool.output.presentationMeta({}, { ok: true, count: 5 });
            assert.ok(meta);
            assertNoUndefined(meta);
        }
    });
    it("3.17 [F8 x F12] Bible mention resolution prevents prefix collision between shorter and longer names", () => {
        const store = new CanvasStore();
        store.updateBible({
            characters: [
                { name: "Chen", description: "Old Master Chen" },
                { name: "Chen Shi", description: "Detective Chen Shi" },
                { name: "Li Bai", description: "Great Poet" },
            ],
        });
        const node = store.createElement({
            id: "shot_collision_test",
            type: "video",
            kind: "video",
            mediaParams: {
                prompt: "A portrait of @Chen Shi walking near @Chen discussing poetry with @Li Bai",
            },
        });
        const pipeline = new PipelineEngine();
        const resolved = pipeline.resolvePrompt(node, store);
        assert.ok(resolved.includes("[Chen Shi: Detective Chen Shi]"), "Longer character name must be resolved without corruption");
        assert.ok(resolved.includes("[Chen: Old Master Chen]"), "Shorter character name must be resolved independently");
        assert.ok(!resolved.includes("[Chen: Old Master Chen] Shi"), "Prefix collision must not corrupt longer entity name");
    });
    it("3.18 [F3 x F9] Authored screenplay stored in ScriptNode.text is untouched by runWorkflow and correctly propagates to downstream nodes", async () => {
        const store = new CanvasStore();
        const authoredText = "EXT. DESERT HIGHWAY - DUSK\nAgent 47 steps out of the classic muscle car.";
        // Create authored screenplay storing text in ScriptNode.text
        store.createElement({
            id: "authored_screenplay_01",
            kind: "script",
            type: "script",
            x: 100,
            y: 100,
            width: 300,
            height: 200,
            text: authoredText,
        });
        // Create downstream storyboard node
        const storyboardNode = store.createElement({
            id: "storyboard_01",
            kind: "storyboard",
            type: "storyboard",
            x: 450,
            y: 100,
            width: 300,
            height: 200,
        });
        // Wire script -> storyboard
        store.connect({
            fromNode: "authored_screenplay_01",
            toNode: "storyboard_01",
            fromPort: "out",
            toPort: "in",
        });
        const pipeline = new PipelineEngine();
        const res = await pipeline.runWorkflow(store);
        // Assertions
        assert.equal(res.ok, true, "Workflow execution must succeed");
        assert.ok(!res.executedNodes.includes("authored_screenplay_01"), "Authored screenplay without upstream generator must NOT be executed or regenerated");
        assert.ok(res.executedNodes.includes("storyboard_01"), "Downstream storyboard node must be executed");
        // Verify script node state is completely intact
        const postScript = store.getElementById("authored_screenplay_01");
        assert.equal(postScript?.text, authoredText, "Authored screenplay text must remain untouched");
        assert.equal(postScript?.data?.output, undefined, "Script node data.output must remain undefined, never overwritten with placeholder text");
        assert.equal(postScript?.data?.assetId, undefined, "Script node data.assetId must remain undefined");
        assert.notEqual(postScript?.status, "completed", "Script node status must not be transitioned to completed by workflow");
        // Verify downstream input resolution receives authored screenplay text
        const inputs = pipeline.getResolvedInputs(storyboardNode, store);
        const inValue = Array.isArray(inputs["in"])
            ? inputs["in"][0]
            : inputs["in"];
        assert.equal(inValue, authoredText, "Downstream node input must resolve to authored screenplay text");
        // Verify downstream prompt resolution includes authored screenplay text
        const prompt = pipeline.resolvePrompt(storyboardNode, store);
        assert.ok(prompt.includes("EXT. DESERT HIGHWAY - DUSK"), "Downstream prompt must incorporate authored screenplay text");
        // Contrasting verification: script node with upstream generator IS executed
        store.createElement({
            id: "llm_writer",
            kind: "image",
            type: "image",
            x: 0,
            y: 300,
            width: 200,
            height: 100,
        });
        store.createElement({
            id: "generated_script_02",
            kind: "script",
            type: "script",
            x: 250,
            y: 300,
            width: 200,
            height: 100,
            text: "Placeholder draft",
        });
        store.connect({
            fromNode: "llm_writer",
            toNode: "generated_script_02",
            fromPort: "out",
            toPort: "in",
        });
        const res2 = await pipeline.runWorkflow(store, {
            rootNodeIds: ["llm_writer"],
        });
        assert.ok(res2.executedNodes.includes("generated_script_02"), "Script with upstream generator input must be scheduled and executed");
    });
    it("3.19 [F8 x F12] Bible mention resolution preserves character descriptions containing regex substitution tokens ($&, $', $`, $1)", () => {
        const store = new CanvasStore();
        store.updateBible({
            characters: [
                {
                    name: "SpecialAgent",
                    description: "Codename $` stealth operative with $& badge and $' mission",
                },
                {
                    name: "BountyHunter",
                    description: "Reward value: $500,000 in cash ($1 and $2 bills)",
                },
                {
                    name: "DoubleDollar",
                    description: "Symbol $$ double cash",
                },
            ],
        });
        const node = store.createElement({
            id: "dollar_prompt_node",
            type: "image",
            kind: "image",
            x: 0,
            y: 0,
            width: 200,
            height: 200,
            text: "Command: Contact @SpecialAgent and @BountyHunter for @DoubleDollar payout.",
        });
        const pipeline = new PipelineEngine();
        const resolved = pipeline.resolvePrompt(node, store);
        assert.ok(resolved.includes("[SpecialAgent: Codename $` stealth operative with $& badge and $' mission]"), "SpecialAgent description with $`, $&, $' must be preserved verbatim without prompt injection");
        assert.ok(resolved.includes("[BountyHunter: Reward value: $500,000 in cash ($1 and $2 bills)]"), "BountyHunter description with $1, $2, $500 must be preserved verbatim");
        assert.ok(resolved.includes("[DoubleDollar: Symbol $$ double cash]"), "Double dollar signs must not be collapsed into single dollar sign");
        assert.equal(resolved, "Command: Contact [SpecialAgent: Codename $` stealth operative with $& badge and $' mission] and [BountyHunter: Reward value: $500,000 in cash ($1 and $2 bills)] for [DoubleDollar: Symbol $$ double cash] payout.");
    });
});
