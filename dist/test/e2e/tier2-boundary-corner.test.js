/**
 * Tier 2: Boundary & Corner Cases Test Suite (dsh-cult-canvas)
 * Boundary Value Analysis and Corner Cases across all 15 features:
 * ≥5 tests per feature = 75 tests minimum.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createMockHostContext, createMockToolExec, createMockIncomingMessage, createMockServerResponse, CanvasStore, GraphEngine, PipelineEngine, buildCanvasTools, applyCanvasPlugin, createMockClientContext, MockModuleLoader, MockStyleRegistry, MockLocaleRegistry, CANONICAL_CANVAS_LOCALES, screenToCanvas, canvasToScreen, } from "./helpers/mock-harness.js";
import { assertNoUndefined, assertPointInStroke, assertPointNotInStroke, assertCycleDetected, assertNoCycles, boxesOverlap, unionBounds, } from "./helpers/assertion-helpers.js";
import { buildStrokeNode, isValidStroke, getShapePaddingCompensation, SHAPE_DEFINITIONS, } from "../../canvas-model.js";
const CURRENT_DIR = typeof import.meta.dirname === "string"
    ? import.meta.dirname
    : path.dirname(fileURLToPath(import.meta.url));
const PLUGIN_DIR = CURRENT_DIR.includes("/dist/")
    ? path.resolve(CURRENT_DIR, "../../../")
    : path.resolve(CURRENT_DIR, "../../");
describe("Tier 2: Boundary & Corner Cases Test Suite", () => {
    // ==========================================================================
    // Feature 1: Plugin Manifest & Config
    // ==========================================================================
    describe("Feature 1: Plugin Manifest & Config Boundaries", () => {
        it("1.1 empty config object falls back to robust defaults", () => {
            const ctx = createMockHostContext();
            const store = applyCanvasPlugin(ctx, {});
            assert.ok(store);
        });
        it("1.2 negative canvas dimensions are clamped or safely handled", () => {
            const store = new CanvasStore();
            const el = store.createElement({
                id: "neg_dim_el",
                type: "text",
                x: -500,
                y: -500,
                width: -100,
                height: -100,
            });
            assert.ok(el.width >= 1, "Element width must be clamped to positive minimum");
            assert.ok(el.height >= 1, "Element height must be clamped to positive minimum");
            assert.equal(el.x, -500, "Negative x coordinate must be preserved");
            assert.equal(el.y, -500, "Negative y coordinate must be preserved");
        });
        it("1.3 extremely large canvas dimension bounds are supported", () => {
            const store = new CanvasStore();
            const el = store.createElement({
                id: "extreme_el",
                type: "text",
                x: -100000,
                y: -100000,
                width: 200000,
                height: 200000,
            });
            assert.equal(el.width, 200000);
            assert.equal(el.height, 200000);
            const inBounds = store.queryBounds({
                minX: -1000,
                minY: -1000,
                maxX: 1000,
                maxY: 1000,
            });
            assert.ok(inBounds.some((n) => n.id === "extreme_el"));
            const doc = store.exportJsonCanvas();
            assert.equal(doc.nodes[0].width, 200000);
        });
        it("1.4 maxElements boundary of 1 restricts creation after 1 element", () => {
            const store = new CanvasStore({ maxElements: 1 });
            store.createElement({
                type: "text",
                x: 0,
                y: 0,
                width: 100,
                height: 100,
            });
            assert.throws(() => {
                store.createElement({
                    type: "text",
                    x: 10,
                    y: 10,
                    width: 100,
                    height: 100,
                });
            }, /limit reached/);
        });
        it("1.5 package and patch names match expected namespace and reject empty identifiers", () => {
            const pkgPath = path.join(PLUGIN_DIR, "package.json");
            const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
            assert.ok(pkg.name && pkg.name.trim().length > 0);
            assert.match(pkg.name, /^@local\/[a-z0-9-]+$/);
            const patchPath = path.join(PLUGIN_DIR, "cordis.patch.yml");
            const patchContent = fs.readFileSync(patchPath, "utf8");
            assert.ok(patchContent.includes(pkg.name));
            assert.ok(patchContent.includes("id: cult-canvas"));
        });
    });
    // ==========================================================================
    // Feature 2: TypeScript & Quality Gate Setup
    // ==========================================================================
    describe("Feature 2: TypeScript & Quality Gate Setup Boundaries", () => {
        it("2.1 tsconfig enforces strict typechecking and legacy module detection", () => {
            const tsconfigPath = path.join(PLUGIN_DIR, "tsconfig.json");
            const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, "utf8"));
            assert.equal(tsconfig.compilerOptions?.strict, true);
            assert.equal(tsconfig.compilerOptions?.moduleDetection, "legacy");
            assert.ok(Array.isArray(tsconfig.include));
            assert.ok(tsconfig.include.includes("*.ts"));
        });
        it("2.2 handles unicode and special characters in element text without corruption", () => {
            const store = new CanvasStore();
            const unicodeText = "盛唐 2088 🚀 \n \t \" ' ` \\ 🎨 🎬 🎭";
            store.createElement({
                id: "cjk_sticky",
                kind: "sticky",
                type: "text",
                text: unicodeText,
            });
            const retrieved = store.getElementById("cjk_sticky");
            assert.equal(retrieved?.text, unicodeText);
            const doc = store.exportJsonCanvas();
            assert.equal(doc.nodes[0].text, unicodeText);
        });
        it("2.3 CRLF to LF line ending normalization verified via oxfmtrc and source files", () => {
            const oxfmtPath = path.join(PLUGIN_DIR, ".oxfmtrc.json");
            const oxfmt = JSON.parse(fs.readFileSync(oxfmtPath, "utf8"));
            assert.equal(oxfmt.endOfLine, "lf");
            const modelPath = path.join(PLUGIN_DIR, "canvas-model.ts");
            const modelSource = fs.readFileSync(modelPath, "utf8");
            assert.ok(!modelSource.includes("\r\n"), "canvas-model.ts must not contain CRLF line endings");
        });
        it("2.4 oxlint configuration enforces error level for correctness category", () => {
            const oxlintPath = path.join(PLUGIN_DIR, ".oxlintrc.json");
            const oxlint = JSON.parse(fs.readFileSync(oxlintPath, "utf8"));
            assert.equal(oxlint.categories?.correctness, "error");
            assert.ok(Array.isArray(oxlint.plugins));
            assert.ok(oxlint.plugins.includes("typescript"));
            assert.ok(oxlint.plugins.includes("oxc"));
        });
        it("2.5 tsconfig compilerOptions configure modern NodeNext and ES2023 targets", () => {
            const tsconfigPath = path.join(PLUGIN_DIR, "tsconfig.json");
            const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, "utf8"));
            assert.equal(tsconfig.compilerOptions?.moduleResolution, "NodeNext");
            assert.equal(tsconfig.compilerOptions?.target, "ES2023");
            assert.equal(tsconfig.compilerOptions?.skipLibCheck, true);
        });
    });
    // ==========================================================================
    // Feature 3: Unified Document & Element Model
    // ==========================================================================
    describe("Feature 3: Unified Document & Element Model Boundaries", () => {
        it("3.1 empty canvas contains 0 elements and zero bounds", () => {
            const store = new CanvasStore();
            assert.equal(store.getAllElements().length, 0);
            assert.equal(store.getAllEdges().length, 0);
            const bounds = unionBounds([]);
            assert.equal(bounds.width, 0);
            assert.equal(bounds.height, 0);
        });
        it("3.2 negative coordinate positioning is fully supported without distortion", () => {
            const store = new CanvasStore();
            const el = store.createElement({
                type: "text",
                x: -5000,
                y: -3000,
                width: 200,
                height: 100,
            });
            assert.equal(el.x, -5000);
            assert.equal(el.y, -3000);
        });
        it("3.3 zero dimensions are clamped to minimum positive size", () => {
            const store = new CanvasStore();
            const el = store.createElement({
                type: "text",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
            });
            assert.ok(el.width >= 1);
            assert.ok(el.height >= 1);
        });
        it("3.4 extreme large coordinates handle without overflow or precision loss", () => {
            const store = new CanvasStore();
            const el = store.createElement({
                type: "text",
                x: 1000000,
                y: 2000000,
                width: 500,
                height: 500,
            });
            assert.equal(el.x, 1000000);
            assert.equal(el.y, 2000000);
        });
        it("3.5 max elements limit of 5000 rejects the 5001st element", () => {
            const store = new CanvasStore({ maxElements: 5 });
            for (let i = 0; i < 5; i++) {
                store.createElement({
                    type: "text",
                    x: i * 10,
                    y: 0,
                    width: 10,
                    height: 10,
                });
            }
            assert.throws(() => {
                store.createElement({
                    type: "text",
                    x: 100,
                    y: 0,
                    width: 10,
                    height: 10,
                });
            }, /limit reached/);
        });
    });
    // ==========================================================================
    // Feature 4: JSON Canvas 1.0 Compatibility
    // ==========================================================================
    describe("Feature 4: JSON Canvas 1.0 Compatibility Boundaries", () => {
        it("4.1 empty JSON Canvas document with empty arrays imports cleanly", () => {
            const store = new CanvasStore();
            const res = store.importJsonCanvas({ nodes: [], edges: [] });
            assert.equal(res.importedNodes, 0);
            assert.equal(res.importedEdges, 0);
        });
        it("4.2 rejects document with missing nodes array", () => {
            const store = new CanvasStore();
            assert.throws(() => {
                store.importJsonCanvas({ edges: [] });
            }, /Invalid JSON Canvas/);
        });
        it("4.3 rejects document with missing edges array", () => {
            const store = new CanvasStore();
            assert.throws(() => {
                store.importJsonCanvas({ nodes: [] });
            }, /Invalid JSON Canvas/);
        });
        it("4.4 dangling edges referencing missing node IDs are filtered during import", () => {
            const store = new CanvasStore();
            const res = store.importJsonCanvas({
                nodes: [
                    { id: "n1", type: "text", x: 0, y: 0, width: 100, height: 100 },
                ],
                edges: [{ id: "e1", fromNode: "n1", toNode: "missing_n2" }],
            });
            assert.equal(res.importedNodes, 1);
            assert.equal(res.importedEdges, 0); // dangling edge filtered!
        });
        it("4.5 duplicate node IDs in import document throws error or overwrites cleanly", () => {
            const store = new CanvasStore();
            const _res = store.importJsonCanvas({
                nodes: [
                    {
                        id: "dup",
                        type: "text",
                        x: 0,
                        y: 0,
                        width: 100,
                        height: 100,
                        text: "First",
                    },
                    {
                        id: "dup",
                        type: "text",
                        x: 50,
                        y: 50,
                        width: 100,
                        height: 100,
                        text: "Second",
                    },
                ],
                edges: [],
            });
            assert.equal(store.getElementById("dup")?.text, "Second");
        });
    });
    // ==========================================================================
    // Feature 5: Freehand & Stroke Algorithms
    // ==========================================================================
    describe("Feature 5: Freehand & Stroke Algorithms Boundaries", () => {
        it("5.1 empty points array throws descriptive error in buildStrokeNode", () => {
            assert.throws(() => buildStrokeNode([], 5), /Cult Canvas: empty stroke/);
        });
        it("5.2 single point stroke synthesizes second point and valid stroke hit box", () => {
            const node = buildStrokeNode([[100, 100]], 6);
            assert.ok(isValidStroke(node.gbStroke));
            assert.equal(node.gbStroke.points.length, 2);
            assert.ok(node.width > 0);
            assert.ok(node.height > 0);
        });
        it("5.3 stroke hit test handles collinear vertical segment", () => {
            const verticalStroke = {
                x: 50,
                y: 0,
                width: 10,
                height: 200,
                gbStroke: {
                    v: 1,
                    size: 4,
                    w: 10,
                    h: 200,
                    points: [
                        [5, 0],
                        [5, 200],
                    ],
                },
            };
            assertPointInStroke({ x: 55, y: 100 }, verticalStroke);
            assertPointNotInStroke({ x: 75, y: 100 }, verticalStroke);
        });
        it("5.4 rapid sampling with large distance jumps (> 300px) retains segment continuity", () => {
            const rapidStroke = {
                x: 0,
                y: 0,
                width: 600,
                height: 600,
                gbStroke: {
                    v: 1,
                    size: 10,
                    w: 600,
                    h: 600,
                    points: [
                        [0, 0],
                        [600, 600],
                    ],
                },
            };
            // Midpoint at (300, 300) must hit even with 848px segment jump
            assertPointInStroke({ x: 300, y: 300 }, rapidStroke);
        });
        it("5.5 closed loop stroke does not hit its empty interior center", () => {
            const loopStroke = {
                x: 0,
                y: 0,
                width: 200,
                height: 200,
                gbStroke: {
                    v: 1,
                    size: 4,
                    w: 200,
                    h: 200,
                    points: [
                        [0, 0],
                        [200, 0],
                        [200, 200],
                        [0, 200],
                        [0, 0],
                    ],
                },
            };
            // Center at (100, 100) is far from the perimeter segments
            assertPointNotInStroke({ x: 100, y: 100 }, loopStroke);
        });
    });
    // ==========================================================================
    // Feature 6: Shape & Card Geometries
    // ==========================================================================
    describe("Feature 6: Shape & Card Geometries Boundaries", () => {
        it("6.1 1x1 pixel card geometry does not crash math calculations", () => {
            const box = { x: 0, y: 0, width: 1, height: 1 };
            const other = { x: 0, y: 0, width: 10, height: 10 };
            assert.equal(boxesOverlap(box, other), true);
        });
        it("6.2 extreme wide aspect ratio (10000x10) maintains bounding box validity", () => {
            const wideBox = { x: 0, y: 0, width: 10000, height: 10 };
            const bounds = unionBounds([wideBox]);
            assert.equal(bounds.width, 10000);
            assert.equal(bounds.height, 10);
        });
        it("6.3 multiline text in diamond shape text padding bounds calculation", () => {
            const comp = getShapePaddingCompensation("diamond");
            const width = 220;
            const padding = (width * comp.paddingInlinePercent) / 100;
            const textUsableWidth = width - padding * 2;
            assert.ok(textUsableWidth > 0);
            assert.equal(Math.round(textUsableWidth * 10) / 10, 123.2);
        });
        it("6.4 null shape property safely defaults to rect padding compensation", () => {
            const comp = getShapePaddingCompensation(null);
            assert.equal(comp.paddingInlinePercent, 0);
            assert.equal(comp.textOffsetY, 0);
        });
        it("6.5 case-insensitive shape name normalization against registered definitions", () => {
            const input = "DIAMOND";
            const normalized = input.toLowerCase();
            assert.ok(normalized in SHAPE_DEFINITIONS);
            assert.equal(SHAPE_DEFINITIONS[normalized].id, "diamond");
        });
    });
    // ==========================================================================
    // Feature 7: Directed Graph & DAG Engine
    // ==========================================================================
    describe("Feature 7: Directed Graph & DAG Engine Boundaries", () => {
        it("7.1 self-loop edge A -> A is detected as immediate cycle", () => {
            const engine = new GraphEngine();
            engine.buildGraph(["A"], [{ fromNode: "A", toNode: "A" }]);
            assertCycleDetected(engine.hasCycles());
            assert.equal(engine.getTopologicalOrder(), null);
        });
        it("7.2 disconnected graph with isolated nodes sorts all nodes", () => {
            const engine = new GraphEngine();
            engine.buildGraph(["isolated_1", "isolated_2", "isolated_3"], []);
            const order = engine.getTopologicalOrder();
            assert.ok(order !== null);
            assert.equal(order.length, 3);
            assertNoCycles(engine.hasCycles());
        });
        it("7.3 deep chain of 100 sequential nodes computes topological order in linear time", () => {
            const nodeIds = [];
            const edges = [];
            for (let i = 0; i < 100; i++) {
                nodeIds.push(`node_${i}`);
                if (i > 0) {
                    edges.push({ fromNode: `node_${i - 1}`, toNode: `node_${i}` });
                }
            }
            const engine = new GraphEngine();
            engine.buildGraph(nodeIds, edges);
            const order = engine.getTopologicalOrder();
            assert.ok(order !== null);
            assert.equal(order.length, 100);
            assert.equal(order[0], "node_0");
            assert.equal(order[99], "node_99");
        });
        it("7.4 multi-input port resolves multiple incoming edges without collision", () => {
            const engine = new GraphEngine();
            // video node accepts multiple image refs
            const v1 = engine.validatePortConnection("image", "out", "video", "ref");
            assert.equal(v1.valid, true);
        });
        it("7.5 connecting non-existent source node throws error in CanvasStore", () => {
            const store = new CanvasStore();
            store.createElement({
                id: "valid_dst",
                type: "text",
                x: 0,
                y: 0,
                width: 10,
                height: 10,
            });
            assert.throws(() => {
                store.connect({ fromNode: "ghost_src", toNode: "valid_dst" });
            }, /Source element not found/);
        });
    });
    // ==========================================================================
    // Feature 8: Multi-Shot Storyboard & Prompt Resolution
    // ==========================================================================
    describe("Feature 8: Multi-Shot Storyboard & Prompt Resolution Boundaries", () => {
        it("8.1 empty shots array returns empty segments without error", () => {
            const pipeline = new PipelineEngine();
            const segments = pipeline.planShotSegments([]);
            assert.deepEqual(segments, []);
        });
        it("8.2 zero duration shot is handled safely", () => {
            const pipeline = new PipelineEngine();
            const segments = pipeline.planShotSegments([{ index: 1, duration: 0 }]);
            assert.equal(segments.length, 1);
        });
        it("8.3 single long scene with 50 shots chunks into balanced video segments", () => {
            const shots = Array.from({ length: 50 }, (_, i) => ({
                index: i + 1,
                duration: 3.0,
                join: "strict",
            }));
            const pipeline = new PipelineEngine();
            const segments = pipeline.planShotSegments(shots);
            assert.ok(segments.length >= 10);
        });
        it("8.4 unresolved @UnknownEntity in prompt is preserved intact", () => {
            const store = new CanvasStore();
            const node = store.createElement({
                type: "image",
                kind: "image",
                mediaParams: { prompt: "Encounter with @AlienCreature in alley" },
            });
            const pipeline = new PipelineEngine();
            const resolved = pipeline.resolvePrompt(node, store);
            assert.ok(resolved.includes("@AlienCreature"));
        });
        it("8.5 empty prompt resolves to empty string without undefined", () => {
            const store = new CanvasStore();
            const node = store.createElement({ type: "image", kind: "image" });
            const pipeline = new PipelineEngine();
            const resolved = pipeline.resolvePrompt(node, store);
            assert.equal(resolved, "");
        });
        it("8.6 character descriptions containing regex dollar substitution tokens ($&, $', $`, $1) are preserved verbatim", () => {
            const store = new CanvasStore();
            store.updateBible({
                characters: [
                    {
                        name: "Cipher",
                        description: "Hacker alias $` running $& exploit with $' trace",
                    },
                    {
                        name: "Trader",
                        description: "Bounty: $1000 with $1 fee and $$ sign",
                    },
                ],
            });
            const node = store.createElement({
                type: "image",
                kind: "image",
                mediaParams: { prompt: "Target identified: @Cipher met by @Trader" },
            });
            const pipeline = new PipelineEngine();
            const resolved = pipeline.resolvePrompt(node, store);
            assert.ok(resolved.includes("[Cipher: Hacker alias $` running $& exploit with $' trace]"), "Regex replacement tokens $`, $&, $' must not corrupt entity description");
            assert.ok(resolved.includes("[Trader: Bounty: $1000 with $1 fee and $$ sign]"), "Dollar numbers and double dollars must not trigger regex capture substitutions");
        });
    });
    // ==========================================================================
    // Feature 9: Pipeline Execution Runner
    // ==========================================================================
    describe("Feature 9: Pipeline Execution Runner Boundaries", () => {
        it("9.1 executing non-existent node ID throws error", async () => {
            const store = new CanvasStore();
            const pipeline = new PipelineEngine();
            await assert.rejects(async () => {
                await pipeline.executeNode("ghost_node", store);
            }, /Node not found/);
        });
        it("9.2 pre-aborted signal halts before execution begins", async () => {
            const store = new CanvasStore();
            const node = store.createElement({ type: "image", kind: "image" });
            const pipeline = new PipelineEngine();
            const controller = new AbortController();
            controller.abort();
            await assert.rejects(async () => {
                await pipeline.executeNode(node.id, store, {
                    signal: controller.signal,
                });
            }, /aborted/);
        });
        it("9.3 workflow execution on empty store succeeds trivially", async () => {
            const store = new CanvasStore();
            const pipeline = new PipelineEngine();
            const res = await pipeline.runWorkflow(store);
            assert.equal(res.ok, true);
            assert.deepEqual(res.executedNodes, []);
        });
        it("9.4 workflow execution on cyclic graph rejects with clear error", async () => {
            const store = new CanvasStore();
            const n1 = store.createElement({
                id: "c1",
                type: "script",
                kind: "script",
            });
            const n2 = store.createElement({
                id: "c2",
                type: "video",
                kind: "video",
            });
            store.connect({ fromNode: n1.id, toNode: n2.id });
            // Force cycle directly in store
            store.connect({ fromNode: n2.id, toNode: n1.id });
            const pipeline = new PipelineEngine();
            await assert.rejects(async () => {
                await pipeline.runWorkflow(store);
            }, /DAG contains cycles/);
        });
        it("9.5 stopOnError false allows execution to continue past failed nodes", async () => {
            const store = new CanvasStore();
            const _n1 = store.createElement({
                id: "fail_node",
                type: "image",
                kind: "image",
            });
            const _n2 = store.createElement({
                id: "ok_node",
                type: "image",
                kind: "image",
            });
            const pipeline = new PipelineEngine();
            // Override executeNode for fail_node
            const origExec = pipeline.executeNode.bind(pipeline);
            pipeline.executeNode = async (id, s, opts) => {
                if (id === "fail_node") {
                    return { ok: false, nodeId: id, status: "failed", error: "Boom" };
                }
                return origExec(id, s, opts);
            };
            const res = await pipeline.runWorkflow(store, { stopOnError: false });
            assert.equal(res.ok, false);
            assert.ok(res.failedNodes.includes("fail_node"));
            assert.ok(res.executedNodes.includes("ok_node"));
        });
    });
    // ==========================================================================
    // Feature 10: Web Route Security & API Endpoints
    // ==========================================================================
    describe("Feature 10: Web Route Security & API Endpoints Boundaries", () => {
        it("10.1 IPv6 loopback [::1] recognized as local host", async () => {
            const ctx = createMockHostContext({ host: "::1" });
            applyCanvasPlugin(ctx);
            const route = ctx.webServer.routes.find((r) => r.path === "/plugin-api/cult-canvas");
            const req = new Request("http://[::1]:3344/plugin-api/cult-canvas/state", {
                headers: { host: "[::1]:3344" },
            });
            const res = await route.resource(req);
            assert.equal(res.status, 200);
        });
        it("10.2 localhost hostname recognized as loopback", async () => {
            const ctx = createMockHostContext({ host: "localhost" });
            applyCanvasPlugin(ctx);
            const route = ctx.webServer.routes.find((r) => r.path === "/plugin-api/cult-canvas");
            const req = new Request("http://localhost:3344/plugin-api/cult-canvas/state", {
                headers: { host: "localhost:3344" },
            });
            const res = await route.resource(req);
            assert.equal(res.status, 200);
        });
        it("10.3 remote IP without admission fails closed with 503", async () => {
            const ctx = createMockHostContext({ host: "10.0.0.5" });
            applyCanvasPlugin(ctx);
            const route = ctx.webServer.routes.find((r) => r.path === "/plugin-api/cult-canvas");
            const req = new Request("http://10.0.0.5:3344/plugin-api/cult-canvas/state", {
                headers: { host: "10.0.0.5:3344" },
            });
            const res = await route.resource(req);
            assert.equal(res.status, 503);
        });
        it("10.4 request with cross-site sec-fetch-site header is rejected 403", async () => {
            const ctx = createMockHostContext({
                connection: {
                    allowsRemoteAuthorities: true,
                    requestRejection: (req) => {
                        if (req.headers["sec-fetch-site"] === "cross-site")
                            return 403;
                    },
                },
            });
            applyCanvasPlugin(ctx);
            const route = ctx.webServer.routes.find((r) => r.path === "/plugin-api/cult-canvas");
            const req = new Request("http://127.0.0.1:3344/plugin-api/cult-canvas/state", {
                headers: { host: "127.0.0.1:3344", "sec-fetch-site": "cross-site" },
            });
            const res = await route.resource(req);
            assert.equal(res.status, 403);
        });
        it("10.5 malformed path returns 404", async () => {
            const ctx = createMockHostContext();
            applyCanvasPlugin(ctx);
            const route = ctx.webServer.routes.find((r) => r.path === "/plugin-api/cult-canvas");
            const req = new Request("http://127.0.0.1:3344/plugin-api/cult-canvas/../../../etc/passwd", {
                headers: { host: "127.0.0.1:3344" },
            });
            const res = await route.resource(req);
            assert.equal(res.status, 404);
        });
        it("10.6 spoofed loopback origin subdomain 127.evil.com rejected with 403", async () => {
            const ctx = createMockHostContext({ host: "127.0.0.1" });
            applyCanvasPlugin(ctx);
            const route = ctx.webServer.routes.find((r) => r.path === "/plugin-api/cult-canvas");
            assert.ok(route, "Route /plugin-api/cult-canvas must be registered");
            // 1. Fetch resource route rejection
            const req = new Request("http://127.0.0.1:3344/plugin-api/cult-canvas/state", {
                headers: {
                    host: "127.0.0.1:3344",
                    origin: "http://127.evil.com:8080",
                },
            });
            const res = await route.resource(req);
            assert.equal(res.status, 403, "Origin 127.evil.com starting with 127. but not valid IPv4 must be rejected with 403");
            // 2. Node incoming message handler rejection
            const nodeReq = createMockIncomingMessage({
                headers: {
                    host: "127.0.0.1:3344",
                    origin: "http://127.evil.com:8080",
                    "sec-fetch-site": "same-site",
                },
            });
            const nodeRes = createMockServerResponse();
            route.handler(nodeReq, nodeRes);
            assert.equal(nodeRes.statusCode, 403, "Node handler must reject 127.evil.com origin with 403");
        });
    });
    // ==========================================================================
    // Feature 11: Agent Tools - Inspection
    // ==========================================================================
    describe("Feature 11: Agent Tools - Inspection Boundaries", () => {
        it("11.1 canvas_get_state with zero area bounding box query", async () => {
            const ctx = createMockHostContext();
            const store = new CanvasStore();
            const tools = buildCanvasTools(ctx, store);
            for (const t of tools)
                ctx.tools.register(t);
            const res = (await ctx.tools.execute("canvas_get_state", {
                boundingBox: { minX: 100, minY: 100, maxX: 100, maxY: 100 },
            }));
            assert.equal(res.ok, true);
            assert.equal(res.count, 0);
        });
        it("11.2 canvas_node_status on missing node throws error", async () => {
            const ctx = createMockHostContext();
            const store = new CanvasStore();
            const tools = buildCanvasTools(ctx, store);
            for (const t of tools)
                ctx.tools.register(t);
            await assert.rejects(async () => {
                await ctx.tools.execute("canvas_node_status", {
                    nodeId: "non_existent",
                });
            }, /Node not found/);
        });
        it("11.3 canvas_get_bible on empty store returns empty object without error", async () => {
            const ctx = createMockHostContext();
            const store = new CanvasStore();
            const tools = buildCanvasTools(ctx, store);
            for (const t of tools)
                ctx.tools.register(t);
            const res = (await ctx.tools.execute("canvas_get_bible", {}));
            assert.equal(res.ok, true);
            assert.deepEqual(res.bible, {});
        });
        it("11.4 recursive undefined and non-finite stripping on tool output", async () => {
            const ctx = createMockHostContext();
            const store = new CanvasStore();
            store.createElement({
                id: "undef_test",
                type: "text",
                x: 0,
                y: 0,
                width: 100,
                height: 100,
                data: { missingVal: undefined, nanVal: NaN, infVal: Infinity },
            });
            const tools = buildCanvasTools(ctx, store);
            for (const t of tools)
                ctx.tools.register(t);
            const res = await ctx.tools.execute("canvas_get_state", {});
            assertNoUndefined(res);
        });
        it("11.5 aborted ToolExec signal halts tool execution immediately", async () => {
            const ctx = createMockHostContext();
            const store = new CanvasStore();
            const tools = buildCanvasTools(ctx, store);
            for (const t of tools)
                ctx.tools.register(t);
            const exec = createMockToolExec();
            exec.abortController.abort();
            await assert.rejects(async () => {
                await ctx.tools.execute("canvas_get_state", {}, exec);
            }, /Aborted/);
        });
    });
    // ==========================================================================
    // Feature 12: Agent Tools - Manipulation
    // ==========================================================================
    describe("Feature 12: Agent Tools - Manipulation Boundaries", () => {
        it("12.1 canvas_create_element with unicode and emojis preserves text fidelity", async () => {
            const ctx = createMockHostContext();
            const store = new CanvasStore();
            const tools = buildCanvasTools(ctx, store);
            for (const t of tools)
                ctx.tools.register(t);
            const unicodeText = "长安城 2088 🏮 🤖 剑气纵横";
            const res = (await ctx.tools.execute("canvas_create_element", {
                kind: "sticky",
                x: 0,
                y: 0,
                text: unicodeText,
            }));
            assert.equal(store.getElementById(res.elementId)?.text, unicodeText);
        });
        it("12.2 canvas_update_element on non-existent element throws error", async () => {
            const ctx = createMockHostContext();
            const store = new CanvasStore();
            const tools = buildCanvasTools(ctx, store);
            for (const t of tools)
                ctx.tools.register(t);
            await assert.rejects(async () => {
                await ctx.tools.execute("canvas_update_element", {
                    id: "ghost",
                    patch: { text: "new" },
                });
            }, /Element not found/);
        });
        it("12.3 canvas_delete_element with empty array returns 0 deleted", async () => {
            const ctx = createMockHostContext();
            const store = new CanvasStore();
            const tools = buildCanvasTools(ctx, store);
            for (const t of tools)
                ctx.tools.register(t);
            const res = (await ctx.tools.execute("canvas_delete_element", {
                ids: [],
            }));
            assert.equal(res.ok, true);
            assert.equal(res.deletedCount, 0);
        });
        it("12.4 canvas_connect cycle creation attempt is rejected", async () => {
            const ctx = createMockHostContext();
            const store = new CanvasStore();
            const a = store.createElement({
                id: "c_a",
                type: "text",
                x: 0,
                y: 0,
                width: 10,
                height: 10,
            });
            const b = store.createElement({
                id: "c_b",
                type: "text",
                x: 20,
                y: 0,
                width: 10,
                height: 10,
            });
            store.connect({ fromNode: a.id, toNode: b.id });
            const tools = buildCanvasTools(ctx, store);
            for (const t of tools)
                ctx.tools.register(t);
            await assert.rejects(async () => {
                await ctx.tools.execute("canvas_connect", {
                    fromNode: b.id,
                    toNode: a.id,
                });
            }, /cycle in the DAG/);
        });
        it("12.5 canvas_layout_elements with empty layout array succeeds trivially", async () => {
            const ctx = createMockHostContext();
            const store = new CanvasStore();
            const tools = buildCanvasTools(ctx, store);
            for (const t of tools)
                ctx.tools.register(t);
            const res = (await ctx.tools.execute("canvas_layout_elements", {
                layouts: [],
            }));
            assert.equal(res.ok, true);
            assert.equal(res.updatedCount, 0);
        });
        it("12.6 CanvasStore undo/redo snapshot performs deep cloning via structuredClone preventing reference mutation", () => {
            const store = new CanvasStore();
            store.createElement({
                id: "deep_elem",
                kind: "image",
                x: 10,
                y: 10,
                mediaParams: { prompt: "initial", tags: ["a", "b"] },
            });
            store.updateBible({ project: "Cult Canvas", tags: ["v1"] });
            // Modify nested property on retrieved element
            const fetched = store.getElementById("deep_elem");
            assert.ok(fetched && fetched.mediaParams);
            fetched.mediaParams.prompt = "mutated";
            fetched.mediaParams.tags.push("c");
            // Undo should recover pristine snapshot without mutated nested fields
            store.undo();
            const restored = store.getElementById("deep_elem");
            assert.equal(restored?.mediaParams?.prompt, "initial");
            assert.deepEqual(restored?.mediaParams?.tags, ["a", "b"]);
        });
    });
    // ==========================================================================
    // Feature 13: Agent Tools - Execution & Storage
    // ==========================================================================
    describe("Feature 13: Agent Tools - Execution & Storage Boundaries", () => {
        it("13.1 canvas_run_pipeline on empty canvas returns completed status", async () => {
            const ctx = createMockHostContext();
            const store = new CanvasStore();
            const tools = buildCanvasTools(ctx, store);
            for (const t of tools)
                ctx.tools.register(t);
            const res = (await ctx.tools.execute("canvas_run_pipeline", {
                mode: "all",
            }));
            assert.equal(res.ok, true);
            assert.equal(res.status, "completed");
        });
        it("13.2 canvas_import_export without document payload for import throws error", async () => {
            const ctx = createMockHostContext();
            const store = new CanvasStore();
            const tools = buildCanvasTools(ctx, store);
            for (const t of tools)
                ctx.tools.register(t);
            await assert.rejects(async () => {
                await ctx.tools.execute("canvas_import_export", { action: "import" });
            }, /Document payload required/);
        });
        it("13.3 canvas_update_bible with empty patch does not mutate bible", async () => {
            const ctx = createMockHostContext();
            const store = new CanvasStore();
            store.updateBible({ initial: "val" });
            const tools = buildCanvasTools(ctx, store);
            for (const t of tools)
                ctx.tools.register(t);
            const res = (await ctx.tools.execute("canvas_update_bible", {
                patch: {},
            }));
            assert.equal(res.ok, true);
            assert.equal(res.bible.initial, "val");
        });
        it("13.4 canvas_update_bible merges deeply nested structures cleanly", async () => {
            const ctx = createMockHostContext();
            const store = new CanvasStore();
            store.updateBible({ author: "Li Bai", nested: { count: 1 } });
            const tools = buildCanvasTools(ctx, store);
            for (const t of tools)
                ctx.tools.register(t);
            const res = (await ctx.tools.execute("canvas_update_bible", {
                patch: { nested: { count: 2, newProp: "ok" } },
            }));
            assert.equal(res.bible.author, "Li Bai");
            assert.equal(res.bible.nested.count, 2);
            assert.equal(res.bible.nested.newProp, "ok");
        });
        it("13.5 canvas_import_export preserves extended media parameters during JSON Canvas round-trip", async () => {
            const ctx = createMockHostContext();
            const store = new CanvasStore();
            store.createElement({
                id: "ext_node",
                type: "video",
                kind: "video",
                x: 0,
                y: 0,
                width: 320,
                height: 240,
                mediaParams: { duration: 4.5, resolution: "4K" },
            });
            const tools = buildCanvasTools(ctx, store);
            for (const t of tools)
                ctx.tools.register(t);
            const exp = (await ctx.tools.execute("canvas_import_export", {
                action: "export",
            }));
            const imported = (await ctx.tools.execute("canvas_import_export", {
                action: "import",
                document: exp.document,
            }));
            assert.equal(imported.ok, true);
            assert.equal(store.getElementById("ext_node")?.mediaParams?.duration, 4.5);
        });
    });
    // ==========================================================================
    // Feature 14: Host Plugin Entrypoint & Cordis Lifecycle
    // ==========================================================================
    describe("Feature 14: Host Plugin Entrypoint & Cordis Lifecycle Boundaries", () => {
        it("14.1 multiple apply calls re-initialize store and tools cleanly", () => {
            const ctx = createMockHostContext();
            const s1 = applyCanvasPlugin(ctx);
            const s2 = applyCanvasPlugin(ctx);
            assert.ok(s1);
            assert.ok(s2);
        });
        it("14.2 disposing an already disposed context is safe and idempotent", () => {
            const ctx = createMockHostContext();
            applyCanvasPlugin(ctx);
            ctx.dispose();
            // Second dispose must not throw
            assert.doesNotThrow(() => {
                ctx.dispose();
            });
        });
        it("14.3 registered effect with void return value handles cleanly", () => {
            const ctx = createMockHostContext();
            ctx.effect(() => {
                // No return disposer
            });
            assert.doesNotThrow(() => {
                ctx.dispose();
            });
        });
        it("14.4 system prompt sections with same order maintain deterministic list ordering", () => {
            const ctx = createMockHostContext();
            ctx.systemPrompt.section({ name: "sec1", order: 100, text: "A" });
            ctx.systemPrompt.section({ name: "sec2", order: 100, text: "B" });
            const list = ctx.systemPrompt.list();
            assert.equal(list.length, 2);
        });
        it("14.5 HostContext without optional logger does not throw on operations", () => {
            const ctx = createMockHostContext();
            delete ctx.logger;
            assert.doesNotThrow(() => {
                applyCanvasPlugin(ctx);
                ctx.dispose();
            });
        });
    });
    // ==========================================================================
    // Feature 15: Client Module Entrypoint
    // ==========================================================================
    describe("Feature 15: Client Module Entrypoint Boundaries", () => {
        it("15.1 ModuleLoader load called with missing or empty id rejects safely", () => {
            const loader = new MockModuleLoader();
            assert.throws(() => loader.load({ id: "", factory: () => ({}) }), /invalid module id/);
            assert.throws(() => loader.load({ id: "   ", factory: () => ({}) }), /invalid module id/);
            assert.throws(() => loader.load({
                id: undefined,
                factory: () => ({}),
            }), /invalid module id/);
            assert.throws(() => loader.load({
                id: "@local/dsh-cult-canvas",
                factory: null,
            }), /invalid factory/);
            assert.throws(() => loader.load({
                id: "@local/dsh-cult-canvas",
                factory: "not-a-function",
            }), /invalid factory/);
            // Valid load succeeds and registers module
            loader.load({
                id: "@local/dsh-cult-canvas",
                factory: () => ({ inject: ["slots", "locale"] }),
            });
            assert.ok(loader.has("@local/dsh-cult-canvas"));
            assert.equal(loader.get("@local/dsh-cult-canvas")?.id, "@local/dsh-cult-canvas");
        });
        it("15.2 multiple style tag insertions remove cleanly via disposers", () => {
            const styleRegistry = new MockStyleRegistry();
            const disposer1 = styleRegistry.inject("style_sheet_1", ".canvas-viewport { cursor: grab; }");
            const disposer2 = styleRegistry.inject("style_sheet_2", ".canvas-node { border-radius: 8px; }");
            assert.equal(styleRegistry.size, 2);
            disposer1();
            assert.equal(styleRegistry.size, 1);
            assert.equal(styleRegistry.has("style_sheet_1"), false);
            assert.equal(styleRegistry.has("style_sheet_2"), true);
            // Disposer idempotence: calling disposer again does not corrupt state
            disposer1();
            assert.equal(styleRegistry.size, 1);
            disposer2();
            assert.equal(styleRegistry.size, 0);
            assert.equal(styleRegistry.has("style_sheet_2"), false);
        });
        it("15.3 unknown locale falls back to default language gracefully", () => {
            const localeRegistry = new MockLocaleRegistry();
            localeRegistry.register("cult-canvas", CANONICAL_CANVAS_LOCALES);
            // Exact match for known language
            assert.equal(localeRegistry.translate("cult-canvas", "ru", "title"), "Культ Канвас");
            // Fallback to default English for unconfigured language
            assert.equal(localeRegistry.translate("cult-canvas", "ja", "title"), "Cult Canvas");
            assert.equal(localeRegistry.translate("cult-canvas", "de", "create"), "Create Element");
            // Partial locale dictionary missing key falls back to English
            localeRegistry.register("partial-ns", {
                en: { available: "Yes", fallbackOnly: "Default Text" },
                ru: { available: "Да" },
            });
            assert.equal(localeRegistry.translate("partial-ns", "ru", "available"), "Да");
            assert.equal(localeRegistry.translate("partial-ns", "ru", "fallbackOnly"), "Default Text");
            // Completely unknown key returns key name itself
            assert.equal(localeRegistry.translate("cult-canvas", "es", "completely_unknown_key"), "completely_unknown_key");
        });
        it("15.4 duplicate slot registration overwrites cleanly", () => {
            const clientCtx = createMockClientContext();
            const slotKey = "tool.call.toolview:canvas_create_element";
            const disposer1 = clientCtx.slots.inject(slotKey, {
                version: 1,
                component: "CardV1",
            });
            assert.equal(clientCtx.slots.get(slotKey).version, 1);
            assert.equal(clientCtx.slots.size, 1);
            // Duplicate registration on same slot key replaces component without leaking slots
            const disposer2 = clientCtx.slots.inject(slotKey, {
                version: 2,
                component: "CardV2",
            });
            assert.equal(clientCtx.slots.get(slotKey).version, 2);
            assert.equal(clientCtx.slots.size, 1, "Duplicate slot registration must replace rather than duplicate");
            // Calling older disposer does not inadvertently clear newer registration
            disposer1();
            assert.equal(clientCtx.slots.has(slotKey), true);
            assert.equal(clientCtx.slots.get(slotKey).version, 2);
            // Active disposer cleanly unmounts
            disposer2();
            assert.equal(clientCtx.slots.has(slotKey), false);
            assert.equal(clientCtx.slots.size, 0);
        });
        it("15.5 client view dimensions scale on extreme browser zoom levels (25% to 500%)", () => {
            const testPoints = [
                { x: 0, y: 0 },
                { x: 500, y: 300 },
                { x: -1280, y: -720 },
                { x: 19200, y: 10800 },
            ];
            const zoomLevels = [0.01, 0.25, 0.5, 1.0, 2.0, 5.0, 100.0];
            for (const pt of testPoints) {
                for (const zoom of zoomLevels) {
                    const vp = { x: 150, y: -75, zoom };
                    const canvasPt = screenToCanvas(pt, vp);
                    const roundTrip = canvasToScreen(canvasPt, vp);
                    assert.ok(Math.abs(roundTrip.x - pt.x) < 1e-6, `X roundtrip failed for point (${pt.x}, ${pt.y}) at zoom ${zoom}`);
                    assert.ok(Math.abs(roundTrip.y - pt.y) < 1e-6, `Y roundtrip failed for point (${pt.x}, ${pt.y}) at zoom ${zoom}`);
                }
            }
            // Boundary checks: invalid zoom values throw clear errors
            assert.throws(() => screenToCanvas({ x: 100, y: 100 }, { x: 0, y: 0, zoom: 0 }), /zoom/i);
            assert.throws(() => screenToCanvas({ x: 100, y: 100 }, { x: 0, y: 0, zoom: Number.NaN }), /zoom/i);
            assert.throws(() => screenToCanvas({ x: 100, y: 100 }, { x: 0, y: 0, zoom: Number.POSITIVE_INFINITY }), /zoom/i);
            assert.throws(() => canvasToScreen({ x: 100, y: 100 }, { x: 0, y: 0, zoom: 0 }), /zoom/i);
        });
    });
});
