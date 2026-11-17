import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildStrokeNode, CanvasStore, centerlinePath, clampMarkerWidth, createAudioNode, createFileCard, createFinalcutNode, createGroupFrame, createImageNode, createLinkCard, createMarkerStroke, createScriptNode, createStickyNote, createStoryboardNode, createTextCard, createVideoNode, createWhiteboardShape, dedupePoints, eraserSweep, exportToJsonCanvas, getShapePaddingCompensation, getSvgPathFromStroke, importFromJsonCanvas, isPipelineElement, isPortCompatible, isValidStroke, isWhiteboardElement, layerOrder, MARKER_COLORS, MARKER_WIDTH, mixColor, MULTI_INPUT_PORTS, PORT_TABLE, resolveColorToRgb, samplePath, SHAPE_DEFINITIONS, STICKY_DEFAULT_BG, STICKY_DEFAULT_INK, strokeDistance, strokeHit, strokeOutlinePath, strokeOutlinePoints, TEXT_SIZES, } from "../canvas-model.js";
describe("Milestone 1: Unified Canvas Model & Infrastructure", () => {
    describe("1. Whiteboard Elements & Geometries", () => {
        it("creates a default sticky note with warm yellow paper and dark olive ink defaults", () => {
            assert.equal(STICKY_DEFAULT_INK, "#3a3500");
            const note = createStickyNote("sticky-1", 100, 200, "Brainstorm concept");
            assert.equal(note.id, "sticky-1");
            assert.equal(note.kind, "sticky");
            assert.equal(note.x, 100);
            assert.equal(note.y, 200);
            assert.equal(note.width, 220);
            assert.equal(note.height, 220);
            assert.equal(note.color, STICKY_DEFAULT_BG);
            assert.equal(note.fontSize, "m");
            assert.equal(note.textAlign, "left");
            assert.equal(isWhiteboardElement(note), true);
            assert.equal(isPipelineElement(note), false);
        });
        it("creates custom sticky note with user-specified color and size", () => {
            const note = createStickyNote("sticky-custom", 50, 50, "Urgent task", {
                color: "#FF5A3D",
                width: 300,
                height: 250,
                fontSize: "l",
                textAlign: "center",
            });
            assert.equal(note.color, "#FF5A3D");
            assert.equal(note.width, 300);
            assert.equal(note.height, 250);
            assert.equal(note.fontSize, "l");
            assert.equal(note.textAlign, "center");
        });
        it("creates all 7 geometric shapes with correct default dimensions", () => {
            const shapeTypes = [
                "rect",
                "pill",
                "diamond",
                "circle",
                "parallelogram",
                "document",
                "database",
            ];
            for (const shapeType of shapeTypes) {
                const shape = createWhiteboardShape(`shape-${shapeType}`, shapeType, 10, 20, `Label ${shapeType}`);
                assert.equal(shape.kind, "shape");
                assert.equal(shape.shapeType, shapeType);
                assert.equal(shape.width, SHAPE_DEFINITIONS[shapeType].defaultWidth);
                assert.equal(shape.height, SHAPE_DEFINITIONS[shapeType].defaultHeight);
                assert.equal(shape.textAlign, "center");
                assert.equal(shape.border, "solid");
                assert.equal(isWhiteboardElement(shape), true);
            }
        });
        it("calculates shape padding compensation for diamond (22%), circle (14%), and database (20px top offset)", () => {
            const diamondComp = getShapePaddingCompensation("diamond");
            assert.equal(diamondComp.paddingInlinePercent, 22);
            assert.equal(diamondComp.textOffsetY, 0);
            const circleComp = getShapePaddingCompensation("circle");
            assert.equal(circleComp.paddingInlinePercent, 14);
            assert.equal(circleComp.textOffsetY, 0);
            const dbComp = getShapePaddingCompensation("database");
            assert.equal(dbComp.paddingInlinePercent, 0);
            assert.equal(dbComp.textOffsetY, 20);
            const rectComp = getShapePaddingCompensation("rect");
            assert.equal(rectComp.paddingInlinePercent, 0);
            assert.equal(rectComp.textOffsetY, 0);
        });
        it("creates borderless text cards with accurate font scale mapping", () => {
            assert.equal(TEXT_SIZES.s, 14);
            assert.equal(TEXT_SIZES.m, 18);
            assert.equal(TEXT_SIZES.l, 26);
            assert.equal(TEXT_SIZES.xl, 38);
            const textCard = createTextCard("text-1", 400, 150, "Header Title", {
                fontSize: "xl",
                textAlign: "center",
            });
            assert.equal(textCard.kind, "text");
            assert.equal(textCard.fontSize, "xl");
            assert.equal(textCard.textAlign, "center");
            assert.equal(isWhiteboardElement(textCard), true);
        });
        it("creates group containers", () => {
            const group = createGroupFrame("grp-1", 0, 0, 800, 600, {
                label: "Act 1 Sequence",
                background: "#26282C",
                backgroundStyle: "cover",
            });
            assert.equal(group.kind, "group");
            assert.equal(group.label, "Act 1 Sequence");
            assert.equal(group.width, 800);
            assert.equal(group.height, 600);
            assert.equal(isWhiteboardElement(group), true);
        });
        it("blends colors with mixColor helper in srgb space", () => {
            // Mix canvas theme cyan with pastel base
            const blended = mixColor("#5DB2FF", 45, "#FFFBEA");
            assert.match(blended, /^#[0-9a-f]{6}$/i);
            // Pure color1 at 100%
            assert.equal(mixColor("#FF0000", 100, "#0000FF").toUpperCase(), "#FF0000");
            // Pure color2 at 0%
            assert.equal(mixColor("#FF0000", 0, "#0000FF").toUpperCase(), "#0000FF");
            // Preset color string "1" (Red preset)
            const blendedPreset = mixColor("1", 50, "#FFFFFF");
            assert.match(blendedPreset, /^#[0-9a-f]{6}$/i);
        });
        it("safely handles object prototype property names in resolveColorToRgb and mixColor", () => {
            assert.doesNotThrow(() => resolveColorToRgb("toString"));
            assert.doesNotThrow(() => resolveColorToRgb("valueOf"));
            assert.doesNotThrow(() => resolveColorToRgb("constructor"));
            // Fallback warm yellow
            assert.deepEqual(resolveColorToRgb("toString"), [255, 245, 154]);
            const mixed = mixColor("toString", 50, "#FFFFFF");
            assert.match(mixed, /^#[0-9a-f]{6}$/i);
        });
        it("creates file and link cards with factory functions", () => {
            const fileCard = createFileCard("f-1", "docs/spec.pdf", 10, 20, {
                subpath: "#page=2",
                color: "2",
                zIndex: 3,
                pinned: true,
            });
            assert.equal(fileCard.kind, "file");
            assert.equal(fileCard.file, "docs/spec.pdf");
            assert.equal(fileCard.subpath, "#page=2");
            assert.equal(fileCard.color, "2");
            assert.equal(fileCard.zIndex, 3);
            assert.equal(fileCard.pinned, true);
            assert.equal(isWhiteboardElement(fileCard), true);
            const linkCard = createLinkCard("l-1", "https://jsoncanvas.org", 50, 60, {
                color: "3",
            });
            assert.equal(linkCard.kind, "link");
            assert.equal(linkCard.url, "https://jsoncanvas.org");
            assert.equal(linkCard.color, "3");
            assert.equal(isWhiteboardElement(linkCard), true);
        });
    });
    describe("2. Freehand Marker Strokes & Algorithms", () => {
        it("builds stroke node with bounding box covering line with size padding", () => {
            const n = buildStrokeNode([
                [100, 50],
                [150, 80],
                [200, 50],
            ], 6);
            assert.deepEqual([n.x, n.y, n.width, n.height], [94, 44, 112, 42]);
            assert.deepEqual(n.gbStroke.points[0], [6, 6]);
            assert.equal(n.gbStroke.w, n.width);
            assert.equal(n.gbStroke.h, n.height);
            assert.equal(isValidStroke(n.gbStroke), true);
            for (const [x, y] of n.gbStroke.points) {
                assert.ok(x >= 0 && y >= 0 && x <= n.width && y <= n.height);
            }
        });
        it("synthesizes a second point for a single pointer click", () => {
            const deduped = dedupePoints([
                [10, 10],
                [10.2, 10.1],
            ]);
            assert.equal(deduped.length, 1);
            const n = buildStrokeNode([
                [10, 10],
                [10.2, 10.1],
            ], 5);
            assert.equal(n.gbStroke.points.length, 2);
            assert.ok(strokeOutlinePath(n.gbStroke.points, 5).startsWith("M"));
        });
        it("throws an error when building a stroke with empty points", () => {
            assert.throws(() => buildStrokeNode([], 5), /Cult Canvas: empty stroke/);
        });
        it("clamps marker width within defined min and max limits", () => {
            assert.equal(clampMarkerWidth(0), MARKER_WIDTH.min);
            assert.equal(clampMarkerWidth(99), MARKER_WIDTH.max);
            assert.equal(clampMarkerWidth("7"), 7);
            assert.equal(clampMarkerWidth(4.6), 5);
            assert.equal(clampMarkerWidth(undefined), MARKER_WIDTH.def);
            assert.equal(clampMarkerWidth("thin"), MARKER_WIDTH.def);
        });
        it("clamps non-positive size in buildStrokeNode and createMarkerStroke", () => {
            const strokeNode = buildStrokeNode([
                [10, 10],
                [50, 50],
            ], -5);
            assert.equal(strokeNode.gbStroke.size, MARKER_WIDTH.min);
            assert.ok(strokeNode.width > 0);
            assert.ok(strokeNode.height > 0);
            assert.equal(isValidStroke(strokeNode.gbStroke), true);
            const stroke = createMarkerStroke("str-zero", [
                [0, 0],
                [10, 10],
            ], 0);
            assert.equal(stroke.strokeWidth, MARKER_WIDTH.min);
            assert.ok(stroke.width > 0);
            assert.ok(stroke.height > 0);
        });
        it("validates stroke data structures rejecting invalid shapes", () => {
            assert.equal(isValidStroke(null), false);
            assert.equal(isValidStroke({ points: [], size: 5, w: 10, h: 10 }), false);
            assert.equal(isValidStroke({ points: [[1, "x"]], size: 5, w: 10, h: 10 }), false);
            assert.equal(isValidStroke({ points: [[1, 2]], size: 0, w: 10, h: 10 }), false);
            assert.equal(isValidStroke({ points: [[1, 2]], size: 5, w: -10, h: 10 }), false);
        });
        it("detects stroke hit only near the line, including after container resize", () => {
            const n = buildStrokeNode([
                [0, 0],
                [100, 0],
            ], 6);
            const s = n.gbStroke;
            const dist = strokeDistance(n, s, { x: 50, y: 10 });
            assert.ok(Math.abs(dist - 10) < 0.01);
            assert.equal(strokeHit(n, s, { x: 50, y: 2 }, 2), true);
            assert.equal(strokeHit(n, s, { x: 50, y: 20 }, 2), false);
            assert.equal(strokeHit(n, s, { x: 300, y: 0 }, 2), false);
            // Stretched container to 2x width
            const wide = { ...n, width: n.width * 2 };
            assert.equal(strokeHit(wide, s, { x: 190, y: 0 }, 2), true);
            assert.equal(strokeHit(n, s, { x: 190, y: 0 }, 2), false);
        });
        it("does not hit clicks inside a closed circle stroke around a card", () => {
            const pts = [];
            for (let a = 0; a <= Math.PI * 2 + 0.01; a += 0.1) {
                pts.push([200 + 150 * Math.cos(a), 200 + 100 * Math.sin(a)]);
            }
            const n = buildStrokeNode(pts, 5);
            // Center of circle should not hit the stroke line
            assert.equal(strokeHit(n, n.gbStroke, { x: 200, y: 200 }, 4), false);
            // Point on circumference should hit
            assert.equal(strokeHit(n, n.gbStroke, { x: 350, y: 200 }, 4), true);
        });
        it("samples path for eraser sweep and detects intersecting strokes", () => {
            const samples = samplePath({ x: 0, y: 0 }, { x: 100, y: 0 }, 10);
            assert.equal(samples.length, 11);
            assert.deepEqual(samples[samples.length - 1], { x: 100, y: 0 });
            const stroke1 = createMarkerStroke("stroke-1", [
                [50, 0],
                [50, 100],
            ], 6);
            const stroke2 = createMarkerStroke("stroke-2", [
                [200, 0],
                [200, 100],
            ], 6);
            const strokeItems = [
                {
                    id: stroke1.id,
                    box: stroke1,
                    stroke: {
                        v: 1,
                        size: stroke1.strokeWidth,
                        w: stroke1.origWidth,
                        h: stroke1.origHeight,
                        points: stroke1.points,
                    },
                },
                {
                    id: stroke2.id,
                    box: stroke2,
                    stroke: {
                        v: 1,
                        size: stroke2.strokeWidth,
                        w: stroke2.origWidth,
                        h: stroke2.origHeight,
                        points: stroke2.points,
                    },
                },
            ];
            // Drag line cutting through stroke 1 but missing stroke 2
            const hits = eraserSweep(strokeItems, { x: 0, y: 50 }, { x: 100, y: 50 }, 10);
            assert.deepEqual(hits, ["stroke-1"]);
            // Drag line cutting through both
            const hitsBoth = eraserSweep(strokeItems, { x: 0, y: 50 }, { x: 250, y: 50 }, 10);
            assert.equal(hitsBoth.length, 2);
            assert.ok(hitsBoth.includes("stroke-1"));
            assert.ok(hitsBoth.includes("stroke-2"));
        });
        it("generates outline and centerline SVG paths", () => {
            const outlinePts = strokeOutlinePoints([
                [0, 0],
                [100, 0],
            ], 6);
            assert.ok(outlinePts.length > 4);
            const svgPath = getSvgPathFromStroke(outlinePts);
            assert.ok(svgPath.startsWith("M"));
            assert.ok(svgPath.endsWith("Z"));
            const centerPath = centerlinePath([
                [1, 2],
                [3, 4],
            ]);
            assert.equal(centerPath, "M1,2 L3,4");
        });
        it("supports layer ordering adjustments (front, back, forward, backward)", () => {
            const order = ["a", "b", "c", "d"];
            const sel = new Set(["b"]);
            assert.deepEqual(layerOrder(order, sel, "front"), ["a", "c", "d", "b"]);
            assert.deepEqual(layerOrder(order, sel, "back"), ["b", "a", "c", "d"]);
            assert.deepEqual(layerOrder(order, sel, "forward"), ["a", "c", "b", "d"]);
            assert.deepEqual(layerOrder(order, sel, "backward"), [
                "b",
                "a",
                "c",
                "d",
            ]);
        });
    });
    describe("3. Media Pipeline Nodes & Port Taxonomy", () => {
        it("creates media pipeline nodes with valid initial state and ports", () => {
            const script = createScriptNode("script-1", 10, 10, "INT. LAB - NIGHT\nAgent initiates canvas.", {
                label: "Scene 1 Script",
                idea: "Introduce cult canvas",
            });
            assert.equal(script.kind, "script");
            assert.equal(script.status, "idle");
            assert.equal(isPipelineElement(script), true);
            const shots = [
                {
                    index: 1,
                    visual: "Close up on terminal",
                    motion: "Slow dolly zoom in",
                    duration: 4,
                    characters: ["Director"],
                    scene: "Control Room",
                    props: ["Microphone"],
                },
            ];
            const storyboard = createStoryboardNode("sb-1", 350, 10, shots);
            assert.equal(storyboard.kind, "storyboard");
            assert.equal(storyboard.shots.length, 1);
            assert.equal(storyboard.shots[0]?.visual, "Close up on terminal");
            const image = createImageNode("img-1", 10, 300, "Futuristic neon control terminal", {
                ratio: "16:9",
                size: "2K",
            });
            assert.equal(image.kind, "image");
            assert.equal(image.ratio, "16:9");
            assert.equal(image.size, "2K");
            const video = createVideoNode("vid-1", 350, 300, "Camera pan across dials", {
                duration: 5,
                resolution: "1080P",
            });
            assert.equal(video.kind, "video");
            assert.equal(video.duration, 5);
            assert.equal(video.resolution, "1080P");
        });
        it("creates audio and finalcut pipeline nodes with factory helpers", () => {
            const audio = createAudioNode("aud-1", 100, 200, "Dramatic orchestral theme", {
                label: "Theme Music",
                audioType: "music",
                duration: 30,
                assetId: "asset-audio-1",
                zIndex: 2,
                pinned: true,
            });
            assert.equal(audio.kind, "audio");
            assert.equal(audio.label, "Theme Music");
            assert.equal(audio.status, "idle");
            assert.equal(audio.prompt, "Dramatic orchestral theme");
            assert.equal(audio.audioType, "music");
            assert.equal(audio.duration, 30);
            assert.equal(audio.assetId, "asset-audio-1");
            assert.equal(audio.width, 280);
            assert.equal(audio.height, 180);
            assert.equal(audio.zIndex, 2);
            assert.equal(audio.pinned, true);
            assert.equal(isPipelineElement(audio), true);
            // Audio defaults
            const defaultAudio = createAudioNode("aud-def", 0, 0, "Voiceover");
            assert.equal(defaultAudio.audioType, "speech");
            assert.equal(defaultAudio.duration, 5);
            assert.equal(defaultAudio.assetId, null);
            const finalcut = createFinalcutNode("fc-1", 400, 200, {
                label: "Assembly Cut",
                sequence: ["vid-1", "vid-2"],
                totalDuration: 45,
                assetId: "asset-fc-1",
                zIndex: 4,
            });
            assert.equal(finalcut.kind, "finalcut");
            assert.equal(finalcut.label, "Assembly Cut");
            assert.equal(finalcut.status, "idle");
            assert.deepEqual(finalcut.sequence, ["vid-1", "vid-2"]);
            assert.equal(finalcut.totalDuration, 45);
            assert.equal(finalcut.assetId, "asset-fc-1");
            assert.equal(finalcut.width, 340);
            assert.equal(finalcut.height, 220);
            assert.equal(finalcut.zIndex, 4);
            assert.equal(isPipelineElement(finalcut), true);
            // Finalcut defaults
            const defaultFc = createFinalcutNode("fc-def", 0, 0);
            assert.deepEqual(defaultFc.sequence, []);
            assert.equal(defaultFc.totalDuration, 0);
            assert.equal(defaultFc.assetId, null);
        });
        it("verifies PORT_TABLE definitions and port compatibility", () => {
            assert.ok(PORT_TABLE.script);
            assert.equal(PORT_TABLE.script.inputs.length, 0);
            assert.equal(PORT_TABLE.script.outputs[0]?.id, "out");
            assert.equal(PORT_TABLE.script.outputs[0]?.kind, "text");
            assert.ok(PORT_TABLE.storyboard);
            assert.equal(PORT_TABLE.storyboard.inputs.length, 2);
            assert.ok(PORT_TABLE.storyboard.inputs.some((p) => p.id === "script"));
            assert.ok(PORT_TABLE.image);
            assert.ok(PORT_TABLE.image.inputs.some((p) => p.id === "prompt" && p.kind === "text"));
            assert.ok(PORT_TABLE.image.inputs.some((p) => p.id === "ref" && p.kind === "image"));
            assert.ok(PORT_TABLE.image.outputs.some((p) => p.id === "out" && p.kind === "image"));
            assert.ok(PORT_TABLE.video);
            assert.ok(PORT_TABLE.video.inputs.some((p) => p.id === "frame" && p.kind === "image"));
            assert.ok(PORT_TABLE.video.outputs.some((p) => p.id === "tailpick" && p.kind === "image"));
            assert.ok(PORT_TABLE.finalcut);
            assert.ok(PORT_TABLE.finalcut.inputs.some((p) => p.id === "in" && p.kind === "video"));
            assert.ok(PORT_TABLE.file);
            assert.ok(PORT_TABLE.file.outputs.some((p) => p.id === "ref" && p.kind === "image"));
            assert.ok(PORT_TABLE.file.outputs.some((p) => p.id === "out" && p.kind === "file"));
            assert.ok(PORT_TABLE.link);
            assert.ok(PORT_TABLE.link.outputs.some((p) => p.id === "out" && p.kind === "text"));
            assert.equal(isPortCompatible("text", "text"), true);
            assert.equal(isPortCompatible("text", "image"), false);
            assert.equal(isPortCompatible("image", "image"), true);
            assert.equal(isPortCompatible("video", "video"), true);
            assert.ok(MULTI_INPUT_PORTS.has("ref"));
            assert.ok(MULTI_INPUT_PORTS.has("in"));
            assert.ok(!MULTI_INPUT_PORTS.has("prompt"));
        });
    });
    describe("4. JSON Canvas 1.0 Roundtrip Fidelity", () => {
        it("exports and imports whiteboard items without loss of data", () => {
            const sticky = createStickyNote("st-1", 100, 100, "Sticky Content", {
                color: "#FFD54A",
                fontSize: "l",
            });
            const shape = createWhiteboardShape("sh-1", "diamond", 300, 100, "Decision");
            const text = createTextCard("tx-1", 100, 350, "Header Markdown", {
                fontSize: "xl",
            });
            const stroke = createMarkerStroke("str-1", [
                [10, 10],
                [50, 50],
            ], 4, MARKER_COLORS[0]);
            const group = createGroupFrame("grp-1", 50, 50, 600, 400, {
                label: "Card Group",
            });
            const edge = {
                id: "edge-1",
                fromNode: "st-1",
                fromSide: "right",
                toNode: "sh-1",
                toSide: "left",
                toEnd: "arrow",
                label: "transitions to",
                color: "#5DB2FF",
            };
            const elements = {
                [sticky.id]: sticky,
                [shape.id]: shape,
                [text.id]: text,
                [stroke.id]: stroke,
                [group.id]: group,
            };
            const edges = { [edge.id]: edge };
            // Export to JSON Canvas 1.0
            const doc = exportToJsonCanvas(elements, edges);
            assert.equal(doc.nodes.length, 5);
            assert.equal(doc.edges.length, 1);
            // Import back
            const imported = importFromJsonCanvas(doc);
            assert.equal(Object.keys(imported.elements).length, 5);
            assert.equal(Object.keys(imported.edges).length, 1);
            const importedSticky = imported.elements["st-1"];
            assert.equal(importedSticky.kind, "sticky");
            assert.equal(importedSticky.text, "Sticky Content");
            assert.equal(importedSticky.color, "#FFD54A");
            assert.equal(importedSticky.fontSize, "l");
            const importedShape = imported.elements["sh-1"];
            assert.equal(importedShape.kind, "shape");
            assert.equal(importedShape.shapeType, "diamond");
            assert.equal(importedShape.text, "Decision");
            const importedStroke = imported.elements["str-1"];
            assert.equal(importedStroke.kind, "stroke");
            assert.equal(importedStroke.strokeWidth, 4);
            assert.equal(importedStroke.points.length, 2);
            const importedEdge = imported.edges["edge-1"];
            assert.equal(importedEdge.fromNode, "st-1");
            assert.equal(importedEdge.toNode, "sh-1");
            assert.equal(importedEdge.label, "transitions to");
        });
        it("exports and imports media pipeline nodes with full payload fidelity", () => {
            const script = createScriptNode("sc-1", 0, 0, "Script body", {
                label: "Main Script",
                idea: "A story of agents",
            });
            const image = createImageNode("im-1", 400, 0, "Character portrait", {
                ratio: "1:1",
                size: "4K",
                assetId: "asset-char-1",
            });
            const edge = {
                id: "pipe-edge-1",
                fromNode: "sc-1",
                fromPort: "out",
                toNode: "im-1",
                toPort: "prompt",
            };
            const elements = {
                [script.id]: script,
                [image.id]: image,
            };
            const edges = { [edge.id]: edge };
            const doc = exportToJsonCanvas(elements, edges);
            assert.equal(doc.nodes.length, 2);
            const imported = importFromJsonCanvas(doc);
            const importedScript = imported.elements["sc-1"];
            assert.equal(importedScript.kind, "script");
            assert.equal(importedScript.text, "Script body");
            assert.equal(importedScript.idea, "A story of agents");
            const importedImage = imported.elements["im-1"];
            assert.equal(importedImage.kind, "image");
            assert.equal(importedImage.prompt, "Character portrait");
            assert.equal(importedImage.ratio, "1:1");
            assert.equal(importedImage.size, "4K");
            assert.equal(importedImage.assetId, "asset-char-1");
            const importedEdge = imported.edges["pipe-edge-1"];
            assert.equal(importedEdge.fromPort, "out");
            assert.equal(importedEdge.toPort, "prompt");
        });
        it("roundtrips standard JSON Canvas 1.0 file and link nodes without data loss", () => {
            const fileCard = {
                id: "spec-file",
                kind: "file",
                file: "docs/spec.pdf",
                subpath: "#page=2",
                x: 10,
                y: 20,
                width: 300,
                height: 200,
                color: "2",
            };
            const linkCard = {
                id: "spec-link",
                kind: "link",
                url: "https://jsoncanvas.org/spec/1.0",
                x: 350,
                y: 20,
                width: 280,
                height: 120,
                color: "4",
            };
            const exported = exportToJsonCanvas({ [fileCard.id]: fileCard, [linkCard.id]: linkCard }, {});
            assert.equal(exported.nodes.length, 2);
            const fileExportNode = exported.nodes.find((n) => n.id === "spec-file");
            assert.equal(fileExportNode.type, "file");
            assert.equal(fileExportNode.file, "docs/spec.pdf");
            assert.equal(fileExportNode.subpath, "#page=2");
            assert.equal(fileExportNode.color, "2");
            const linkExportNode = exported.nodes.find((n) => n.id === "spec-link");
            assert.equal(linkExportNode.type, "link");
            assert.equal(linkExportNode.url, "https://jsoncanvas.org/spec/1.0");
            assert.equal(linkExportNode.color, "4");
            const reimported = importFromJsonCanvas(exported);
            const importedFile = reimported.elements["spec-file"];
            assert.equal(importedFile.kind, "file");
            assert.equal(importedFile.file, "docs/spec.pdf");
            assert.equal(importedFile.subpath, "#page=2");
            assert.equal(importedFile.color, "2");
            assert.equal(importedFile.x, 10);
            assert.equal(importedFile.y, 20);
            const importedLink = reimported.elements["spec-link"];
            assert.equal(importedLink.kind, "link");
            assert.equal(importedLink.url, "https://jsoncanvas.org/spec/1.0");
            assert.equal(importedLink.color, "4");
            assert.equal(importedLink.x, 350);
            assert.equal(importedLink.y, 20);
        });
        it("preserves whiteboard shape fontSize across JSON Canvas export and import", () => {
            const shapeS = createWhiteboardShape("sh-s", "rect", 0, 0, "Small", {
                fontSize: "s",
            });
            const shapeL = createWhiteboardShape("sh-l", "circle", 100, 0, "Large", {
                fontSize: "l",
            });
            const shapeXL = createWhiteboardShape("sh-xl", "diamond", 200, 0, "Extra Large", {
                fontSize: "xl",
            });
            const exported = exportToJsonCanvas({
                [shapeS.id]: shapeS,
                [shapeL.id]: shapeL,
                [shapeXL.id]: shapeXL,
            }, {});
            const imported = importFromJsonCanvas(exported);
            const impS = imported.elements["sh-s"];
            const impL = imported.elements["sh-l"];
            const impXL = imported.elements["sh-xl"];
            assert.equal(impS.fontSize, "s");
            assert.equal(impL.fontSize, "l");
            assert.equal(impXL.fontSize, "xl");
        });
        it("handles missing nodes or edges root properties without throwing TypeError", () => {
            // Empty object
            const emptyDoc = {};
            assert.doesNotThrow(() => {
                const res = importFromJsonCanvas(emptyDoc);
                assert.equal(Object.keys(res.elements).length, 0);
                assert.equal(Object.keys(res.edges).length, 0);
            });
            // Missing edges
            const noEdgesDoc = {
                nodes: [
                    {
                        id: "n1",
                        type: "text",
                        text: "Solo Node",
                        x: 0,
                        y: 0,
                        width: 100,
                        height: 100,
                    },
                ],
            };
            assert.doesNotThrow(() => {
                const res = importFromJsonCanvas(noEdgesDoc);
                assert.equal(Object.keys(res.elements).length, 1);
                assert.equal(Object.keys(res.edges).length, 0);
                assert.equal(res.elements.n1?.kind, "text");
            });
            // Missing nodes
            const noNodesDoc = {
                edges: [{ id: "e1", fromNode: "a", toNode: "b" }],
            };
            assert.doesNotThrow(() => {
                const res = importFromJsonCanvas(noNodesDoc);
                assert.equal(Object.keys(res.elements).length, 0);
                assert.equal(Object.keys(res.edges).length, 1);
                assert.equal(res.edges.e1?.id, "e1");
            });
        });
        it("preserves element zIndex and pinned status across JSON Canvas export and import", () => {
            const note = createStickyNote("st-pin", 0, 0, "Pinned Note", {
                zIndex: 10,
                pinned: true,
            });
            const shape = createWhiteboardShape("sh-z", "rect", 50, 50, "Layered Shape", {
                zIndex: 5,
                pinned: false,
            });
            const file = createFileCard("f-pin", "file.pdf", 100, 100, {
                zIndex: 2,
                pinned: true,
            });
            const doc = exportToJsonCanvas({ [note.id]: note, [shape.id]: shape, [file.id]: file }, {});
            const reimported = importFromJsonCanvas(doc);
            assert.equal(reimported.elements["st-pin"]?.zIndex, 10);
            assert.equal(reimported.elements["st-pin"]?.pinned, true);
            assert.equal(reimported.elements["sh-z"]?.zIndex, 5);
            assert.equal(reimported.elements["sh-z"]?.pinned, false);
            assert.equal(reimported.elements["f-pin"]?.zIndex, 2);
            assert.equal(reimported.elements["f-pin"]?.pinned, true);
        });
    });
    describe("5. CanvasStore State Management & Spatial Queries", () => {
        it("performs CRUD on canvas elements and auto-cleans connected edges on deletion", () => {
            const store = new CanvasStore();
            const n1 = createStickyNote("node-1", 0, 0, "Card 1");
            const n2 = createStickyNote("node-2", 300, 0, "Card 2");
            store.createElement(n1);
            store.createElement(n2);
            assert.equal(store.getAllElements().length, 2);
            assert.equal(store.getElementById("node-1")?.kind, "sticky");
            // Add edge
            store.connect({
                id: "edge-1-2",
                fromNode: "node-1",
                toNode: "node-2",
            });
            assert.equal(store.getAllEdges().length, 1);
            assert.equal(store.getConnectedEdges("node-1").length, 1);
            // Update element
            const updated = store.updateElement("node-1", { text: "Card 1 Updated" });
            assert.equal(updated?.kind, "sticky");
            assert.equal(store.getElementById("node-1").text, "Card 1 Updated");
            // Delete element 1: should delete node-1 AND auto-delete edge-1-2!
            const res = store.deleteElements(["node-1"]);
            assert.deepEqual(res.deletedElements, ["node-1"]);
            assert.deepEqual(res.deletedEdges, ["edge-1-2"]);
            assert.equal(store.getAllElements().length, 1);
            assert.equal(store.getAllEdges().length, 0);
        });
        it("computes overall bounding box and performs spatial bounds queries", () => {
            const store = new CanvasStore();
            store.createElement(createStickyNote("n1", 100, 100, "Box 1", { width: 100, height: 100 }));
            store.createElement(createStickyNote("n2", 400, 400, "Box 2", { width: 100, height: 100 }));
            const bounds = store.getBounds();
            assert.ok(bounds);
            assert.equal(bounds.minX, 100);
            assert.equal(bounds.minY, 100);
            assert.equal(bounds.maxX, 500);
            assert.equal(bounds.maxY, 500);
            // Query overlapping region
            const hits = store.queryBounds({
                minX: 50,
                minY: 50,
                maxX: 250,
                maxY: 250,
            });
            assert.equal(hits.length, 1);
            assert.equal(hits[0]?.id, "n1");
            const noHits = store.queryBounds({
                minX: 250,
                minY: 250,
                maxX: 350,
                maxY: 350,
            });
            assert.equal(noHits.length, 0);
        });
        it("performs spatial hit testing taking into account zIndex", () => {
            const store = new CanvasStore();
            const baseCard = createStickyNote("base", 100, 100, "Base", {
                width: 200,
                height: 200,
                zIndex: 1,
            });
            const topCard = createStickyNote("top", 150, 150, "Top", {
                width: 100,
                height: 100,
                zIndex: 5,
            });
            store.createElement(baseCard);
            store.createElement(topCard);
            // Point (160, 160) intersects both: topCard should be first
            const hits = store.hitTest({ x: 160, y: 160 });
            assert.equal(hits.length, 2);
            assert.equal(hits[0]?.id, "top");
            assert.equal(hits[1]?.id, "base");
            // Point (110, 110) intersects only baseCard
            const baseOnly = store.hitTest({ x: 110, y: 110 });
            assert.equal(baseOnly.length, 1);
            assert.equal(baseOnly[0]?.id, "base");
        });
        it("manages project series bible updates and continuity anchors", () => {
            const store = new CanvasStore();
            assert.equal(store.getBible(), undefined);
            const bible = {
                worldview: "Cyberpunk Neo-Tokyo",
                style: "Cel-shaded Anime",
                styleAnchor: "anime aesthetic, sharp lines",
                characters: [{ name: "Kaelen", desc: "Cybernetic investigator" }],
                scenes: [{ name: "Sector 7", desc: "Neon rainy alleyway" }],
                props: [{ name: "Neural Deck", desc: "Portable cyber interface" }],
            };
            store.updateBible(bible);
            assert.equal(store.getBible()?.worldview, "Cyberpunk Neo-Tokyo");
            assert.equal(store.getBible()?.characters.length, 1);
            // Partial update
            store.updateBible({ styleAnchor: "anime aesthetic, high contrast" });
            assert.equal(store.getBible()?.styleAnchor, "anime aesthetic, high contrast");
            assert.equal(store.getBible()?.worldview, "Cyberpunk Neo-Tokyo");
        });
        it("snapshots and restores entire CanvasDocument", () => {
            const store = new CanvasStore();
            store.createElement(createStickyNote("n-1", 10, 10, "Note"));
            store.updateBible({ worldview: "Fantasy Realm" });
            const doc = store.toDocument("doc-1", "My Canvas");
            assert.equal(doc.id, "doc-1");
            assert.equal(doc.title, "My Canvas");
            assert.equal(doc.bible?.worldview, "Fantasy Realm");
            const newStore = new CanvasStore();
            newStore.loadDocument(doc);
            assert.equal(newStore.getAllElements().length, 1);
            assert.equal(newStore.getBible()?.worldview, "Fantasy Realm");
        });
        it("breaks ties on equal zIndex by insertion order in hitTest (newer element top)", () => {
            const store = new CanvasStore();
            // Bottom card created first with default zIndex (undefined -> 0)
            const cardA = createStickyNote("card-a", 100, 100, "Card A (Bottom)", {
                width: 200,
                height: 200,
            });
            // Top card created second with identical zIndex (undefined -> 0) overlapping Card A
            const cardB = createStickyNote("card-b", 120, 120, "Card B (Top)", {
                width: 150,
                height: 150,
            });
            store.createElement(cardA);
            store.createElement(cardB);
            // Point (150, 150) intersects both cardA and cardB
            const hits = store.hitTest({ x: 150, y: 150 });
            assert.equal(hits.length, 2);
            // Visually top card (cardB, inserted later) must be returned first
            assert.equal(hits[0]?.id, "card-b");
            assert.equal(hits[1]?.id, "card-a");
        });
        it("provides convenience aliases deleteElement, toJSONCanvas, and fromJSONCanvas on CanvasStore", () => {
            const store = new CanvasStore();
            const note = createStickyNote("n-alias", 50, 50, "Alias note");
            store.createElement(note);
            // toJSONCanvas alias
            const jsonDoc = store.toJSONCanvas();
            assert.equal(jsonDoc.nodes.length, 1);
            assert.equal(jsonDoc.nodes[0]?.id, "n-alias");
            // deleteElement alias
            const delRes = store.deleteElement("n-alias");
            assert.deepEqual(delRes.deletedElements, ["n-alias"]);
            assert.equal(store.getElementById("n-alias"), undefined);
            // fromJSONCanvas alias
            const importRes = store.fromJSONCanvas(jsonDoc);
            assert.equal(importRes.nodeCount, 1);
            assert.equal(importRes.importedNodes, 1);
            assert.equal(importRes.edgeCount, 0);
            assert.equal(importRes.importedEdges, 0);
            assert.ok(store.getElementById("n-alias"));
        });
        it("returns complete count signature on CanvasStore.importJsonCanvas", () => {
            const store = new CanvasStore();
            const doc = {
                nodes: [
                    {
                        id: "n1",
                        type: "text",
                        text: "A",
                        x: 0,
                        y: 0,
                        width: 100,
                        height: 100,
                    },
                    {
                        id: "n2",
                        type: "text",
                        text: "B",
                        x: 200,
                        y: 0,
                        width: 100,
                        height: 100,
                    },
                ],
                edges: [{ id: "e1", fromNode: "n1", toNode: "n2" }],
            };
            const res = store.importJsonCanvas(doc);
            // Support both nodeCount/edgeCount and importedNodes/importedEdges
            assert.equal(res.nodeCount, 2);
            assert.equal(res.edgeCount, 1);
            assert.equal(res.importedNodes, 2);
            assert.equal(res.importedEdges, 1);
        });
    });
});
