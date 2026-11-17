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
import type {
	MarkerStrokeData,
	Point,
	RectBounds,
} from "../../domain/types.js";
import { type ClientNode, h, useRef, useState } from "./react-binding.js";

export const DEFAULT_ERASER_RADIUS = 14;
export const DEFAULT_ERASER_STEP = 10;

export interface ErasableStroke {
	id: string;
	box: RectBounds;
	stroke: MarkerStrokeData;
}

export interface EraserSweepHandlerProps {
	strokes: ErasableStroke[];
	radius?: number;
	step?: number;
	onDeleteStrokes: (deletedIds: string[]) => void;
	isActive: boolean;
	children?: ClientNode;
}

/**
 * Eraser sweep calculation utility.
 */
export function sweepAndCollectHitStrokes(
	strokes: ErasableStroke[],
	start: Point,
	end: Point,
	radius = DEFAULT_ERASER_RADIUS,
	step = DEFAULT_ERASER_STEP,
): string[] {
	return eraserSweep(strokes, start, end, radius, step);
}

/**
 * Eraser interaction overlay tracking pointer sweeps and erasing strokes.
 */
export function EraserSweep({
	strokes,
	radius = DEFAULT_ERASER_RADIUS,
	step = DEFAULT_ERASER_STEP,
	onDeleteStrokes,
	isActive,
	children,
}: EraserSweepHandlerProps): ClientNode {
	const lastPosRef = useRef<Point | null>(null);
	const isDraggingRef = useRef<boolean>(false);
	const [cursorPos, setCursorPos] = useState<Point | null>(null);

	if (!isActive) {
		return h("div", { className: "dsh-eraser-wrapper" }, children);
	}

	const handlePointerDown = (e: unknown) => {
		const ev = e as {
			clientX?: number;
			clientY?: number;
			currentTarget?: {
				getBoundingClientRect?: () => { left: number; top: number };
			};
		};
		if (typeof ev.clientX !== "number" || typeof ev.clientY !== "number")
			return;

		const rect = ev.currentTarget?.getBoundingClientRect?.() ?? {
			left: 0,
			top: 0,
		};
		const pt: Point = {
			x: ev.clientX - rect.left,
			y: ev.clientY - rect.top,
		};
		isDraggingRef.current = true;
		lastPosRef.current = pt;
		setCursorPos(pt);
	};

	const handlePointerMove = (e: unknown) => {
		const ev = e as {
			clientX?: number;
			clientY?: number;
			currentTarget?: {
				getBoundingClientRect?: () => { left: number; top: number };
			};
		};
		if (typeof ev.clientX !== "number" || typeof ev.clientY !== "number")
			return;

		const rect = ev.currentTarget?.getBoundingClientRect?.() ?? {
			left: 0,
			top: 0,
		};
		const currentPt: Point = {
			x: ev.clientX - rect.left,
			y: ev.clientY - rect.top,
		};
		setCursorPos(currentPt);

		if (!isDraggingRef.current || !lastPosRef.current) {
			return;
		}

		const hits = sweepAndCollectHitStrokes(
			strokes,
			lastPosRef.current,
			currentPt,
			radius,
			step,
		);

		if (hits.length > 0) {
			onDeleteStrokes(hits);
		}
		lastPosRef.current = currentPt;
	};

	const handlePointerUp = () => {
		isDraggingRef.current = false;
		lastPosRef.current = null;
	};

	return h(
		"div",
		{
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
		},
		children,
		cursorPos
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
			: null,
	);
}

export { eraserSweep };
