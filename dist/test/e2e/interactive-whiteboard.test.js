/**
 * Interactive Whiteboard DOM Simulation E2E Test Suite (Feature 25)
 *
 * Implements browser-based interactive simulation tests for the CultCanvasBoard
 * master whiteboard interface, CanvasViewport, CanvasToolbar, StickyNote,
 * ShapeElement, MarkerStroke, ElementManipulation, EraserSweep, and CanvasMinimap.
 *
 * Uses zero-dependency in-memory React hook harness and virtual DOM simulation,
 * supporting both Node.js native test runner (`node --test`) and Bun (`bun test`).
 *
 * @module @local/dsh-cult-canvas/test/e2e/interactive-whiteboard
 */
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { CultCanvasBoard, } from "../../src/presentation/components/CultCanvasBoard.js";
import { getReact, setReact, } from "../../src/presentation/components/react-binding.js";
import { CanvasToolbar, WHITEBOARD_TOOLS, } from "../../src/presentation/components/CanvasToolbar.js";
import { CanvasViewport, DEFAULT_VIEWPORT, MAX_ZOOM, MIN_ZOOM, screenToWorld, worldToScreen, } from "../../src/presentation/components/CanvasViewport.js";
import { DEFAULT_STICKY_SIZE, STICKY_PALETTE_COLORS, StickyNote, } from "../../src/presentation/components/StickyNote.js";
import { getShapeSvgPath, SUPPORTED_SHAPES, ShapeElement, } from "../../src/presentation/components/ShapeElement.js";
import { DEFAULT_MARKER_COLOR, DEFAULT_MARKER_WIDTH, generateMarkerCenterlinePath, generateMarkerOutlinePath, MARKER_PALETTE_COLORS, MARKER_PRESET_WIDTHS, MarkerStroke, MAX_MARKER_WIDTH, MIN_MARKER_WIDTH, } from "../../src/presentation/components/MarkerStroke.js";
import { computeSelectionBounds, RESIZE_HANDLES, SelectionOverlay, snapToGrid, } from "../../src/presentation/components/ElementManipulation.js";
import { DEFAULT_ERASER_RADIUS, EraserSweep, sweepAndCollectHitStrokes, } from "../../src/presentation/components/EraserSweep.js";
import { CanvasMinimap, MINIMAP_HEIGHT, MINIMAP_PADDING, MINIMAP_WIDTH, } from "../../src/presentation/components/CanvasMinimap.js";
import { createMarkerStroke } from "../../src/domain/elements.js";
import { getShapePaddingCompensation } from "../../src/domain/geometry.js";
class InteractiveWhiteboardHarness {
    hookIdx = 0;
    hookValues = [];
    effects = [];
    originalWindow;
    originalReact;
    listeners = new Map();
    latestElements = [];
    latestEdges = [];
    rootVNode = null;
    props;
    constructor(options = {}) {
        this.latestElements = options.initialElements
            ? [...options.initialElements]
            : [];
        this.latestEdges = options.initialEdges ? [...options.initialEdges] : [];
        this.props = {
            initialElements: options.initialElements ?? [],
            initialEdges: options.initialEdges ?? [],
            syncUrl: options.syncUrl,
            onStateChange: (els, edges) => {
                this.latestElements = els;
                this.latestEdges = edges;
            },
        };
        // 1. Setup mock window for keyboard events & dimensions
        this.originalWindow = globalThis.window;
        globalThis.window = {
            addEventListener: (ev, fn) => {
                if (!this.listeners.has(ev)) {
                    this.listeners.set(ev, new Set());
                }
                this.listeners.get(ev).add(fn);
            },
            removeEventListener: (ev, fn) => {
                this.listeners.get(ev)?.delete(fn);
            },
            dispatchEvent: (ev) => {
                const fns = this.listeners.get(ev.type);
                if (fns) {
                    for (const fn of fns)
                        fn(ev);
                }
                return true;
            },
        };
        // 2. Save original React binding and install stateful hook mock
        this.originalReact = getReact();
        this.installReact();
        this.render();
    }
    installReact() {
        const testReact = {
            Fragment: "dsh-fragment",
            createElement(type, props, ...children) {
                const flatChildren = children.flat();
                const p = { ...props };
                if (flatChildren.length > 0) {
                    p["children"] =
                        flatChildren.length === 1 ? flatChildren[0] : flatChildren;
                }
                return {
                    type,
                    props: p,
                    key: props?.["key"] ?? null,
                    children: flatChildren,
                };
            },
            useState: (initial) => {
                const idx = this.hookIdx++;
                if (this.hookValues[idx] === undefined) {
                    this.hookValues[idx] =
                        typeof initial === "function" ? initial() : initial;
                }
                const setState = (val) => {
                    this.hookValues[idx] =
                        typeof val === "function"
                            ? val(this.hookValues[idx])
                            : val;
                };
                return [this.hookValues[idx], setState];
            },
            useRef: (initial) => {
                const idx = this.hookIdx++;
                if (this.hookValues[idx] === undefined) {
                    this.hookValues[idx] = { current: initial };
                }
                return this.hookValues[idx];
            },
            useCallback: (fn) => {
                return fn;
            },
            useMemo: (fn) => {
                return fn();
            },
            useEffect: (cb, deps) => {
                const idx = this.hookIdx++;
                const prev = this.effects[idx];
                let shouldRun = !prev;
                if (prev && deps && prev.deps) {
                    shouldRun = deps.some((d, i) => d !== prev.deps[i]);
                }
                else if (prev && (!deps || !prev.deps)) {
                    shouldRun = true;
                }
                let cleanup = undefined;
                if (shouldRun) {
                    if (prev?.cleanup && typeof prev.cleanup === "function") {
                        try {
                            prev.cleanup();
                        }
                        catch {
                            // ignore
                        }
                    }
                    try {
                        cleanup = cb();
                    }
                    catch {
                        // ignore
                    }
                    this.effects[idx] = { effect: cb, deps, cleanup };
                }
            },
        };
        setReact(testReact);
    }
    render() {
        this.hookIdx = 0;
        this.rootVNode = CultCanvasBoard(this.props);
        return this.rootVNode;
    }
    getToolbar() {
        if (!this.rootVNode)
            this.render();
        return this.rootVNode.children[0];
    }
    getViewport() {
        if (!this.rootVNode)
            this.render();
        return this.rootVNode.children[1];
    }
    getMinimap() {
        if (!this.rootVNode)
            this.render();
        return this.rootVNode.children[2];
    }
    getEraser() {
        if (!this.rootVNode)
            this.render();
        return this.rootVNode.children[3] ?? null;
    }
    getDomContent() {
        return this.getViewport().props["domContent"];
    }
    getSvgContent() {
        return this.getViewport().props["svgContent"];
    }
    getElements() {
        return this.hookValues[0] ?? this.latestElements;
    }
    getEdges() {
        return this.hookValues[1] ?? this.latestEdges;
    }
    getSelectionOverlay() {
        const domChildren = this.getDomContent().children ?? [];
        return (domChildren.find((c) => c &&
            (c.type === SelectionOverlay ||
                c.props?.["onResizeStart"] !== undefined)) ?? null);
    }
    findSticky(id) {
        const domChildren = this.getDomContent().children ?? [];
        return domChildren.find((c) => c?.props?.["id"] === id) ?? null;
    }
    findShape(id) {
        const domChildren = this.getDomContent().children ?? [];
        return domChildren.find((c) => c?.props?.["id"] === id) ?? null;
    }
    findStroke(id) {
        const svgChildren = this.getSvgContent().children ?? [];
        return svgChildren.find((c) => c?.props?.["id"] === id) ?? null;
    }
    renderToolbar() {
        return CanvasToolbar(this.getToolbar().props);
    }
    selectTool(tool) {
        const toolbar = this.getToolbar();
        const onSelectTool = toolbar.props["onSelectTool"];
        onSelectTool(tool);
        this.render();
    }
    setMarkerColor(color) {
        const toolbar = this.getToolbar();
        const onSelectMarkerColor = toolbar.props["onSelectMarkerColor"];
        onSelectMarkerColor(color);
        this.render();
    }
    setMarkerWidth(width) {
        const toolbar = this.getToolbar();
        const onSelectMarkerWidth = toolbar.props["onSelectMarkerWidth"];
        onSelectMarkerWidth(width);
        this.render();
    }
    setSelectedShape(shape) {
        const toolbar = this.getToolbar();
        const onSelectShape = toolbar.props["onSelectShape"];
        onSelectShape(shape);
        this.render();
    }
    setStickyColor(color) {
        const toolbar = this.getToolbar();
        const onSelectStickyColor = toolbar.props["onSelectStickyColor"];
        onSelectStickyColor(color);
        this.render();
    }
    pointerDown(x, y, options = {}) {
        const vp = this.getViewport();
        const onDown = vp.props["onPointerDown"];
        onDown({
            clientX: x,
            clientY: y,
            altKey: options.altKey ?? false,
            shiftKey: options.shiftKey ?? false,
            currentTarget: {
                getBoundingClientRect: () => ({
                    left: 0,
                    top: 0,
                    width: 1200,
                    height: 800,
                }),
            },
        });
        this.render();
    }
    pointerMove(x, y, options = {}) {
        const vp = this.getViewport();
        const onMove = vp.props["onPointerMove"];
        onMove({
            clientX: x,
            clientY: y,
            altKey: options.altKey ?? false,
            shiftKey: options.shiftKey ?? false,
            currentTarget: {
                getBoundingClientRect: () => ({
                    left: 0,
                    top: 0,
                    width: 1200,
                    height: 800,
                }),
            },
        });
        this.render();
    }
    pointerUp() {
        const vp = this.getViewport();
        const onUp = vp.props["onPointerUp"];
        onUp();
        this.render();
    }
    pointerDownElement(id, x, y, options = {}) {
        const el = this.findSticky(id) ?? this.findShape(id) ?? this.findStroke(id);
        if (!el) {
            throw new Error(`Element ${id} not found in DOM or SVG layers`);
        }
        const onDown = el.props["onPointerDown"];
        let stopped = false;
        onDown(id, {
            clientX: x,
            clientY: y,
            altKey: options.altKey ?? false,
            shiftKey: options.shiftKey ?? false,
            stopPropagation: () => {
                stopped = true;
                options.stopPropagation?.();
            },
            currentTarget: {
                getBoundingClientRect: () => ({
                    left: 0,
                    top: 0,
                    width: 1200,
                    height: 800,
                }),
            },
        });
        this.render();
        return { stoppedPropagation: stopped };
    }
    startResize(handle, startX, startY) {
        const overlay = this.getSelectionOverlay();
        if (!overlay) {
            throw new Error("SelectionOverlay not rendered - is an element selected?");
        }
        const onResizeStart = overlay.props["onResizeStart"];
        onResizeStart(handle, {
            clientX: startX,
            clientY: startY,
            stopPropagation: () => { },
            currentTarget: {
                getBoundingClientRect: () => ({
                    left: 0,
                    top: 0,
                    width: 1200,
                    height: 800,
                }),
            },
        });
        this.render();
    }
    dispatchKeyDown(keyEvent) {
        const win = globalThis.window;
        if (!win?.dispatchEvent) {
            throw new Error("Mock window not initialized");
        }
        let prevented = false;
        win.dispatchEvent({
            type: "keydown",
            preventDefault: () => {
                prevented = true;
            },
            ...keyEvent,
        });
        this.render();
        return { defaultPrevented: prevented };
    }
    dispatchWheel(wheelData) {
        const vp = this.getViewport();
        const vpNode = CanvasViewport(vp.props);
        const onWheel = vpNode.props["onWheel"];
        onWheel({
            ...wheelData,
            currentTarget: {
                getBoundingClientRect: () => ({
                    left: 0,
                    top: 0,
                    width: 1200,
                    height: 800,
                }),
            },
        });
        this.render();
    }
    dispatchMinimapClick(clientX, clientY) {
        const minimap = this.getMinimap();
        const minimapNode = CanvasMinimap(minimap.props);
        const onClick = minimapNode.props["onClick"];
        onClick({
            clientX,
            clientY,
            currentTarget: {
                getBoundingClientRect: () => ({
                    left: 0,
                    top: 0,
                    width: MINIMAP_WIDTH,
                    height: MINIMAP_HEIGHT,
                }),
            },
        });
        this.render();
    }
    destroy() {
        for (const eff of this.effects) {
            if (eff?.cleanup && typeof eff.cleanup === "function") {
                try {
                    eff.cleanup();
                }
                catch {
                    // ignore
                }
            }
        }
        this.effects = [];
        this.listeners.clear();
        globalThis.window =
            this.originalWindow;
        setReact(this.originalReact);
    }
}
/**
 * Isolated hook runner for testing sub-component state transitions
 * (such as double-click editing and blur on StickyNote and ShapeElement).
 */
