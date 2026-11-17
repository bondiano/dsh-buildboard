/**
 * ElementManipulation Component & Logic for DSH Cult Canvas
 *
 * Implements:
 * - Selection bounding box calculation and visual marquee overlay
 * - 8 resize handles (nw, n, ne, e, se, s, sw, w) with snap-to-grid (20px)
 * - Alt+drag duplicate detection
 * - Layer ordering (], [, Ctrl+], Ctrl+[)
 * - Keyboard shortcuts (Delete, Backspace, Ctrl+D)
 *
 * @module @local/dsh-cult-canvas/presentation/components/ElementManipulation
 */

import {
	boxesOverlap,
	layerOrder,
	unionBounds,
} from "../../domain/geometry.js";
import type { BoundingBox, RectBounds } from "../../domain/types.js";
import { type ClientNode, h } from "./react-binding.js";

export const DEFAULT_GRID_SIZE = 20;

export type ResizeHandleDirection =
	| "nw"
	| "n"
	| "ne"
	| "e"
	| "se"
	| "s"
	| "sw"
	| "w";

export const RESIZE_HANDLES: ResizeHandleDirection[] = [
	"nw",
	"n",
	"ne",
	"e",
	"se",
	"s",
	"sw",
	"w",
];

/** Snaps a coordinate value to the nearest grid step. */
export function snapToGrid(
	value: number,
	gridSize = DEFAULT_GRID_SIZE,
): number {
	return Math.round(value / gridSize) * gridSize;
}

/** Computes the combined RectBounds enclosing all given element bounds. */
export function computeSelectionBounds(
	elements: Array<{ x: number; y: number; width: number; height: number }>,
): RectBounds | null {
	if (elements.length === 0) return null;
	const boxes: BoundingBox[] = elements.map((el) => ({
		minX: el.x,
		minY: el.y,
		maxX: el.x + el.width,
		maxY: el.y + el.height,
	}));
	const union = unionBounds(boxes);
	if (!union) return null;
	return {
		x: union.minX,
		y: union.minY,
		width: union.maxX - union.minX,
		height: union.maxY - union.minY,
	};
}

export interface ManipulationKeyboardOptions {
	selectedIds: string[];
	order: string[];
	onDelete?: (ids: string[]) => void;
	onDuplicate?: (ids: string[]) => void;
	onReorder?: (newOrder: string[]) => void;
	overlapsFn?: (idA: string, idB: string) => boolean;
}

/**
 * Handles keyboard events for whiteboard element manipulation:
 * - Delete / Backspace: deletes selected elements
 * - ]: Bring to front
 * - [: Send to back
 * - Ctrl+] / Cmd+]: Step forward
 * - Ctrl+[ / Cmd+[: Step backward
 * - Ctrl+D / Cmd+D: Duplicate selected
 */
export function handleManipulationKeyDown(
	event: {
		key: string;
		ctrlKey?: boolean;
		metaKey?: boolean;
		altKey?: boolean;
		shiftKey?: boolean;
		preventDefault?: () => void;
	},
	options: ManipulationKeyboardOptions,
): boolean {
	const { selectedIds, order, onDelete, onDuplicate, onReorder, overlapsFn } =
		options;
	if (selectedIds.length === 0) return false;

	const isCtrl = Boolean(event.ctrlKey || event.metaKey);
	const selSet = new Set(selectedIds);

	// 1. Delete / Backspace
	if (event.key === "Delete" || event.key === "Backspace") {
		if (event.preventDefault) event.preventDefault();
		if (onDelete) onDelete(selectedIds);
		return true;
	}

	// 2. Duplicate (Ctrl+D)
	if (isCtrl && (event.key === "d" || event.key === "D")) {
		if (event.preventDefault) event.preventDefault();
		if (onDuplicate) onDuplicate(selectedIds);
		return true;
	}

	// 3. Layer forward / backward (Ctrl+] / Ctrl+[)
	if (isCtrl && event.key === "]") {
		if (event.preventDefault) event.preventDefault();
		if (onReorder) {
			const next = layerOrder(order, selSet, "forward", overlapsFn);
			onReorder(next);
		}
		return true;
	}

	if (isCtrl && event.key === "[") {
		if (event.preventDefault) event.preventDefault();
		if (onReorder) {
			const next = layerOrder(order, selSet, "backward", overlapsFn);
			onReorder(next);
		}
		return true;
	}

	// 4. Layer front / back (] / [)
	if (event.key === "]") {
		if (event.preventDefault) event.preventDefault();
		if (onReorder) {
			const next = layerOrder(order, selSet, "front", overlapsFn);
			onReorder(next);
		}
		return true;
	}

	if (event.key === "[") {
		if (event.preventDefault) event.preventDefault();
		if (onReorder) {
			const next = layerOrder(order, selSet, "back", overlapsFn);
			onReorder(next);
		}
		return true;
	}

	return false;
}

