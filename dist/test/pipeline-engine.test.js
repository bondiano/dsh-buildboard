import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CanvasStore, createScriptNode, createStoryboardNode, createImageNode, createVideoNode, createAudioNode, createFinalcutNode, createStickyNote, } from "../canvas-model.js";
import { PipelineEngine, planShotSegments, shotContinuityPlan, shotVisualText, isCutPoint, gateBible, gateStoryboard, gateOneVideoPerStoryboard, gateShotNodeName, gateStage, inferPipelineStage, PRODUCTION_STAGES, PRODUCTION_STAGE_ZH, STAGE_INDEX, COMBAT_ACTION_LEXICON, detectCombatScene, shotIsCombat, combatContractAddendum, combatCausalityText, validateCombatGeometry, MockGenerationProvider, } from "../pipeline-engine.js";
const SAMPLE_SHOTS = [
    {
        index: 1,
        title: "Shot 1: Neon Tavern Exterior",
        duration: 3.5,
        visual: "Wide cinematic establishing shot of Chang'an alley in rain.",
        motion: "Slow dolly forward toward tavern door.",
        tail: "Camera pauses before door handle.",
        start: "Skyline descending into alley.",
        cam: "35mm anamorphic wide",
        seg: "opening",
        join: "cut",
        dialogue: [],
    },
    {
        index: 2,
        title: "Shot 2: Tavern Interior Encounter",
        duration: 4.0,
        visual: "Medium shot inside Chang'an tavern. Chen Shi pushes door.",
        motion: "Pan right following Chen Shi to reveal Li Bai.",
        tail: "Li Bai raises wine gourd with grin.",
        start: "Door opening silhouette.",
        cam: "50mm prime, shallow depth of field",
        seg: "continuation",
        join: "strict",
        dialogue: [
            { speaker: "Chen Shi", text: "You're late, poet." },
            { speaker: "Li Bai", text: "The moon moves at its own pace." },
        ],
    },
    {
        index: 3,
        title: "Shot 3: Close-up Secret Map",
        duration: 3.0,
        visual: "Extreme close-up top-down on wooden table.",
        motion: "Smooth tilt up from scroll to eyes.",
        tail: "Scroll glows bright amber.",
        start: "Hands unrolling silk scroll.",
        cam: "85mm macro",
        seg: "closeup",
        join: "strict",
        dialogue: [
            { speaker: "Li Bai", text: "The imperial archive breaches tonight." },
        ],
    },
];
describe("Milestone 2: PipelineEngine Unit Test Suite", () => {
    // =========================================================================
    // 1. Helper Functions
    // =========================================================================
    describe("1. Helper Functions", () => {
        it("shotVisualText extracts and combines visual and motion", () => {
            assert.equal(shotVisualText({
                index: 1,
                duration: 2,
                visual: "Rain pouring on neon sign",
                motion: "Dolly forward",
            }), "Rain pouring on neon sign；Dolly forward");
            assert.equal(shotVisualText(null), "");
            assert.equal(shotVisualText({ index: 1, duration: 1, visual: "Only visual" }), "Only visual");
        });
        it("isCutPoint correctly identifies cut segment types", () => {
            assert.equal(isCutPoint("opening"), true);
            assert.equal(isCutPoint("scene_change"), true);
            assert.equal(isCutPoint("closeup"), true);
            assert.equal(isCutPoint("new_character"), true);
            assert.equal(isCutPoint("state_jump"), true);
            assert.equal(isCutPoint("continuation"), false);
        });
        it("shotContinuityPlan assigns correct roles and seam joins", () => {
            const plan1 = shotContinuityPlan(SAMPLE_SHOTS[0], null, 0);
            assert.equal(plan1.seg, "opening");
            assert.equal(plan1.chain, false);
            const plan2 = shotContinuityPlan(SAMPLE_SHOTS[1], SAMPLE_SHOTS[0], 1);
            assert.equal(plan2.seg, "continuation");
            assert.equal(plan2.join, "strict");
            assert.equal(plan2.chain, true);
            assert.equal(plan2.prevTail, "Camera pauses before door handle.");
        });
    });
    // =========================================================================
    // 2. Shot Segmentation
    // =========================================================================
    describe("2. Shot Segmentation", () => {
        it("plans multi-shot storyboard segmentation adhering to seam boundaries", () => {
            const segments = planShotSegments(SAMPLE_SHOTS);
            assert.equal(segments.length, 2);
            assert.equal(segments[0].duration, 7.5);
            assert.equal(segments[1].duration, 3.0);
            assert.equal(segments[0].startShotIndex, 1);
            assert.equal(segments[0].endShotIndex, 2);
            assert.equal(segments[1].startShotIndex, 3);
            assert.equal(segments[1].endShotIndex, 3);
            assert.equal(segments[0].isJoinStrict, true);
            assert.equal(segments[0].videoSegment, 1);
            assert.equal(segments[1].videoSegment, 2);
            assert.equal(segments.total, 10.5);
            assert.equal(segments.cutMode, "clean");
        });
        it("handles empty shots array returning clean empty list", () => {
            const segments = planShotSegments([]);
            assert.deepEqual(segments, []);
            assert.equal(segments.length, 0);
            assert.equal(segments.total, 0);
            assert.equal(segments.cutMode, "empty");
        });
        it("handles single zero-duration shot safely", () => {
            const segments = planShotSegments([{ index: 1, duration: 0 }]);
            assert.equal(segments.length, 1);
            assert.equal(segments[0].duration, 0);
        });
        it("chunks 50 continuous shots into balanced video segments", () => {
            const shots = Array.from({ length: 50 }, (_, i) => ({
                index: i + 1,
                duration: 3.0,
                join: "strict",
            }));
            const segments = planShotSegments(shots, { maxSeconds: 6.0 });
            assert.ok(segments.length >= 10);
            assert.equal(segments.total, 150.0);
        });
        it("evaluates seamRisk as 'none' when opening on a clean cut point", () => {
            const shots = [
                { index: 1, duration: 3.0, visual: "大特写", seg: "opening" },
                { index: 2, duration: 3.0, visual: "全景", seg: "scene_change" },
            ];
            const segments = planShotSegments(shots, { maxSeconds: 6.0 });
            assert.equal(segments.length, 2);
            assert.equal(segments[0].seamRisk, "none");
            assert.equal(segments[0].needsTailChain, false);
            assert.equal(segments[1].seamRisk, "none");
            assert.equal(segments[1].needsTailChain, false);
        });
        it("evaluates seamRisk as 'forced' when previous segment exceeded duration limit", () => {
            const shots = [
                { index: 1, duration: 4.0, visual: "大特写", seg: "opening" },
                { index: 2, duration: 2.0, visual: "特写", seg: "continuation" },
            ];
            const segments = planShotSegments(shots, { maxSeconds: 3.0 });
            assert.equal(segments.length, 2);
            assert.equal(segments[0].seamRisk, "none");
            assert.equal(segments[1].seamRisk, "forced");
            assert.equal(segments[1].needsTailChain, true);
            assert.ok(segments.warnings.some((w) => w.includes("forced cut")));
        });
        it("evaluates seamRisk as 'chain' when continuation shot requires tail frame without duration overflow", () => {
            const shots = [
                { index: 1, duration: 3.0, visual: "大特写", seg: "opening" },
                {
                    index: 2,
                    duration: 3.0,
                    visual: "特写",
                    seg: "continuation",
                    join: "cut",
                },
            ];
            const segments = planShotSegments(shots, { maxSeconds: 6.0 });
            assert.equal(segments.length, 2);
            assert.equal(segments[0].seamRisk, "none");
            assert.equal(segments[1].seamRisk, "chain");
            assert.equal(segments[1].needsTailChain, true);
        });
    });
    // =========================================================================
    // 3. Prompt Resolution & Series Bible @mentions
    // =========================================================================
    describe("3. Prompt Resolution & Series Bible @mentions", () => {
        it("resolves prompt propagating upstream script text", () => {
            const store = new CanvasStore();
            const script = createScriptNode("scr_1", 0, 0, "Scene: Detective arrives in rain.");
            store.createElement(script);
            const image = createImageNode("img_1", 100, 0, "Atmospheric neon glow");
            store.createElement(image);
            store.connect({
                id: "e_scr_img",
                fromNode: script.id,
                toNode: image.id,
                toPort: "prompt",
            });
            const engine = new PipelineEngine();
            const prompt = engine.resolvePrompt(image, store);
            assert.ok(prompt.includes("Scene: Detective arrives in rain."));
            assert.ok(prompt.includes("Atmospheric neon glow"));
        });
        it("compiles storyboard multi-shot descriptions when upstream", () => {
            const store = new CanvasStore();
            const sb = createStoryboardNode("sb_1", 0, 0, SAMPLE_SHOTS);
            // Embed shots in node data
            sb.data = {
                shots: SAMPLE_SHOTS,
            };
            store.createElement(sb);
            const video = createVideoNode("vid_1", 200, 0, "Cinematic film grain");
            store.createElement(video);
            store.connect({
                id: "e_sb_vid",
                fromNode: sb.id,
                toNode: video.id,
                toPort: "prompt",
            });
            const engine = new PipelineEngine();
            const prompt = engine.resolvePrompt(video, store);
            assert.ok(prompt.includes("Neon Tavern Exterior"));
            assert.ok(prompt.includes("Cinematic film grain"));
        });
        it("expands @mention bible entities avoiding prefix collision (@Chen vs @Chen Shi)", () => {
            const store = new CanvasStore();
            store.updateBible({
                characters: [
                    {
                        name: "Chen",
                        desc: "Elder scholar with gray beard",
                    },
                    {
                        name: "Chen Shi",
                        desc: "Young forensic detective from Luoyang",
                    },
                ],
            });
            const node = createImageNode("img_mention", 0, 0, "Portrait of @Chen Shi speaking with @Chen in the library");
            store.createElement(node);
            const engine = new PipelineEngine();
            const resolved = engine.resolvePrompt(node, store);
            assert.ok(!resolved.includes("@Chen Shi"));
            assert.ok(!resolved.includes("@Chen"));
            assert.ok(resolved.includes("[Chen Shi: Young forensic detective from Luoyang]"));
            assert.ok(resolved.includes("[Chen: Elder scholar with gray beard]"));
        });
        it("preserves unresolved @UnknownEntity in prompt intact", () => {
            const store = new CanvasStore();
            const node = createImageNode("img_unres", 0, 0, "Encounter with @AlienCreature in alley");
            store.createElement(node);
            const engine = new PipelineEngine();
            const resolved = engine.resolvePrompt(node, store);
            assert.ok(resolved.includes("@AlienCreature"));
        });
        it("prevents infinite recursion when prompt edges contain cycles", () => {
            const store = new CanvasStore();
            const n1 = createImageNode("cyc_1", 0, 0, "Prompt 1");
            const n2 = createImageNode("cyc_2", 100, 0, "Prompt 2");
            store.createElement(n1);
            store.createElement(n2);
            store.connect({
                id: "e_c1",
                fromNode: n1.id,
                toNode: n2.id,
                toPort: "prompt",
            });
            store.connect({
                id: "e_c2",
                fromNode: n2.id,
                toNode: n1.id,
                toPort: "prompt",
            });
            const engine = new PipelineEngine();
            const prompt = engine.resolvePrompt(n1, store);
            assert.ok(prompt.length > 0);
        });
        it("returns empty string for empty prompt", () => {
            const store = new CanvasStore();
            const node = createImageNode("empty_p", 0, 0, "");
            store.createElement(node);
            const engine = new PipelineEngine();
            assert.equal(engine.resolvePrompt(node, store), "");
        });
        it("resolves prompt on multi-hop chain A -> B -> C with exact string and no duplication", () => {
            const store = new CanvasStore();
            const nodeA = createImageNode("node_a", 0, 0, "Prompt A");
            const nodeB = createImageNode("node_b", 100, 0, "Prompt B");
            const nodeC = createImageNode("node_c", 200, 0, "Prompt C");
            store.createElement(nodeA);
            store.createElement(nodeB);
            store.createElement(nodeC);
            store.connect({
                id: "e_ab",
                fromNode: "node_a",
                toNode: "node_b",
                toPort: "prompt",
            });
            store.connect({
                id: "e_bc",
                fromNode: "node_b",
                toNode: "node_c",
                toPort: "prompt",
            });
            const engine = new PipelineEngine();
            const promptB = engine.resolvePrompt(nodeB, store);
            assert.equal(promptB, "Prompt A\nPrompt B");
            const promptC = engine.resolvePrompt(nodeC, store);
            assert.equal(promptC, "Prompt A\nPrompt B\nPrompt C");
        });
        it("resolves diamond prompt fan-in A -> (B, C) -> D without prompt duplication", () => {
            const store = new CanvasStore();
            const nodeA = createImageNode("node_a", 0, 0, "Prompt A");
            const nodeB = createImageNode("node_b", 100, -50, "Prompt B");
            const nodeC = createImageNode("node_c", 100, 50, "Prompt C");
            const nodeD = createImageNode("node_d", 200, 0, "Prompt D");
            store.createElement(nodeA);
            store.createElement(nodeB);
            store.createElement(nodeC);
            store.createElement(nodeD);
            store.connect({
                id: "e_ab",
                fromNode: "node_a",
                toNode: "node_b",
                toPort: "prompt",
            });
            store.connect({
                id: "e_ac",
                fromNode: "node_a",
                toNode: "node_c",
                toPort: "prompt",
            });
            store.connect({
                id: "e_bd",
                fromNode: "node_b",
                toNode: "node_d",
                toPort: "prompt",
            });
            store.connect({
                id: "e_cd",
                fromNode: "node_c",
                toNode: "node_d",
                toPort: "prompt",
            });
            const engine = new PipelineEngine();
            const result = engine.resolvePrompt(nodeD, store);
            assert.equal(result.match(/Prompt A/g)?.length, 1);
            assert.equal(result.match(/Prompt B/g)?.length, 1);
            assert.equal(result.match(/Prompt C/g)?.length, 1);
            assert.equal(result.match(/Prompt D/g)?.length, 1);
        });
    });
    // =========================================================================
    // 4. Single Node Execution Lifecycle
    // =========================================================================
    describe("4. Single Node Execution Lifecycle", () => {
        it("executes node advancing status idle -> running -> completed", async () => {
            const store = new CanvasStore();
            const node = createImageNode("node_exec_test", 0, 0, "Test image");
            store.createElement(node);
            const engine = new PipelineEngine();
            const res = await engine.executeNode(node.id, store);
            assert.equal(res.ok, true);
            assert.equal(res.status, "completed");
            assert.ok(res.assetId?.startsWith("asset_image_node_exec_test"));
            const stored = store.getElementById(node.id);
            assert.equal(stored?.status, "completed");
            assert.equal(stored?.data?.assetId, res.assetId);
        });
        it("uses custom mockGenerator when provided", async () => {
            const store = new CanvasStore();
            const node = createVideoNode("custom_gen_node", 0, 0, "Test video");
            store.createElement(node);
            const engine = new PipelineEngine();
            const res = await engine.executeNode(node.id, store, {
                mockGenerator: async (_n, _inputs) => {
                    return {
                        assetId: "custom_video_asset_999",
                        output: "High resolution render 4K",
                    };
                },
            });
            assert.equal(res.ok, true);
            assert.equal(res.assetId, "custom_video_asset_999");
            const stored = store.getElementById(node.id);
            assert.equal(stored?.data?.assetId, "custom_video_asset_999");
            assert.equal(stored?.data?.output, "High resolution render 4K");
        });
        it("handles generator error marking node as failed", async () => {
            const store = new CanvasStore();
            const node = createImageNode("failing_node", 0, 0, "Prompt");
            store.createElement(node);
            const engine = new PipelineEngine();
            const res = await engine.executeNode(node.id, store, {
                mockGenerator: async () => {
                    throw new Error("Out of memory on GPU device 0");
                },
            });
            assert.equal(res.ok, false);
            assert.equal(res.status, "failed");
            assert.equal(res.error, "Out of memory on GPU device 0");
            const stored = store.getElementById(node.id);
            assert.equal(stored?.status, "failed");
            assert.equal(stored?.data?.error, "Out of memory on GPU device 0");
        });
        it("throws error when executing non-existent node ID", async () => {
            const store = new CanvasStore();
            const engine = new PipelineEngine();
            await assert.rejects(async () => {
                await engine.executeNode("missing_id", store);
            }, /Node not found/);
        });
        it("halts execution when AbortSignal is pre-aborted", async () => {
            const store = new CanvasStore();
            const node = createImageNode("aborted_node", 0, 0, "Prompt");
            store.createElement(node);
            const controller = new AbortController();
            controller.abort();
            const engine = new PipelineEngine();
            await assert.rejects(async () => {
                await engine.executeNode(node.id, store, {
                    signal: controller.signal,
                });
            }, /aborted/);
        });
        it("aggregates multiple incoming connections into arrays for MULTI_INPUT_PORTS (in, ref)", () => {
            const store = new CanvasStore();
            const v1 = createVideoNode("v1", 0, 0, "Vid 1");
            v1.data = { assetId: "asset_vid_1" };
            const v2 = createVideoNode("v2", 100, 0, "Vid 2");
            v2.data = { assetId: "asset_vid_2" };
            const fc = createFinalcutNode("fc", 200, 0);
            store.createElement(v1);
            store.createElement(v2);
            store.createElement(fc);
            store.connect({
                id: "e_fc1",
                fromNode: "v1",
                toNode: "fc",
                toPort: "in",
            });
            store.connect({
                id: "e_fc2",
                fromNode: "v2",
                toNode: "fc",
                toPort: "in",
            });
            const img1 = createImageNode("img1", 0, 100, "Ref 1");
            img1.data = { assetId: "asset_img_1" };
            const img2 = createImageNode("img2", 100, 100, "Ref 2");
            img2.data = { assetId: "asset_img_2" };
            const targetImg = createImageNode("target_img", 200, 100, "Target");
            store.createElement(img1);
            store.createElement(img2);
            store.createElement(targetImg);
            store.connect({
                id: "e_ref1",
                fromNode: "img1",
                toNode: "target_img",
                toPort: "ref",
            });
            store.connect({
                id: "e_ref2",
                fromNode: "img2",
                toNode: "target_img",
                toPort: "ref",
            });
            const engine = new PipelineEngine();
            const fcInputs = engine.getResolvedInputs(fc, store);
            assert.deepEqual(fcInputs.in, ["asset_vid_1", "asset_vid_2"]);
            const imgInputs = engine.getResolvedInputs(targetImg, store);
            assert.deepEqual(imgInputs.ref, ["asset_img_1", "asset_img_2"]);
        });
    });
    // =========================================================================
    // 5. Full DAG Workflow Runner
    // =========================================================================
    describe("5. Full DAG Workflow Runner", () => {
        it("runs entire workflow in topological dependency order", async () => {
            const store = new CanvasStore();
            const n1 = createScriptNode("flow_script", 0, 0, "");
            const n2 = createVideoNode("flow_video", 100, 0, "Video prompt");
            const n3 = createFinalcutNode("flow_finalcut", 200, 0);
            store.createElement(n1);
            store.createElement(n2);
            store.createElement(n3);
            store.connect({
                id: "e_f1",
                fromNode: n1.id,
                toNode: n2.id,
            });
            store.connect({
                id: "e_f2",
                fromNode: n2.id,
                toNode: n3.id,
            });
            const engine = new PipelineEngine();
            const res = await engine.runWorkflow(store);
            assert.equal(res.ok, true);
            assert.deepEqual(res.executedNodes, [
                "flow_script",
                "flow_video",
                "flow_finalcut",
            ]);
            assert.equal(res.failedNodes.length, 0);
        });
        it("skips non-generative whiteboard annotations and authored scripts", async () => {
            const store = new CanvasStore();
            const sticky = createStickyNote("anno_sticky", 0, 0, "Director note");
            const authored = createScriptNode("authored_screenplay", 100, 0, "Authored text");
            authored.data = {
                output: "# Act 1\nAuthored text",
            };
            const vid = createVideoNode("gen_video", 200, 0, "Prompt");
            store.createElement(sticky);
            store.createElement(authored);
            store.createElement(vid);
            store.connect({
                id: "e_auth_vid",
                fromNode: authored.id,
                toNode: vid.id,
            });
            store.connect({
                id: "e_stick_vid",
                fromNode: sticky.id,
                toNode: vid.id,
            });
            const engine = new PipelineEngine();
            const res = await engine.runWorkflow(store);
            assert.equal(res.ok, true);
            assert.deepEqual(res.executedNodes, ["gen_video"]);
        });
        it("rejects workflow when DAG contains cyclic dependency", async () => {
            const store = new CanvasStore();
            const n1 = createImageNode("c_a", 0, 0, "Prompt 1");
            const n2 = createVideoNode("c_b", 100, 0, "Prompt 2");
            store.createElement(n1);
            store.createElement(n2);
            store.connect({ id: "e_cyc_1", fromNode: n1.id, toNode: n2.id });
            store.connect({ id: "e_cyc_2", fromNode: n2.id, toNode: n1.id });
            const engine = new PipelineEngine();
            await assert.rejects(async () => {
                await engine.runWorkflow(store);
            }, /DAG contains cycles/);
        });
        it("respects stopOnError: false to continue execution past failures", async () => {
            const store = new CanvasStore();
            const failNode = createImageNode("node_err", 0, 0, "Fail");
            const okNode = createImageNode("node_success", 100, 0, "Success");
            store.createElement(failNode);
            store.createElement(okNode);
            const engine = new PipelineEngine();
            const res = await engine.runWorkflow(store, {
                stopOnError: false,
                mockGenerator: async (node) => {
                    if (node.id === "node_err") {
                        throw new Error("Simulated failure");
                    }
                    return { assetId: "ok_asset" };
                },
            });
            assert.equal(res.ok, false);
            assert.deepEqual(res.failedNodes, ["node_err"]);
            assert.deepEqual(res.executedNodes, ["node_success"]);
        });
        it("runs workflow filtered by rootNodeIds and downstream dependents", async () => {
            const store = new CanvasStore();
            const r1 = createImageNode("branch1_root", 0, 0, "Root");
            const d1 = createVideoNode("branch1_down", 100, 0, "Down");
            const r2 = createImageNode("branch2_root", 200, 0, "Root2");
            store.createElement(r1);
            store.createElement(d1);
            store.createElement(r2);
            store.connect({ id: "e_b1", fromNode: r1.id, toNode: d1.id });
            const engine = new PipelineEngine();
            const res = await engine.runWorkflow(store, {
                rootNodeIds: ["branch1_root"],
            });
            assert.equal(res.ok, true);
            assert.deepEqual(res.executedNodes, ["branch1_root", "branch1_down"]);
            assert.ok(!res.executedNodes.includes("branch2_root"));
        });
        it("aborts running workflow when signal triggers", async () => {
            const store = new CanvasStore();
            const node = createImageNode("wf_abort", 0, 0, "Prompt");
            store.createElement(node);
            const controller = new AbortController();
            controller.abort();
            const engine = new PipelineEngine();
            await assert.rejects(async () => {
                await engine.runWorkflow(store, { signal: controller.signal });
            }, /aborted/);
        });
    });
    // =========================================================================
    // 6. Automated Quality Gates G1-G6 & Lifecycle Stages
    // =========================================================================
    describe("6. Automated Quality Gates G1-G6 & Lifecycle Stages", () => {
        it("G1 Bible Gate enforces worldview, style, and at least 1 character", () => {
            assert.equal(PRODUCTION_STAGES.length, 10);
            assert.equal(PRODUCTION_STAGES[0], "brief");
            assert.equal(PRODUCTION_STAGE_ZH.brief, "立项");
            assert.equal(STAGE_INDEX.brief, 0);
            const stageSample = "storyboard";
            assert.equal(PRODUCTION_STAGE_ZH[stageSample], "分镜");
            const failEmpty = gateBible({});
            assert.equal(failEmpty.ok, false);
            assert.equal(failEmpty.code, "G1");
            assert.equal(failEmpty.missing.length, 3);
            const failNoChar = gateBible({
                worldview: "Cyberpunk Chang'an",
                style: "Anime 90s aesthetic",
                characters: [],
            });
            assert.equal(failNoChar.ok, false);
            assert.ok(failNoChar.missing.some((m) => m.includes("characters")));
            const pass = gateBible({
                worldview: "Cyberpunk Chang'an",
                style: "Anime 90s aesthetic",
                characters: [{ name: "Chen Shi", desc: "Detective" }],
            });
            assert.equal(pass.ok, true);
            assert.equal(pass.missing.length, 0);
        });
        it("G2 Storyboard Gate verifies shot count, concrete shot sizes, and motions", () => {
            // Empty shots fails
            const failEmpty = gateStoryboard([]);
            assert.equal(failEmpty.ok, false);
            assert.equal(failEmpty.code, "G2");
            // More than 24 shots fails
            const shots25 = Array.from({ length: 25 }, (_, i) => ({
                index: i + 1,
                duration: 3,
                visual: "全景 shot",
                motion: "pan",
            }));
            const failTooMany = gateStoryboard(shots25);
            assert.equal(failTooMany.ok, false);
            assert.ok(failTooMany.fails.some((f) => f.includes("超过单表上限 24")));
            // Missing extreme close up "大特写" fails
            const shotsNoEcu = [
                {
                    index: 1,
                    duration: 3,
                    visual: "全景 远景 street",
                    motion: "pan right",
                },
                {
                    index: 2,
                    duration: 3,
                    visual: "中景 角色对话",
                    motion: "tilt up",
                },
            ];
            const failNoEcu = gateStoryboard(shotsNoEcu);
            assert.equal(failNoEcu.ok, false);
            assert.ok(failNoEcu.fails.some((f) => f.includes("大特写")));
            // 3 consecutive identical motions fails
            const shotsConsecutiveMotion = [
                {
                    index: 1,
                    duration: 3,
                    visual: "大特写 眼睛",
                    motion: "pan right",
                },
                {
                    index: 2,
                    duration: 3,
                    visual: "中景 街道",
                    motion: "pan right",
                },
                {
                    index: 3,
                    duration: 3,
                    visual: "全景 酒肆",
                    motion: "pan right",
                },
            ];
            const failMotion = gateStoryboard(shotsConsecutiveMotion);
            assert.equal(failMotion.ok, false);
            assert.ok(failMotion.fails.some((f) => f.includes("连续三镜运动完全相同")));
            // Valid storyboard passes
            const validShots = [
                {
                    index: 1,
                    duration: 2.5,
                    visual: "全景 雨夜长安街",
                    motion: "dolly in",
                    seg: "opening",
                    tail: "停在酒肆门口",
                    cam: "35mm",
                },
                {
                    index: 2,
                    duration: 3.0,
                    visual: "大特写 滴水的刀尖",
                    motion: "pan left",
                    seg: "closeup",
                    tail: "水珠落下",
                    cam: "85mm",
                },
                {
                    index: 3,
                    duration: 4.0,
                    visual: "中景 李白与陈拾对峙",
                    motion: "static",
                    seg: "continuation",
                    tail: "李白举酒葫芦",
                    cam: "50mm",
                },
            ];
            const pass = gateStoryboard(validShots);
            assert.equal(pass.ok, true);
            assert.equal(pass.fails.length, 0);
        });
        it("G3 One Video per Storyboard Gate blocks redundant video nodes", () => {
            const store = new CanvasStore();
            const sb = createStoryboardNode("sb_gate", 0, 0, []);
            const vid1 = createVideoNode("vid_gate_1", 200, 0, "A video prompt");
            store.createElement(sb);
            store.createElement(vid1);
            // Initially not connected: ok
            const check1 = gateOneVideoPerStoryboard(store, sb.id);
            assert.equal(check1.ok, true);
            // Connect sb -> vid1
            store.connect({
                id: "e_sb_v1",
                fromNode: sb.id,
                toNode: vid1.id,
            });
            // Now sb already has a video node: fails
            const check2 = gateOneVideoPerStoryboard(store, sb.id);
            assert.equal(check2.ok, false);
            assert.equal(check2.code, "G3");
            assert.equal(check2.existingVideoId, vid1.id);
        });
        it("G4 Prohibit Per-Shot Video Nodes rejects '镜N' and '镜头 NN' naming pattern", () => {
            assert.equal(gateShotNodeName("镜1", "video").ok, false);
            assert.equal(gateShotNodeName("镜 2", "image").ok, false);
            assert.equal(gateShotNodeName("第1场 镜3 特写", "video").ok, false);
            assert.equal(gateShotNodeName("镜头 02", "video").ok, false);
            assert.equal(gateShotNodeName("镜头02", "video").ok, false);
            assert.equal(gateShotNodeName("镜头 1", "video").ok, false);
            assert.equal(gateShotNodeName("镜头1", "image").ok, false);
            assert.equal(gateShotNodeName("第1场 镜头 03 特写", "video").ok, false);
            assert.equal(gateShotNodeName("Scene 1 Video Generation", "video").ok, true);
            assert.equal(gateShotNodeName("Character Ref Sheet", "image").ok, true);
            assert.equal(gateShotNodeName("镜头 02", "audio").ok, true);
        });
        it("G6 Stage Sequencing enforces progression order", () => {
            assert.equal(gateStage("storyboard", "script").ok, true);
            assert.equal(gateStage("shots_ready", "shots_ready").ok, true);
            assert.equal(gateStage("script", "generating").ok, false);
            assert.equal(gateStage("brief", "post").ok, false);
        });
        it("inferPipelineStage accurately infers lifecycle stage from store state", () => {
            const store = new CanvasStore();
            assert.equal(inferPipelineStage(store), "brief");
            store.updateBible({
                worldview: "Tang Dynasty cyberpunk",
                style: "Anime",
                characters: [{ name: "Li Bai", desc: "Poet" }],
            });
            assert.equal(inferPipelineStage(store), "bible");
            const img = createImageNode("img_done", 0, 0, "Test");
            img.status = "completed";
            store.createElement(img);
            assert.equal(inferPipelineStage(store), "assets");
            const script = createScriptNode("scr_done", 100, 0, "Script text");
            store.createElement(script);
            assert.equal(inferPipelineStage(store), "script");
            const sb = createStoryboardNode("sb_done", 200, 0, []);
            sb.data = {
                shots: [
                    {
                        index: 1,
                        duration: 3,
                        visual: "大特写 眼睛",
                        motion: "slow zoom",
                    },
                    { index: 2, duration: 4, visual: "全景 长安", motion: "dolly" },
                ],
            };
            store.createElement(sb);
            assert.equal(inferPipelineStage(store), "shots_ready");
            const vid = createVideoNode("vid_gen", 300, 0, "A video prompt");
            vid.status = "running";
            store.createElement(vid);
            assert.equal(inferPipelineStage(store), "generating");
            vid.status = "completed";
            assert.equal(inferPipelineStage(store), "qc");
            const fc = createFinalcutNode("fc_post", 400, 0);
            fc.status = "completed";
            store.createElement(fc);
            assert.equal(inferPipelineStage(store), "post");
        });
        it("PipelineEngine.checkGate unifies gate checks cleanly", () => {
            const engine = new PipelineEngine();
            const g1Res = engine.checkGate("G1", { worldview: "V", style: "S" });
            assert.equal(g1Res.ok, false);
            const g6Res = engine.checkGate("G6", "storyboard", "script");
            assert.equal(g6Res.ok, true);
        });
    });
    // =========================================================================
    // 7. Shot Segmentation Trailing Fragment Merge
    // =========================================================================
    describe("7. Shot Segmentation Trailing Fragment Merge", () => {
        it("merges trailing tiny fragment (<= 20% maxSeconds) into previous segment", () => {
            // Total: 5.5s + 0.8s = 6.3s. maxSeconds = 6.0s.
            // 0.8s <= 20% of 6.0s (1.2s), and total 6.3s <= 6.0s + 0.6s tolerance.
            const shots = [
                {
                    index: 1,
                    duration: 5.5,
                    visual: "全景 街道",
                    motion: "dolly",
                    seg: "opening",
                },
                {
                    index: 2,
                    duration: 0.8,
                    visual: "大特写 刀尖",
                    motion: "static",
                    seg: "closeup",
                },
            ];
            const plan = planShotSegments(shots, { maxSeconds: 6.0 });
            // Without merge, this would be 2 segments (5.5s and 0.8s).
            // With trailing fragment merge, segment 2 is merged into segment 1!
            assert.equal(plan.length, 1);
            assert.equal(plan[0].duration, 6.3);
            assert.equal(plan[0].shots.length, 2);
            assert.ok(plan.warnings.some((w) => w.includes("Trailing fragment of 0.8s merged")));
        });
        it("does not merge trailing fragment if it exceeds 20% of maxSeconds", () => {
            const shots = [
                {
                    index: 1,
                    duration: 5.0,
                    visual: "全景 街道",
                    motion: "dolly",
                    seg: "opening",
                },
                {
                    index: 2,
                    duration: 3.0,
                    visual: "大特写 刀尖",
                    motion: "static",
                    seg: "closeup",
                },
            ];
            const plan = planShotSegments(shots, { maxSeconds: 6.0 });
            assert.equal(plan.length, 2);
            assert.equal(plan[0].duration, 5.0);
            assert.equal(plan[1].duration, 3.0);
        });
    });
    // =========================================================================
    // 8. Combat Semantics & Lexicon
    // =========================================================================
    describe("8. Combat Semantics & Lexicon", () => {
        it("COMBAT_ACTION_LEXICON provides 12 biomechanical action poses with zh and en", () => {
            assert.equal(COMBAT_ACTION_LEXICON.length, 12);
            for (const pose of COMBAT_ACTION_LEXICON) {
                assert.ok(pose.id.length > 0);
                assert.ok(pose.zh.length > 0);
                assert.ok(pose.en.length > 0);
            }
        });
        it("detectCombatScene detects combat action keywords while ignoring dialogue and past context", () => {
            const combatText = "李寒持枪刺出，直取沈铁胸膛；沈铁侧身避开，挥拳反击。";
            const res1 = detectCombatScene(combatText);
            assert.equal(res1.hit, true);
            assert.ok(res1.matched.length > 0);
            const peacefulText = "李寒坐在茶馆里喝茶，静静看着窗外的细雨。";
            const res2 = detectCombatScene(peacefulText);
            assert.equal(res2.hit, false);
            // Dialogue text excluded
            const dialogueText = '李寒说道："当年我挥刀断水，开打无敌。"';
            const res3 = detectCombatScene(dialogueText);
            assert.equal(res3.hit, false);
            // Dialogue with exclamation/question delimiters and standalone quotes excluded
            assert.equal(detectCombatScene('李寒拔剑冲上前，说道："看招！吃我一拳！"').hit, false);
            assert.equal(detectCombatScene("“看招！吃我一拳！”").hit, false);
            assert.equal(detectCombatScene("「看招！吃我一拳！」").hit, false);
            assert.equal(detectCombatScene("『看招！吃我一拳！』").hit, false);
            assert.equal(detectCombatScene("小明微笑着，喊道：“看招！吃我一拳！”").hit, false);
            // Narrative combat outside quotes is detected while spoken combat in quotes is excluded
            const mixedText = "李寒持枪刺出，直取沈铁胸膛。“看招！吃我一拳！”李寒喊道。";
            const resMixed = detectCombatScene(mixedText);
            assert.equal(resMixed.hit, true);
            assert.ok(resMixed.matched.includes("刺出"));
            assert.ok(!resMixed.matched.includes("一拳"));
            // Mode overrides
            assert.equal(detectCombatScene(peacefulText, { mode: "on" }).hit, true);
            assert.equal(detectCombatScene(combatText, { mode: "off" }).hit, false);
        });
        it("shotIsCombat identifies combat shots by presence of combat fields", () => {
            assert.equal(shotIsCombat({ index: 1, duration: 2 }), false);
            assert.equal(shotIsCombat({
                index: 1,
                duration: 2,
                attack: "@Li@ -> @Shen@ spear thrust",
            }), true);
        });
        it("combatContractAddendum generates combat rules in zh and en", () => {
            const zhRules = combatContractAddendum(true);
            assert.ok(zhRules.length >= 10);
            assert.ok(zhRules.some((r) => r.includes("打斗分镜")));
            const enRules = combatContractAddendum(false);
            assert.ok(enRules.length >= 10);
            assert.ok(enRules.some((r) => r.includes("[COMBAT STORYBOARD - HARD]")));
        });
        it("combatCausalityText formats combat action chains", () => {
            const shot = {
                index: 1,
                duration: 3,
                attack: "@Li@ -> @Shen@ 枪突刺",
                reaction: "@Shen@ 单臂斜上架格挡",
                impact: "枪尖滑向侧面木柱",
                initiative: "攻势仍在李寒",
            };
            const causality = combatCausalityText(shot, true);
            assert.ok(causality.includes("【打斗因果】"));
            assert.ok(causality.includes("攻击（必须朝向该对手）"));
            assert.ok(causality.includes("对手回应（必须演出）"));
        });
        it("validateCombatGeometry verifies 4 combat geometry rules", () => {
            // Attack without reaction
            const err1 = validateCombatGeometry({
                index: 1,
                duration: 2,
                attack: "@Li@ -> @Shen@",
            });
            assert.ok(err1.some((e) => e.includes("有攻击但无对手回应")));
            // Attack without target opponent
            const err2 = validateCombatGeometry({
                index: 2,
                duration: 2,
                attack: "wild punch",
                reaction: "dodge",
            });
            assert.ok(err2.some((e) => e.includes("攻击未指向具体对手")));
            // Visibility conflict: back to camera with facial expressions
            const err3 = validateCombatGeometry({
                index: 3,
                duration: 2,
                attack: "@A@ -> @B@",
                reaction: "@B@ block",
                visual: "背对镜头，嘴角浮现微笑",
            });
            assert.ok(err3.some((e) => e.includes("可见性矛盾")));
        });
    });
    // =========================================================================
    // 9. Provider-Driven Workflow Execution
    // =========================================================================
    describe("9. Provider-Driven Workflow Execution", () => {
        it("executes generation nodes using MockGenerationProvider", async () => {
            const store = new CanvasStore();
            const imgNode = createImageNode("prov_img", 0, 0, "Cyberpunk warrior");
            const vidNode = createVideoNode("prov_vid", 100, 0, "Warrior runs in rain");
            const audNode = createAudioNode("prov_aud", 200, 0, "Thunder prompt");
            store.createElement(imgNode);
            store.createElement(vidNode);
            store.createElement(audNode);
            const provider = new MockGenerationProvider("test_provider");
            const engine = new PipelineEngine();
            const imgRes = await engine.executeNode(imgNode.id, store, { provider });
            assert.equal(imgRes.ok, true);
            assert.ok(imgRes.assetId?.startsWith("test_provider_img_"));
            const vidRes = await engine.executeNode(vidNode.id, store, { provider });
            assert.equal(vidRes.ok, true);
            assert.ok(vidRes.assetId?.startsWith("test_provider_vid_"));
            const audRes = await engine.executeNode(audNode.id, store, { provider });
            assert.equal(audRes.ok, true);
            assert.ok(audRes.assetId?.startsWith("test_provider_aud_"));
        });
        it("runs entire workflow with provider end-to-end", async () => {
            const store = new CanvasStore();
            const img = createImageNode("wf_img", 0, 0, "Concept sketch");
            const vid = createVideoNode("wf_vid", 100, 0, "Action sequence");
            store.createElement(img);
            store.createElement(vid);
            store.connect({ id: "e_iv", fromNode: img.id, toNode: vid.id });
            const provider = new MockGenerationProvider("wf_prov");
            const engine = new PipelineEngine();
            const res = await engine.runWorkflow(store, { provider });
            assert.equal(res.ok, true);
            assert.deepEqual(res.executedNodes, ["wf_img", "wf_vid"]);
            assert.equal(store.getElementById("wf_img")?.status, "completed");
            assert.equal(store.getElementById("wf_vid")?.status, "completed");
        });
    });
});
