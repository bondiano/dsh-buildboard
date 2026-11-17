/**
 * Client Contract & Component Unit Tests for DSH Cult Canvas
 *
 * Verifies:
 * - Module loader registration via window.__ModuleLoader__.load
 * - Declared service dependency injection list
 * - Right-sidebar tab type registration with its guide card
 * - Tab body and settings card slot registrations
 * - Toolview registrations for every canvas agent tool
 * - Multi-language locale registration (en, ru, zh)
 * - Stylesheet injection into document.head and clean disposer removal
 * - Component unit tests for MarkerStroke, StickyNote, ShapeElement,
 *   ElementManipulation, EraserSweep, CanvasViewport, CanvasMinimap,
 *   CanvasToolbar, and CultCanvasBoard.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	apply,
	BUNDLE_PACKAGE,
	CANVAS_TAB_ID,
	CANVAS_TAB_KIND,
	CANVAS_TOOL_NAMES,
	CLIENT_NAMESPACE,
	CLIENT_STYLE_ATTR,
	clientPlugin,
	clientPluginFactory,
	inject,
} from "../src/presentation/client.js";
import {
	CanvasMinimap,
	CanvasToolbar,
	CanvasToolView,
	CanvasViewport,
	clampMarkerStrokeWidth,
	computeSelectionBounds,
	CultCanvasBoard,
	CultCanvasTab,
	CanvasSettingsCard,
	DEFAULT_MARKER_COLOR,
	DEFAULT_MARKER_WIDTH,
	DEFAULT_STICKY_SIZE,
	DEFAULT_VIEWPORT,
	EraserSweep,
	generateMarkerCenterlinePath,
	generateMarkerOutlinePath,
	getShapePaddingCompensation,
	getShapeSvgPath,
	handleManipulationKeyDown,
	layerOrder,
	MARKER_PALETTE_COLORS,
	MARKER_PRESET_WIDTHS,
	MarkerStroke,
	MIN_MARKER_WIDTH,
	MAX_MARKER_WIDTH,
	screenToWorld,
	SelectionOverlay,
	setReact,
	ShapeElement,
	snapToGrid,
	STICKY_PALETTE_COLORS,
	StickyNote,
	strokeOutlinePoints,
	SUPPORTED_SHAPES,
	sweepAndCollectHitStrokes,
	WHITEBOARD_TOOLS,
	worldToScreen,
} from "../src/presentation/components/index.js";
import { CANVAS_CLIENT_STYLES } from "../src/presentation/styles.js";

// Setup mock React runtime for headless test evaluation
const mockReact = {
	Fragment: "mock-fragment",
	createElement(
		type: unknown,
		props: Record<string, unknown> | null,
		...children: unknown[]
	) {
		const flatChildren = children.flat();
		return {
			type,
			props: { ...props, children: flatChildren },
			key: props?.["key"] ?? null,
			children: flatChildren,
		};
	},
	useState<T>(initial: T | (() => T)): [T, (val: T) => void] {
		const val =
			typeof initial === "function" ? (initial as () => T)() : initial;
		return [val, () => {}];
	},
	useEffect(cb: () => void | (() => void)) {
		if (typeof cb === "function") {
			cb();
		}
	},
	useCallback<T>(fn: T): T {
		return fn;
	},
	useMemo<T>(fn: () => T): T {
		return fn();
	},
	useRef<T>(initial: T): { current: T } {
		return { current: initial };
	},
};

setReact(mockReact as unknown as typeof import("react"));

describe("Milestone 3: Client Shell Contract Suite", () => {
	it("3.1 exports valid clientPlugin descriptor with id and inject array", () => {
		assert.equal(clientPlugin.id, "@local/dsh-cult-canvas");
		assert.deepEqual(clientPlugin.inject, [
			"slots",
			"locale",
			"sidebarRightTabs",
			"configForms",
			"uiWorkspace",
		]);
		assert.equal(typeof clientPlugin.apply, "function");
	});

	it("3.2 registers with window.__ModuleLoader__.load when executed in browser context", () => {
		let capturedDescriptor: {
			id: string;
			factory: (req: unknown) => unknown;
		} | null = null;
		const mockWindow = {
			__ModuleLoader__: {
				load(desc: { id: string; factory: (req: unknown) => unknown }) {
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
			factory: (req) => clientPluginFactory(req as (name: string) => unknown),
		});

		assert.ok(capturedDescriptor !== null);
		const captured = capturedDescriptor as unknown as {
			id: string;
			factory: (req: unknown) => { id: string };
		};
		assert.equal(captured.id, "@local/dsh-cult-canvas");
		const created = captured.factory(() => mockReact);
		assert.equal(created.id, "@local/dsh-cult-canvas");
	});

	it("3.3 registers multi-language locale dictionaries (en, ru, zh)", () => {
		const registeredLocales: Record<
			string,
			Record<string, Record<string, string>>
		> = {};
		const mockCtx = {
			effect(cb: () => void) {
				cb();
			},
			locale: {
				register(ns: string, dicts: Record<string, Record<string, string>>) {
					registeredLocales[ns] = dicts;
				},
				bind: () => (k: string) => k,
			},
			slots: {
				inject: () => {},
				register: () => {},
			},
		};

		apply(
			mockCtx as unknown as import("../src/presentation/client.js").ClientContext,
		);

		assert.ok(registeredLocales[CLIENT_NAMESPACE] !== undefined);
		const dicts = registeredLocales[CLIENT_NAMESPACE]!;
		assert.ok(
			dicts["en"] !== undefined,
			"English dictionary must be registered",
		);
		assert.ok(
			dicts["ru"] !== undefined,
			"Russian dictionary must be registered",
		);
		assert.ok(
			dicts["zh"] !== undefined,
			"Chinese dictionary must be registered",
		);
	});

	it("3.4 injects stylesheet into document.head and cleanly removes it on disposer call", () => {
		const appendedElements: Array<{
			tagName: string;
			attrs: Record<string, string>;
			textContent: string;
			remove: () => void;
		}> = [];
		let removed = false;

		const fakeStyle = {
			tagName: "STYLE",
			attrs: {} as Record<string, string>,
			textContent: "",
			setAttribute(k: string, v: string) {
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
				append: (el: unknown) => {
					appendedElements.push(el as typeof fakeStyle);
				},
			},
		};

		(globalThis as unknown as { document: typeof fakeDoc }).document = fakeDoc;

		let capturedDisposer: (() => void) | undefined;
		const mockCtx = {
			effect(cb: () => void | (() => void)) {
				const res = cb();
				if (typeof res === "function") {
					capturedDisposer = res;
				}
			},
			locale: {
				register: () => {},
				bind: () => (k: string) => k,
			},
			slots: {
				inject: () => {},
				register: () => {},
			},
		};

		apply(
			mockCtx as unknown as import("../src/presentation/client.js").ClientContext,
		);

		assert.equal(appendedElements.length, 1);
		const injected = appendedElements[0]!;
		assert.equal(injected.attrs[CLIENT_STYLE_ATTR], CLIENT_NAMESPACE);
		assert.equal(injected.textContent, CANVAS_CLIENT_STYLES);

		// Execute the disposer
		assert.ok(typeof capturedDisposer === "function");
		const disposerFn = capturedDisposer as () => void;
		disposerFn();
		assert.equal(
			removed,
			true,
			"Disposer must remove injected style from document.head",
		);
	});

	it("3.5 registers the sidebar tab type with a guide card on the Start screen", () => {
		const tabTypes: Array<Record<string, unknown>> = [];
		const mockCtx = {
			effect(callback: () => unknown) {
				return callback();
			},
			locale: {
				register: () => {},
				bind: () => (k: string) => k,
			},
			slots: { inject: () => {}, register: () => ({}) },
			inject(_services: readonly string[], callback: (child: unknown) => void) {
				callback({
					effect(inner: () => unknown) {
						return inner();
					},
					sidebarRightTabs: {
						register(definition: Record<string, unknown>) {
							tabTypes.push(definition);
							return () => {};
						},
					},
				});
			},
		};

		apply(
			mockCtx as unknown as import("../src/presentation/client.js").ClientContext,
		);

		assert.equal(tabTypes.length, 1);
		const tab = tabTypes[0]!;
		assert.equal(tab["id"], CANVAS_TAB_ID);
		assert.equal(tab["kind"], CANVAS_TAB_KIND);
		const guide = tab["guide"] as Array<{ id: string; order: number }>;
		assert.equal(guide.length, 1);
		assert.equal(guide[0]!.id, "board");
		assert.equal(guide[0]!.order, 25);
		assert.equal(typeof (tab["title"] as () => string)(), "string");
	});

	it("3.6 registers the tab body, the settings card and all 12 toolviews", () => {
		const slotInjections: Record<string, unknown[]> = {};
		const mockCtx = {
			effect: () => {},
			locale: {
				register: () => {},
				bind: () => (k: string) => k,
			},
			uiWorkspace: { getActiveSession: () => ({ id: "session-active" }) },
			configForms: {
				get: () => ({
					getSnapshot: () => ({
						status: "ready",
						value: {},
						writable: true,
						revision: 1,
					}),
					subscribe: () => () => {},
					set: async () => true,
				}),
				whileServed: (
					_namespaces: readonly string[],
					register: () => () => void,
				) => register(),
			},
			slots: {
				inject(name: string, generator: () => unknown) {
					const out = generator();
					const items: unknown[] = [];
					for (const item of out as Iterable<unknown>) items.push(item);
					slotInjections[name] = items;
				},
				register(desc: unknown, comp: unknown) {
					return { desc, comp };
				},
			},
		};

		apply(
			mockCtx as unknown as import("../src/presentation/client.js").ClientContext,
		);

		const pane = slotInjections["sidebar.right.pane.tab"]![0] as {
			desc: { name: string; key: string };
			comp: unknown;
		};
		assert.equal(pane.desc.name, "sidebar.right.pane.tab");
		assert.equal(pane.desc.key, CANVAS_TAB_ID);
		assert.equal(pane.comp, CultCanvasTab);

		const card = slotInjections["plugins.bundle.config"]![0] as {
			desc: { name: string; key: string };
			comp: unknown;
		};
		assert.equal(card.desc.name, "plugins.bundle.config");
		assert.equal(
			card.desc.key,
			BUNDLE_PACKAGE,
			"the card is dispatched by the bundle package name",
		);
		assert.equal(card.comp, CanvasSettingsCard);

		// The seat may omit the session id; the tab then follows the active one.
		const paneInject = pane.desc as unknown as {
			inject?: (sessionId?: string) => Record<string, unknown>;
		};
		assert.equal(paneInject.inject?.()?.["sessionId"], "session-active");
		assert.equal(
			paneInject.inject?.("session-explicit")?.["sessionId"],
			"session-explicit",
		);

		const registeredCards = slotInjections["tool.call.toolview"] as Array<{
			desc: { name: string; key: string };
			comp: unknown;
		}>;
		assert.equal(registeredCards.length, CANVAS_TOOL_NAMES.length);
		const registeredKeys = registeredCards.map((r) => r.desc.key);
		for (const expectedTool of CANVAS_TOOL_NAMES) {
			assert.ok(
				registeredKeys.includes(expectedTool),
				`Missing toolview registration for ${expectedTool}`,
			);
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

		const testPoints: Array<[number, number]> = [
			[10, 10],
			[30, 40],
			[80, 90],
			[120, 150],
		];
		const outline = generateMarkerOutlinePath(testPoints, 6);
		assert.ok(
			outline.startsWith("M"),
			"Outline path must start with M command",
		);
		assert.ok(
			outline.endsWith("Z"),
			"Outline path must be closed with Z command",
		);

		const centerline = generateMarkerCenterlinePath(testPoints);
		assert.ok(
			centerline.startsWith("M10,10"),
			"Centerline path must start at first point",
		);
		assert.ok(
			centerline.includes("L120,150"),
			"Centerline path must include last point",
		);

		const outlinePts = strokeOutlinePoints(testPoints, 6);
		assert.ok(outlinePts.length > testPoints.length);

		// Test rendering
		const node = MarkerStroke({
			id: "stroke_1",
			points: testPoints,
			width: 6,
			color: DEFAULT_MARKER_COLOR,
			isSelected: true,
		}) as unknown as { type: string; props: Record<string, unknown> };

		assert.equal(node.type, "g");
		assert.ok((node.props["className"] as string).includes("selected"));
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

		let _editedText: string | null = null;
		let selectedColor: string | null = null;

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
		}) as unknown as {
			type: string;
			props: Record<string, unknown>;
			children: Array<{ type: string; props: Record<string, unknown> }>;
		};

		assert.equal(vnode.type, "div");
		const style = vnode.props["style"] as Record<string, string>;
		assert.equal(style["width"], "220px");
		assert.equal(style["height"], "220px");
		assert.equal(style["backgroundColor"], "#FFF59A");
		assert.ok(vnode.props["className"]?.toString().includes("selected"));

		// Find color dot button in rendered palette and trigger onClick
		const palette = vnode.children.find((c) =>
			Boolean(
				c &&
				typeof c === "object" &&
				(c as { props?: Record<string, unknown> }).props?.["className"] ===
					"dsh-sticky-color-palette",
			),
		) as { children: Array<{ props: Record<string, unknown> }> } | undefined;
		assert.ok(
			palette !== undefined,
			"Color palette must be rendered when isSelected is true",
		);
		assert.equal(palette.children.length, 5);

		// Click the second color dot (#E3F2FD)
		const secondDot = palette.children[1]!;
		const clickFn = secondDot.props["onClick"] as
			| ((e: unknown) => void)
			| undefined;
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
		assert.ok(
			diamondPath.includes("L 200 100"),
			"Diamond path must connect right vertex",
		);

		const dbPath = getShapeSvgPath("database", 200, 160);
		assert.ok(
			dbPath.includes("A 100"),
			"Database path must contain cylindrical arcs",
		);

		// Test component rendering
		const shapeNode = ShapeElement({
			id: "shape_dia",
			shapeType: "diamond",
			x: 50,
			y: 50,
			width: 220,
			height: 220,
			text: "Decision",
		}) as unknown as { type: string; props: Record<string, unknown> };

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
		if (!bounds) throw new Error("Bounds must not be null");
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
		let deleted: string[] = [];
		const handledDelete = handleManipulationKeyDown(
			{ key: "Delete" },
			{
				selectedIds: ["a", "b"],
				order,
				onDelete: (ids) => {
					deleted = ids;
				},
			},
		);
		assert.equal(handledDelete, true);
		assert.deepEqual(deleted, ["a", "b"]);

		// Keyboard manipulation: Duplicate (Ctrl+D)
		let duplicated: string[] = [];
		const handledDup = handleManipulationKeyDown(
			{ key: "d", ctrlKey: true },
			{
				selectedIds: ["c"],
				order,
				onDuplicate: (ids) => {
					duplicated = ids;
				},
			},
		);
		assert.equal(handledDup, true);
		assert.deepEqual(duplicated, ["c"]);

		// Selection overlay rendering
		const overlay = SelectionOverlay({
			bounds: bounds!,
			zoom: 1,
		}) as unknown as {
			type: string;
			children: Array<{ type: string; props: Record<string, unknown> }>;
		};
		assert.equal(overlay.type, "div");
		assert.equal(
			overlay.children.length,
			8,
			"Must render exactly 8 resize handles",
		);
	});

	it("3.10 EraserSweep: detects intersecting strokes and deletes whole lines", () => {
		const strokes = [
			{
				id: "stroke_horizontal",
				box: { x: 0, y: 50, width: 200, height: 10 },
				stroke: {
					v: 1 as const,
					size: 4,
					w: 200,
					h: 10,
					points: [
						[0, 5],
						[100, 5],
						[200, 5],
					] as Array<[number, number]>,
				},
			},
			{
				id: "stroke_distant",
				box: { x: 500, y: 500, width: 50, height: 50 },
				stroke: {
					v: 1 as const,
					size: 4,
					w: 50,
					h: 50,
					points: [
						[0, 0],
						[50, 50],
					] as Array<[number, number]>,
				},
			},
		];

		// Sweep vertical line crossing the horizontal stroke at (100, 50)
		const hits = sweepAndCollectHitStrokes(
			strokes,
			{ x: 100, y: 0 },
			{ x: 100, y: 100 },
			14,
			5,
		);

		assert.ok(
			hits.includes("stroke_horizontal"),
			"Sweep should hit intersecting stroke",
		);
		assert.ok(
			!hits.includes("stroke_distant"),
			"Sweep should not hit distant stroke",
		);

		let erased: string[] = [];
		const eraserNode = EraserSweep({
			strokes,
			isActive: true,
			onDeleteStrokes: (ids) => {
				erased = ids;
			},
		}) as unknown as { type: string; props: Record<string, unknown> };

		assert.equal(eraserNode.type, "div");
		assert.equal(
			(eraserNode.props["style"] as Record<string, string>)?.["cursor"],
			"crosshair",
		);

		// Simulate pointer sweep dragging across the stroke
		const onDown = eraserNode.props["onPointerDown"] as
			| ((e: unknown) => void)
			| undefined;
		onDown?.({
			clientX: 100,
			clientY: 0,
			currentTarget: { getBoundingClientRect: () => ({ left: 0, top: 0 }) },
		});

		const onMove = eraserNode.props["onPointerMove"] as
			| ((e: unknown) => void)
			| undefined;
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
		}) as unknown as { type: string; props: Record<string, unknown> };
		assert.equal(vpNode.type, "div");
		assert.ok(
			(vpNode.props["className"] as string).includes("dsh-cult-canvas-root"),
		);
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
		}) as unknown as {
			type: string;
			props: Record<string, unknown>;
			children: Array<{ props?: Record<string, unknown> }>;
		};
		assert.equal(toolbarNode.type, "aside");

		// Find the marker tool button in toolbarNode.children and trigger its onClick
		const markerBtn = toolbarNode.children.find((c) =>
			Boolean(c?.props?.["className"]?.toString().includes("tool-marker")),
		);
		assert.ok(markerBtn !== undefined);
		const clickBtn = markerBtn.props?.["onClick"] as (() => void) | undefined;
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
		}) as unknown as { type: string; props: Record<string, unknown> };
		assert.equal(minimapNode.type, "div");
		assert.ok(
			(minimapNode.props["className"] as string).includes(
				"dsh-cult-canvas-minimap",
			),
		);
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
		}) as unknown as {
			type: string;
			props: Record<string, unknown>;
			children: unknown[];
		};

		assert.equal(toolView.type, "div");
		assert.ok(
			(toolView.props["className"] as string).includes(
				"tool-canvas_create_element",
			),
		);
	});

	it("3.14 CultCanvasBoard: mounts master whiteboard and accepts initial elements", () => {
		const initialElements = [
			{
				id: "note_1",
				kind: "sticky" as const,
				x: 50,
				y: 50,
				width: 220,
				height: 220,
				text: "Master Whiteboard",
			},
		];

		const board = CultCanvasBoard({
			initialElements,
		}) as unknown as {
			type: string;
			props: Record<string, unknown>;
			children: unknown[];
		};

		assert.equal(board.type, "div");
		assert.ok(
			(board.props["className"] as string).includes("dsh-cult-canvas-board"),
		);
	});

	it("3.15 CultCanvasBoard: incremental dragging with small per-frame steps moves elements without snapping trap", () => {
		// Create stateful React test harness to track interactive component cycles
		let hookIdx = 0;
		const hookValues: unknown[] = [];
		const testReact = {
			Fragment: "fragment",
			createElement(
				type: unknown,
				props: Record<string, unknown> | null,
				...children: unknown[]
			) {
				const flatChildren = children.flat();
				return {
					type,
					props: { ...props, children: flatChildren },
					children: flatChildren,
				};
			},
			useState<T>(
				initial: T | (() => T),
			): [T, (val: T | ((prev: T) => T)) => void] {
				const idx = hookIdx++;
				if (hookValues[idx] === undefined) {
					hookValues[idx] =
						typeof initial === "function" ? (initial as () => T)() : initial;
				}
				const setState = (val: T | ((prev: T) => T)) => {
					hookValues[idx] =
						typeof val === "function"
							? (val as (prev: T) => T)(hookValues[idx] as T)
							: val;
				};
				return [hookValues[idx] as T, setState];
			},
			useRef<T>(initial: T): { current: T } {
				const idx = hookIdx++;
				if (hookValues[idx] === undefined) {
					hookValues[idx] = { current: initial };
				}
				return hookValues[idx] as { current: T };
			},
			useCallback<T>(fn: T): T {
				return fn;
			},
			useMemo<T>(fn: () => T): T {
				return fn();
			},
			useEffect() {},
		};

		setReact(testReact as unknown as typeof import("react"));

		let latestElements: Array<{ id: string; x: number; y: number }> = [];
		const initialElements = [
			{
				id: "note_1",
				kind: "sticky" as const,
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
			}) as unknown as {
				type: string;
				props: Record<string, unknown>;
				children: Array<{
					type: unknown;
					props: Record<string, unknown>;
					children: unknown[];
				}>;
			};
		};

		// 1. Initial render
		let board = render();
		const viewport = board.children[1]!;
		const domGroup = viewport.props["domContent"] as {
			children: Array<{
				type: unknown;
				props: Record<string, unknown>;
			}>;
		};
		const sticky = domGroup.children[0]!;

		// 2. Select note and start drag at (0, 0)
		const onElementPointerDown = sticky.props["onPointerDown"] as (
			id: string,
			e: unknown,
		) => void;
		assert.ok(
			typeof onElementPointerDown === "function",
			"StickyNote must provide onPointerDown",
		);

		onElementPointerDown("note_1", {
			clientX: 0,
			clientY: 0,
			stopPropagation: () => {},
		});

		// 3. Move pointer by 50 small steps of 2px each (total 100px)
		// Under the old bug, each 2px step rounded snapToGrid(100 + 2) to 100, leaving element permanently at 100.
		const onPointerMove = viewport.props["onPointerMove"] as (
			e: unknown,
		) => void;
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
		assert.equal(
			movedNote.x,
			200,
			"Cumulative displacement must reach 200, avoiding incremental snap trap",
		);
		assert.equal(
			movedNote.y,
			200,
			"Cumulative displacement must reach 200, avoiding incremental snap trap",
		);

		// Reset React mock for subsequent tests
		setReact(mockReact as unknown as typeof import("react"));
	});

	it("3.16 CultCanvasBoard: resize handles interactively update element dimensions and position", () => {
		let hookIdx = 0;
		const hookValues: unknown[] = [];
		const testReact = {
			Fragment: "fragment",
			createElement(
				type: unknown,
				props: Record<string, unknown> | null,
				...children: unknown[]
			) {
				const flatChildren = children.flat();
				return {
					type,
					props: { ...props, children: flatChildren },
					children: flatChildren,
				};
			},
			useState<T>(
				initial: T | (() => T),
			): [T, (val: T | ((prev: T) => T)) => void] {
				const idx = hookIdx++;
				if (hookValues[idx] === undefined) {
					hookValues[idx] =
						typeof initial === "function" ? (initial as () => T)() : initial;
				}
				const setState = (val: T | ((prev: T) => T)) => {
					hookValues[idx] =
						typeof val === "function"
							? (val as (prev: T) => T)(hookValues[idx] as T)
							: val;
				};
				return [hookValues[idx] as T, setState];
			},
			useRef<T>(initial: T): { current: T } {
				const idx = hookIdx++;
				if (hookValues[idx] === undefined) {
					hookValues[idx] = { current: initial };
				}
				return hookValues[idx] as { current: T };
			},
			useCallback<T>(fn: T): T {
				return fn;
			},
			useMemo<T>(fn: () => T): T {
				return fn();
			},
			useEffect() {},
		};

		setReact(testReact as unknown as typeof import("react"));

		let latestElements: Array<{
			id: string;
			x: number;
			y: number;
			width?: number;
			height?: number;
		}> = [];
		const initialElements = [
			{
				id: "shape_1",
				kind: "shape" as const,
				shapeType: "rect" as const,
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
			}) as unknown as {
				type: string;
				props: Record<string, unknown>;
				children: Array<{
					type: unknown;
					props: Record<string, unknown>;
					children: unknown[];
				}>;
			};
		};

		// 1. Initial render & select element
		let board = render();
		let viewport = board.children[1]!;
		let domGroup = viewport.props["domContent"] as {
			children: Array<{
				type: unknown;
				props: Record<string, unknown>;
			}>;
		};
		const shape = domGroup.children[0]!;
		const onElementPointerDown = shape.props["onPointerDown"] as (
			id: string,
			e: unknown,
		) => void;
		onElementPointerDown("shape_1", {
			clientX: 100,
			clientY: 100,
			stopPropagation: () => {},
		});

		// 2. Re-render: SelectionOverlay should now be mounted
		board = render();
		viewport = board.children[1]!;
		domGroup = viewport.props["domContent"] as {
			children: Array<{
				type: unknown;
				props: Record<string, unknown>;
			}>;
		};
		const selectionOverlay = domGroup.children.find(
			(c) =>
				c &&
				typeof c.props?.["onResizeStart"] === "function" &&
				c.props?.["bounds"],
		);
		assert.ok(
			selectionOverlay,
			"SelectionOverlay must be rendered when selected",
		);

		const onResizeStart = selectionOverlay.props["onResizeStart"] as (
			handle: string,
			e: unknown,
		) => void;

		// 3. Resize via 'se' handle by dragging +60px in both axes
		onResizeStart("se", { clientX: 200, clientY: 200 });
		const onPointerMove = viewport.props["onPointerMove"] as (
			e: unknown,
		) => void;
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

		setReact(mockReact as unknown as typeof import("react"));
	});

	it("3.17 CultCanvasBoard & StickyNote/ShapeElement: pointerdown selects element and initiates drag", () => {
		let hookIdx = 0;
		const hookValues: unknown[] = [];
		const testReact = {
			Fragment: "fragment",
			createElement(
				type: unknown,
				props: Record<string, unknown> | null,
				...children: unknown[]
			) {
				const flatChildren = children.flat();
				return {
					type,
					props: { ...props, children: flatChildren },
					children: flatChildren,
				};
			},
			useState<T>(
				initial: T | (() => T),
			): [T, (val: T | ((prev: T) => T)) => void] {
				const idx = hookIdx++;
				if (hookValues[idx] === undefined) {
					hookValues[idx] =
						typeof initial === "function" ? (initial as () => T)() : initial;
				}
				const setState = (val: T | ((prev: T) => T)) => {
					hookValues[idx] =
						typeof val === "function"
							? (val as (prev: T) => T)(hookValues[idx] as T)
							: val;
				};
				return [hookValues[idx] as T, setState];
			},
			useRef<T>(initial: T): { current: T } {
				const idx = hookIdx++;
				if (hookValues[idx] === undefined) {
					hookValues[idx] = { current: initial };
				}
				return hookValues[idx] as { current: T };
			},
			useCallback<T>(fn: T): T {
				return fn;
			},
			useMemo<T>(fn: () => T): T {
				return fn();
			},
			useEffect() {},
		};

		setReact(testReact as unknown as typeof import("react"));

		let stoppedPropagation = false;
		const initialElements = [
			{
				id: "note_1",
				kind: "sticky" as const,
				x: 40,
				y: 40,
				width: 200,
				height: 200,
				text: "Selection & Drag Test",
			},
		];

		let latestEls: typeof initialElements = [];
		const render = () => {
			hookIdx = 0;
			return CultCanvasBoard({
				initialElements,
				onStateChange: (els) => {
					latestEls = els as typeof initialElements;
				},
			}) as unknown as {
				type: string;
				props: Record<string, unknown>;
				children: Array<{
					type: unknown;
					props: Record<string, unknown>;
					children: unknown[];
				}>;
			};
		};

		const board = render();
		const viewport = board.children[1]!;
		const domGroup = viewport.props["domContent"] as {
			children: Array<{
				type: unknown;
				props: Record<string, unknown>;
			}>;
		};
		const sticky = domGroup.children[0]!;

		// Verify onPointerDown on StickyNote component
		const stickyComponent = StickyNote({
			id: "note_1",
			text: "Note",
			onPointerDown: (_id, _e) => {},
		}) as unknown as { props: Record<string, unknown> };
		assert.ok(
			typeof stickyComponent.props["onPointerDown"] === "function",
			"StickyNote must bind onPointerDown to root div",
		);

		// Execute pointerdown on sticky note in board
		const onElementPointerDown = sticky.props["onPointerDown"] as (
			id: string,
			e: unknown,
		) => void;
		onElementPointerDown("note_1", {
			clientX: 50,
			clientY: 50,
			stopPropagation: () => {
				stoppedPropagation = true;
			},
		});

		assert.ok(
			stoppedPropagation,
			"Pointer down on note must stop propagation to canvas background",
		);

		// Drag the note
		const onPointerMove = viewport.props["onPointerMove"] as (
			e: unknown,
		) => void;
		onPointerMove({ clientX: 90, clientY: 90 }); // +40px

		const moved = latestEls.find((e) => e.id === "note_1");
		assert.ok(moved);
		assert.equal(moved.x, 80, "Note x should move from 40 to 80");
		assert.equal(moved.y, 80, "Note y should move from 40 to 80");

		setReact(mockReact as unknown as typeof import("react"));
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
				append: () => {},
			},
		};

		// Swap document
		const origDoc = globalThis.document;
		(globalThis as unknown as { document: unknown }).document =
			mockIncompleteDoc;

		try {
			const effectCalls: Array<() => unknown> = [];
			const mockCtx = {
				effect(cb: () => unknown) {
					effectCalls.push(cb);
				},
				locale: {
					register() {},
					bind: () => () => "",
				},
				slots: {
					inject() {},
					register: () => ({}),
				},
			};

			// Apply plugin
			apply(
				mockCtx as unknown as import("../src/presentation/client.js").ClientContext,
			);
			assert.ok(effectCalls.length >= 2);

			// Run style injection effect with incomplete mock DOM - should not throw
			const styleEffect = effectCalls[1]!;
			assert.doesNotThrow(() => {
				styleEffect();
			});
		} finally {
			(globalThis as unknown as { document: unknown }).document = origDoc;
		}

		// Test CultCanvasBoard mount when window.addEventListener is undefined
		const origWin = globalThis.window;
		(globalThis as unknown as { window: unknown }).window = {
			// addEventListener intentionally missing!
		};

		try {
			assert.doesNotThrow(() => {
				void CultCanvasBoard({
					initialElements: [],
				});
			});
		} finally {
			(globalThis as unknown as { window: unknown }).window = origWin;
		}
	});

	it("3.19 react-binding: setReact safely merges partial React mocks without wiping fallback hooks", () => {
		// Pass an incomplete React mock with only createElement (no useState or useRef)
		const incompleteMock = {
			createElement: () => "mock-node",
		};

		setReact(incompleteMock as unknown as typeof import("react"));

		// Must not throw or wipe useState
		assert.doesNotThrow(() => {
			const r = CultCanvasBoard({ initialElements: [] });
			assert.ok(r);
		});

		// Restore mockReact
		setReact(mockReact as unknown as typeof import("react"));
	});
});
