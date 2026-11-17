/**
 * CultCanvasBoard Master Whiteboard Component for DSH Cult Canvas
 *
 * Combines:
 * - CanvasViewport with pan/zoom and infinite dot grid
 * - CanvasToolbar with 8 tools and flyout palettes
 * - CanvasMinimap with camera indicator
 * - Freehand marker drawing with real-time SVG preview
 * - Sticky note and 7 geometric shape placement
 * - Selection bounds, marquee dragging, Alt+drag duplicate, snap-to-grid (20px)
 * - Eraser sweep tool deleting intersecting strokes
 * - Layer ordering (], [, Ctrl+], Ctrl+[) and hotkeys
 *
 * @module @local/dsh-cult-canvas/presentation/components/CultCanvasBoard
 */

import {
	createMarkerStroke,
	createStickyNote,
	createTextCard,
	createWhiteboardShape,
} from "../../domain/elements.js";
import { dragRect } from "../../domain/geometry.js";
import type {
	CanvasEdge,
	CanvasElement,
	Point,
	RectBounds,
	ShapeType,
} from "../../domain/types.js";
import { CanvasMinimap } from "./CanvasMinimap.js";
import { CanvasToolbar, type WhiteboardTool } from "./CanvasToolbar.js";
import {
	CanvasViewport,
	DEFAULT_VIEWPORT,
	screenToWorld,
	type ViewportTransform,
} from "./CanvasViewport.js";
import {
	computeSelectionBounds,
	handleManipulationKeyDown,
	type ResizeHandleDirection,
	SelectionOverlay,
	snapToGrid,
} from "./ElementManipulation.js";
import { EraserSweep, sweepAndCollectHitStrokes } from "./EraserSweep.js";
import {
	DEFAULT_MARKER_COLOR,
	DEFAULT_MARKER_WIDTH,
	generateMarkerOutlinePath,
	MarkerStroke,
} from "./MarkerStroke.js";
import {
	type ClientNode,
	h,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "./react-binding.js";
import { ShapeElement } from "./ShapeElement.js";
import { DEFAULT_STICKY_SIZE, StickyNote } from "./StickyNote.js";

export type ElementUpdater =
	| CanvasElement[]
	| ((prev: CanvasElement[]) => CanvasElement[]);

export interface CultCanvasBoardProps {
	initialElements?: CanvasElement[];
	initialEdges?: CanvasEdge[];
	syncUrl?: string;
	onStateChange?: (elements: CanvasElement[], edges: CanvasEdge[]) => void;
	className?: string;
}

export function CultCanvasBoard({
	initialElements = [],
	initialEdges = [],
	syncUrl,
	onStateChange,
	className,
}: CultCanvasBoardProps): ClientNode {
	// 1. Elements and Edges State
	const [elements, setElements] = useState<CanvasElement[]>(initialElements);
	const [edges, setEdges] = useState<CanvasEdge[]>(initialEdges);
	const [layerOrderList, setLayerOrderList] = useState<string[]>(
		initialElements.map((e) => e.id),
	);

	// 2. Viewport Transform (Pan & Zoom)
	const [viewport, setViewport] = useState<ViewportTransform>(DEFAULT_VIEWPORT);

	// 3. Active Tool & Tool Options
	const [activeTool, setActiveTool] = useState<WhiteboardTool>("select");
	const [markerColor, setMarkerColor] = useState<string>(DEFAULT_MARKER_COLOR);
	const [markerWidth, setMarkerWidth] = useState<number>(DEFAULT_MARKER_WIDTH);
	const [selectedShape, setSelectedShape] = useState<ShapeType>("rect");
	const [stickyColor, setStickyColor] = useState<string>("#FFF59A");

	// 4. Selection State
	const [selectedIds, setSelectedIds] = useState<string[]>([]);

	// 5. Interaction Tracking State
	const [drawingPoints, setDrawingPoints] = useState<Array<[number, number]>>(
		[],
	);
	const [marqueeRect, setMarqueeRect] = useState<RectBounds | null>(null);

	const isInteractingRef = useRef<boolean>(false);
	const isDraggingElementsRef = useRef<boolean>(false);
	const isResizingRef = useRef<boolean>(false);
	const resizeHandleRef = useRef<ResizeHandleDirection | null>(null);
	const resizeStartBoundsRef = useRef<RectBounds | null>(null);
	const dragStartPointRef = useRef<Point | null>(null);
	const dragStartWorldRef = useRef<Point | null>(null);
	const lastWorldPointRef = useRef<Point | null>(null);
	const isAltDragRef = useRef<boolean>(false);
	const didDuplicateRef = useRef<boolean>(false);
	const dragStartElementsRef = useRef<
		Map<string, { x: number; y: number; width: number; height: number }>
	>(new Map());

	const elementsRef = useRef<CanvasElement[]>(elements);
	elementsRef.current = elements;
	const selectedIdsRef = useRef<string[]>(selectedIds);
	selectedIdsRef.current = selectedIds;

	// Sync notification
	const updateElements = useCallback(
		(next: ElementUpdater) => {
			setElements((prev: CanvasElement[]) => {
				const resolved = typeof next === "function" ? next(prev) : next;
				elementsRef.current = resolved;
				if (onStateChange) onStateChange(resolved, edges);
				return resolved;
			});
		},
		[edges, onStateChange],
	);

	// Collaborative Sync Polling (if syncUrl provided)
	useEffect(() => {
		if (!syncUrl || typeof fetch === "undefined") return () => {};

		let isMounted = true;
		const pollState = async () => {
			try {
				const res = await fetch(syncUrl);
				if (!res.ok) return;
				const data = (await res.json()) as {
					elements?: CanvasElement[];
					edges?: CanvasEdge[];
				};
				if (isMounted && data.elements) {
					setElements(data.elements);
					if (data.edges) setEdges(data.edges);
				}
			} catch {
				// ignore fetch error in offline/mock environment
			}
		};

		void pollState();
		const interval = setInterval(() => void pollState(), 4000);
		return () => {
			isMounted = false;
			clearInterval(interval);
		};
	}, [syncUrl]);

	// Selection Bounds
	const selectedElements = elements.filter((e) => selectedIds.includes(e.id));
	const selectionBounds = computeSelectionBounds(selectedElements);

	// Keyboard Shortcut Listener
	useEffect(() => {
		if (
			typeof window === "undefined" ||
			typeof window.addEventListener !== "function"
		) {
			return () => {};
		}

		const onKeyDown = (e: KeyboardEvent) => {
			handleManipulationKeyDown(e, {
				selectedIds,
				order: elements.map((e) => e.id),
				onDelete: (ids: string[]) => {
					setLayerOrderList((prev) => prev.filter((id) => !ids.includes(id)));
					updateElements((prev: CanvasElement[]) =>
						prev.filter((el: CanvasElement) => !ids.includes(el.id)),
					);
					setEdges((prev: CanvasEdge[]) =>
						prev.filter(
							(edge: CanvasEdge) =>
								!ids.includes(edge.fromNode) && !ids.includes(edge.toNode),
						),
					);
					setSelectedIds([]);
				},
				onDuplicate: (ids: string[]) => {
					const toDup = elements.filter((el) => ids.includes(el.id));
					const newElements = toDup.map((el) => ({
						...el,
						id: `copy_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
						x: snapToGrid(el.x + 40),
						y: snapToGrid(el.y + 40),
					}));
					setLayerOrderList((prev) => [
						...prev,
						...newElements.map((e) => e.id),
					]);
					updateElements((prev: CanvasElement[]) => [...prev, ...newElements]);
					setSelectedIds(newElements.map((e) => e.id));
				},
				onReorder: (newOrder: string[]) => {
					setLayerOrderList(newOrder);
					const orderMap = new Map(newOrder.map((id, idx) => [id, idx]));
					updateElements((prev: CanvasElement[]) =>
						[...prev].sort(
							(a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0),
						),
					);
				},
			});
		};

		window.addEventListener("keydown", onKeyDown);
		return () => {
			if (
				typeof window !== "undefined" &&
				typeof window.removeEventListener === "function"
			) {
				window.removeEventListener("keydown", onKeyDown);
			}
		};
	}, [selectedIds, layerOrderList, elements, updateElements]);

	const getPointerScreenPoint = (ev: {
		clientX?: number;
		clientY?: number;
		currentTarget?: unknown;
	}): Point => {
		const target = ev.currentTarget as
			| {
					closest?: (selector: string) => {
						getBoundingClientRect?: () => { left: number; top: number };
					};
					getBoundingClientRect?: () => { left: number; top: number };
			  }
			| undefined;

		let rect: { left: number; top: number } | undefined;
		const vpEl = target?.closest?.(".dsh-cult-canvas-viewport-container");
		if (vpEl && typeof vpEl.getBoundingClientRect === "function") {
			rect = vpEl.getBoundingClientRect();
		} else if (target && typeof target.getBoundingClientRect === "function") {
			const className = (target as { className?: unknown }).className;
			if (
				typeof className === "string" &&
				className.includes("dsh-cult-canvas-viewport-container")
			) {
				rect = target.getBoundingClientRect();
			}
		}

		const left = rect?.left ?? 0;
		const top = rect?.top ?? 0;
		return {
			x: (ev.clientX ?? 0) - left,
			y: (ev.clientY ?? 0) - top,
		};
	};

	const handleElementPointerDown = (id: string, e: unknown) => {
		if (
			e &&
			typeof (e as { stopPropagation?: () => void }).stopPropagation ===
				"function"
		) {
			(e as { stopPropagation: () => void }).stopPropagation();
		}

		const ev = e as {
			clientX?: number;
			clientY?: number;
			altKey?: boolean;
			shiftKey?: boolean;
			button?: number;
			currentTarget?: unknown;
		};

		if (activeTool !== "select") {
			handlePointerDown(e);
			return;
		}

		let nextSelected: string[];
		if (ev.shiftKey) {
			nextSelected = selectedIdsRef.current.includes(id)
				? selectedIdsRef.current.filter((x) => x !== id)
				: [...selectedIdsRef.current, id];
		} else {
			nextSelected = selectedIdsRef.current.includes(id)
				? selectedIdsRef.current
				: [id];
		}
		setSelectedIds(nextSelected);
		selectedIdsRef.current = nextSelected;

		const screenPt = getPointerScreenPoint(ev);
		const worldPt = screenToWorld(screenPt.x, screenPt.y, viewport);

		isInteractingRef.current = true;
		isDraggingElementsRef.current = true;
		isResizingRef.current = false;
		resizeHandleRef.current = null;
		resizeStartBoundsRef.current = null;

		dragStartPointRef.current = screenPt;
		dragStartWorldRef.current = worldPt;
		lastWorldPointRef.current = worldPt;
		isAltDragRef.current = Boolean(ev.altKey);
		didDuplicateRef.current = false;

		const snapMap = new Map<
			string,
			{ x: number; y: number; width: number; height: number }
		>();
		for (const el of elementsRef.current) {
			snapMap.set(el.id, {
				x: el.x,
				y: el.y,
				width: el.width ?? 100,
				height: el.height ?? 100,
			});
		}
		dragStartElementsRef.current = snapMap;
	};

	const handleResizeStart = (handle: ResizeHandleDirection, e: unknown) => {
		if (
			e &&
			typeof (e as { stopPropagation?: () => void }).stopPropagation ===
				"function"
		) {
			(e as { stopPropagation: () => void }).stopPropagation();
		}

		const ev = e as {
			clientX?: number;
			clientY?: number;
			currentTarget?: unknown;
		};

		const sel = elementsRef.current.filter((el) =>
			selectedIdsRef.current.includes(el.id),
		);
		const currentBounds = computeSelectionBounds(sel) ?? selectionBounds;
		if (!currentBounds) return;

		const screenPt = getPointerScreenPoint(ev);
		const worldPt = screenToWorld(screenPt.x, screenPt.y, viewport);

		isInteractingRef.current = true;
		isResizingRef.current = true;
		isDraggingElementsRef.current = false;
		resizeHandleRef.current = handle;
		resizeStartBoundsRef.current = currentBounds;

		dragStartPointRef.current = screenPt;
		dragStartWorldRef.current = worldPt;
		lastWorldPointRef.current = worldPt;

		const snapMap = new Map<
			string,
			{ x: number; y: number; width: number; height: number }
		>();
		for (const el of elementsRef.current) {
			snapMap.set(el.id, {
				x: el.x,
				y: el.y,
				width: el.width ?? 100,
				height: el.height ?? 100,
			});
		}
		dragStartElementsRef.current = snapMap;
	};

	// Pointer Event Handlers for Viewport Canvas
	const handlePointerDown = (e: unknown) => {
		const ev = e as {
			clientX?: number;
			clientY?: number;
			altKey?: boolean;
			shiftKey?: boolean;
			button?: number;
			currentTarget?: unknown;
		};
		if (typeof ev.clientX !== "number" || typeof ev.clientY !== "number")
			return;

		const screenPt = getPointerScreenPoint(ev);
		const worldPt = screenToWorld(screenPt.x, screenPt.y, viewport);

		isInteractingRef.current = true;
		isDraggingElementsRef.current = false;
		isResizingRef.current = false;
		resizeHandleRef.current = null;
		resizeStartBoundsRef.current = null;

		dragStartPointRef.current = screenPt;
		dragStartWorldRef.current = worldPt;
		lastWorldPointRef.current = worldPt;
		isAltDragRef.current = Boolean(ev.altKey);
		didDuplicateRef.current = false;

		// Tool action on pointer down:
		if (activeTool === "marker") {
			setDrawingPoints([[worldPt.x, worldPt.y]]);
		} else if (activeTool === "sticky") {
			const id = `sticky_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
			const newSticky = createStickyNote(
				id,
				snapToGrid(worldPt.x - DEFAULT_STICKY_SIZE / 2),
				snapToGrid(worldPt.y - DEFAULT_STICKY_SIZE / 2),
				"New Note",
				{ color: stickyColor },
			);
			updateElements((prev: CanvasElement[]) => [...prev, newSticky]);
			setSelectedIds([id]);
			selectedIdsRef.current = [id];
			setActiveTool("select");
		} else if (activeTool === "shape") {
			const id = `shape_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
			const newShape = createWhiteboardShape(
				id,
				selectedShape,
				snapToGrid(worldPt.x - 100),
				snapToGrid(worldPt.y - 60),
				selectedShape.toUpperCase(),
			);
			updateElements((prev: CanvasElement[]) => [...prev, newShape]);
			setSelectedIds([id]);
			selectedIdsRef.current = [id];
			setActiveTool("select");
		} else if (activeTool === "text") {
			const id = `text_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
			const newText = createTextCard(
				id,
				snapToGrid(worldPt.x - 80),
				snapToGrid(worldPt.y - 20),
				"Text",
			);
			updateElements((prev: CanvasElement[]) => [...prev, newText]);
			setSelectedIds([id]);
			selectedIdsRef.current = [id];
			setActiveTool("select");
		} else if (activeTool === "select") {
			if (!ev.shiftKey) {
				// Clicked empty background: clear selection
				setSelectedIds([]);
				selectedIdsRef.current = [];
			}
			dragStartElementsRef.current.clear();
		}
	};

	const handlePointerMove = (e: unknown) => {
		if (!isInteractingRef.current || !dragStartPointRef.current) return;
		const ev = e as {
			clientX?: number;
			clientY?: number;
			altKey?: boolean;
			currentTarget?: unknown;
		};
		if (typeof ev.clientX !== "number" || typeof ev.clientY !== "number")
			return;

		const currentScreen = getPointerScreenPoint(ev);
		const currentWorld = screenToWorld(
			currentScreen.x,
			currentScreen.y,
			viewport,
		);

		// 1. Resizing selected element(s)
		if (
			isResizingRef.current &&
			resizeHandleRef.current &&
			dragStartWorldRef.current &&
			resizeStartBoundsRef.current
		) {
			const totalDx = currentWorld.x - dragStartWorldRef.current.x;
			const totalDy = currentWorld.y - dragStartWorldRef.current.y;
			const handle = resizeHandleRef.current;
			const startBounds = resizeStartBoundsRef.current;
			const MIN_SIZE = 20;

			let newX = startBounds.x;
			let newY = startBounds.y;
			let newWidth = startBounds.width;
			let newHeight = startBounds.height;

			if (handle === "e" || handle === "ne" || handle === "se") {
				newWidth = Math.max(MIN_SIZE, snapToGrid(startBounds.width + totalDx));
			} else if (handle === "w" || handle === "nw" || handle === "sw") {
				const rawWidth = startBounds.width - totalDx;
				newWidth = Math.max(MIN_SIZE, snapToGrid(rawWidth));
				const actualDx = startBounds.width - newWidth;
				newX = snapToGrid(startBounds.x + actualDx);
			}

			if (handle === "s" || handle === "se" || handle === "sw") {
				newHeight = Math.max(
					MIN_SIZE,
					snapToGrid(startBounds.height + totalDy),
				);
			} else if (handle === "n" || handle === "ne" || handle === "nw") {
				const rawHeight = startBounds.height - totalDy;
				newHeight = Math.max(MIN_SIZE, snapToGrid(rawHeight));
				const actualDy = startBounds.height - newHeight;
				newY = snapToGrid(startBounds.y + actualDy);
			}

			if (selectedIdsRef.current.length === 1) {
				const targetId = selectedIdsRef.current[0];
				updateElements((prev: CanvasElement[]) =>
					prev.map((el: CanvasElement) =>
						el.id === targetId
							? {
									...el,
									x: newX,
									y: newY,
									width: newWidth,
									height: newHeight,
								}
							: el,
					),
				);
			} else {
				const scaleX = startBounds.width > 0 ? newWidth / startBounds.width : 1;
				const scaleY =
					startBounds.height > 0 ? newHeight / startBounds.height : 1;
				updateElements((prev: CanvasElement[]) =>
					prev.map((el: CanvasElement) => {
						if (!selectedIdsRef.current.includes(el.id)) return el;
						const start = dragStartElementsRef.current.get(el.id);
						if (!start) return el;
						const relX = start.x - startBounds.x;
						const relY = start.y - startBounds.y;
						return {
							...el,
							x: snapToGrid(newX + relX * scaleX),
							y: snapToGrid(newY + relY * scaleY),
							width: Math.max(MIN_SIZE, snapToGrid(start.width * scaleX)),
							height: Math.max(MIN_SIZE, snapToGrid(start.height * scaleY)),
						};
					}),
				);
			}
			lastWorldPointRef.current = currentWorld;
			return;
		}

		if (activeTool === "hand") {
			// Pan viewport
			const dx = currentScreen.x - dragStartPointRef.current.x;
			const dy = currentScreen.y - dragStartPointRef.current.y;
			setViewport((v) => ({ ...v, x: v.x + dx, y: v.y + dy }));
			dragStartPointRef.current = currentScreen;
		} else if (activeTool === "marker") {
			// Draw marker stroke
			setDrawingPoints((pts) => [...pts, [currentWorld.x, currentWorld.y]]);
		} else if (activeTool === "eraser") {
			// Eraser sweep
			if (lastWorldPointRef.current) {
				const strokes = elements
					.filter((el) => el.kind === "stroke")
					.map((el) => ({
						id: el.id,
						box: { x: el.x, y: el.y, width: el.width, height: el.height },
						stroke: {
							v: 1 as const,
							size: el.strokeWidth ?? 4,
							w: el.origWidth ?? el.width,
							h: el.origHeight ?? el.height,
							points: el.points ?? [],
						},
					}));
				const hits = sweepAndCollectHitStrokes(
					strokes,
					lastWorldPointRef.current,
					currentWorld,
				);
				if (hits.length > 0) {
					updateElements((prev: CanvasElement[]) =>
						prev.filter((el: CanvasElement) => !hits.includes(el.id)),
					);
				}
			}
		} else if (activeTool === "select") {
			if (
				isDraggingElementsRef.current &&
				selectedIdsRef.current.length > 0 &&
				dragStartWorldRef.current
			) {
				// Move selected elements with cumulative drag distance from initial snapshot
				const totalDx = currentWorld.x - dragStartWorldRef.current.x;
				const totalDy = currentWorld.y - dragStartWorldRef.current.y;

				// Handle Alt+drag duplicate on first drag frame
				if (isAltDragRef.current && !didDuplicateRef.current) {
					didDuplicateRef.current = true;
					const toDup = elementsRef.current.filter((el) =>
						selectedIdsRef.current.includes(el.id),
					);
					const cloned = toDup.map((el) => ({
						...el,
						id: `copy_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
					}));
					for (const c of cloned) {
						dragStartElementsRef.current.set(c.id, {
							x: c.x,
							y: c.y,
							width: c.width ?? 100,
							height: c.height ?? 100,
						});
					}
					updateElements((prev: CanvasElement[]) => [...prev, ...cloned]);
					const newIds = cloned.map((c) => c.id);
					setSelectedIds(newIds);
					selectedIdsRef.current = newIds;
				}

				updateElements((prev: CanvasElement[]) =>
					prev.map((el: CanvasElement) => {
						if (!selectedIdsRef.current.includes(el.id)) return el;
						const start = dragStartElementsRef.current.get(el.id);
						if (!start) return el;
						return {
							...el,
							x: snapToGrid(start.x + totalDx),
							y: snapToGrid(start.y + totalDy),
						};
					}),
				);
			} else if (!isDraggingElementsRef.current) {
				// Rubberband marquee selection
				const box = dragRect(dragStartPointRef.current, currentScreen);
				setMarqueeRect(box);
			}
		}

		lastWorldPointRef.current = currentWorld;
	};

	const handlePointerUp = () => {
		if (!isInteractingRef.current) return;
		isInteractingRef.current = false;
		isDraggingElementsRef.current = false;
		isResizingRef.current = false;
		resizeHandleRef.current = null;
		resizeStartBoundsRef.current = null;
		dragStartWorldRef.current = null;
		dragStartElementsRef.current.clear();

		if (activeTool === "marker" && drawingPoints.length > 1) {
			const id = `stroke_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
			const newStroke = createMarkerStroke(
				id,
				drawingPoints,
				markerWidth,
				markerColor,
			);
			updateElements((prev: CanvasElement[]) => [...prev, newStroke]);
			setDrawingPoints([]);
		}

		if (activeTool === "select" && marqueeRect) {
			// Find elements inside marquee box in world coordinates
			const worldStart = screenToWorld(marqueeRect.x, marqueeRect.y, viewport);
			const worldEnd = screenToWorld(
				marqueeRect.x + marqueeRect.width,
				marqueeRect.y + marqueeRect.height,
				viewport,
			);
			const worldBox = dragRect(worldStart, worldEnd);

			const caught = elements
				.filter(
					(el) =>
						el.x >= worldBox.x &&
						el.y >= worldBox.y &&
						el.x + (el.width ?? 100) <= worldBox.x + worldBox.width &&
						el.y + (el.height ?? 100) <= worldBox.y + worldBox.height,
				)
				.map((e) => e.id);

			setSelectedIds(caught);
			setMarqueeRect(null);
		}

		dragStartPointRef.current = null;
		lastWorldPointRef.current = null;
		isAltDragRef.current = false;
	};

	// Cursors per tool
	const cursor =
		activeTool === "hand"
			? "grab"
			: activeTool === "marker"
				? "crosshair"
				: activeTool === "eraser"
					? "cell"
					: "default";

	// SVG Layer: Strokes and In-Flight Drawing Preview
	const svgContent = h(
		"g",
		{ className: "dsh-svg-elements-group" },
		...elements
			.filter((el) => el.kind === "stroke")
			.map((s) =>
				h(MarkerStroke, {
					key: s.id,
					id: s.id,
					points: (s.points ?? []).map(([px, py]) => [px + s.x, py + s.y]),
					width: s.strokeWidth ?? 4,
					color: s.color ?? DEFAULT_MARKER_COLOR,
					isSelected: selectedIds.includes(s.id),
					onSelect: (id?: string) => {
						if (id) setSelectedIds([id]);
					},
					onPointerDown: (strokeId?: string, e?: unknown) => {
						if (strokeId) handleElementPointerDown(strokeId, e);
					},
				}),
			),
		// Live drawing stroke outline preview
		drawingPoints.length > 1
			? h("path", {
					className: "dsh-marker-preview",
					d: generateMarkerOutlinePath(drawingPoints, markerWidth),
					fill: markerColor,
					opacity: 0.85,
				})
			: null,
	);

	// DOM Layer: Sticky Notes, Shapes, Selection Overlay
	const domContent = h(
		"div",
		{ className: "dsh-dom-elements-group" },
		...elements
			.filter((el) => el.kind !== "stroke")
			.map((el) => {
				const isSelected = selectedIds.includes(el.id);
				if (el.kind === "sticky") {
					return h(StickyNote, {
						key: el.id,
						id: el.id,
						x: el.x,
						y: el.y,
						width: el.width,
						height: el.height,
						text: el.text ?? "",
						color: el.color,
						isSelected,
						onSelect: (id: string, shift?: boolean) => {
							setSelectedIds((prev) =>
								shift
									? prev.includes(id)
										? prev.filter((x) => x !== id)
										: [...prev, id]
									: [id],
							);
						},
						onPointerDown: handleElementPointerDown,
						onChangeText: (id: string, text: string) => {
							updateElements((prev: CanvasElement[]) =>
								prev.map((e: CanvasElement) =>
									e.id === id ? { ...e, text } : e,
								),
							);
						},
						onChangeColor: (id: string, color: string) => {
							updateElements((prev: CanvasElement[]) =>
								prev.map((e: CanvasElement) =>
									e.id === id ? { ...e, color } : e,
								),
							);
						},
					});
				}
				if (el.kind === "shape") {
					return h(ShapeElement, {
						key: el.id,
						id: el.id,
						shapeType: el.shapeType ?? "rect",
						x: el.x,
						y: el.y,
						width: el.width,
						height: el.height,
						text: el.text ?? "",
						color: el.color,
						isSelected,
						onSelect: (id: string, shift?: boolean) => {
							setSelectedIds((prev) =>
								shift
									? prev.includes(id)
										? prev.filter((x) => x !== id)
										: [...prev, id]
									: [id],
							);
						},
						onPointerDown: handleElementPointerDown,
						onChangeText: (id: string, text: string) => {
							updateElements((prev: CanvasElement[]) =>
								prev.map((e: CanvasElement) =>
									e.id === id ? { ...e, text } : e,
								),
							);
						},
					});
				}
				return null;
			}),
		// Selection bounding box and handles
		selectionBounds && selectedIds.length > 0
			? h(SelectionOverlay, {
					bounds: selectionBounds,
					zoom: viewport.zoom,
					onResizeStart: handleResizeStart,
				})
			: null,
	);

	return h(
		"div",
		{
			className: `dsh-cult-canvas-board ${className ?? ""}`,
			style: {
				position: "relative",
				width: "100%",
				height: "100%",
				minHeight: "560px",
				overflow: "hidden",
			},
		},
		// 1. Toolbar on left
		h(CanvasToolbar, {
			activeTool,
			onSelectTool: setActiveTool,
			markerColor,
			onSelectMarkerColor: setMarkerColor,
			markerWidth,
			onSelectMarkerWidth: setMarkerWidth,
			selectedShape,
			onSelectShape: setSelectedShape,
			stickyColor,
			onSelectStickyColor: setStickyColor,
		}),
		// 2. Interactive Viewport
		h(CanvasViewport, {
			viewport,
			onViewportChange: setViewport,
			svgContent,
			domContent,
			marqueeBounds: marqueeRect,
			cursor,
			onPointerDown: handlePointerDown,
			onPointerMove: handlePointerMove,
			onPointerUp: handlePointerUp,
		}),
		// 3. Minimap in bottom-right
		h(CanvasMinimap, {
			elements,
			viewport,
			onPanTo: (wx: number, wy: number) => {
				setViewport((v) => ({
					...v,
					x: -wx * v.zoom + 600,
					y: -wy * v.zoom + 400,
				}));
			},
		}),
		// 4. Eraser sweep wrapper (if active)
		activeTool === "eraser"
			? h(EraserSweep, {
					strokes: elements
						.filter((el) => el.kind === "stroke")
						.map((el) => ({
							id: el.id,
							box: { x: el.x, y: el.y, width: el.width, height: el.height },
							stroke: {
								v: 1 as const,
								size: el.strokeWidth ?? 4,
								w: el.origWidth ?? el.width,
								h: el.origHeight ?? el.height,
								points: el.points ?? [],
							},
						})),
					isActive: true,
					onDeleteStrokes: (hits: string[]) => {
						updateElements((prev: CanvasElement[]) =>
							prev.filter((e: CanvasElement) => !hits.includes(e.id)),
						);
					},
				})
			: null,
	);
}