export interface SelectionOverlayProps {
	bounds: RectBounds;
	zoom?: number;
	onResizeStart?: (handle: ResizeHandleDirection, e: unknown) => void;
	onDragStart?: (e: unknown) => void;
}

/**
 * Selection bounds overlay rendering the dashed selection box and 8 resize handles.
 */
export function SelectionOverlay({
	bounds,
	zoom = 1,
	onResizeStart,
	onDragStart,
}: SelectionOverlayProps): ClientNode {
	const handleSize = 8 / zoom;
	const half = handleSize / 2;

	const handlePositions: Record<
		ResizeHandleDirection,
		{ left: number; top: number; cursor: string }
	> = {
		nw: { left: -half, top: -half, cursor: "nwse-resize" },
		n: { left: bounds.width / 2 - half, top: -half, cursor: "ns-resize" },
		ne: { left: bounds.width - half, top: -half, cursor: "nesw-resize" },
		e: {
			left: bounds.width - half,
			top: bounds.height / 2 - half,
			cursor: "ew-resize",
		},
		se: {
			left: bounds.width - half,
			top: bounds.height - half,
			cursor: "nwse-resize",
		},
		s: {
			left: bounds.width / 2 - half,
			top: bounds.height - half,
			cursor: "ns-resize",
		},
		sw: { left: -half, top: bounds.height - half, cursor: "nesw-resize" },
		w: { left: -half, top: bounds.height / 2 - half, cursor: "ew-resize" },
	};

	return h(
		"div",
		{
			className: "dsh-cult-canvas-selection-box",
			style: {
				position: "absolute",
				left: `${bounds.x}px`,
				top: `${bounds.y}px`,
				width: `${bounds.width}px`,
				height: `${bounds.height}px`,
				border: "1.5px dashed var(--dsh-accent, #38bdf8)",
				boxSizing: "border-box",
				pointerEvents: "none",
			},
			onPointerDown: onDragStart,
		},
		...RESIZE_HANDLES.map((handle) => {
			const pos = handlePositions[handle];
			return h("div", {
				key: handle,
				className: `dsh-resize-handle handle-${handle}`,
				"data-handle": handle,
				style: {
					position: "absolute",
					left: `${pos.left}px`,
					top: `${pos.top}px`,
					width: `${handleSize}px`,
					height: `${handleSize}px`,
					backgroundColor: "#ffffff",
					border: "1.5px solid var(--dsh-accent, #38bdf8)",
					borderRadius: "2px",
					cursor: pos.cursor,
					pointerEvents: "auto",
					boxSizing: "border-box",
				},
				onPointerDown: (e: unknown) => {
					if (
						e &&
						typeof (e as { stopPropagation?: () => void }).stopPropagation ===
							"function"
					) {
						(e as { stopPropagation: () => void }).stopPropagation();
					}
					if (onResizeStart) onResizeStart(handle, e);
				},
			});
		}),
	);
}

export { boxesOverlap, layerOrder, unionBounds };
