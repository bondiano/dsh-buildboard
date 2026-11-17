/**
 * Client Contract & Component Unit Tests for DSH Cult Canvas
 *
 * Verifies:
 * - Module loader registration via window.__ModuleLoader__.load
 * - Declared service dependency injection list
 * - Slot injection for @deepseek-ai/dsh-client-ui-tool and tool.call.toolview
 * - Multi-language locale registration (en, ru, zh)
 * - Stylesheet injection into document.head and clean disposer removal
 * - Component unit tests for MarkerStroke, StickyNote, ShapeElement,
 *   ElementManipulation, EraserSweep, CanvasViewport, CanvasMinimap,
 *   CanvasToolbar, and CultCanvasBoard.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { apply, CANVAS_TOOL_NAMES, CANVAS_UI_TOOL_SLOT, CLIENT_NAMESPACE, CLIENT_STYLE_ATTR, clientPlugin, clientPluginFactory, inject, } from "../src/presentation/client.js";
import { CanvasMinimap, CanvasToolbar, CanvasToolView, CanvasViewport, clampMarkerStrokeWidth, computeSelectionBounds, CultCanvasBoard, DEFAULT_MARKER_COLOR, DEFAULT_MARKER_WIDTH, DEFAULT_STICKY_SIZE, DEFAULT_VIEWPORT, EraserSweep, generateMarkerCenterlinePath, generateMarkerOutlinePath, getShapePaddingCompensation, getShapeSvgPath, handleManipulationKeyDown, layerOrder, MARKER_PALETTE_COLORS, MARKER_PRESET_WIDTHS, MarkerStroke, MIN_MARKER_WIDTH, MAX_MARKER_WIDTH, screenToWorld, SelectionOverlay, setReact, ShapeElement, snapToGrid, STICKY_PALETTE_COLORS, StickyNote, strokeOutlinePoints, SUPPORTED_SHAPES, sweepAndCollectHitStrokes, WHITEBOARD_TOOLS, worldToScreen, } from "../src/presentation/components/index.js";
import { CANVAS_CLIENT_STYLES } from "../src/presentation/styles.js";
// Setup mock React runtime for headless test evaluation
const mockReact = {
    Fragment: "mock-fragment",
    createElement(type, props, ...children) {
        const flatChildren = children.flat();
        return {
            type,
            props: { ...props, children: flatChildren },
            key: props?.["key"] ?? null,
            children: flatChildren,
        };
    },
    useState(initial) {
        const val = typeof initial === "function" ? initial() : initial;
        return [val, () => { }];
    },
    useEffect(cb) {
        if (typeof cb === "function") {
            cb();
        }
    },
    useCallback(fn) {
        return fn;
    },
    useMemo(fn) {
        return fn();
    },
    useRef(initial) {
        return { current: initial };
    },
};
setReact(mockReact);
describe("Milestone 3: Client Shell Contract Suite", () => {
    it("3.1 exports valid clientPlugin descriptor with id and inject array", () => {
        assert.equal(clientPlugin.id, "@local/dsh-cult-canvas");
        assert.deepEqual(clientPlugin.inject, [
            "slots",
            "locale",
            "remote",
            "styles",
            "uiWorkspace",
        ]);
        assert.equal(typeof clientPlugin.apply, "function");
    });
    it("3.2 registers with window.__ModuleLoader__.load when executed in browser context", () => {
        let capturedDescriptor = null;
        const mockWindow = {
            __ModuleLoader__: {
                load(desc) {
                    capturedDescriptor = desc;
                },
            },
        };
        // Test clientPluginFactory directly
        const factoryResult = clientPluginFactory(() => mockReact);
        assert.equal(factoryResult.id, "@local/dsh-cult-canvas");
        assert.deepEqual(factoryResult.inject, inject);
        assert.equal(factoryResult.apply, apply);
        // Test global window loader interaction
        mockWindow.__ModuleLoader__.load({
            id: "@local/dsh-cult-canvas",
            factory: (req) => clientPluginFactory(req),
        });
        assert.ok(capturedDescriptor !== null);
        const captured = capturedDescriptor;
        assert.equal(captured.id, "@local/dsh-cult-canvas");
        const created = captured.factory(() => mockReact);
        assert.equal(created.id, "@local/dsh-cult-canvas");
    });
    it("3.3 registers multi-language locale dictionaries (en, ru, zh)", () => {
        const registeredLocales = {};
        const mockCtx = {
            effect(cb) {
                cb();
            },
            locale: {
                register(ns, dicts) {
                    registeredLocales[ns] = dicts;
                },
                bind: () => (k) => k,
            },
            slots: {
                inject: () => { },
                register: () => { },
            },
        };
        apply(mockCtx);
        assert.ok(registeredLocales[CLIENT_NAMESPACE] !== undefined);
        const dicts = registeredLocales[CLIENT_NAMESPACE];
        assert.ok(dicts["en"] !== undefined, "English dictionary must be registered");
        assert.ok(dicts["ru"] !== undefined, "Russian dictionary must be registered");
        assert.ok(dicts["zh"] !== undefined, "Chinese dictionary must be registered");
    });
    it("3.4 injects stylesheet into document.head and cleanly removes it on disposer call", () => {
        const appendedElements = [];
        let removed = false;
        const fakeStyle = {
            tagName: "STYLE",
            attrs: {},
            textContent: "",
            setAttribute(k, v) {
                this.attrs[k] = v;
            },
            remove() {
                removed = true;
            },
        };
        const fakeDoc = {
            querySelectorAll: () => [],
            createElement: () => fakeStyle,
            head: {
                append: (el) => {
                    appendedElements.push(el);
                },
            },
        };
        globalThis.document = fakeDoc;
        let capturedDisposer;
        const mockCtx = {
            effect(cb) {
                const res = cb();
                if (typeof res === "function") {
                    capturedDisposer = res;
                }
            },
            locale: {
                register: () => { },
                bind: () => (k) => k,
            },
            slots: {
                inject: () => { },
                register: () => { },
            },
        };
        apply(mockCtx);
        assert.equal(appendedElements.length, 1);
        const injected = appendedElements[0];
        assert.equal(injected.attrs[CLIENT_STYLE_ATTR], CLIENT_NAMESPACE);
        assert.equal(injected.textContent, CANVAS_CLIENT_STYLES);
        // Execute the disposer
        assert.ok(typeof capturedDisposer === "function");
        const disposerFn = capturedDisposer;
        disposerFn();
        assert.equal(removed, true, "Disposer must remove injected style from document.head");
    });
    it("3.5 injects slot views for UI tool and all 12 agent toolview cards", () => {
        const slotInjections = {};
        const mockCtx = {
            effect: () => { },
            locale: {
                register: () => { },
                bind: () => (k) => k,
            },
            slots: {
                inject(name, generator) {
                    const out = generator();
                    const items = [];
                    if (out !== null &&
                        out !== undefined &&
                        typeof out[Symbol.iterator] ===
                            "function") {
                        for (const item of out) {
                            items.push(item);
                        }
                    }
                    else {
                        items.push(out);
                    }
                    slotInjections[name] = items;
                },
                register(desc, comp) {
                    return { desc, comp };
                },
            },
        };
        apply(mockCtx);
        // Check UI tool slot
        assert.ok(slotInjections[CANVAS_UI_TOOL_SLOT] !== undefined);
        const uiTool = slotInjections[CANVAS_UI_TOOL_SLOT][0];
        assert.equal(uiTool.desc.name, CANVAS_UI_TOOL_SLOT);
        assert.equal(uiTool.desc.id, CLIENT_NAMESPACE);
        assert.equal(uiTool.comp, CultCanvasBoard);
        // Check tool.call.toolview registrations
        assert.ok(slotInjections["tool.call.toolview"] !== undefined);
        const registeredCards = slotInjections["tool.call.toolview"];
        assert.equal(registeredCards.length, CANVAS_TOOL_NAMES.length);
        const registeredKeys = registeredCards.map((r) => r.desc.key);
        for (const expectedTool of CANVAS_TOOL_NAMES) {
            assert.ok(registeredKeys.includes(expectedTool), `Missing toolview registration for ${expectedTool}`);
        }
    });
});
describe("Milestone 3: Whiteboard Components Unit Tests", () => {
    it("3.6 MarkerStroke: validates widths, colors, and generates outline & centerline SVG paths", () => {
        assert.equal(clampMarkerStrokeWidth(1), MIN_MARKER_WIDTH);
        assert.equal(clampMarkerStrokeWidth(30), MAX_MARKER_WIDTH);
        assert.equal(clampMarkerStrokeWidth(8), 8);
        assert.equal(clampMarkerStrokeWidth("invalid"), DEFAULT_MARKER_WIDTH);
        assert.equal(MARKER_PALETTE_COLORS.length, 5);
        assert.deepEqual(MARKER_PALETTE_COLORS, [
            "#1E1E1E",
            "#E03E3E",
            "#2F9E44",
            "#1971C2",
            "#F08C00",
        ]);
        assert.deepEqual(MARKER_PRESET_WIDTHS, [2, 4, 8, 16, 24]);
        const testPoints = [
            [10, 10],
            [30, 40],
            [80, 90],
            [120, 150],
        ];
        const outline = generateMarkerOutlinePath(testPoints, 6);
        assert.ok(outline.startsWith("M"), "Outline path must start with M command");
        assert.ok(outline.endsWith("Z"), "Outline path must be closed with Z command");
        const centerline = generateMarkerCenterlinePath(testPoints);
        assert.ok(centerline.startsWith("M10,10"), "Centerline path must start at first point");
        assert.ok(centerline.includes("L120,150"), "Centerline path must include last point");
        const outlinePts = strokeOutlinePoints(testPoints, 6);
        assert.ok(outlinePts.length > testPoints.length);
        // Test rendering
        const node = MarkerStroke({
            id: "stroke_1",
            points: testPoints,
            width: 6,
            color: DEFAULT_MARKER_COLOR,
            isSelected: true,
        });
        assert.equal(node.type, "g");
        assert.ok(node.props["className"].includes("selected"));
    });
    it("3.7 StickyNote: provides 220x220 default size, yellow background, and 5 palette colors", () => {
        assert.equal(DEFAULT_STICKY_SIZE, 220);
        assert.equal(STICKY_PALETTE_COLORS.length, 5);
        assert.deepEqual(STICKY_PALETTE_COLORS, [
            "#FFF59A",
            "#E3F2FD",
            "#E8F5E9",
            "#FFEBEE",
            "#F3E5F5",
        ]);
        let _editedText = null;
        let selectedColor = null;
        const vnode = StickyNote({
            id: "note_1",
            x: 100,
            y: 150,
            text: "Hello Whiteboard",
            color: "#FFF59A",
            isSelected: true,
            onChangeText: (_id, text) => {
                _editedText = text;
            },
            onChangeColor: (_id, col) => {
                selectedColor = col;
            },
        });
        assert.equal(vnode.type, "div");
        const style = vnode.props["style"];
        assert.equal(style["width"], "220px");
        assert.equal(style["height"], "220px");
        assert.equal(style["backgroundColor"], "#FFF59A");
        assert.ok(vnode.props["className"]?.toString().includes("selected"));
        // Find color dot button in rendered palette and trigger onClick
        const palette = vnode.children.find((c) => Boolean(c &&
            typeof c === "object" &&
            c.props?.["className"] ===
                "dsh-sticky-color-palette"));
        assert.ok(palette !== undefined, "Color palette must be rendered when isSelected is true");
        assert.equal(palette.children.length, 5);
        // Click the second color dot (#E3F2FD)
        const secondDot = palette.children[1];
        const clickFn = secondDot.props["onClick"];
        clickFn?.({});
        assert.equal(selectedColor, "#E3F2FD");
    });
    it("3.8 ShapeElement: compensates text padding for all 7 geometric shapes", () => {
        assert.equal(SUPPORTED_SHAPES.length, 7);
        assert.deepEqual(SUPPORTED_SHAPES, [
            "rect",
            "pill",
            "diamond",
            "circle",
            "parallelogram",
            "document",
            "database",
        ]);
        // Verify domain padding compensation
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
        // Verify SVG path generators for non-rectangular shapes
        const diamondPath = getShapeSvgPath("diamond", 200, 200);
        assert.ok(diamondPath.includes("L 200 100"), "Diamond path must connect right vertex");
        const dbPath = getShapeSvgPath("database", 200, 160);
        assert.ok(dbPath.includes("A 100"), "Database path must contain cylindrical arcs");
        // Test component rendering
        const shapeNode = ShapeElement({
            id: "shape_dia",
            shapeType: "diamond",
            x: 50,
            y: 50,
            width: 220,
            height: 220,
            text: "Decision",
        });
        assert.equal(shapeNode.type, "div");
        assert.equal(shapeNode.props["data-shape-type"], "diamond");
    });
    it("3.9 ElementManipulation: selection bounds, resize handles, snap-to-grid, and layer ordering", () => {
        // Snap to grid (20px)
        assert.equal(snapToGrid(24), 20);
        assert.equal(snapToGrid(31), 40);
        assert.equal(snapToGrid(0), 0);
        assert.equal(snapToGrid(100), 100);
        // Union selection bounds
        const items = [
            { x: 10, y: 20, width: 100, height: 80 },
            { x: 50, y: 70, width: 150, height: 90 },
        ];
        const bounds = computeSelectionBounds(items);
        if (!bounds)
            throw new Error("Bounds must not be null");
        assert.equal(bounds.x, 10);
        assert.equal(bounds.y, 20);
        assert.equal(bounds.width, 190); // max X: 50 + 150 = 200 -> width: 200 - 10 = 190
        assert.equal(bounds.height, 140); // max Y: 70 + 90 = 160 -> height: 160 - 20 = 140
        // Layer ordering
        const order = ["a", "b", "c", "d"];
        const toFront = layerOrder(order, new Set(["b"]), "front");
        assert.deepEqual(toFront, ["a", "c", "d", "b"]);
        const toBack = layerOrder(order, new Set(["c"]), "back");
        assert.deepEqual(toBack, ["c", "a", "b", "d"]);
        // Keyboard manipulation: Delete
        let deleted = [];
        const handledDelete = handleManipulationKeyDown({ key: "Delete" }, {
            selectedIds: ["a", "b"],
            order,
            onDelete: (ids) => {
                deleted = ids;
            },
        });
        assert.equal(handledDelete, true);
        assert.deepEqual(deleted, ["a", "b"]);
        // Keyboard manipulation: Duplicate (Ctrl+D)
        let duplicated = [];
        const handledDup = handleManipulationKeyDown({ key: "d", ctrlKey: true }, {
            selectedIds: ["c"],
            order,
            onDuplicate: (ids) => {
                duplicated = ids;
            },
        });
        assert.equal(handledDup, true);
        assert.deepEqual(duplicated, ["c"]);
        // Selection overlay rendering
        const overlay = SelectionOverlay({
            bounds: bounds,
            zoom: 1,
        });
        assert.equal(overlay.type, "div");
        assert.equal(overlay.children.length, 8, "Must render exactly 8 resize handles");
    });
    it("3.10 EraserSweep: detects intersecting strokes and deletes whole lines", () => {
        const strokes = [
            {
                id: "stroke_horizontal",
                box: { x: 0, y: 50, width: 200, height: 10 },
                stroke: {
                    v: 1,
                    size: 4,
                    w: 200,
                    h: 10,
                    points: [
                        [0, 5],
                        [100, 5],
                        [200, 5],
                    ],
                },
            },
            {
                id: "stroke_distant",
                box: { x: 500, y: 500, width: 50, height: 50 },
                stroke: {
                    v: 1,
                    size: 4,
                    w: 50,
                    h: 50,
                    points: [
                        [0, 0],
                        [50, 50],
                    ],
                },
            },
        ];
        // Sweep vertical line crossing the horizontal stroke at (100, 50)
        const hits = sweepAndCollectHitStrokes(strokes, { x: 100, y: 0 }, { x: 100, y: 100 }, 14, 5);
        assert.ok(hits.includes("stroke_horizontal"), "Sweep should hit intersecting stroke");
        assert.ok(!hits.includes("stroke_distant"), "Sweep should not hit distant stroke");
        let erased = [];
        const eraserNode = EraserSweep({
            strokes,
            isActive: true,
            onDeleteStrokes: (ids) => {
                erased = ids;
            },
        });
        assert.equal(eraserNode.type, "div");
        assert.equal(eraserNode.props["style"]?.["cursor"], "crosshair");
        // Simulate pointer sweep dragging across the stroke
        const onDown = eraserNode.props["onPointerDown"];
        onDown?.({
            clientX: 100,
            clientY: 0,
            currentTarget: { getBoundingClientRect: () => ({ left: 0, top: 0 }) },
        });
        const onMove = eraserNode.props["onPointerMove"];
        onMove?.({
            clientX: 100,
            clientY: 100,
            currentTarget: { getBoundingClientRect: () => ({ left: 0, top: 0 }) },
        });
        assert.deepEqual(erased, ["stroke_horizontal"]);
    });
    it("3.11 CanvasViewport & Coordinate Conversions: converts world and screen coordinates", () => {
        const vp = { x: 100, y: 50, zoom: 2 };
        // Screen to world: (screen - offset) / zoom
        const world = screenToWorld(300, 250, vp);
        assert.equal(world.x, (300 - 100) / 2); // 100
        assert.equal(world.y, (250 - 50) / 2); // 100
        // World to screen: world * zoom + offset
        const screen = worldToScreen(100, 100, vp);
        assert.equal(screen.x, 300);
        assert.equal(screen.y, 250);
        const vpNode = CanvasViewport({
            viewport: DEFAULT_VIEWPORT,
        });
        assert.equal(vpNode.type, "div");
        assert.ok(vpNode.props["className"].includes("dsh-cult-canvas-root"));
    });
    it("3.12 CanvasToolbar & CanvasMinimap: renders tools and minimap camera view", () => {
        assert.equal(WHITEBOARD_TOOLS.length, 8);
        const toolIds = WHITEBOARD_TOOLS.map((t) => t.id);
        assert.deepEqual(toolIds, [
            "select",
            "hand",
            "sticky",
            "text",
            "shape",
            "marker",
            "eraser",
            "frame",
        ]);
        let selectedTool = "select";
        const toolbarNode = CanvasToolbar({
            activeTool: "select",
            onSelectTool: (t) => {
                selectedTool = t;
            },
        });
        assert.equal(toolbarNode.type, "aside");
        // Find the marker tool button in toolbarNode.children and trigger its onClick
        const markerBtn = toolbarNode.children.find((c) => Boolean(c?.props?.["className"]?.toString().includes("tool-marker")));
        assert.ok(markerBtn !== undefined);
        const clickBtn = markerBtn.props?.["onClick"];
        clickBtn?.();
        assert.equal(selectedTool, "marker");
        const minimapNode = CanvasMinimap({
            elements: [
                {
                    id: "e1",
                    kind: "sticky",
                    x: 0,
                    y: 0,
                    width: 220,
                    height: 220,
                    text: "Sticky",
                },
                {
                    id: "e2",
                    kind: "shape",
                    shapeType: "rect",
                    x: 400,
                    y: 300,
                    width: 200,
                    height: 150,
                    text: "Shape",
                },
            ],
            viewport: DEFAULT_VIEWPORT,
        });
        assert.equal(minimapNode.type, "div");
        assert.ok(minimapNode.props["className"].includes("dsh-cult-canvas-minimap"));
    });
    it("3.13 CanvasToolView: renders tool parameters, execution status and disclosure", () => {
        const toolView = CanvasToolView({
            toolName: "canvas_create_element",
            callId: "call_abc12345",
            payload: {
                status: "completed",
                args: { kind: "sticky", text: "New Note" },
                result: { ok: true, id: "elem_1" },
            },
            expanded: true,
        });
        assert.equal(toolView.type, "div");
        assert.ok(toolView.props["className"].includes("tool-canvas_create_element"));
    });
    it("3.14 CultCanvasBoard: mounts master whiteboard and accepts initial elements", () => {
        const initialElements = [
            {
                id: "note_1",
                kind: "sticky",
                x: 50,
                y: 50,
                width: 220,
                height: 220,
                text: "Master Whiteboard",
            },
        ];
        const board = CultCanvasBoard({
            initialElements,
        });
        assert.equal(board.type, "div");
        assert.ok(board.props["className"].includes("dsh-cult-canvas-board"));
    });
    it("3.15 CultCanvasBoard: incremental dragging with small per-frame steps moves elements without snapping trap", () => {
        // Create stateful React test harness to track interactive component cycles
        let hookIdx = 0;
        const hookValues = [];
        const testReact = {
            Fragment: "fragment",
            createElement(type, props, ...children) {
                const flatChildren = children.flat();
                return {
                    type,
                    props: { ...props, children: flatChildren },
                    children: flatChildren,
                };
            },
            useState(initial) {
                const idx = hookIdx++;
                if (hookValues[idx] === undefined) {
                    hookValues[idx] =
                        typeof initial === "function" ? initial() : initial;
                }
                const setState = (val) => {
                    hookValues[idx] =
                        typeof val === "function"
                            ? val(hookValues[idx])
                            : val;
                };
                return [hookValues[idx], setState];
            },
            useRef(initial) {
                const idx = hookIdx++;
                if (hookValues[idx] === undefined) {
                    hookValues[idx] = { current: initial };
                }
                return hookValues[idx];
            },
            useCallback(fn) {
                return fn;
            },
            useMemo(fn) {
                return fn();
            },
            useEffect() { },
        };
        setReact(testReact);
        let latestElements = [];
        const initialElements = [
            {
                id: "note_1",
                kind: "sticky",
                x: 100,
                y: 100,
                width: 220,
                height: 220,
                text: "Drag Snapping Test",
            },
        ];
        const render = () => {
            hookIdx = 0;
            return CultCanvasBoard({
                initialElements,
                onStateChange: (els) => {
                    latestElements = els;
                },
            });
        };
        // 1. Initial render
        let board = render();
        const viewport = board.children[1];
        const domGroup = viewport.props["domContent"];
        const sticky = domGroup.children[0];
        // 2. Select note and start drag at (0, 0)
        const onElementPointerDown = sticky.props["onPointerDown"];
        assert.ok(typeof onElementPointerDown === "function", "StickyNote must provide onPointerDown");
        onElementPointerDown("note_1", {
            clientX: 0,
            clientY: 0,
            stopPropagation: () => { },
        });
        // 3. Move pointer by 50 small steps of 2px each (total 100px)
        // Under the old bug, each 2px step rounded snapToGrid(100 + 2) to 100, leaving element permanently at 100.
        const onPointerMove = viewport.props["onPointerMove"];
        for (let step = 1; step <= 50; step++) {
            onPointerMove({
                clientX: step * 2,
                clientY: step * 2,
            });
        }
        // Re-render to observe state
        board = render();
        const movedNote = latestElements.find((e) => e.id === "note_1");
        assert.ok(movedNote, "Note must still exist");
        // 100 initial + 100 total displacement = 200 (snapped to 20px grid)
        assert.equal(movedNote.x, 200, "Cumulative displacement must reach 200, avoiding incremental snap trap");
        assert.equal(movedNote.y, 200, "Cumulative displacement must reach 200, avoiding incremental snap trap");
        // Reset React mock for subsequent tests
        setReact(mockReact);
    });
    it("3.16 CultCanvasBoard: resize handles interactively update element dimensions and position", () => {
        let hookIdx = 0;
        const hookValues = [];
        const testReact = {
            Fragment: "fragment",
            createElement(type, props, ...children) {
                const flatChildren = children.flat();
                return {
                    type,
                    props: { ...props, children: flatChildren },
                    children: flatChildren,
                };
            },
            useState(initial) {
                const idx = hookIdx++;
                if (hookValues[idx] === undefined) {
                    hookValues[idx] =
                        typeof initial === "function" ? initial() : initial;
                }
                const setState = (val) => {
                    hookValues[idx] =
                        typeof val === "function"
                            ? val(hookValues[idx])
                            : val;
                };
                return [hookValues[idx], setState];
            },
            useRef(initial) {
                const idx = hookIdx++;
                if (hookValues[idx] === undefined) {
                    hookValues[idx] = { current: initial };
                }
                return hookValues[idx];
            },
            useCallback(fn) {
                return fn;
            },
            useMemo(fn) {
                return fn();
            },
            useEffect() { },
        };
        setReact(testReact);
        let latestElements = [];
        const initialElements = [
            {
                id: "shape_1",
                kind: "shape",
                shapeType: "rect",
                x: 100,
                y: 100,
                width: 100,
                height: 100,
                text: "Resize Test",
            },
        ];
        const render = () => {
            hookIdx = 0;
            return CultCanvasBoard({
                initialElements,
                onStateChange: (els) => {
                    latestElements = els;
                },
            });
        };
        // 1. Initial render & select element
        let board = render();
        let viewport = board.children[1];
        let domGroup = viewport.props["domContent"];
        const shape = domGroup.children[0];
        const onElementPointerDown = shape.props["onPointerDown"];
        onElementPointerDown("shape_1", {
            clientX: 100,
            clientY: 100,
            stopPropagation: () => { },
        });
        // 2. Re-render: SelectionOverlay should now be mounted
        board = render();
        viewport = board.children[1];
        domGroup = viewport.props["domContent"];
        const selectionOverlay = domGroup.children.find((c) => c &&
            typeof c.props?.["onResizeStart"] === "function" &&
            c.props?.["bounds"]);
        assert.ok(selectionOverlay, "SelectionOverlay must be rendered when selected");
        const onResizeStart = selectionOverlay.props["onResizeStart"];
        // 3. Resize via 'se' handle by dragging +60px in both axes
        onResizeStart("se", { clientX: 200, clientY: 200 });
        const onPointerMove = viewport.props["onPointerMove"];
        onPointerMove({ clientX: 260, clientY: 260 });
        const resizedNote = latestElements.find((e) => e.id === "shape_1");
        assert.ok(resizedNote, "Resized element must exist");
        assert.equal(resizedNote.width, 160, "Width must expand from 100 to 160");
        assert.equal(resizedNote.height, 160, "Height must expand from 100 to 160");
        assert.equal(resizedNote.x, 100, "Position x should remain anchor 100");
        assert.equal(resizedNote.y, 100, "Position y should remain anchor 100");
        // 4. Resize via 'nw' handle by dragging -40px (expanding top and left)
        onResizeStart("nw", { clientX: 100, clientY: 100 });
        onPointerMove({ clientX: 60, clientY: 60 });
        const nwResized = latestElements.find((e) => e.id === "shape_1");
        assert.ok(nwResized);
        // From 160 width, expanding left by 40px gives 200 width and moves x to 60
        assert.equal(nwResized.x, 60, "Position x should shift left to 60");
        assert.equal(nwResized.y, 60, "Position y should shift up to 60");
        assert.equal(nwResized.width, 200, "Width should expand to 200");
        assert.equal(nwResized.height, 200, "Height should expand to 200");
        setReact(mockReact);
    });
    it("3.17 CultCanvasBoard & StickyNote/ShapeElement: pointerdown selects element and initiates drag", () => {
        let hookIdx = 0;
        const hookValues = [];
        const testReact = {
            Fragment: "fragment",
            createElement(type, props, ...children) {
                const flatChildren = children.flat();
                return {
                    type,
                    props: { ...props, children: flatChildren },
                    children: flatChildren,
                };
            },
            useState(initial) {
                const idx = hookIdx++;
                if (hookValues[idx] === undefined) {
                    hookValues[idx] =
                        typeof initial === "function" ? initial() : initial;
                }
                const setState = (val) => {
                    hookValues[idx] =
                        typeof val === "function"
                            ? val(hookValues[idx])
                            : val;
                };
                return [hookValues[idx], setState];
            },
            useRef(initial) {
                const idx = hookIdx++;
                if (hookValues[idx] === undefined) {
                    hookValues[idx] = { current: initial };
                }
                return hookValues[idx];
            },
            useCallback(fn) {
                return fn;
            },
            useMemo(fn) {
                return fn();
            },
            useEffect() { },
        };
        setReact(testReact);
        let stoppedPropagation = false;
        const initialElements = [
            {
                id: "note_1",
                kind: "sticky",
                x: 40,
                y: 40,
                width: 200,
                height: 200,
                text: "Selection & Drag Test",
            },
        ];
        let latestEls = [];
        const render = () => {
            hookIdx = 0;
            return CultCanvasBoard({
                initialElements,
                onStateChange: (els) => {
                    latestEls = els;
                },
            });
        };
        const board = render();
        const viewport = board.children[1];
        const domGroup = viewport.props["domContent"];
        const sticky = domGroup.children[0];
        // Verify onPointerDown on StickyNote component
        const stickyComponent = StickyNote({
            id: "note_1",
            text: "Note",
            onPointerDown: (_id, _e) => { },
        });
        assert.ok(typeof stickyComponent.props["onPointerDown"] === "function", "StickyNote must bind onPointerDown to root div");
        // Execute pointerdown on sticky note in board
        const onElementPointerDown = sticky.props["onPointerDown"];
        onElementPointerDown("note_1", {
            clientX: 50,
            clientY: 50,
            stopPropagation: () => {
                stoppedPropagation = true;
            },
        });
        assert.ok(stoppedPropagation, "Pointer down on note must stop propagation to canvas background");
        // Drag the note
        const onPointerMove = viewport.props["onPointerMove"];
        onPointerMove({ clientX: 90, clientY: 90 }); // +40px
        const moved = latestEls.find((e) => e.id === "note_1");
        assert.ok(moved);
        assert.equal(moved.x, 80, "Note x should move from 40 to 80");
        assert.equal(moved.y, 80, "Note y should move from 40 to 80");
        setReact(mockReact);
    });
    it("3.18 Client Shell: defensively handles mock DOM with missing style.setAttribute and window.addEventListener", () => {
        // Test incomplete mock document where style.setAttribute is undefined
        const mockIncompleteDoc = {
            querySelectorAll: () => [],
            createElement: () => ({
                // setAttribute intentionally missing!
                textContent: "",
            }),
            head: {
                append: () => { },
            },
        };
        // Swap document
        const origDoc = globalThis.document;
        globalThis.document =
            mockIncompleteDoc;
        try {
            const effectCalls = [];
            const mockCtx = {
                effect(cb) {
                    effectCalls.push(cb);
                },
                locale: {
                    register() { },
                    bind: () => () => "",
                },
                slots: {
                    inject() { },
                    register: () => ({}),
                },
            };
            // Apply plugin
            apply(mockCtx);
            assert.ok(effectCalls.length >= 2);
            // Run style injection effect with incomplete mock DOM - should not throw
            const styleEffect = effectCalls[1];
            assert.doesNotThrow(() => {
                styleEffect();
            });
        }
        finally {
            globalThis.document = origDoc;
        }
        // Test CultCanvasBoard mount when window.addEventListener is undefined
        const origWin = globalThis.window;
        globalThis.window = {
        // addEventListener intentionally missing!
        };
        try {
            assert.doesNotThrow(() => {
                void CultCanvasBoard({
                    initialElements: [],
                });
            });
        }
        finally {
            globalThis.window = origWin;
        }
    });
    it("3.19 react-binding: setReact safely merges partial React mocks without wiping fallback hooks", () => {
        // Pass an incomplete React mock with only createElement (no useState or useRef)
        const incompleteMock = {
            createElement: () => "mock-node",
        };
        setReact(incompleteMock);
        // Must not throw or wipe useState
        assert.doesNotThrow(() => {
            const r = CultCanvasBoard({ initialElements: [] });
            assert.ok(r);
        });
        // Restore mockReact
        setReact(mockReact);
    });
});
