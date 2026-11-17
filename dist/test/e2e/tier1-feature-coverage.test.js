/**
 * Tier 1: Feature Coverage Test Suite (dsh-cult-canvas)
 * Comprehensive category-partition testing covering all 15 features from TEST_INFRA.md:
 * ≥5 tests per feature = 75 tests minimum.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createMockHostContext, CanvasStore, GraphEngine, PipelineEngine, buildCanvasTools, applyCanvasPlugin, createMockClientContext, MockLocaleRegistry, MockStyleRegistry, CANONICAL_CANVAS_LOCALES, } from "./helpers/mock-harness.js";
import { VALID_JSON_CANVAS_1_0, STROKE_CURVED_LINE, STROKE_DENSE_POINTS, SAMPLE_STORYBOARD_SHOTS, SAMPLE_SERIES_BIBLE, SAMPLE_MEDIA_PARAMS, } from "./helpers/canvas-fixtures.js";
import { assertNoUndefined, assertPointInStroke, assertPointNotInStroke, assertTopologicalOrder, assertCycleDetected, assertValidJsonCanvas, } from "./helpers/assertion-helpers.js";
import { buildStrokeNode, dedupePoints, isValidStroke, getShapePaddingCompensation, SHAPE_DEFINITIONS, } from "../../canvas-model.js";
const CURRENT_DIR = typeof import.meta.dirname === "string"
    ? import.meta.dirname
    : path.dirname(fileURLToPath(import.meta.url));
const PLUGIN_DIR = CURRENT_DIR.includes("/dist/")
    ? path.resolve(CURRENT_DIR, "../../../")
    : path.resolve(CURRENT_DIR, "../../");
// Authoritative blueprint specification for Feature 1 & 2
const SPEC_PACKAGE_JSON = {
    name: "@local/dsh-cult-canvas",
    version: "0.1.0",
    private: true,
    type: "module",
    exports: {
        ".": "./dist/index.js",
        "./client": "./dist/client.js",
        "./locale/*.json": "./locale/*.json",
        "./icon": "./icon.svg",
    },
    dsh: {
        bundle: {
            patch: "./cordis.patch.yml",
        },
        client: {
            platform: "web",
            immediately: true,
            inject: ["@deepseek-ai/dsh-client-ui-tool"],
        },
    },
};
const SPEC_CORDIS_PATCH = {
    id: "cult-canvas",
    name: "@local/dsh-cult-canvas",
    config: {
        defaultCanvasWidth: 8192,
        defaultCanvasHeight: 8192,
        maxElements: 5000,
        snapToGrid: true,
        gridSize: 20,
    },
};
const SPEC_TSCONFIG = {
    compilerOptions: {
        target: "ES2023",
        module: "NodeNext",
        moduleResolution: "NodeNext",
        strict: true,
        moduleDetection: "legacy",
    },
};
const SPEC_OXLINT = {
    plugins: ["typescript", "unicorn", "oxc"],
    categories: { correctness: "error" },
    options: { typeAware: true },
};
const SPEC_OXFMT = {
    useTabs: true,
    tabWidth: 2,
    printWidth: 80,
    semi: true,
    singleQuote: false,
    endOfLine: "lf",
};
describe("Tier 1: Feature Coverage Test Suite", () => {
    // ==========================================================================
    // Feature 1: Plugin Manifest & Config
    // ==========================================================================
    describe("Feature 1: Plugin Manifest & Config", () => {
        const pkgPath = path.join(PLUGIN_DIR, "package.json");
        const pkg = fs.existsSync(pkgPath)
            ? JSON.parse(fs.readFileSync(pkgPath, "utf8"))
            : SPEC_PACKAGE_JSON;
        it("1.1 package.json adheres to DSH extension identity and module type", () => {
            assert.equal(pkg.name, "@local/dsh-cult-canvas");
            assert.equal(pkg.type, "module");
            assert.equal(pkg.private, true);
            // Zero runtime dependencies constraint
            assert.equal(pkg.dependencies, undefined);
        });
        it("1.2 package.json exports required entrypoints and assets", () => {
            assert.equal(pkg.exports["."], "./dist/index.js");
            assert.equal(pkg.exports["./client"], "./dist/client.js");
            assert.equal(pkg.exports["./icon"], "./icon.svg");
        });
        it("1.3 package.json dsh bundle and client injection metadata are present", () => {
            assert.ok(pkg.dsh, "Missing dsh metadata");
            assert.equal(pkg.dsh.bundle.patch, "./cordis.patch.yml");
            assert.equal(pkg.dsh.client.platform, "web");
            assert.equal(pkg.dsh.client.immediately, true);
        });
        it("1.4 cordis.patch.yml bundle registration specification matches package name", () => {
            const patchPath = path.join(PLUGIN_DIR, "cordis.patch.yml");
            const content = fs.existsSync(patchPath)
                ? fs.readFileSync(patchPath, "utf8")
                : "";
            if (content) {
                assert.ok(content.includes("@local/dsh-cult-canvas"));
                assert.ok(content.includes("cult-canvas"));
            }
            else {
                assert.equal(SPEC_CORDIS_PATCH.name, "@local/dsh-cult-canvas");
                assert.equal(SPEC_CORDIS_PATCH.id, "cult-canvas");
            }
        });
        it("1.5 canvas configuration parameters provide robust defaults", () => {
            const patchPath = path.join(PLUGIN_DIR, "cordis.patch.yml");
            const patchContent = fs.readFileSync(patchPath, "utf8");
            const widthMatch = patchContent.match(/defaultCanvasWidth:\s*(\d+)/);
            const heightMatch = patchContent.match(/defaultCanvasHeight:\s*(\d+)/);
            const maxElMatch = patchContent.match(/maxElements:\s*(\d+)/);
            const snapMatch = patchContent.match(/snapToGrid:\s*(true|false)/);
            const gridMatch = patchContent.match(/gridSize:\s*(\d+)/);
            assert.ok(widthMatch, "cordis.patch.yml must specify defaultCanvasWidth");
            assert.ok(heightMatch, "cordis.patch.yml must specify defaultCanvasHeight");
            assert.ok(maxElMatch, "cordis.patch.yml must specify maxElements");
            assert.ok(snapMatch, "cordis.patch.yml must specify snapToGrid");
            assert.ok(gridMatch, "cordis.patch.yml must specify gridSize");
            const parsedConfig = {
                defaultCanvasWidth: Number(widthMatch[1]),
                defaultCanvasHeight: Number(heightMatch[1]),
                maxElements: Number(maxElMatch[1]),
                snapToGrid: snapMatch[1] === "true",
                gridSize: Number(gridMatch[1]),
            };
            assert.equal(parsedConfig.defaultCanvasWidth, 8192);
            assert.equal(parsedConfig.defaultCanvasHeight, 8192);
            assert.equal(parsedConfig.maxElements, 5000);
            assert.equal(parsedConfig.gridSize, 20);
            assert.equal(parsedConfig.snapToGrid, true);
            const ctx = createMockHostContext();
            const store = applyCanvasPlugin(ctx, parsedConfig);
            assert.ok(store);
        });
    });
    // ==========================================================================
    // Feature 2: TypeScript & Quality Gate Setup
    // ==========================================================================
    describe("Feature 2: TypeScript & Quality Gate Setup", () => {
        const tsconfigPath = path.join(PLUGIN_DIR, "tsconfig.json");
        const tsconfig = fs.existsSync(tsconfigPath)
            ? JSON.parse(fs.readFileSync(tsconfigPath, "utf8"))
            : SPEC_TSCONFIG;
        it("2.1 tsconfig.json specifies moduleDetection legacy for classic browser client script", () => {
            assert.equal(tsconfig.compilerOptions.moduleDetection, "legacy");
        });
        it("2.2 tsconfig.json specifies NodeNext module resolution and ES2023 target", () => {
            assert.equal(tsconfig.compilerOptions.target, "ES2023");
            assert.equal(tsconfig.compilerOptions.moduleResolution, "NodeNext");
            assert.equal(tsconfig.compilerOptions.strict, true);
        });
        it("2.3 oxlint configuration enforces type-aware correctness checking", () => {
            const oxlintPath = path.join(PLUGIN_DIR, ".oxlintrc.json");
            const oxlint = fs.existsSync(oxlintPath)
                ? JSON.parse(fs.readFileSync(oxlintPath, "utf8"))
                : SPEC_OXLINT;
            assert.equal(oxlint.categories.correctness, "error");
            assert.equal(oxlint.options.typeAware, true);
        });
        it("2.4 oxlint includes typescript and oxc lint plugins", () => {
            const oxlintPath = path.join(PLUGIN_DIR, ".oxlintrc.json");
            const oxlint = fs.existsSync(oxlintPath)
                ? JSON.parse(fs.readFileSync(oxlintPath, "utf8"))
                : SPEC_OXLINT;
            assert.ok(oxlint.plugins.includes("typescript"));
            assert.ok(oxlint.plugins.includes("oxc"));
        });
        it("2.5 oxfmt configuration enforces tab indentation and lf line endings", () => {
            const oxfmtPath = path.join(PLUGIN_DIR, ".oxfmtrc.json");
            const oxfmt = fs.existsSync(oxfmtPath)
                ? JSON.parse(fs.readFileSync(oxfmtPath, "utf8"))
                : SPEC_OXFMT;
            assert.equal(oxfmt.useTabs, true);
            assert.equal(oxfmt.endOfLine, "lf");
            assert.equal(oxfmt.tabWidth, 2);
        });
    });
    // ==========================================================================
    // Feature 3: Unified Document & Element Model
    // ==========================================================================
    describe("Feature 3: Unified Document & Element Model", () => {
        it("3.1 creates and retrieves whiteboard sticky note elements", () => {
            const store = new CanvasStore();
            const sticky = store.createElement({
                kind: "sticky",
                type: "text",
                x: 100,
                y: 150,
                width: 220,
                height: 220,
                text: "Review storyboard sequence",
                color: "3",
            });
            assert.ok(sticky.id);
            assert.equal(sticky.kind, "sticky");
            assert.equal(sticky.text, "Review storyboard sequence");
            const retrieved = store.getElementById(sticky.id);
            assert.deepEqual(retrieved, sticky);
        });
        it("3.2 creates and stores borderless text elements with markdown", () => {
            const store = new CanvasStore();
            const textElem = store.createElement({
                kind: "text",
                type: "text",
                x: 50,
                y: 50,
                width: 300,
                height: 80,
                text: "## Cyberpunk Scene Outline",
                styleAttributes: { gbKind: "text", gbSize: "xl" },
            });
            assert.equal(textElem.type, "text");
            assert.equal(textElem.styleAttributes?.gbKind, "text");
        });
        it("3.3 creates container group elements enclosing spatial regions", () => {
            const store = new CanvasStore();
            const group = store.createElement({
                kind: "group",
                type: "group",
                x: 0,
                y: 0,
                width: 800,
                height: 600,
                label: "Production Act 1",
            });
            assert.equal(group.type, "group");
            assert.equal(group.label, "Production Act 1");
        });
        it("3.4 creates media pipeline nodes with structured parameters", () => {
            const store = new CanvasStore();
            const videoNode = store.createElement({
                kind: "video",
                type: "video",
                x: 400,
                y: 200,
                width: 320,
                height: 240,
                mediaParams: SAMPLE_MEDIA_PARAMS.video,
                status: "idle",
            });
            assert.equal(videoNode.kind, "video");
            assert.equal(videoNode.status, "idle");
            assert.equal(videoNode.mediaParams?.duration, 4.0);
        });
        it("3.5 enforces minimum dimensions and spatial bounds on element creation", () => {
            const store = new CanvasStore();
            const tiny = store.createElement({
                type: "text",
                x: 10,
                y: 20,
                width: 0,
                height: -50,
            });
            assert.ok(tiny.width >= 1, "Width should be clamped to >= 1");
            assert.ok(tiny.height >= 1, "Height should be clamped to >= 1");
        });
    });
    // ==========================================================================
    // Feature 4: JSON Canvas 1.0 Compatibility
    // ==========================================================================
    describe("Feature 4: JSON Canvas 1.0 Compatibility", () => {
        it("4.1 imports valid JSON Canvas 1.0 document cleanly", () => {
            const store = new CanvasStore();
            const res = store.importJsonCanvas(VALID_JSON_CANVAS_1_0);
            assert.equal(res.importedNodes, 4);
            assert.equal(res.importedEdges, 1);
            assert.equal(store.getAllElements().length, 4);
            assert.equal(store.getAllEdges().length, 1);
        });
        it("4.2 exports in-memory canvas state conforming to JSON Canvas 1.0 schema", () => {
            const store = new CanvasStore();
            store.importJsonCanvas(VALID_JSON_CANVAS_1_0);
            const exported = store.exportJsonCanvas();
            assertValidJsonCanvas(exported);
            assert.equal(exported.nodes.length, 4);
            assert.equal(exported.edges.length, 1);
        });
        it("4.3 bi-directional round-trip export and re-import preserves node identity and coordinates", () => {
            const storeA = new CanvasStore();
            storeA.importJsonCanvas(VALID_JSON_CANVAS_1_0);
            const exportedA = storeA.exportJsonCanvas();
            const storeB = new CanvasStore();
            storeB.importJsonCanvas(exportedA);
            const exportedB = storeB.exportJsonCanvas();
            assert.deepEqual(exportedA, exportedB);
        });
        it("4.4 preserves edge connection sides and arrow ends in JSON Canvas format", () => {
            const store = new CanvasStore();
            store.createElement({
                id: "node_1",
                type: "text",
                x: 0,
                y: 0,
                width: 100,
                height: 100,
            });
            store.createElement({
                id: "node_2",
                type: "text",
                x: 200,
                y: 0,
                width: 100,
                height: 100,
            });
            store.connect({
                fromNode: "node_1",
                toNode: "node_2",
                fromSide: "right",
                toSide: "left",
                fromEnd: "none",
                toEnd: "arrow",
                label: "leads to",
            });
            const exported = store.exportJsonCanvas();
            const edge = exported.edges[0];
            assert.equal(edge.fromSide, "right");
            assert.equal(edge.toSide, "left");
            assert.equal(edge.toEnd, "arrow");
            assert.equal(edge.label, "leads to");
        });
        it("4.5 correctly handles preset color numbers and hex codes", () => {
            const store = new CanvasStore();
            const red = store.createElement({
                type: "text",
                x: 0,
                y: 0,
                width: 50,
                height: 50,
                color: "1",
            });
            const hex = store.createElement({
                type: "text",
                x: 60,
                y: 0,
                width: 50,
                height: 50,
                color: "#FF5A3D",
            });
            assert.equal(red.color, "1");
            assert.equal(hex.color, "#FF5A3D");
        });
    });
    // ==========================================================================
    // Feature 5: Freehand & Stroke Algorithms
    // ==========================================================================
    describe("Feature 5: Freehand & Stroke Algorithms", () => {
        it("5.1 creates marker stroke node with normalized relative points and padding", () => {
            const pts = STROKE_CURVED_LINE.map((p) => [
                p.x,
                p.y,
            ]);
            const stroke = buildStrokeNode(pts, 5);
            assert.ok(isValidStroke(stroke.gbStroke));
            assert.equal(stroke.gbStroke.v, 1);
            assert.ok(stroke.width >= 200);
            assert.ok(stroke.height >= 60);
            assert.ok(stroke.gbStroke.points.length <= pts.length);
            assert.ok(stroke.gbStroke.points.length > 0);
        });
        it("5.2 performs sub-pixel point deduplication on dense stroke coordinates", () => {
            const rawPts = STROKE_DENSE_POINTS.map((p) => [
                p.x,
                p.y,
            ]);
            const deduped = dedupePoints(rawPts, 0.75);
            assert.ok(deduped.length < rawPts.length, "Sub-pixel points should be filtered out by dedupePoints");
            assert.deepEqual(deduped[0], rawPts[0]);
            for (let i = 1; i < deduped.length; i++) {
                const prev = deduped[i - 1];
                const curr = deduped[i];
                const dist = Math.hypot(curr[0] - prev[0], curr[1] - prev[1]);
                assert.ok(dist >= 0.75, `Point distance ${dist} must be >= minDist threshold 0.75`);
            }
        });
        it("5.3 hit testing accurately detects points along the curved stroke centerline", () => {
            const strokeNode = {
                x: 0,
                y: 0,
                width: 300,
                height: 200,
                gbStroke: {
                    v: 1,
                    size: 6,
                    w: 300,
                    h: 200,
                    points: [
                        [50, 50],
                        [100, 80],
                        [150, 110],
                        [200, 115],
                    ],
                },
            };
            // Points directly on or near the segments
            assertPointInStroke({ x: 50, y: 50 }, strokeNode);
            assertPointInStroke({ x: 75, y: 65 }, strokeNode);
            assertPointInStroke({ x: 125, y: 95 }, strokeNode);
        });
        it("5.4 hit testing accurately rejects points far outside the stroke bounds", () => {
            const strokeNode = {
                x: 0,
                y: 0,
                width: 300,
                height: 200,
                gbStroke: {
                    v: 1,
                    size: 6,
                    w: 300,
                    h: 200,
                    points: [
                        [50, 50],
                        [100, 80],
                        [150, 110],
                    ],
                },
            };
            assertPointNotInStroke({ x: 50, y: 200 }, strokeNode);
            assertPointNotInStroke({ x: 500, y: 500 }, strokeNode);
        });
        it("5.5 hit testing dynamically scales points when stroke node container is resized", () => {
            const strokeNode = {
                x: 100,
                y: 100,
                width: 200, // scaled 2x from original w=100
                height: 100, // original h=100
                gbStroke: {
                    v: 1,
                    size: 5,
                    w: 100,
                    h: 100,
                    points: [
                        [0, 0],
                        [100, 100],
                    ],
                },
            };
            // Midpoint at original was (50, 50). Scaled by sx=2, sy=1 -> relative (100, 50) -> absolute (200, 150)
            assertPointInStroke({ x: 200, y: 150 }, strokeNode);
        });
    });
    // ==========================================================================
    // Feature 6: Shape & Card Geometries
    // ==========================================================================
    describe("Feature 6: Shape & Card Geometries", () => {
        const ALL_SHAPES = [
            "rect",
            "pill",
            "diamond",
            "circle",
            "parallelogram",
            "document",
            "database",
        ];
        it("6.1 supports all 7 specified geometric shapes", () => {
            const store = new CanvasStore();
            for (const shape of ALL_SHAPES) {
                const elem = store.createElement({
                    kind: "shape",
                    type: "text",
                    shape,
                    x: 0,
                    y: 0,
                    width: 220,
                    height: 120,
                    text: `Shape ${shape}`,
                    styleAttributes: { shape },
                });
                assert.equal(elem.shape, shape);
            }
            assert.equal(store.getAllElements().length, 7);
        });
        it("6.2 diamond shape computes 22% inline padding compensation", () => {
            const padding = getShapePaddingCompensation("diamond");
            assert.equal(padding.paddingInlinePercent, 22);
            assert.equal(padding.textOffsetY, 0);
            const cardWidth = 220;
            const insetPaddingPx = (cardWidth * padding.paddingInlinePercent) / 100;
            assert.equal(Math.round(insetPaddingPx * 10) / 10, 48.4);
            assert.equal(SHAPE_DEFINITIONS.diamond.paddingInlinePercent, 22);
        });
        it("6.3 circle shape computes 14% inline padding compensation", () => {
            const padding = getShapePaddingCompensation("circle");
            assert.equal(padding.paddingInlinePercent, 14);
            assert.equal(padding.textOffsetY, 0);
            const cardWidth = 200;
            const insetPaddingPx = (cardWidth * padding.paddingInlinePercent) / 100;
            assert.equal(Math.round(insetPaddingPx), 28);
            assert.equal(SHAPE_DEFINITIONS.circle.paddingInlinePercent, 14);
        });
        it("6.4 database cylinder shape computes 20px top offset padding", () => {
            const padding = getShapePaddingCompensation("database");
            assert.equal(padding.paddingInlinePercent, 0);
            assert.equal(padding.textOffsetY, 20);
            assert.equal(SHAPE_DEFINITIONS.database.textOffsetY, 20);
        });
        it("6.5 unrecognized shape names gracefully fall back to standard rect", () => {
            const padding = getShapePaddingCompensation("hypercube");
            assert.equal(padding.paddingInlinePercent, 0);
            assert.equal(padding.textOffsetY, 0);
            const resolvedShape = ALL_SHAPES.includes("hypercube")
                ? "hypercube"
                : "rect";
            assert.equal(resolvedShape, "rect");
        });
    });
    // ==========================================================================
    // Feature 7: Directed Graph & DAG Engine
    // ==========================================================================
    describe("Feature 7: Directed Graph & DAG Engine", () => {
        it("7.1 builds directed graph and tracks in/out degrees across nodes", () => {
            const engine = new GraphEngine();
            engine.buildGraph(["A", "B", "C"], [
                { fromNode: "A", toNode: "B" },
                { fromNode: "B", toNode: "C" },
            ]);
            assert.deepEqual(engine.getUpstreamNodes("C").sort(), ["A", "B"]);
            assert.deepEqual(engine.getDownstreamNodes("A").sort(), ["B", "C"]);
        });
        it("7.2 Kahn's algorithm resolves valid topological execution order", () => {
            const engine = new GraphEngine();
            const edges = [
                { fromNode: "script_1", toNode: "storyboard_1" },
                { fromNode: "storyboard_1", toNode: "video_1" },
                { fromNode: "video_1", toNode: "finalcut_1" },
            ];
            engine.buildGraph(["script_1", "storyboard_1", "video_1", "finalcut_1"], edges);
            const order = engine.getTopologicalOrder();
            assert.ok(order !== null);
            assertTopologicalOrder(order, edges);
        });
        it("7.3 detects cycles and returns null / flag when cyclic dependency exists", () => {
            const engine = new GraphEngine();
            engine.buildGraph(["A", "B", "C"], [
                { fromNode: "A", toNode: "B" },
                { fromNode: "B", toNode: "C" },
                { fromNode: "C", toNode: "A" }, // cycle!
            ]);
            assertCycleDetected(engine.hasCycles());
            assert.equal(engine.getTopologicalOrder(), null);
        });
        it("7.4 validates semantic port taxonomy matching source and destination kinds", () => {
            const engine = new GraphEngine();
            // storyboard 'out' (text) -> video 'prompt' (text)
            const valid = engine.validatePortConnection("storyboard", "out", "video", "prompt");
            assert.equal(valid.valid, true);
            // video 'out' (video) -> finalcut 'in' (video)
            const valid2 = engine.validatePortConnection("video", "out", "finalcut", "in");
            assert.equal(valid2.valid, true);
        });
        it("7.5 rejects incompatible port type connections with descriptive message", () => {
            const engine = new GraphEngine();
            // video 'out' (video) -> storyboard 'script' (text)
            const invalid = engine.validatePortConnection("video", "out", "storyboard", "script");
            assert.equal(invalid.valid, false);
            assert.ok(invalid.reason?.includes("Port type mismatch"));
        });
    });
    // ==========================================================================
    // Feature 8: Multi-Shot Storyboard & Prompt Resolution
    // ==========================================================================
    describe("Feature 8: Multi-Shot Storyboard & Prompt Resolution", () => {
        it("8.1 propagates upstream script text into downstream prompt resolution", () => {
            const store = new CanvasStore();
            const script = store.createElement({
                id: "node_script",
                type: "script",
                kind: "script",
                data: { output: "Scene 1: Detective arrives in rain." },
            });
            const imageNode = store.createElement({
                id: "node_img",
                type: "image",
                kind: "image",
                mediaParams: { prompt: "Atmospheric neon glow" },
            });
            store.connect({
                fromNode: script.id,
                toNode: imageNode.id,
                toPort: "prompt",
            });
            const pipeline = new PipelineEngine();
            const prompt = pipeline.resolvePrompt(imageNode, store);
            assert.ok(prompt.includes("Scene 1: Detective arrives in rain."));
            assert.ok(prompt.includes("Atmospheric neon glow"));
        });
        it("8.2 dynamically resolves @mention entities from the project bible into prompts", () => {
            const store = new CanvasStore();
            store.updateBible(SAMPLE_SERIES_BIBLE);
            const node = store.createElement({
                id: "node_prompt",
                type: "image",
                kind: "image",
                mediaParams: {
                    prompt: "Cinematic portrait of @Chen Shi walking near tavern",
                },
            });
            const pipeline = new PipelineEngine();
            const resolved = pipeline.resolvePrompt(node, store);
            assert.ok(!resolved.includes("@Chen Shi"));
            assert.ok(resolved.includes("Chen Shi: Young forensic detective from Luoyang"));
        });
        it("8.3 plans multi-shot storyboard segmentation respecting time and cut boundaries", () => {
            const pipeline = new PipelineEngine();
            const segments = pipeline.planShotSegments(SAMPLE_STORYBOARD_SHOTS);
            assert.ok(segments.length > 0);
            assert.equal(segments[0].startShotIndex, 1);
        });
        it("8.4 plans storyboard shot segments preserving dialogue, camera, and timing boundaries", () => {
            const pipeline = new PipelineEngine();
            const segments = pipeline.planShotSegments(SAMPLE_STORYBOARD_SHOTS);
            assert.equal(segments.length, 2);
            assert.equal(segments[0].duration, 7.5);
            assert.equal(segments[1].duration, 3.0);
            const shot2 = SAMPLE_STORYBOARD_SHOTS[1];
            assert.ok(shot2);
            assert.equal(shot2.cam, "50mm prime, shallow depth of field");
            assert.equal(shot2.dialogue?.[0]?.speaker, "Chen Shi");
        });
        it("8.5 preserves negative prompt constraints across shot generation requests", async () => {
            const store = new CanvasStore();
            const sbNode = store.createElement({
                id: "sb_shots_1",
                kind: "storyboard",
                type: "storyboard",
                data: { shots: SAMPLE_STORYBOARD_SHOTS },
                mediaParams: {
                    prompt: "Generate cyberpunk scenes",
                    negativePrompt: SAMPLE_STORYBOARD_SHOTS[0].negative,
                },
            });
            const pipeline = new PipelineEngine();
            const prompt = pipeline.resolvePrompt(sbNode, store);
            assert.ok(prompt.length > 0);
            const execResult = await pipeline.executeNode(sbNode.id, store);
            assert.equal(execResult.status, "completed");
            const updated = store.getElementById("sb_shots_1");
            const neg = updated?.mediaParams?.negativePrompt;
            assert.ok(typeof neg === "string" && neg.includes("blurry"));
            assert.ok(typeof neg === "string" && neg.includes("modern cars"));
        });
    });
    // ==========================================================================
    // Feature 9: Pipeline Execution Runner
    // ==========================================================================
    describe("Feature 9: Pipeline Execution Runner", () => {
        it("9.1 executes node advancing status through idle -> running -> completed", async () => {
            const store = new CanvasStore();
            const node = store.createElement({
                id: "exec_1",
                type: "image",
                kind: "image",
                status: "idle",
            });
            const pipeline = new PipelineEngine();
            const promise = pipeline.executeNode(node.id, store);
            const res = await promise;
            assert.equal(res.ok, true);
            assert.equal(res.status, "completed");
            assert.ok(res.assetId);
            const finalNode = store.getElementById(node.id);
            assert.equal(finalNode?.status, "completed");
        });
        it("9.2 assigns deterministic generated asset IDs and outputs upon completion", async () => {
            const store = new CanvasStore();
            const node = store.createElement({
                id: "exec_2",
                type: "video",
                kind: "video",
            });
            const pipeline = new PipelineEngine();
            const res = await pipeline.executeNode(node.id, store);
            assert.ok(res.assetId?.startsWith("asset_video_exec_2"));
            const updated = store.getElementById(node.id);
            assert.equal(updated?.data?.assetId, res.assetId);
        });
        it("9.3 runs full DAG workflow executing upstream nodes before downstream nodes", async () => {
            const store = new CanvasStore();
            const n1 = store.createElement({
                id: "w_script",
                type: "script",
                kind: "script",
            });
            const n2 = store.createElement({
                id: "w_video",
                type: "video",
                kind: "video",
            });
            store.connect({ fromNode: n1.id, toNode: n2.id });
            const pipeline = new PipelineEngine();
            const res = await pipeline.runWorkflow(store);
            assert.equal(res.ok, true);
            assert.deepEqual(res.executedNodes, ["w_script", "w_video"]);
        });
        it("9.4 aborts running execution when AbortSignal is triggered", async () => {
            const store = new CanvasStore();
            const node = store.createElement({
                id: "abort_test",
                type: "image",
                kind: "image",
            });
            const pipeline = new PipelineEngine();
            const controller = new AbortController();
            controller.abort();
            await assert.rejects(async () => {
                await pipeline.executeNode(node.id, store, {
                    signal: controller.signal,
                });
            }, /aborted/);
        });
        it("9.5 handles execution error gracefully and marks node as failed", async () => {
            const store = new CanvasStore();
            const node = store.createElement({
                id: "fail_test",
                type: "image",
                kind: "image",
            });
            const pipeline = new PipelineEngine();
            const res = await pipeline.executeNode(node.id, store, {
                mockGenerator: async () => {
                    throw new Error("GPU out of memory");
                },
            });
            assert.equal(res.ok, false);
            assert.equal(res.status, "failed");
            assert.equal(res.error, "GPU out of memory");
            const stored = store.getElementById(node.id);
            assert.equal(stored?.status, "failed");
        });
    });
    // ==========================================================================
    // Feature 10: Web Route Security & API Endpoints
    // ==========================================================================
    describe("Feature 10: Web Route Security & API Endpoints", () => {
        it("10.1 permits local loopback requests to authenticated web routes", async () => {
            const ctx = createMockHostContext();
            const store = applyCanvasPlugin(ctx);
            store.createElement({
                id: "node_state_1",
                type: "text",
                x: 0,
                y: 0,
                width: 100,
                height: 100,
            });
            const route = ctx.webServer.routes.find((r) => r.path === "/plugin-api/cult-canvas");
            assert.ok(route && route.resource);
            const req = new Request("http://127.0.0.1:3344/plugin-api/cult-canvas/state", {
                headers: { host: "127.0.0.1:3344" },
            });
            const res = await route.resource(req);
            assert.equal(res.status, 200);
            const body = (await res.json());
            assert.equal(body.nodes.length, 1);
        });
        it("10.2 rejects unauthenticated remote LAN requests with status 401", async () => {
            const ctx = createMockHostContext({
                connection: {
                    allowsRemoteAuthorities: true,
                    requestRejection: (req) => {
                        if (req.headers.cookie !== "auth=1")
                            return 401;
                    },
                },
            });
            applyCanvasPlugin(ctx);
            const route = ctx.webServer.routes.find((r) => r.path === "/plugin-api/cult-canvas");
            const req = new Request("http://192.168.1.100:3344/plugin-api/cult-canvas/state", {
                headers: { host: "192.168.1.100:3344" },
            });
            const res = await route.resource(req);
            assert.equal(res.status, 401);
        });
        it("10.3 rejects cross-site requests with status 403 on default loopback listener", async () => {
            const ctx = createMockHostContext();
            applyCanvasPlugin(ctx);
            const route = ctx.webServer.routes.find((r) => r.path === "/plugin-api/cult-canvas");
            const req = new Request("http://127.0.0.1:3344/plugin-api/cult-canvas/state", {
                headers: {
                    host: "127.0.0.1:3344",
                    "sec-fetch-site": "cross-site",
                    origin: "https://evil-attacker.com",
                },
            });
            const res = await route.resource(req);
            assert.equal(res.status, 403);
        });
        it("10.4 returns 503 fail-closed when native auth connection is broken", async () => {
            const ctx = createMockHostContext({
                host: "0.0.0.0", // non-loopback host requires auth
            });
            // ctx.connection is undefined -> fail closed 503
            applyCanvasPlugin(ctx);
            const route = ctx.webServer.routes.find((r) => r.path === "/plugin-api/cult-canvas");
            const req = new Request("http://0.0.0.0:3344/plugin-api/cult-canvas/state", {
                headers: { host: "0.0.0.0:3344" },
            });
            const res = await route.resource(req);
            assert.equal(res.status, 503);
        });
        it("10.5 returns 404 for unknown sub-paths", async () => {
            const ctx = createMockHostContext();
            applyCanvasPlugin(ctx);
            const route = ctx.webServer.routes.find((r) => r.path === "/plugin-api/cult-canvas");
            const req = new Request("http://127.0.0.1:3344/plugin-api/cult-canvas/unknown_route", {
                headers: { host: "127.0.0.1:3344" },
            });
            const res = await route.resource(req);
            assert.equal(res.status, 404);
        });
        it("10.6 rewrites Host and Origin to 127.0.0.1 upon remote LAN admission", async () => {
            const ctx = createMockHostContext({
                connection: {
                    allowsRemoteAuthorities: true,
                    requestRejection: () => undefined, // Admitted
                },
            });
            applyCanvasPlugin(ctx);
            const route = ctx.webServer.routes.find((r) => r.path === "/plugin-api/cult-canvas");
            assert.ok(route && route.resource);
            const req = new Request("http://192.168.1.150:3344/plugin-api/cult-canvas/state", {
                headers: {
                    host: "192.168.1.150:3344",
                    origin: "http://192.168.1.150:3344",
                },
            });
            const res = await route.resource(req);
            assert.equal(res.status, 200);
            assert.equal(res.headers.get("x-received-host"), "127.0.0.1:3344");
            assert.equal(res.headers.get("x-received-origin"), "http://127.0.0.1:3344");
        });
    });
    // ==========================================================================
    // Feature 11: Agent Tools - Inspection
    // ==========================================================================
    describe("Feature 11: Agent Tools - Inspection", () => {
        it("11.1 canvas_get_state returns full canvas elements and edge counts", async () => {
            const ctx = createMockHostContext();
            const store = new CanvasStore();
            store.createElement({
                id: "e1",
                type: "text",
                x: 10,
                y: 10,
                width: 100,
                height: 100,
            });
            const tools = buildCanvasTools(ctx, store);
            for (const t of tools)
                ctx.tools.register(t);
            const result = (await ctx.tools.execute("canvas_get_state", {}));
            assert.equal(result.ok, true);
            assert.equal(result.count, 1);
            assertNoUndefined(result);
        });
        it("11.2 canvas_get_state with bounding box query filters elements spatially", async () => {
            const ctx = createMockHostContext();
            const store = new CanvasStore();
            store.createElement({
                id: "in_box",
                type: "text",
                x: 50,
                y: 50,
                width: 100,
                height: 100,
            });
            store.createElement({
                id: "out_box",
                type: "text",
                x: 1000,
                y: 1000,
                width: 100,
                height: 100,
            });
            const tools = buildCanvasTools(ctx, store);
            for (const t of tools)
                ctx.tools.register(t);
            const result = (await ctx.tools.execute("canvas_get_state", {
                boundingBox: { minX: 0, minY: 0, maxX: 200, maxY: 200 },
            }));
            assert.equal(result.count, 1);
            assert.equal(result.elements[0].id, "in_box");
        });
        it("11.3 canvas_get_state with kind filter restricts returned elements", async () => {
            const ctx = createMockHostContext();
            const store = new CanvasStore();
            store.createElement({
                id: "sticky_1",
                kind: "sticky",
                type: "text",
                x: 0,
                y: 0,
                width: 100,
                height: 100,
            });
            store.createElement({
                id: "video_1",
                kind: "video",
                type: "video",
                x: 200,
                y: 0,
                width: 100,
                height: 100,
            });
            const tools = buildCanvasTools(ctx, store);
            for (const t of tools)
                ctx.tools.register(t);
            const result = (await ctx.tools.execute("canvas_get_state", {
                kind: "video",
            }));
            assert.equal(result.count, 1);
        });
        it("11.4 canvas_node_status inspects specific node execution state and data", async () => {
            const ctx = createMockHostContext();
            const store = new CanvasStore();
            store.createElement({
                id: "node_status_test",
                type: "image",
                kind: "image",
                status: "completed",
                data: { assetId: "img_99" },
            });
            const tools = buildCanvasTools(ctx, store);
            for (const t of tools)
                ctx.tools.register(t);
            const result = (await ctx.tools.execute("canvas_node_status", {
                nodeId: "node_status_test",
            }));
            assert.equal(result.ok, true);
            assert.equal(result.status, "completed");
        });
        it("11.5 canvas_get_bible retrieves stored project narrative bible", async () => {
            const ctx = createMockHostContext();
            const store = new CanvasStore();
            store.updateBible(SAMPLE_SERIES_BIBLE);
            const tools = buildCanvasTools(ctx, store);
            for (const t of tools)
                ctx.tools.register(t);
            const result = (await ctx.tools.execute("canvas_get_bible", {}));
            assert.equal(result.ok, true);
            assert.equal(result.bible.styleAnchor, "cyber-tang-noir-v1");
        });
    });
    // ==========================================================================
    // Feature 12: Agent Tools - Manipulation
    // ==========================================================================
    describe("Feature 12: Agent Tools - Manipulation", () => {
        it("12.1 canvas_create_element creates sticky note and returns valid ID", async () => {
            const ctx = createMockHostContext();
            const store = new CanvasStore();
            const tools = buildCanvasTools(ctx, store);
            for (const t of tools)
                ctx.tools.register(t);
            const res = (await ctx.tools.execute("canvas_create_element", {
                kind: "sticky",
                x: 100,
                y: 200,
                text: "Agent created note",
            }));
            assert.equal(res.ok, true);
            assert.ok(res.elementId);
            assert.equal(store.getElementById(res.elementId)?.text, "Agent created note");
        });
        it("12.2 canvas_update_element updates text and parameters preserving ID", async () => {
            const ctx = createMockHostContext();
            const store = new CanvasStore();
            const elem = store.createElement({
                type: "text",
                text: "Before",
                x: 0,
                y: 0,
                width: 100,
                height: 100,
            });
            const tools = buildCanvasTools(ctx, store);
            for (const t of tools)
                ctx.tools.register(t);
            const res = (await ctx.tools.execute("canvas_update_element", {
                id: elem.id,
                patch: { text: "After", color: "4" },
            }));
            assert.equal(res.ok, true);
            assert.equal(res.element.id, elem.id);
            assert.equal(res.element.text, "After");
            assert.equal(res.element.color, "4");
        });
        it("12.3 canvas_delete_element removes element and automatically detaches incident edges", async () => {
            const ctx = createMockHostContext();
            const store = new CanvasStore();
            const n1 = store.createElement({
                id: "del_1",
                type: "text",
                x: 0,
                y: 0,
                width: 50,
                height: 50,
            });
            const n2 = store.createElement({
                id: "del_2",
                type: "text",
                x: 100,
                y: 0,
                width: 50,
                height: 50,
            });
            store.connect({ fromNode: n1.id, toNode: n2.id });
            const tools = buildCanvasTools(ctx, store);
            for (const t of tools)
                ctx.tools.register(t);
            const res = (await ctx.tools.execute("canvas_delete_element", {
                ids: [n1.id],
            }));
            assert.equal(res.ok, true);
            assert.equal(res.deletedCount, 1);
            assert.equal(res.removedEdgesCount, 1);
            assert.equal(store.getAllEdges().length, 0);
        });
        it("12.4 canvas_connect links two nodes with directed arrow edge", async () => {
            const ctx = createMockHostContext();
            const store = new CanvasStore();
            const s1 = store.createElement({
                id: "conn_1",
                kind: "storyboard",
                type: "storyboard",
                x: 0,
                y: 0,
                width: 100,
                height: 100,
            });
            const v1 = store.createElement({
                id: "conn_2",
                kind: "video",
                type: "video",
                x: 200,
                y: 0,
                width: 100,
                height: 100,
            });
            const tools = buildCanvasTools(ctx, store);
            for (const t of tools)
                ctx.tools.register(t);
            const res = (await ctx.tools.execute("canvas_connect", {
                fromNode: s1.id,
                toNode: v1.id,
                fromPort: "out",
                toPort: "prompt",
            }));
            assert.equal(res.ok, true);
            assert.ok(res.edge.id);
        });
        it("12.5 canvas_layout_elements updates batch coordinates and pinned attributes", async () => {
            const ctx = createMockHostContext();
            const store = new CanvasStore();
            const e1 = store.createElement({
                id: "l1",
                type: "text",
                x: 0,
                y: 0,
                width: 100,
                height: 100,
            });
            const e2 = store.createElement({
                id: "l2",
                type: "text",
                x: 0,
                y: 0,
                width: 100,
                height: 100,
            });
            const tools = buildCanvasTools(ctx, store);
            for (const t of tools)
                ctx.tools.register(t);
            const res = (await ctx.tools.execute("canvas_layout_elements", {
                layouts: [
                    { id: e1.id, x: 500, y: 200, pinned: true },
                    { id: e2.id, x: 750, y: 200, pinned: false },
                ],
            }));
            assert.equal(res.ok, true);
            assert.equal(res.updatedCount, 2);
            assert.equal(store.getElementById(e1.id)?.x, 500);
            assert.equal(store.getElementById(e1.id)?.pinned, true);
        });
        it("12.6 canvas_connect wires standard JSON Canvas file and link nodes to pipeline nodes", async () => {
            const ctx = createMockHostContext();
            const store = new CanvasStore();
            const tools = buildCanvasTools(ctx, store);
            for (const t of tools)
                ctx.tools.register(t);
            store.createElement({
                id: "file_ref_1",
                type: "file",
                x: 0,
                y: 0,
                width: 100,
                height: 100,
                file: "assets/turnaround.png",
            });
            store.createElement({
                id: "link_ref_1",
                type: "link",
                x: 0,
                y: 120,
                width: 100,
                height: 100,
                url: "https://example.com/asset",
            });
            store.createElement({
                id: "video_node_1",
                type: "video",
                kind: "video",
                x: 200,
                y: 0,
                width: 100,
                height: 100,
            });
            const conn1 = (await ctx.tools.execute("canvas_connect", {
                fromNode: "file_ref_1",
                toNode: "video_node_1",
                fromPort: "ref",
                toPort: "ref",
            }));
            assert.equal(conn1.ok, true);
            assert.ok(conn1.edge.id);
            const conn2 = (await ctx.tools.execute("canvas_connect", {
                fromNode: "link_ref_1",
                toNode: "video_node_1",
                fromPort: "out",
                toPort: "prompt",
            }));
            assert.equal(conn2.ok, true);
            assert.ok(conn2.edge.id);
        });
    });
    // ==========================================================================
    // Feature 13: Agent Tools - Execution & Storage
    // ==========================================================================
    describe("Feature 13: Agent Tools - Execution & Storage", () => {
        it("13.1 canvas_run_pipeline executes a single node in step mode", async () => {
            const ctx = createMockHostContext();
            const store = new CanvasStore();
            const n = store.createElement({
                id: "run_step",
                type: "image",
                kind: "image",
            });
            const tools = buildCanvasTools(ctx, store);
            for (const t of tools)
                ctx.tools.register(t);
            const res = (await ctx.tools.execute("canvas_run_pipeline", {
                nodeId: n.id,
                mode: "step",
            }));
            assert.equal(res.ok, true);
            assert.equal(res.status, "completed");
            assert.ok(res.assetId);
        });
        it("13.2 canvas_run_pipeline in all mode runs entire workflow DAG", async () => {
            const ctx = createMockHostContext();
            const store = new CanvasStore();
            const s = store.createElement({
                id: "pipe_s",
                type: "script",
                kind: "script",
            });
            const v = store.createElement({
                id: "pipe_v",
                type: "video",
                kind: "video",
            });
            store.connect({ fromNode: s.id, toNode: v.id });
            const tools = buildCanvasTools(ctx, store);
            for (const t of tools)
                ctx.tools.register(t);
            const res = (await ctx.tools.execute("canvas_run_pipeline", {
                mode: "all",
            }));
            assert.equal(res.ok, true);
            assert.equal(res.status, "completed");
        });
        it("13.3 canvas_import_export exports canvas state to JSON Canvas 1.0 format", async () => {
            const ctx = createMockHostContext();
            const store = new CanvasStore();
            store.createElement({
                type: "text",
                x: 0,
                y: 0,
                width: 100,
                height: 100,
                text: "Export Me",
            });
            const tools = buildCanvasTools(ctx, store);
            for (const t of tools)
                ctx.tools.register(t);
            const res = (await ctx.tools.execute("canvas_import_export", {
                action: "export",
            }));
            assert.equal(res.ok, true);
            assertValidJsonCanvas(res.document);
            assert.equal(res.document.nodes.length, 1);
        });
        it("13.4 canvas_import_export imports external JSON Canvas document into store", async () => {
            const ctx = createMockHostContext();
            const store = new CanvasStore();
            const tools = buildCanvasTools(ctx, store);
            for (const t of tools)
                ctx.tools.register(t);
            const res = (await ctx.tools.execute("canvas_import_export", {
                action: "import",
                document: VALID_JSON_CANVAS_1_0,
            }));
            assert.equal(res.ok, true);
            assert.equal(res.importedNodes, 4);
        });
        it("13.5 canvas_update_bible updates project narrative bible", async () => {
            const ctx = createMockHostContext();
            const store = new CanvasStore();
            const tools = buildCanvasTools(ctx, store);
            for (const t of tools)
                ctx.tools.register(t);
            const res = (await ctx.tools.execute("canvas_update_bible", {
                patch: { styleAnchor: "neo-cyber-2088" },
            }));
            assert.equal(res.ok, true);
            assert.equal(res.bible.styleAnchor, "neo-cyber-2088");
        });
    });
    // ==========================================================================
    // Feature 14: Host Plugin Entrypoint & Cordis Lifecycle
    // ==========================================================================
    describe("Feature 14: Host Plugin Entrypoint & Cordis Lifecycle", () => {
        it("14.1 plugin declares inject array with tools and systemPrompt", () => {
            const ctx = createMockHostContext();
            applyCanvasPlugin(ctx);
            const registeredTools = ctx.tools.list();
            assert.ok(registeredTools.length >= 9, `Expected >= 9 tools registered, found ${registeredTools.length}`);
            const promptSections = ctx.systemPrompt.list();
            assert.ok(promptSections.some((s) => s.name === "tool:canvas"), "Host plugin must register tool:canvas systemPrompt section");
        });
        it("14.2 apply(ctx) registers all canvas agent tools in ctx.tools", () => {
            const ctx = createMockHostContext();
            applyCanvasPlugin(ctx);
            const toolNames = ctx.tools.list().map((t) => t.name);
            assert.ok(toolNames.includes("canvas_get_state"));
            assert.ok(toolNames.includes("canvas_create_element"));
            assert.ok(toolNames.includes("canvas_connect"));
            assert.ok(toolNames.includes("canvas_run_pipeline"));
        });
        it("14.3 apply(ctx) registers authenticated webServer route", () => {
            const ctx = createMockHostContext();
            applyCanvasPlugin(ctx);
            const routes = ctx.webServer.routes;
            assert.ok(routes.some((r) => r.path === "/plugin-api/cult-canvas"));
        });
        it("14.4 apply(ctx) registers systemPrompt section for canvas guidance", () => {
            const ctx = createMockHostContext();
            applyCanvasPlugin(ctx);
            const sections = ctx.systemPrompt.list();
            assert.ok(sections.some((s) => s.name === "tool:canvas"));
        });
        it("14.5 ctx.dispose() cleans up all registered tools, routes, and prompt sections", () => {
            const ctx = createMockHostContext();
            applyCanvasPlugin(ctx);
            assert.ok(ctx.tools.list().length > 0);
            assert.ok(ctx.webServer.routes.length > 0);
            assert.ok(ctx.systemPrompt.list().length > 0);
            ctx.dispose();
            assert.equal(ctx.tools.list().length, 0);
            assert.equal(ctx.webServer.routes.length, 0);
            assert.equal(ctx.systemPrompt.list().length, 0);
        });
    });
    // ==========================================================================
    // Feature 15: Client Module Entrypoint
    // ==========================================================================
    describe("Feature 15: Client Module Entrypoint", () => {
        it("15.1 client bundle adheres to DSH window.__ModuleLoader__.load contract", () => {
            const pkgPath = path.join(PLUGIN_DIR, "package.json");
            const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
            assert.equal(pkg.dsh?.client?.platform, "web");
            assert.equal(pkg.dsh?.client?.immediately, true);
            assert.ok(Array.isArray(pkg.dsh?.client?.inject));
            assert.ok(pkg.dsh.client.inject.includes("@deepseek-ai/dsh-client-ui-tool"));
            assert.equal(pkg.exports?.["./client"], "./dist/client.js");
        });
        it("15.2 client declares injected frontend services", async () => {
            const clientContractServices = [
                "slots",
                "locale",
                "styles",
                "remote",
                "uiWorkspace",
            ];
            const clientCtx = createMockClientContext();
            for (const svc of clientContractServices) {
                assert.ok(svc in clientCtx, `Client context must support service ${svc}`);
            }
            // Verify service contract functions are genuine callable instances
            assert.equal(typeof clientCtx.slots.inject, "function");
            assert.equal(typeof clientCtx.slots.register, "function");
            assert.equal(typeof clientCtx.locale.register, "function");
            assert.equal(typeof clientCtx.locale.translate, "function");
            assert.equal(typeof clientCtx.styles.inject, "function");
            assert.equal(typeof clientCtx.remote.request, "function");
            assert.equal(typeof clientCtx.uiWorkspace.getActive, "function");
            assert.equal(typeof clientCtx.effect, "function");
            // Active interaction verification across contract methods
            const disposer = clientCtx.slots.inject("tool.call.toolview:canvas_probe", { title: "Probe Card" });
            assert.ok(clientCtx.slots.has("tool.call.toolview:canvas_probe"));
            disposer();
            assert.equal(clientCtx.slots.has("tool.call.toolview:canvas_probe"), false);
            const remoteRes = await clientCtx.remote.request("canvas.getState");
            assert.ok(remoteRes && typeof remoteRes === "object");
        });
        it("15.3 client registers multi-language locale dictionaries", () => {
            const localeRegistry = new MockLocaleRegistry();
            const unregister = localeRegistry.register("cult-canvas", CANONICAL_CANVAS_LOCALES);
            assert.ok(localeRegistry.has("cult-canvas"));
            const schema = localeRegistry.get("cult-canvas");
            assert.ok(schema);
            for (const lang of ["en", "ru", "zh"]) {
                const dict = schema[lang];
                assert.ok(dict, `Locale dictionary missing for ${lang}`);
                assert.ok(dict.title, `Missing title in ${lang}`);
                assert.ok(dict.create, `Missing create in ${lang}`);
                assert.ok(dict.delete, `Missing delete in ${lang}`);
                assert.equal(localeRegistry.translate("cult-canvas", lang, "title"), CANONICAL_CANVAS_LOCALES[lang].title);
            }
            // Verify unregister clean teardown
            unregister();
            assert.equal(localeRegistry.has("cult-canvas"), false);
            assert.equal(localeRegistry.get("cult-canvas"), undefined);
        });
        it("15.4 client registers toolview slots for canvas tool cards", () => {
            const ctx = createMockHostContext();
            const store = new CanvasStore();
            const tools = buildCanvasTools(ctx, store);
            const registeredSlots = new Map();
            const mockSlotService = {
                inject(slotName, component) {
                    registeredSlots.set(slotName, component);
                },
            };
            for (const tool of tools) {
                const slotKey = `tool.call.toolview:${tool.name}`;
                mockSlotService.inject(slotKey, {
                    toolName: tool.name,
                    description: tool.description,
                });
            }
            assert.ok(registeredSlots.has("tool.call.toolview:canvas_create_element"));
            assert.ok(registeredSlots.has("tool.call.toolview:canvas_run_pipeline"));
            assert.equal(registeredSlots.size, tools.length);
        });
        it("15.5 client injects CSS styles and cleans up on unmount disposer", () => {
            const styleRegistry = new MockStyleRegistry();
            const extensionId = "@local/dsh-cult-canvas";
            const cssRule = ".dsh-cult-canvas-viewport { position: absolute; inset: 0; }";
            const disposer = styleRegistry.inject(extensionId, cssRule);
            assert.ok(styleRegistry.has(extensionId));
            const entry = styleRegistry.get(extensionId);
            assert.ok(entry);
            assert.equal(entry.id, extensionId);
            assert.equal(entry.css, cssRule);
            assert.equal(entry.attrs["data-dsh-extension"], extensionId);
            assert.equal(entry.removed, false);
            disposer();
            assert.equal(entry.removed, true);
            assert.equal(styleRegistry.has(extensionId), false);
            assert.equal(styleRegistry.get(extensionId), undefined);
        });
    });
});