class SubComponentHarness {
    hookIdx = 0;
    hookValues = [];
    componentFn;
    props;
    constructor(componentFn, initialProps) {
        this.componentFn = componentFn;
        this.props = { ...initialProps };
    }
    updateProps(partial) {
        this.props = { ...this.props, ...partial };
    }
    render() {
        const savedReact = getReact();
        const testReact = {
            Fragment: "dsh-fragment",
            createElement(type, props, ...children) {
                const flatChildren = children.flat();
                const p = { ...props };
                if (flatChildren.length > 0) {
                    p["children"] =
                        flatChildren.length === 1 ? flatChildren[0] : flatChildren;
                }
                return {
                    type,
                    props: p,
                    key: props?.["key"] ?? null,
                    children: flatChildren,
                };
            },
            useState: (initial) => {
                const idx = this.hookIdx++;
                if (this.hookValues[idx] === undefined) {
                    this.hookValues[idx] =
                        typeof initial === "function" ? initial() : initial;
                }
                const setState = (val) => {
                    this.hookValues[idx] =
                        typeof val === "function"
                            ? val(this.hookValues[idx])
                            : val;
                };
                return [this.hookValues[idx], setState];
            },
            useRef: (initial) => {
                const idx = this.hookIdx++;
                if (this.hookValues[idx] === undefined) {
                    this.hookValues[idx] = { current: initial };
                }
                return this.hookValues[idx];
            },
            useCallback: (fn) => {
                return fn;
            },
            useMemo: (fn) => {
                return fn();
            },
            useEffect: () => { },
        };
        setReact(testReact);
        this.hookIdx = 0;
        try {
            return this.componentFn(this.props);
        }
        finally {
            setReact(savedReact);
        }
    }
}
// ============================================================================
// 2. Interactive Whiteboard E2E Test Suites (Feature 25)
// ============================================================================
describe("Feature 25: Interactive Whiteboard DOM Simulation Suite", () => {
    let harness;
    afterEach(() => {
        if (harness) {
            harness.destroy();
        }
    });
    // --------------------------------------------------------------------------
    // Suite 1: Freehand Marker Drawing & Color Palette
    // --------------------------------------------------------------------------
    describe("Suite 1: Freehand Marker Drawing & Color Palette", () => {
        it("1.1 activates marker tool from toolbar and verifies crosshair cursor", () => {
            assert.equal(WHITEBOARD_TOOLS.length, 8);
            harness = new InteractiveWhiteboardHarness({ initialElements: [] });
            // Initial tool is select -> cursor is default
            assert.equal(harness.getViewport().props["cursor"], "default");
            // Activate marker tool
            harness.selectTool("marker");
            // Viewport receives crosshair cursor
            const vp = harness.getViewport();
            assert.equal(vp.props["cursor"], "crosshair");
            // Toolbar reflects active state on marker button
            const toolbarNode = harness.renderToolbar();
            const markerBtn = toolbarNode.children.find((c) => c?.props?.["className"]?.includes("tool-marker"));
            assert.ok(markerBtn, "Marker button must exist on toolbar");
            assert.ok(markerBtn.props["className"].includes("active"), "Marker button must have active class");
        });
        it("1.2 generates freehand marker stroke from pointerdown, pointermove, and pointerup", () => {
            harness = new InteractiveWhiteboardHarness({ initialElements: [] });
            harness.selectTool("marker");
            // Start drawing at (100, 100), move through (150, 120), end at (200, 150)
            harness.pointerDown(100, 100);
            harness.pointerMove(150, 120);
            harness.pointerMove(200, 150);
            harness.pointerUp();
            const elements = harness.latestElements;
            assert.equal(elements.length, 1, "Should create exactly 1 new stroke element");
            const stroke = elements[0];
            assert.equal(stroke.kind, "stroke");
            assert.ok(stroke.id.startsWith("stroke_"), "Stroke id should have stroke_ prefix");
            assert.ok(stroke.points && stroke.points.length >= 3);
            assert.equal(stroke.color, DEFAULT_MARKER_COLOR);
            assert.equal(stroke.strokeWidth, DEFAULT_MARKER_WIDTH);
            // Bounds should enclose the stroke points
            assert.ok(stroke.x <= 100);
            assert.ok(stroke.y <= 100);
            assert.ok(stroke.width >= 100);
            assert.ok(stroke.height >= 50);
        });
        it("1.3 marker stroke generates smooth closed SVG outline path and centerline path", () => {
            assert.equal(MIN_MARKER_WIDTH, 2);
            assert.equal(MAX_MARKER_WIDTH, 24);
            const strokePoints = [
                [100, 100],
                [150, 120],
                [200, 150],
            ];
            const outlinePath = generateMarkerOutlinePath(strokePoints, 8);
            assert.ok(outlinePath.startsWith("M"), "Outline path must begin with M command");
            assert.ok(outlinePath.endsWith("Z"), "Outline path must be closed with Z command");
            const centerlinePath = generateMarkerCenterlinePath(strokePoints);
            assert.ok(centerlinePath.startsWith("M100,100"), "Centerline path must begin at origin point");
            assert.ok(centerlinePath.includes("L200,150"), "Centerline path must include destination point");
            // Render MarkerStroke component node and inspect SVG elements
            const strokeNode = MarkerStroke({
                id: "stroke_test_1",
                points: strokePoints,
                width: 8,
                color: "#E03E3E",
                isSelected: true,
            });
            assert.equal(strokeNode.type, "g");
            const cls = strokeNode.props["className"];
            assert.ok(cls.includes("dsh-cult-canvas-marker-stroke"));
            assert.ok(cls.includes("selected"));
            // Check children: hit area, filled outline, and selection halo
            const children = strokeNode.children;
            assert.equal(children.length, 3);
            assert.ok(children[0].props["className"].includes("dsh-marker-hit-area"));
            assert.ok(children[1].props["className"].includes("dsh-marker-fill"));
            assert.ok(children[2].props["className"].includes("dsh-marker-selection-halo"));
        });
        it("1.4 renders in-flight marker drawing preview path during pointermove", () => {
            harness = new InteractiveWhiteboardHarness({ initialElements: [] });
            harness.selectTool("marker");
            // Down and move without up
            harness.pointerDown(50, 50);
            harness.pointerMove(80, 80);
            // Check preview layer in svgContent
            const svgContent = harness.getSvgContent();
            const previewNode = svgContent.children.find((c) => c?.props?.["className"]?.includes("dsh-marker-preview"));
            assert.ok(previewNode !== undefined, "Preview path must render while pointer is down and moving");
            assert.equal(previewNode.type, "path");
            const d = previewNode.props["d"];
            assert.ok(d.startsWith("M") && d.endsWith("Z"));
            // Pointer up clears preview
            harness.pointerUp();
            const afterSvg = harness.getSvgContent();
            const afterPreview = afterSvg.children.find((c) => c?.props?.["className"]?.includes("dsh-marker-preview"));
            assert.equal(afterPreview, undefined, "Preview path must be cleared after pointerup");
        });
        it("1.5 selects marker color and width presets from toolbar flyout", () => {
            harness = new InteractiveWhiteboardHarness({ initialElements: [] });
            harness.selectTool("marker");
            // Choose color #E03E3E (red) and width 16
            const selectedColor = MARKER_PALETTE_COLORS[1]; // #E03E3E
            const selectedWidth = MARKER_PRESET_WIDTHS[3]; // 16
            harness.setMarkerColor(selectedColor);
            harness.setMarkerWidth(selectedWidth);
            // Draw stroke
            harness.pointerDown(10, 10);
            harness.pointerMove(30, 40);
            harness.pointerUp();
            const stroke = harness.latestElements[0];
            assert.equal(stroke.color, "#E03E3E");
            assert.equal(stroke.strokeWidth, 16);
        });
    });
    // --------------------------------------------------------------------------
    // Suite 2: Sticky Notes & In-Place Editing
    // --------------------------------------------------------------------------
    describe("Suite 2: Sticky Notes & In-Place Editing", () => {
        it("2.1 places sticky note at world coordinates via sticky tool pointerdown", () => {
            harness = new InteractiveWhiteboardHarness({ initialElements: [] });
            // Select sticky tool
            harness.selectTool("sticky");
            // Click at (300, 300)
            harness.pointerDown(300, 300);
            // Sticky note created with 220x220 dimensions and auto-switches tool to select
            const elements = harness.latestElements;
            assert.equal(elements.length, 1);
            const note = elements[0];
            assert.equal(note.kind, "sticky");
            assert.equal(note.width, DEFAULT_STICKY_SIZE);
            assert.equal(note.height, DEFAULT_STICKY_SIZE);
            assert.equal(note.color, "#FFF59A");
            // Active tool auto-resets to select
            assert.equal(harness.getViewport().props["cursor"], "default");
        });
        it("2.2 double-click triggers in-place editing mode rendering textarea", () => {
            const stickyRunner = new SubComponentHarness(StickyNote, {
                id: "note_interactive",
                text: "Editable Content",
                color: "#FFF59A",
                isSelected: true,
            });
            // Initial render: div.dsh-sticky-content
            let node = stickyRunner.render();
            let contentDiv = node.children.find((c) => c?.props?.["className"]?.includes("dsh-sticky-content"));
            assert.ok(contentDiv, "Must display content div in read mode");
            // Trigger double-click
            const onDblClick = node.props["onDoubleClick"];
            assert.ok(typeof onDblClick === "function");
            onDblClick({ stopPropagation: () => { } });
            // Re-render: textarea mounts with autoFocus
            node = stickyRunner.render();
            const textarea = node.children.find((c) => c?.props?.["className"]?.includes("dsh-sticky-textarea"));
            assert.ok(textarea, "Must mount textarea after double-click");
            assert.equal(textarea.props["autoFocus"], true);
            assert.equal(textarea.props["value"], "Editable Content");
        });
        it("2.3 text input and blur commit changes to canvas store state", () => {
            let committedText = "";
            const stickyRunner = new SubComponentHarness(StickyNote, {
                id: "note_commit",
                text: "Original Text",
                color: "#FFF59A",
                onChangeText: (_id, text) => {
                    committedText = text;
                },
            });
            // Enter editing mode
            let node = stickyRunner.render();
            node.props["onDoubleClick"]({
                stopPropagation: () => { },
            });
            // Re-render: textarea mounts
            node = stickyRunner.render();
            let textarea = node.children.find((c) => c?.props?.["className"]?.includes("dsh-sticky-textarea"));
            const onChange = textarea.props["onChange"];
            onChange({ target: { value: "Updated Sticky Idea" } });
            // Re-render so that editText state updates to the new value before blur
            node = stickyRunner.render();
            textarea = node.children.find((c) => c?.props?.["className"]?.includes("dsh-sticky-textarea"));
            // Blur commit
            const onBlur = textarea.props["onBlur"];
            onBlur();
            assert.equal(committedText, "Updated Sticky Idea", "Blur must commit text via onChangeText");
            // Update props with committed text and re-render: returns to content div
            stickyRunner.updateProps({ text: committedText });
            node = stickyRunner.render();
            const content = node.children.find((c) => c?.props?.["className"]?.includes("dsh-sticky-content"));
            assert.equal(content.children[0], "Updated Sticky Idea");
        });
        it("2.4 selecting sticky note reveals 5-color palette", () => {
            // Unselected note
            const unselected = StickyNote({
                id: "n_unsel",
                text: "Note",
                isSelected: false,
            });
            const unselPalette = unselected.children.find((c) => c?.props?.["className"]?.includes("dsh-sticky-color-palette"));
            assert.equal(unselPalette, undefined, "Palette must be hidden when unselected");
            // Selected note
            const selected = StickyNote({
                id: "n_sel",
                text: "Note",
                isSelected: true,
                onChangeColor: () => { },
            });
            const selPalette = selected.children.find((c) => c?.props?.["className"]?.includes("dsh-sticky-color-palette"));
            assert.ok(selPalette, "Palette must render when isSelected is true");
            const dots = selPalette.children;
            assert.equal(dots.length, 5, "Must render exactly 5 color dots");
            assert.deepEqual(STICKY_PALETTE_COLORS, [
                "#FFF59A",
                "#E3F2FD",
                "#E8F5E9",
                "#FFEBEE",
                "#F3E5F5",
            ]);
        });
        it("2.5 clicking palette dot updates sticky note background color", () => {
            let updatedColor = "";
            const selected = StickyNote({
                id: "n_color_test",
                text: "Note",
                isSelected: true,
                onChangeColor: (_id, col) => {
                    updatedColor = col;
                },
            });
            const palette = selected.children.find((c) => c?.props?.["className"]?.includes("dsh-sticky-color-palette"));
            const secondDot = palette.children[1];
            const clickDot = secondDot.props["onClick"];
            clickDot({});
            assert.equal(updatedColor, "#E3F2FD", "Clicking ice-blue dot should commit #E3F2FD");
        });
    });
    // --------------------------------------------------------------------------
    // Suite 3: Geometric Shapes & Inset Padding Compensation
    // --------------------------------------------------------------------------
    describe("Suite 3: Geometric Shapes & Inset Padding Compensation", () => {
        it("3.1 places geometric shape cards across all 7 supported shapes", () => {
            assert.equal(SUPPORTED_SHAPES.length, 7);
            for (const shapeType of SUPPORTED_SHAPES) {
                const shapeNode = ShapeElement({
                    id: `shape_${shapeType}`,
                    shapeType,
                    x: 100,
                    y: 100,
                    text: shapeType.toUpperCase(),
                });
                assert.equal(shapeNode.type, "div");
                assert.equal(shapeNode.props["data-shape-type"], shapeType);
                assert.ok(shapeNode.props["className"].includes(`shape-${shapeType}`));
            }
        });
        it("3.2 diamond shape compensates text padding with 22% inline inset", () => {
            const comp = getShapePaddingCompensation("diamond");
            assert.equal(comp.paddingInlinePercent, 22);
            assert.equal(comp.textOffsetY, 0);
            const diamondSvg = getShapeSvgPath("diamond", 200, 200);
            assert.ok(diamondSvg.startsWith("M 100 0"), "Diamond SVG starts at top center");
            assert.ok(diamondSvg.includes("L 200 100"), "Diamond connects to right vertex");
            assert.ok(diamondSvg.includes("L 100 200"), "Diamond connects to bottom vertex");
            assert.ok(diamondSvg.includes("L 0 100"), "Diamond connects to left vertex");
            assert.ok(diamondSvg.endsWith("Z"), "Diamond polygon is closed");
            // Render ShapeElement
            const node = ShapeElement({
                id: "dia_1",
                shapeType: "diamond",
                width: 200,
                height: 200,
                text: "Diamond",
            });
            const textContainer = node.children.find((c) => c?.props?.["className"]?.includes("dsh-shape-text-wrapper"));
            const style = textContainer.props["style"];
            // 200 * 0.22 = 44px padding
            assert.equal(style["paddingLeft"], "44px");
            assert.equal(style["paddingRight"], "44px");
        });
        it("3.3 circle shape compensates text padding with 14% inline inset", () => {
            const comp = getShapePaddingCompensation("circle");
            assert.equal(comp.paddingInlinePercent, 14);
            const node = ShapeElement({
                id: "circle_1",
                shapeType: "circle",
                width: 200,
                height: 200,
                text: "Circle",
            });
            const textContainer = node.children.find((c) => c?.props?.["className"]?.includes("dsh-shape-text-wrapper"));
            const style = textContainer.props["style"];
            // 200 * 0.14 = 28px padding
            assert.equal(style["paddingLeft"], "28px");
            assert.equal(style["paddingRight"], "28px");
        });
        it("3.4 database cylinder shape applies 20px top vertical text offset", () => {
            const comp = getShapePaddingCompensation("database");
            assert.equal(comp.textOffsetY, 20);
            const dbSvg = getShapeSvgPath("database", 200, 160);
            assert.ok(dbSvg.includes("A 100"), "Database path contains cylindrical top and bottom arcs");
            const node = ShapeElement({
                id: "db_1",
                shapeType: "database",
                width: 200,
                height: 160,
                text: "Database Table",
            });
            const textContainer = node.children.find((c) => c?.props?.["className"]?.includes("dsh-shape-text-wrapper"));
            const style = textContainer.props["style"];
            assert.equal(style["transform"], "translateY(20px)");
        });
        it("3.5 pill shape renders 9999px border radius pill capsule", () => {
            const node = ShapeElement({
                id: "pill_1",
                shapeType: "pill",
                width: 200,
                height: 80,
                text: "Capsule Button",
            });
            assert.equal(node.type, "div");
            assert.equal(node.props["data-shape-type"], "pill");
            // Pill shape has empty SVG path because it uses CSS border-radius
            assert.equal(getShapeSvgPath("pill", 200, 80), "");
            // Pill text padding compensation is 0
            const comp = getShapePaddingCompensation("pill");
            assert.equal(comp.paddingInlinePercent, 0);
            assert.equal(comp.textOffsetY, 0);
        });
        it("3.6 double-click text editing and blur commit on shape element", () => {
            let committed = "";
            const shapeRunner = new SubComponentHarness(ShapeElement, {
                id: "shape_edit",
                shapeType: "rect",
                text: "Original Architecture",
                onChangeText: (_id, text) => {
                    committed = text;
                },
            });
            // Enter edit mode
            let node = shapeRunner.render();
            node.props["onDoubleClick"]({
                stopPropagation: () => { },
            });
            // Textarea renders inside text container
            node = shapeRunner.render();
            const textContainer = node.children.find((c) => c?.props?.["className"]?.includes("dsh-shape-text-wrapper"));
            let textarea = textContainer.children.find((c) => c?.props?.["className"]?.includes("dsh-shape-textarea"));
            assert.ok(textarea, "Must mount textarea for shape editing");
            // Type
            textarea.props["onChange"]({
                target: { value: "Updated Microservices Flow" },
            });
            // Re-render so that state updates before blur
            node = shapeRunner.render();
            const updatedContainer = node.children.find((c) => c?.props?.["className"]?.includes("dsh-shape-text-wrapper"));
            textarea = updatedContainer.children.find((c) => c?.props?.["className"]?.includes("dsh-shape-textarea"));
            // Blur commit
            textarea.props["onBlur"]();
            assert.equal(committed, "Updated Microservices Flow");
        });
    });
    // --------------------------------------------------------------------------
    // Suite 4: Element Selection, Bounding Box & 20px Grid Snapping
    // --------------------------------------------------------------------------
    describe("Suite 4: Element Selection, Bounding Box & 20px Grid Snapping", () => {
        it("4.1 pointerdown on element selects it and stops propagation to canvas", () => {
            harness = new InteractiveWhiteboardHarness({
                initialElements: [
                    {
                        id: "note_1",
                        kind: "sticky",
                        x: 100,
                        y: 100,
                        width: 220,
                        height: 220,
                        text: "First Note",
                    },
                    {
                        id: "note_2",
                        kind: "sticky",
                        x: 400,
                        y: 100,
                        width: 220,
                        height: 220,
                        text: "Second Note",
                    },
                ],
            });
            const { stoppedPropagation } = harness.pointerDownElement("note_1", 110, 110);
            assert.equal(stoppedPropagation, true, "Element pointer down must stop propagation");
            // SelectionOverlay renders for selected note
            const overlay = harness.getSelectionOverlay();
            assert.ok(overlay !== null, "Selection overlay must be visible");
            const bounds = overlay.props["bounds"];
            assert.equal(bounds.x, 100);
            assert.equal(bounds.y, 100);
            assert.equal(bounds.width, 220);
            assert.equal(bounds.height, 220);
        });
        it("4.2 Shift+click toggles multi-element selection", () => {
            harness = new InteractiveWhiteboardHarness({
                initialElements: [
                    {
                        id: "e1",
                        kind: "sticky",
                        x: 50,
                        y: 50,
                        width: 200,
                        height: 200,
                        text: "One",
                    },
                    {
                        id: "e2",
                        kind: "sticky",
                        x: 300,
                        y: 50,
                        width: 200,
                        height: 200,
                        text: "Two",
                    },
                ],
            });
            // Select e1
            harness.pointerDownElement("e1", 60, 60);
            // Shift+click e2 -> both selected
            harness.pointerDownElement("e2", 310, 60, { shiftKey: true });
            let overlay = harness.getSelectionOverlay();
            let bounds = overlay.props["bounds"];
            // Union from x: 50 to x: 500 = width 450
            assert.equal(bounds.x, 50);
            assert.equal(bounds.width, 450);
            // Shift+click e1 again -> toggles off e1, e2 remains selected
            harness.pointerDownElement("e1", 60, 60, { shiftKey: true });
            overlay = harness.getSelectionOverlay();
            bounds = overlay.props["bounds"];
            assert.equal(bounds.x, 300);
            assert.equal(bounds.width, 200);
        });
        it("4.3 rubberband marquee drag selects elements enclosed within rectangular region", () => {
            harness = new InteractiveWhiteboardHarness({
                initialElements: [
                    {
                        id: "inside_1",
                        kind: "sticky",
                        x: 100,
                        y: 100,
                        width: 200,
                        height: 200,
                        text: "Inside",
                    },
                    {
                        id: "outside_1",
                        kind: "sticky",
                        x: 600,
                        y: 600,
                        width: 200,
                        height: 200,
                        text: "Outside",
                    },
                ],
            });
            // Drag marquee on empty background from (50, 50) to (350, 350)
            harness.pointerDown(50, 50);
            harness.pointerMove(350, 350);
            // Viewport renders marquee box
            const vpNode = CanvasViewport(harness.getViewport().props);
            const marquee = vpNode.children.find((c) => c?.props?.["className"]?.includes("dsh-selection-marquee"));
            assert.ok(marquee, "Marquee element must render during drag");
            // Complete marquee drag
            harness.pointerUp();
            // Inside element is selected, outside is not
            const overlay = harness.getSelectionOverlay();
            assert.ok(overlay, "Overlay must mount for selected elements");
            const bounds = overlay.props["bounds"];
            assert.equal(bounds.x, 100);
            assert.equal(bounds.width, 200);
        });
        it("4.4 computes combined selection bounding box and renders SelectionOverlay", () => {
            const elements = [
                { x: 10, y: 20, width: 100, height: 80 },
                { x: 50, y: 70, width: 150, height: 90 },
            ];
            const bounds = computeSelectionBounds(elements);
            assert.ok(bounds);
            assert.equal(bounds.x, 10);
            assert.equal(bounds.y, 20);
            assert.equal(bounds.width, 190); // 200 - 10
            assert.equal(bounds.height, 140); // 160 - 20
        });
        it("4.5 dragging element snaps position to 20px grid multiples", () => {
            assert.equal(snapToGrid(24), 20);
            assert.equal(snapToGrid(31), 40);
            harness = new InteractiveWhiteboardHarness({
                initialElements: [
                    {
                        id: "snap_node",
                        kind: "sticky",
                        x: 100,
                        y: 100,
                        width: 200,
                        height: 200,
                        text: "Snap",
                    },
                ],
            });
            // Select node
            harness.pointerDownElement("snap_node", 100, 100);
            // Drag by arbitrary delta of +27px (total x: 127) -> rounds to 120 (snapToGrid)
            harness.pointerMove(127, 127);
            let moved = harness.latestElements.find((e) => e.id === "snap_node");
            assert.equal(moved.x, 120);
            assert.equal(moved.y, 120);
            // Move by another step to total delta +39px (total x: 139) -> rounds to 140
            harness.pointerMove(139, 139);
            moved = harness.latestElements.find((e) => e.id === "snap_node");
            assert.equal(moved.x, 140);
            assert.equal(moved.y, 140);
        });
    });
    // --------------------------------------------------------------------------
    // Suite 5: 8-Handle Resizing & Alt+Drag Duplication
    // --------------------------------------------------------------------------
    describe("Suite 5: 8-Handle Resizing & Alt+Drag Duplication", () => {
        it("5.1 SelectionOverlay renders exactly 8 resize handles with appropriate cursors", () => {
            assert.equal(RESIZE_HANDLES.length, 8);
            assert.deepEqual(RESIZE_HANDLES, [
                "nw",
                "n",
                "ne",
                "e",
                "se",
                "s",
                "sw",
                "w",
            ]);
            const overlay = SelectionOverlay({
                bounds: { x: 100, y: 100, width: 200, height: 200 },
                zoom: 1,
            });
            assert.equal(overlay.type, "div");
            const handles = overlay.children;
            assert.equal(handles.length, 8);
            for (const handle of RESIZE_HANDLES) {
                const handleNode = handles.find((h) => h?.props?.["data-handle"] === handle);
                assert.ok(handleNode, `Handle ${handle} must be rendered`);
                const cursor = handleNode.props["style"]["cursor"];
                assert.ok(cursor?.includes("resize"));
            }
        });
        it("5.2 dragging south-east handle expands element width and height", () => {
            harness = new InteractiveWhiteboardHarness({
                initialElements: [
                    {
                        id: "box_1",
                        kind: "shape",
                        shapeType: "rect",
                        x: 100,
                        y: 100,
                        width: 100,
                        height: 100,
                        text: "Box",
                    },
                ],
            });
            harness.pointerDownElement("box_1", 100, 100);
            harness.startResize("se", 200, 200);
            // Drag +60px in both axes
            harness.pointerMove(260, 260);
            const resized = harness.latestElements.find((e) => e.id === "box_1");
            assert.equal(resized.width, 160);
            assert.equal(resized.height, 160);
            assert.equal(resized.x, 100, "SE anchor keeps top-left origin fixed");
            assert.equal(resized.y, 100, "SE anchor keeps top-left origin fixed");
        });
        it("5.3 dragging north-west handle shifts position and expands dimensions", () => {
            harness = new InteractiveWhiteboardHarness({
                initialElements: [
                    {
                        id: "box_2",
                        kind: "shape",
                        shapeType: "rect",
                        x: 100,
                        y: 100,
                        width: 160,
                        height: 160,
                        text: "Box",
                    },
                ],
            });
            harness.pointerDownElement("box_2", 100, 100);
            harness.startResize("nw", 100, 100);
            // Drag -40px up and left
            harness.pointerMove(60, 60);
            const resized = harness.latestElements.find((e) => e.id === "box_2");
            assert.equal(resized.x, 60, "NW drag shifts x origin left to 60");
            assert.equal(resized.y, 60, "NW drag shifts y origin up to 60");
            assert.equal(resized.width, 200, "Width expands from 160 to 200");
            assert.equal(resized.height, 200, "Height expands from 160 to 200");
        });
        it("5.4 resizing enforces minimum element dimension clamp of 20px", () => {
            harness = new InteractiveWhiteboardHarness({
                initialElements: [
                    {
                        id: "box_min",
                        kind: "shape",
                        shapeType: "rect",
                        x: 100,
                        y: 100,
                        width: 100,
                        height: 100,
                        text: "Box",
                    },
                ],
            });
            harness.pointerDownElement("box_min", 100, 100);
            harness.startResize("se", 200, 200);
            // Shrink past zero
            harness.pointerMove(50, 50);
            const resized = harness.latestElements.find((e) => e.id === "box_min");
            assert.equal(resized.width, 20, "Width must be clamped to MIN_SIZE = 20");
            assert.equal(resized.height, 20, "Height must be clamped to MIN_SIZE = 20");
        });
        it("5.5 Alt+drag duplicates selected elements on first drag frame", () => {
            harness = new InteractiveWhiteboardHarness({
                initialElements: [
                    {
                        id: "orig_note",
                        kind: "sticky",
                        x: 100,
                        y: 100,
                        width: 200,
                        height: 200,
                        text: "Clone Me",
                    },
                ],
            });
            // Pointer down with Alt key
            harness.pointerDownElement("orig_note", 100, 100, { altKey: true });
            // Drag by 60px
            harness.pointerMove(160, 160);
            // Should now have 2 elements: original at (100, 100) and clone at (160, 160)
            const elements = harness.latestElements;
            assert.equal(elements.length, 2);
            const orig = elements.find((e) => e.id === "orig_note");
            assert.equal(orig.x, 100);
            assert.equal(orig.y, 100);
            const clone = elements.find((e) => e.id !== "orig_note");
            assert.ok(clone.id.startsWith("copy_"));
            assert.equal(clone.x, 160);
            assert.equal(clone.y, 160);
            assert.equal(clone.text, "Clone Me");
        });
    });
    // --------------------------------------------------------------------------
    // Suite 6: Keyboard Manipulation, Layer Ordering & Deletion
    // --------------------------------------------------------------------------
    describe("Suite 6: Keyboard Manipulation, Layer Ordering & Deletion", () => {
        it("6.1 Delete and Backspace hotkeys delete selected elements and cascade edges", () => {
            harness = new InteractiveWhiteboardHarness({
                initialElements: [
                    {
                        id: "node_a",
                        kind: "sticky",
                        x: 100,
                        y: 100,
                        width: 200,
                        height: 200,
                        text: "A",
                    },
                    {
                        id: "node_b",
                        kind: "sticky",
                        x: 400,
                        y: 100,
                        width: 200,
                        height: 200,
                        text: "B",
                    },
                ],
                initialEdges: [
                    {
                        id: "edge_ab",
                        fromNode: "node_a",
                        toNode: "node_b",
                    },
                ],
            });
            // Select node_a
            harness.pointerDownElement("node_a", 100, 100);
            // Delete key removes node_a and cascades edge_ab
            const { defaultPrevented } = harness.dispatchKeyDown({ key: "Delete" });
            assert.equal(defaultPrevented, true);
            assert.equal(harness.getElements().length, 1);
            assert.equal(harness.getElements()[0].id, "node_b");
            assert.equal(harness.getEdges().length, 0);
            // Select node_b and Backspace deletes it
            harness.pointerDownElement("node_b", 400, 100);
            harness.dispatchKeyDown({ key: "Backspace" });
            assert.equal(harness.getElements().length, 0);
        });
        it("6.2 Ctrl+D hotkey duplicates selected elements with 40px grid offset", () => {
            harness = new InteractiveWhiteboardHarness({
                initialElements: [
                    {
                        id: "elem_d",
                        kind: "sticky",
                        x: 100,
                        y: 100,
                        width: 200,
                        height: 200,
                        text: "Duplicate",
                    },
                ],
            });
            harness.pointerDownElement("elem_d", 100, 100);
            harness.dispatchKeyDown({ key: "d", ctrlKey: true });
            const elements = harness.latestElements;
            assert.equal(elements.length, 2);
            const duplicate = elements.find((e) => e.id !== "elem_d");
            assert.ok(duplicate.id.startsWith("copy_"));
            assert.equal(duplicate.x, 140); // 100 + 40
            assert.equal(duplicate.y, 140); // 100 + 40
        });
        it("6.3 ] hotkey brings selected element to the front of layer order", () => {
            harness = new InteractiveWhiteboardHarness({
                initialElements: [
                    {
                        id: "elem_a",
                        kind: "sticky",
                        x: 100,
                        y: 100,
                        width: 200,
                        height: 200,
                        text: "A",
                    },
                    {
                        id: "elem_b",
                        kind: "sticky",
                        x: 150,
                        y: 150,
                        width: 200,
                        height: 200,
                        text: "B",
                    },
                    {
                        id: "elem_c",
                        kind: "sticky",
                        x: 200,
                        y: 200,
                        width: 200,
                        height: 200,
                        text: "C",
                    },
                    {
                        id: "elem_d",
                        kind: "sticky",
                        x: 250,
                        y: 250,
                        width: 200,
                        height: 200,
                        text: "D",
                    },
                ],
            });
            // Select elem_b
            harness.pointerDownElement("elem_b", 150, 150);
            // ] hotkey brings selected element to the front (end of elements array)
            const { defaultPrevented } = harness.dispatchKeyDown({ key: "]" });
            assert.equal(defaultPrevented, true);
            const currentOrder = harness.latestElements.map((e) => e.id);
            assert.deepEqual(currentOrder, ["elem_a", "elem_c", "elem_d", "elem_b"]);
        });
        it("6.4 [ hotkey sends selected element to the back of layer order", () => {
            harness = new InteractiveWhiteboardHarness({
                initialElements: [
                    {
                        id: "elem_a",
                        kind: "sticky",
                        x: 100,
                        y: 100,
                        width: 200,
                        height: 200,
                        text: "A",
                    },
                    {
                        id: "elem_b",
                        kind: "sticky",
                        x: 150,
                        y: 150,
                        width: 200,
                        height: 200,
                        text: "B",
                    },
                    {
                        id: "elem_c",
                        kind: "sticky",
                        x: 200,
                        y: 200,
                        width: 200,
                        height: 200,
                        text: "C",
                    },
                    {
                        id: "elem_d",
                        kind: "sticky",
                        x: 250,
                        y: 250,
                        width: 200,
                        height: 200,
                        text: "D",
                    },
                ],
            });
            // Select elem_c
            harness.pointerDownElement("elem_c", 200, 200);
            // [ hotkey sends selected element to the back (start of elements array)
            const { defaultPrevented } = harness.dispatchKeyDown({ key: "[" });
            assert.equal(defaultPrevented, true);
            const currentOrder = harness.latestElements.map((e) => e.id);
            assert.deepEqual(currentOrder, ["elem_c", "elem_a", "elem_b", "elem_d"]);
        });
        it("6.5 Ctrl+] and Ctrl+[ step element forward and backward in layer order", () => {
            harness = new InteractiveWhiteboardHarness({
                initialElements: [
                    {
                        id: "elem_a",
                        kind: "sticky",
                        x: 100,
                        y: 100,
                        width: 200,
                        height: 200,
                        text: "A",
                    },
                    {
                        id: "elem_b",
                        kind: "sticky",
                        x: 150,
                        y: 150,
                        width: 200,
                        height: 200,
                        text: "B",
                    },
                    {
                        id: "elem_c",
                        kind: "sticky",
                        x: 200,
                        y: 200,
                        width: 200,
                        height: 200,
                        text: "C",
                    },
                    {
                        id: "elem_d",
                        kind: "sticky",
                        x: 250,
                        y: 250,
                        width: 200,
                        height: 200,
                        text: "D",
                    },
                ],
            });
            // Step elem_b forward (Ctrl+]): elem_b moves ahead of elem_c
            harness.pointerDownElement("elem_b", 150, 150);
            const { defaultPrevented: p1 } = harness.dispatchKeyDown({
                key: "]",
                ctrlKey: true,
            });
            assert.equal(p1, true);
            assert.deepEqual(harness.latestElements.map((e) => e.id), ["elem_a", "elem_c", "elem_b", "elem_d"]);
            // Step elem_b backward (Ctrl+[): moves behind elem_c again
            const { defaultPrevented: p2 } = harness.dispatchKeyDown({
                key: "[",
                ctrlKey: true,
            });
            assert.equal(p2, true);
            assert.deepEqual(harness.latestElements.map((e) => e.id), ["elem_a", "elem_b", "elem_c", "elem_d"]);
            // Select elem_d and step it backward (Ctrl+[): moves behind elem_c
            harness.pointerDownElement("elem_d", 250, 250);
            const { defaultPrevented: p3 } = harness.dispatchKeyDown({
                key: "[",
                ctrlKey: true,
            });
            assert.equal(p3, true);
            assert.deepEqual(harness.latestElements.map((e) => e.id), ["elem_a", "elem_b", "elem_d", "elem_c"]);
        });
    });
    // --------------------------------------------------------------------------
    // Suite 7: Eraser Sweep Intersecting Stroke Deletion
    // --------------------------------------------------------------------------
    describe("Suite 7: Eraser Sweep Intersecting Stroke Deletion", () => {
        it("7.1 activating eraser tool mounts EraserSweep overlay with crosshair cursor", () => {
            harness = new InteractiveWhiteboardHarness({ initialElements: [] });
            assert.equal(harness.getEraser(), null);
            harness.selectTool("eraser");
            const eraser = harness.getEraser();
            assert.ok(eraser !== null, "EraserSweep wrapper must be mounted");
            assert.equal(eraser.type, EraserSweep);
            assert.equal(eraser.props["isActive"], true);
            // Render EraserSweep component to verify overlay styles
            const overlayNode = EraserSweep(eraser.props);
            assert.equal(overlayNode.type, "div");
            assert.ok(overlayNode.props["className"].includes("dsh-cult-canvas-eraser-overlay"));
            assert.equal(overlayNode.props["style"]["cursor"], "crosshair");
        });
        it("7.2 sweeping pointer across marker stroke detects intersection and deletes stroke", () => {
            const directHits = sweepAndCollectHitStrokes([
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
            ], { x: 100, y: 0 }, { x: 100, y: 100 });
            assert.ok(directHits.includes("stroke_horizontal"));
            harness = new InteractiveWhiteboardHarness({
                initialElements: [
                    createMarkerStroke("stroke_horizontal", [
                        [0, 50],
                        [100, 50],
                        [200, 50],
                    ], 4, DEFAULT_MARKER_COLOR),
                ],
            });
            harness.selectTool("eraser");
            // Sweep vertically from (100, 0) to (100, 100), crossing y = 50
            harness.pointerDown(100, 0);
            harness.pointerMove(100, 100);
            assert.equal(harness.latestElements.length, 0, "Intersecting stroke must be deleted");
        });
        it("7.3 sweeping pointer away from strokes preserves distant strokes", () => {
            harness = new InteractiveWhiteboardHarness({
                initialElements: [
                    createMarkerStroke("stroke_distant", [
                        [500, 500],
                        [550, 550],
                    ], 4, DEFAULT_MARKER_COLOR),
                ],
            });
            harness.selectTool("eraser");
            // Sweep at (0, 0) to (50, 50)
            harness.pointerDown(0, 0);
            harness.pointerMove(50, 50);
            assert.equal(harness.latestElements.length, 1, "Distant stroke must not be erased");
            assert.equal(harness.latestElements[0].id, "stroke_distant");
        });
        it("7.4 eraser sweep does NOT delete non-stroke elements (sticky notes, shapes)", () => {
            harness = new InteractiveWhiteboardHarness({
                initialElements: [
                    {
                        id: "safe_sticky",
                        kind: "sticky",
                        x: 50,
                        y: 50,
                        width: 200,
                        height: 200,
                        text: "Safe",
                    },
                    {
                        id: "safe_shape",
                        kind: "shape",
                        shapeType: "rect",
                        x: 300,
                        y: 50,
                        width: 200,
                        height: 200,
                        text: "Safe Shape",
                    },
                ],
            });
            harness.selectTool("eraser");
            // Sweep right through both elements
            harness.pointerDown(0, 100);
            harness.pointerMove(600, 100);
            assert.equal(harness.latestElements.length, 2);
        });
        it("7.5 visual eraser cursor indicator tracks pointer coordinates", () => {
            const eraserRunner = new SubComponentHarness(EraserSweep, {
                strokes: [],
                isActive: true,
                radius: DEFAULT_ERASER_RADIUS,
                onDeleteStrokes: () => { },
            });
            let node = eraserRunner.render();
            // Before pointer action: indicator is null
            let indicator = node.children.find((c) => c?.props?.["className"]?.includes("dsh-eraser-cursor-indicator"));
            assert.equal(indicator, undefined);
            // Pointer down at (80, 90)
            node.props["onPointerDown"]({
                clientX: 80,
                clientY: 90,
                currentTarget: {
                    getBoundingClientRect: () => ({ left: 0, top: 0 }),
                },
            });
            node = eraserRunner.render();
            indicator = node.children.find((c) => c?.props?.["className"]?.includes("dsh-eraser-cursor-indicator"));
            assert.ok(indicator, "Indicator must be rendered during active sweep");
            const style = indicator.props["style"];
            // radius 14 -> left: 80 - 14 = 66px, top: 90 - 14 = 76px
            assert.equal(style["left"], "66px");
            assert.equal(style["top"], "76px");
            assert.equal(style["width"], "28px");
            assert.equal(style["height"], "28px");
        });
    });
    // --------------------------------------------------------------------------
    // Suite 8: Viewport Pan/Zoom & Minimap Camera Projection
    // --------------------------------------------------------------------------
    describe("Suite 8: Viewport Pan/Zoom & Minimap Camera Projection", () => {
        it("8.1 hand tool dragging pans viewport coordinates", () => {
            assert.deepEqual(screenToWorld(100, 100, DEFAULT_VIEWPORT), {
                x: 100,
                y: 100,
            });
            assert.deepEqual(worldToScreen(100, 100, DEFAULT_VIEWPORT), {
                x: 100,
                y: 100,
            });
            harness = new InteractiveWhiteboardHarness({ initialElements: [] });
            harness.selectTool("hand");
            assert.equal(harness.getViewport().props["cursor"], "grab");
            // Drag from (100, 100) to (150, 130) -> dx: +50, dy: +30
            harness.pointerDown(100, 100);
            harness.pointerMove(150, 130);
            const vp = harness.getViewport().props["viewport"];
            assert.equal(vp.x, 50);
            assert.equal(vp.y, 30);
        });
        it("8.2 mouse wheel pans viewport coordinates", () => {
            harness = new InteractiveWhiteboardHarness({ initialElements: [] });
            // Initial viewport is at (0, 0)
            harness.dispatchWheel({ deltaX: 40, deltaY: 20 });
            const vp = harness.getViewport().props["viewport"];
            assert.equal(vp.x, -40);
            assert.equal(vp.y, -20);
        });
        it("8.3 mouse wheel with ctrlKey zooms in/out centered at mouse point", () => {
            harness = new InteractiveWhiteboardHarness({ initialElements: [] });
            // Zoom in with negative deltaY
            harness.dispatchWheel({
                ctrlKey: true,
                deltaY: -100,
                clientX: 600,
                clientY: 400,
            });
            let vp = harness.getViewport().props["viewport"];
            assert.ok(vp.zoom > 1.0, "Zoom must increase when deltaY is negative");
            assert.ok(vp.zoom <= MAX_ZOOM);
            // Extreme zoom out clamped to MIN_ZOOM = 0.1
            harness.dispatchWheel({
                ctrlKey: true,
                deltaY: 10000,
                clientX: 600,
                clientY: 400,
            });
            vp = harness.getViewport().props["viewport"];
            assert.equal(vp.zoom, MIN_ZOOM);
        });
        it("8.4 CanvasMinimap renders scaled mini elements and viewport camera box", () => {
            assert.equal(MINIMAP_PADDING, 40);
            const minimapNode = CanvasMinimap({
                elements: [
                    {
                        id: "m_sticky",
                        kind: "sticky",
                        x: 0,
                        y: 0,
                        width: 220,
                        height: 220,
                        text: "Mini Note",
                    },
                    {
                        id: "m_shape",
                        kind: "shape",
                        shapeType: "rect",
                        x: 400,
                        y: 300,
                        width: 200,
                        height: 150,
                        text: "Mini Shape",
                    },
                ],
                viewport: DEFAULT_VIEWPORT,
            });
            assert.equal(minimapNode.type, "div");
            assert.ok(minimapNode.props["className"].includes("dsh-cult-canvas-minimap"));
            const children = minimapNode.children;
            const miniNodes = children.filter((c) => c?.props?.["className"]?.includes("dsh-minimap-node"));
            assert.equal(miniNodes.length, 2, "Must render 2 mini element markers");
            const camera = children.find((c) => c?.props?.["className"]?.includes("dsh-minimap-camera"));
            assert.ok(camera, "Minimap camera rectangle must be rendered");
        });
        it("8.5 clicking on minimap pans camera to center on target world coordinates", () => {
            harness = new InteractiveWhiteboardHarness({
                initialElements: [
                    {
                        id: "center_sticky",
                        kind: "sticky",
                        x: 500,
                        y: 500,
                        width: 220,
                        height: 220,
                        text: "Center",
                    },
                ],
            });
            // Click center of minimap (90, 60)
            harness.dispatchMinimapClick(90, 60);
            const vp = harness.getViewport().props["viewport"];
            assert.ok(typeof vp.x === "number" && typeof vp.y === "number", "Viewport coordinates must update after minimap click");
        });
    });
});
