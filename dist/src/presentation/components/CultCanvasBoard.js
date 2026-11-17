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
import { createMarkerStroke, createStickyNote, createTextCard, createWhiteboardShape, } from "../../domain/elements.js";
import { reconcileFromServer } from "../../application/board-sync.js";
import { dragRect } from "../../domain/geometry.js";
import { CanvasMinimap } from "./CanvasMinimap.js";
import { CanvasToolbar } from "./CanvasToolbar.js";
import { CanvasViewport, DEFAULT_VIEWPORT, screenToWorld, } from "./CanvasViewport.js";
import { computeSelectionBounds, handleManipulationKeyDown, SelectionOverlay, snapToGrid, } from "./ElementManipulation.js";
import { EraserSweep, sweepAndCollectHitStrokes } from "./EraserSweep.js";
import { DEFAULT_MARKER_COLOR, DEFAULT_MARKER_WIDTH, generateMarkerOutlinePath, MarkerStroke, } from "./MarkerStroke.js";
import { h, useCallback, useEffect, useRef, useState, } from "./react-binding.js";
import { ShapeElement } from "./ShapeElement.js";
import { DEFAULT_STICKY_SIZE, StickyNote } from "./StickyNote.js";
export function CultCanvasBoard({ initialElements = [], initialEdges = [], syncUrl, onStateChange, onStartProject, canStartProject = false, visible = true, snapEnabled = true, gridSize = 20, startProjectLabel, agentBadgeLabel, className, }) {
    // 1. Elements and Edges State
    const [elements, setElements] = useState(initialElements);
    const [edges, setEdges] = useState(initialEdges);
    const [layerOrderList, setLayerOrderList] = useState(initialElements.map((e) => e.id));
    // 2. Viewport Transform (Pan & Zoom)
    const [viewport, setViewport] = useState(DEFAULT_VIEWPORT);
    // 3. Active Tool & Tool Options
    const [activeTool, setActiveTool] = useState("select");
    const [markerColor, setMarkerColor] = useState(DEFAULT_MARKER_COLOR);
    const [markerWidth, setMarkerWidth] = useState(DEFAULT_MARKER_WIDTH);
    const [selectedShape, setSelectedShape] = useState("rect");
    const [stickyColor, setStickyColor] = useState("#FFF59A");
    // 4. Selection State
    const [selectedIds, setSelectedIds] = useState([]);
    // 5. Interaction Tracking State
    const [drawingPoints, setDrawingPoints] = useState([]);
    const [marqueeRect, setMarqueeRect] = useState(null);
    const isInteractingRef = useRef(false);
    const isDraggingElementsRef = useRef(false);
    const isResizingRef = useRef(false);
    const resizeHandleRef = useRef(null);
    const resizeStartBoundsRef = useRef(null);
    const dragStartPointRef = useRef(null);
    const dragStartWorldRef = useRef(null);
    const lastWorldPointRef = useRef(null);
    const isAltDragRef = useRef(false);
    const didDuplicateRef = useRef(false);
    const dragStartElementsRef = useRef(new Map());
    const elementsRef = useRef(elements);
    elementsRef.current = elements;
    const edgesRef = useRef(edges);
    edgesRef.current = edges;
    const selectedIdsRef = useRef(selectedIds);
    selectedIdsRef.current = selectedIds;
    // Snapping is a setting: without it a drag lands exactly where it was dropped.
    const snap = useCallback((value) => snapEnabled ? snapToGrid(value, gridSize) : Math.round(value), [snapEnabled, gridSize]);
    // A user edit stamps the elements it touched, so the merge can tell the two
    // writers apart and the agent badge clears on the elements the user now owns.
    const updateElements = useCallback((next) => {
        setElements((prev) => {
            const resolved = typeof next === "function" ? next(prev) : next;
            const before = new Map(prev.map((el) => [el.id, el]));
            const stamped = resolved.map((el) => {
                const prior = before.get(el.id);
                if (prior !== undefined &&
                    prior.text === el.text &&
                    prior.color === el.color &&
                    prior.x === el.x &&
                    prior.y === el.y &&
                    prior.width === el.width &&
                    prior.height === el.height &&
                    prior.updatedBy === el.updatedBy) {
                    return el;
                }
                return { ...el, updatedBy: "user", updatedAt: Date.now() };
            });
            elementsRef.current = stamped;
            if (onStateChange)
                onStateChange(stamped, edges);
            return stamped;
        });
    }, [edges, onStateChange]);
    // Live sync: the Host writes land here, the user's writes leave from the
    // effect below. Polling stops while the tab is off screen and resumes with a
    // full read, because `since` keeps the answer small when nothing changed.
    const revisionRef = useRef(0);
    const lastSyncedAtRef = useRef(0);
    const lastPollSignatureRef = useRef("");
    const removedIdsRef = useRef([]);
    const bibleRef = useRef(undefined);
    useEffect(() => {
        if (!syncUrl || typeof fetch === "undefined" || !visible)
            return () => { };
        let isMounted = true;
        const pollState = async () => {
            const separator = syncUrl.includes("?") ? "&" : "?";
            try {
                const res = await fetch(`${syncUrl}${separator}since=${revisionRef.current}`);
                if (!res.ok)
                    return;
                const data = (await res.json());
                if (!isMounted)
                    return;
                if (typeof data.revision === "number")
                    revisionRef.current = data.revision;
                bibleRef.current = data.bible;
                if (!Array.isArray(data.elements))
                    return;
                const merged = reconcileFromServer({ elements: elementsRef.current, edges: edgesRef.current }, { elements: data.elements, edges: data.edges ?? [] }, lastSyncedAtRef.current);
                // The server answers on every poll; only a real change may re-render.
                const signature = merged.elements
                    .map((el) => `${el.id}:${el.updatedAt ?? 0}`)
                    .join("|");
                if (signature === lastPollSignatureRef.current)
                    return;
                lastPollSignatureRef.current = signature;
                elementsRef.current = merged.elements;
                setElements(merged.elements);
                setEdges(merged.edges);
            }
            catch {
                // ignore fetch error in offline/mock environment
            }
        };
        void pollState();
        const interval = setInterval(() => void pollState(), 2000);
        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, [syncUrl, visible]);
    // Push local edits: only what the server has not seen yet, plus removals.
    useEffect(() => {
        if (!syncUrl || typeof fetch === "undefined")
            return () => { };
        const changed = elements.filter((el) => (el.updatedAt ?? 0) > lastSyncedAtRef.current);
        const removed = removedIdsRef.current;
        if (changed.length === 0 && removed.length === 0)
            return () => { };
        const clientTime = Date.now();
        const timer = setTimeout(() => {
            void fetch(syncUrl, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    clientTime,
                    elements: changed,
                    removeIds: removed,
                }),
            })
                .then((res) => {
                if (!res.ok)
                    return;
                lastSyncedAtRef.current = clientTime;
                removedIdsRef.current = [];
            })
                .catch(() => {
                // offline: the next edit retries
            });
        }, 600);
        return () => clearTimeout(timer);
    }, [elements, syncUrl]);
    // Start a project: hand the Host the pending edits first, so the file the new
    // session reads is the board the user is looking at.
    const startProject = useCallback(async () => {
        const clientTime = Date.now();
        const changed = elementsRef.current.filter((el) => (el.updatedAt ?? 0) > lastSyncedAtRef.current);
        const removed = removedIdsRef.current;
        if (syncUrl &&
            typeof fetch === "function" &&
            (changed.length > 0 || removed.length > 0)) {
            try {
                const res = await fetch(syncUrl, {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({
                        clientTime,
                        elements: changed,
                        removeIds: removed,
                    }),
                });
                if (res.ok) {
                    lastSyncedAtRef.current = clientTime;
                    removedIdsRef.current = [];
                }
            }
            catch {
                // The Host still flushes whatever it has.
            }
        }
        await onStartProject?.({
            elements: elementsRef.current,
            edges: edgesRef.current,
            bible: bibleRef.current,
        });
    }, [syncUrl, onStartProject]);
    // Selection Bounds
    const selectedElements = elements.filter((e) => selectedIds.includes(e.id));
    const selectionBounds = computeSelectionBounds(selectedElements);
    // Keyboard Shortcut Listener
    useEffect(() => {
        if (typeof window === "undefined" ||
            typeof window.addEventListener !== "function") {
            return () => { };
        }
        const onKeyDown = (e) => {
            handleManipulationKeyDown(e, {
                selectedIds,
                order: elements.map((e) => e.id),
                onDelete: (ids) => {
                    removedIdsRef.current.push(...ids);
                    setLayerOrderList((prev) => prev.filter((id) => !ids.includes(id)));
                    updateElements((prev) => prev.filter((el) => !ids.includes(el.id)));
                    setEdges((prev) => prev.filter((edge) => !ids.includes(edge.fromNode) && !ids.includes(edge.toNode)));
                    setSelectedIds([]);
                },
                onDuplicate: (ids) => {
                    const toDup = elements.filter((el) => ids.includes(el.id));
                    const newElements = toDup.map((el) => ({
                        ...el,
                        id: `copy_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                        x: snap(el.x + 40),
                        y: snap(el.y + 40),
                    }));
                    setLayerOrderList((prev) => [
                        ...prev,
                        ...newElements.map((e) => e.id),
                    ]);
                    updateElements((prev) => [...prev, ...newElements]);
                    setSelectedIds(newElements.map((e) => e.id));
                },
                onReorder: (newOrder) => {
                    setLayerOrderList(newOrder);
                    const orderMap = new Map(newOrder.map((id, idx) => [id, idx]));
                    updateElements((prev) => [...prev].sort((a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0)));
                },
            });
        };
        window.addEventListener("keydown", onKeyDown);
        return () => {
            if (typeof window !== "undefined" &&
                typeof window.removeEventListener === "function") {
                window.removeEventListener("keydown", onKeyDown);
            }
        };
    }, [selectedIds, layerOrderList, elements, updateElements, snap]);
    const getPointerScreenPoint = (ev) => {
        const target = ev.currentTarget;
        let rect;
        const vpEl = target?.closest?.(".dsh-cult-canvas-viewport-container");
        if (vpEl && typeof vpEl.getBoundingClientRect === "function") {
            rect = vpEl.getBoundingClientRect();
        }
        else if (target && typeof target.getBoundingClientRect === "function") {
            const className = target.className;
            if (typeof className === "string" &&
                className.includes("dsh-cult-canvas-viewport-container")) {
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
    const handleElementPointerDown = (id, e) => {
        if (e &&
            typeof e.stopPropagation ===
                "function") {
            e.stopPropagation();
        }
        const ev = e;
        if (activeTool !== "select") {
            handlePointerDown(e);
            return;
        }
        let nextSelected;
        if (ev.shiftKey) {
            nextSelected = selectedIdsRef.current.includes(id)
                ? selectedIdsRef.current.filter((x) => x !== id)
                : [...selectedIdsRef.current, id];
        }
        else {
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
        const snapMap = new Map();
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
    const handleResizeStart = (handle, e) => {
        if (e &&
            typeof e.stopPropagation ===
                "function") {
            e.stopPropagation();
        }
        const ev = e;
        const sel = elementsRef.current.filter((el) => selectedIdsRef.current.includes(el.id));
        const currentBounds = computeSelectionBounds(sel) ?? selectionBounds;
        if (!currentBounds)
            return;
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
        const snapMap = new Map();
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
    const handlePointerDown = (e) => {
        const ev = e;
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
        }
        else if (activeTool === "sticky") {
            const id = `sticky_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
            const newSticky = createStickyNote(id, snap(worldPt.x - DEFAULT_STICKY_SIZE / 2), snap(worldPt.y - DEFAULT_STICKY_SIZE / 2), "New Note", { color: stickyColor });
            updateElements((prev) => [...prev, newSticky]);
            setSelectedIds([id]);
            selectedIdsRef.current = [id];
            setActiveTool("select");
        }
        else if (activeTool === "shape") {
            const id = `shape_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
            const newShape = createWhiteboardShape(id, selectedShape, snap(worldPt.x - 100), snap(worldPt.y - 60), selectedShape.toUpperCase());
            updateElements((prev) => [...prev, newShape]);
            setSelectedIds([id]);
            selectedIdsRef.current = [id];
            setActiveTool("select");
        }
        else if (activeTool === "text") {
            const id = `text_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
            const newText = createTextCard(id, snap(worldPt.x - 80), snap(worldPt.y - 20), "Text");
            updateElements((prev) => [...prev, newText]);
            setSelectedIds([id]);
            selectedIdsRef.current = [id];
            setActiveTool("select");
        }
        else if (activeTool === "select") {
            if (!ev.shiftKey) {
                // Clicked empty background: clear selection
                setSelectedIds([]);
                selectedIdsRef.current = [];
            }
            dragStartElementsRef.current.clear();
        }
    };
    const handlePointerMove = (e) => {
        if (!isInteractingRef.current || !dragStartPointRef.current)
            return;
        const ev = e;
        if (typeof ev.clientX !== "number" || typeof ev.clientY !== "number")
            return;
        const currentScreen = getPointerScreenPoint(ev);
        const currentWorld = screenToWorld(currentScreen.x, currentScreen.y, viewport);
        // 1. Resizing selected element(s)
        if (isResizingRef.current &&
            resizeHandleRef.current &&
            dragStartWorldRef.current &&
            resizeStartBoundsRef.current) {
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
                newWidth = Math.max(MIN_SIZE, snap(startBounds.width + totalDx));
            }
            else if (handle === "w" || handle === "nw" || handle === "sw") {
                const rawWidth = startBounds.width - totalDx;
                newWidth = Math.max(MIN_SIZE, snap(rawWidth));
                const actualDx = startBounds.width - newWidth;
                newX = snap(startBounds.x + actualDx);
            }
            if (handle === "s" || handle === "se" || handle === "sw") {
                newHeight = Math.max(MIN_SIZE, snap(startBounds.height + totalDy));
            }
            else if (handle === "n" || handle === "ne" || handle === "nw") {
                const rawHeight = startBounds.height - totalDy;
                newHeight = Math.max(MIN_SIZE, snap(rawHeight));
                const actualDy = startBounds.height - newHeight;
                newY = snap(startBounds.y + actualDy);
            }
            if (selectedIdsRef.current.length === 1) {
                const targetId = selectedIdsRef.current[0];
                updateElements((prev) => prev.map((el) => el.id === targetId
                    ? {
                        ...el,
                        x: newX,
                        y: newY,
                        width: newWidth,
                        height: newHeight,
                    }
                    : el));
            }
            else {
                const scaleX = startBounds.width > 0 ? newWidth / startBounds.width : 1;
                const scaleY = startBounds.height > 0 ? newHeight / startBounds.height : 1;
                updateElements((prev) => prev.map((el) => {
                    if (!selectedIdsRef.current.includes(el.id))
                        return el;
                    const start = dragStartElementsRef.current.get(el.id);
                    if (!start)
                        return el;
                    const relX = start.x - startBounds.x;
                    const relY = start.y - startBounds.y;
                    return {
                        ...el,
                        x: snap(newX + relX * scaleX),
                        y: snap(newY + relY * scaleY),
                        width: Math.max(MIN_SIZE, snap(start.width * scaleX)),
                        height: Math.max(MIN_SIZE, snap(start.height * scaleY)),
                    };
                }));
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
        }
        else if (activeTool === "marker") {
            // Draw marker stroke
            setDrawingPoints((pts) => [...pts, [currentWorld.x, currentWorld.y]]);
        }
        else if (activeTool === "eraser") {
            // Eraser sweep
            if (lastWorldPointRef.current) {
                const strokes = elements
                    .filter((el) => el.kind === "stroke")
                    .map((el) => ({
                    id: el.id,
                    box: { x: el.x, y: el.y, width: el.width, height: el.height },
                    stroke: {
                        v: 1,
                        size: el.strokeWidth ?? 4,
                        w: el.origWidth ?? el.width,
                        h: el.origHeight ?? el.height,
                        points: el.points ?? [],
                    },
                }));
                const hits = sweepAndCollectHitStrokes(strokes, lastWorldPointRef.current, currentWorld);
                if (hits.length > 0) {
                    updateElements((prev) => prev.filter((el) => !hits.includes(el.id)));
                }
            }
        }
        else if (activeTool === "select") {
            if (isDraggingElementsRef.current &&
                selectedIdsRef.current.length > 0 &&
                dragStartWorldRef.current) {
                // Move selected elements with cumulative drag distance from initial snapshot
                const totalDx = currentWorld.x - dragStartWorldRef.current.x;
                const totalDy = currentWorld.y - dragStartWorldRef.current.y;
                // Handle Alt+drag duplicate on first drag frame
                if (isAltDragRef.current && !didDuplicateRef.current) {
                    didDuplicateRef.current = true;
                    const toDup = elementsRef.current.filter((el) => selectedIdsRef.current.includes(el.id));
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
                    updateElements((prev) => [...prev, ...cloned]);
                    const newIds = cloned.map((c) => c.id);
                    setSelectedIds(newIds);
                    selectedIdsRef.current = newIds;
                }
                updateElements((prev) => prev.map((el) => {
                    if (!selectedIdsRef.current.includes(el.id))
                        return el;
                    const start = dragStartElementsRef.current.get(el.id);
                    if (!start)
                        return el;
                    return {
                        ...el,
                        x: snap(start.x + totalDx),
                        y: snap(start.y + totalDy),
                    };
                }));
            }
            else if (!isDraggingElementsRef.current) {
                // Rubberband marquee selection
                const box = dragRect(dragStartPointRef.current, currentScreen);
                setMarqueeRect(box);
            }
        }
        lastWorldPointRef.current = currentWorld;
    };
    const handlePointerUp = () => {
        if (!isInteractingRef.current)
            return;
        isInteractingRef.current = false;
        isDraggingElementsRef.current = false;
        isResizingRef.current = false;
        resizeHandleRef.current = null;
        resizeStartBoundsRef.current = null;
        dragStartWorldRef.current = null;
        dragStartElementsRef.current.clear();
        if (activeTool === "marker" && drawingPoints.length > 1) {
            const id = `stroke_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
            const newStroke = createMarkerStroke(id, drawingPoints, markerWidth, markerColor);
            updateElements((prev) => [...prev, newStroke]);
            setDrawingPoints([]);
        }
        if (activeTool === "select" && marqueeRect) {
            // Find elements inside marquee box in world coordinates
            const worldStart = screenToWorld(marqueeRect.x, marqueeRect.y, viewport);
            const worldEnd = screenToWorld(marqueeRect.x + marqueeRect.width, marqueeRect.y + marqueeRect.height, viewport);
            const worldBox = dragRect(worldStart, worldEnd);
            const caught = elements
                .filter((el) => el.x >= worldBox.x &&
                el.y >= worldBox.y &&
                el.x + (el.width ?? 100) <= worldBox.x + worldBox.width &&
                el.y + (el.height ?? 100) <= worldBox.y + worldBox.height)
                .map((e) => e.id);
            setSelectedIds(caught);
            setMarqueeRect(null);
        }
        dragStartPointRef.current = null;
        lastWorldPointRef.current = null;
        isAltDragRef.current = false;
    };
    // Cursors per tool
    const cursor = activeTool === "hand"
        ? "grab"
        : activeTool === "marker"
            ? "crosshair"
            : activeTool === "eraser"
                ? "cell"
                : "default";
    // SVG Layer: Strokes and In-Flight Drawing Preview
    const svgContent = h("g", { className: "dsh-svg-elements-group" }, ...elements
        .filter((el) => el.kind === "stroke")
        .map((s) => h(MarkerStroke, {
        key: s.id,
        id: s.id,
        points: (s.points ?? []).map(([px, py]) => [px + s.x, py + s.y]),
        width: s.strokeWidth ?? 4,
        color: s.color ?? DEFAULT_MARKER_COLOR,
        isSelected: selectedIds.includes(s.id),
        onSelect: (id) => {
            if (id)
                setSelectedIds([id]);
        },
        onPointerDown: (strokeId, e) => {
            if (strokeId)
                handleElementPointerDown(strokeId, e);
        },
    })), 
    // Live drawing stroke outline preview
    drawingPoints.length > 1
        ? h("path", {
            className: "dsh-marker-preview",
            d: generateMarkerOutlinePath(drawingPoints, markerWidth),
            fill: markerColor,
            opacity: 0.85,
        })
        : null);
    // DOM Layer: Sticky Notes, Shapes, Selection Overlay
    const domContent = h("div", { className: "dsh-dom-elements-group" }, ...elements
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
                onSelect: (id, shift) => {
                    setSelectedIds((prev) => shift
                        ? prev.includes(id)
                            ? prev.filter((x) => x !== id)
                            : [...prev, id]
                        : [id]);
                },
                onPointerDown: handleElementPointerDown,
                onChangeText: (id, text) => {
                    updateElements((prev) => prev.map((e) => e.id === id ? { ...e, text } : e));
                },
                onChangeColor: (id, color) => {
                    updateElements((prev) => prev.map((e) => e.id === id ? { ...e, color } : e));
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
                onSelect: (id, shift) => {
                    setSelectedIds((prev) => shift
                        ? prev.includes(id)
                            ? prev.filter((x) => x !== id)
                            : [...prev, id]
                        : [id]);
                },
                onPointerDown: handleElementPointerDown,
                onChangeText: (id, text) => {
                    updateElements((prev) => prev.map((e) => e.id === id ? { ...e, text } : e));
                },
            });
        }
        return null;
    }), 
    // Agent edits: an outline plus a chip, until the user edits the same element
    ...elements
        .filter((el) => el.kind !== "stroke" && el.updatedBy === "agent")
        .map((el) => h("div", {
        key: `agent-${el.id}`,
        className: "dsh-cc-agent",
        style: {
            position: "absolute",
            left: `${el.x}px`,
            top: `${el.y}px`,
            width: `${el.width}px`,
            height: `${el.height}px`,
            border: "2px solid var(--dsh-accent, #38bdf8)",
            borderRadius: "10px",
            boxSizing: "border-box",
            pointerEvents: "none",
        },
    }, h("span", { className: "dsh-cc-agent-chip" }, agentBadgeLabel ?? "agent"))), 
    // Selection bounding box and handles
    selectionBounds && selectedIds.length > 0
        ? h(SelectionOverlay, {
            bounds: selectionBounds,
            zoom: viewport.zoom,
            onResizeStart: handleResizeStart,
        })
        : null);
    return h("div", {
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
        canStartProject,
        onStartProject: startProject,
        startProjectLabel,
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
        gridSize,
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
        onPanTo: (wx, wy) => {
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
                    v: 1,
                    size: el.strokeWidth ?? 4,
                    w: el.origWidth ?? el.width,
                    h: el.origHeight ?? el.height,
                    points: el.points ?? [],
                },
            })),
            isActive: true,
            onDeleteStrokes: (hits) => {
                removedIdsRef.current.push(...hits);
                updateElements((prev) => prev.filter((e) => !hits.includes(e.id)));
            },
        })
        : null);
}
