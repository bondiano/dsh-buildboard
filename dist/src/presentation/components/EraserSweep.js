/**
 * EraserSweep Component & Interaction Handler for DSH Cult Canvas
 *
 * Implements intersection-based stroke erasing:
 * - Uses eraserSweep domain algorithm
 * - Tracks pointer movement during eraser dragging
 * - Detects intersecting stroke elements and emits deletion events
 * - Visual eraser trail / cursor
 *
 * @module @local/dsh-cult-canvas/presentation/components/EraserSweep
 */
import { eraserSweep } from "../../domain/geometry.js";
import { h, useRef, useState } from "./react-binding.js";
export const DEFAULT_ERASER_RADIUS = 14;
export const DEFAULT_ERASER_STEP = 10;
/**
 * Eraser sweep calculation utility.
 */
export function sweepAndCollectHitStrokes(strokes, start, end, radius = DEFAULT_ERASER_RADIUS, step = DEFAULT_ERASER_STEP) {
    return eraserSweep(strokes, start, end, radius, step);
}
/**
 * Eraser interaction overlay tracking pointer sweeps and erasing strokes.
 */
export function EraserSweep({ strokes, radius = DEFAULT_ERASER_RADIUS, step = DEFAULT_ERASER_STEP, onDeleteStrokes, isActive, children, }) {
    const lastPosRef = useRef(null);
    const isDraggingRef = useRef(false);
    const [cursorPos, setCursorPos] = useState(null);
    if (!isActive) {
        return h("div", { className: "dsh-eraser-wrapper" }, children);
    }
    const handlePointerDown = (e) => {
        const ev = e;
        if (typeof ev.clientX !== "number" || typeof ev.clientY !== "number")
            return;
        const rect = ev.currentTarget?.getBoundingClientRect?.() ?? {
            left: 0,
            top: 0,
        };
        const pt = {
            x: ev.clientX - rect.left,
            y: ev.clientY - rect.top,
        };
        isDraggingRef.current = true;
        lastPosRef.current = pt;
        setCursorPos(pt);
    };
    const handlePointerMove = (e) => {
        const ev = e;
        if (typeof ev.clientX !== "number" || typeof ev.clientY !== "number")
            return;
        const rect = ev.currentTarget?.getBoundingClientRect?.() ?? {
            left: 0,
            top: 0,
        };
        const currentPt = {
            x: ev.clientX - rect.left,
            y: ev.clientY - rect.top,
        };
        setCursorPos(currentPt);
        if (!isDraggingRef.current || !lastPosRef.current) {
            return;
        }
        const hits = sweepAndCollectHitStrokes(strokes, lastPosRef.current, currentPt, radius, step);
        if (hits.length > 0) {
            onDeleteStrokes(hits);
        }
        lastPosRef.current = currentPt;
    };
    const handlePointerUp = () => {
        isDraggingRef.current = false;
        lastPosRef.current = null;
    };
    return h("div", {
        className: "dsh-cult-canvas-eraser-overlay",
        style: {
            position: "absolute",
            inset: 0,
            cursor: "crosshair",
            touchAction: "none",
        },
        onPointerDown: handlePointerDown,
        onPointerMove: handlePointerMove,
        onPointerUp: handlePointerUp,
        onPointerLeave: handlePointerUp,
    }, children, cursorPos
        ? h("div", {
            className: "dsh-eraser-cursor-indicator",
            style: {
                position: "absolute",
                left: `${cursorPos.x - radius}px`,
                top: `${cursorPos.y - radius}px`,
                width: `${radius * 2}px`,
                height: `${radius * 2}px`,
                borderRadius: "50%",
                border: "1.5px solid rgba(239, 68, 68, 0.8)",
                backgroundColor: "rgba(239, 68, 68, 0.15)",
                pointerEvents: "none",
                transform: "translate3d(0, 0, 0)",
            },
        })
        : null);
}
export { eraserSweep };
