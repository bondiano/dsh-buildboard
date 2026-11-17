/**
 * CanvasViewport Component for DSH Cult Canvas
 *
 * Implements pan/zoom viewport with multi-layered canvas workspace:
 * - Dynamic dot-grid background synchronized with viewport pan and zoom
 * - SVG layer for freehand strokes and connector edges
 * - DOM layer for sticky notes, geometric shapes, and media nodes
 * - Preview layer for live drawing strokes and rubberband selection marquee
 * - Precise screen-to-world and world-to-screen coordinate mapping
 *
 * @module @local/dsh-cult-canvas/presentation/components/CanvasViewport
 */

import type { Point, RectBounds } from "../../domain/types.js";
import { type ClientNode, h, useRef } from "./react-binding.js";

export interface ViewportTransform {
	x: number;
	y: number;
	zoom: number;
}

export const DEFAULT_VIEWPORT: ViewportTransform = {
	x: 0,
	y: 0,
	zoom: 1,
};

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 5.0;

/** Converts screen (container-relative) coordinates to canvas world coordinates. */
export function screenToWorld(
	screenX: number,
	screenY: number,
	viewport: ViewportTransform,
): Point {
	return {
		x: (screenX - viewport.x) / viewport.zoom,
		y: (screenY - viewport.y) / viewport.zoom,
	};
}

/** Converts canvas world coordinates to screen (container-relative) coordinates. */
export function worldToScreen(
	worldX: number,
	worldY: number,
	viewport: ViewportTransform,
): Point {
	return {
		x: worldX * viewport.zoom + viewport.x,
		y: worldY * viewport.zoom + viewport.y,
	};
}

export interface CanvasViewportProps {
	viewport: ViewportTransform;
	onViewportChange?: (viewport: ViewportTransform) => void;
	svgContent?: ClientNode;
	domContent?: ClientNode;
	previewContent?: ClientNode;
	marqueeBounds?: RectBounds | null;
	/** Dot-grid step in world units. */
	gridSize?: number;
	cursor?: string;
	onPointerDown?: (e: unknown) => void;
	onPointerMove?: (e: unknown) => void;
	onPointerUp?: (e: unknown) => void;
	className?: string;
}

export function CanvasViewport({
	viewport,
	onViewportChange,
	svgContent,
	domContent,
	previewContent,
	marqueeBounds,
	gridSize: gridStep = 20,
	cursor = "default",
	onPointerDown,
	onPointerMove,
	onPointerUp,
	className,
}: CanvasViewportProps): ClientNode {
	const containerRef = useRef<HTMLDivElement | null>(null);

	const handleWheel = (e: unknown) => {
		const ev = e as {
			preventDefault?: () => void;
			deltaX?: number;
			deltaY?: number;
			ctrlKey?: boolean;
			metaKey?: boolean;
			clientX?: number;
			clientY?: number;
			currentTarget?: {
				getBoundingClientRect?: () => { left: number; top: number };
			};
		};
		if (!onViewportChange) return;
		if (ev.preventDefault) ev.preventDefault();

		const rect = ev.currentTarget?.getBoundingClientRect?.() ?? {
			left: 0,
			top: 0,
		};
		const mouseX = (ev.clientX ?? 0) - rect.left;
		const mouseY = (ev.clientY ?? 0) - rect.top;

		if (ev.ctrlKey || ev.metaKey) {
			// Zooming
			const factor = Math.exp(-(ev.deltaY ?? 0) * 0.005);
			const newZoom = Math.min(
				MAX_ZOOM,
				Math.max(MIN_ZOOM, viewport.zoom * factor),
			);
			const zoomRatio = newZoom / viewport.zoom;

			const newX = mouseX - (mouseX - viewport.x) * zoomRatio;
			const newY = mouseY - (mouseY - viewport.y) * zoomRatio;

			onViewportChange({
				x: Math.round(newX),
				y: Math.round(newY),
				zoom: newZoom,
			});
		} else {
			// Panning
			onViewportChange({
				x: viewport.x - (ev.deltaX ?? 0),
				y: viewport.y - (ev.deltaY ?? 0),
				zoom: viewport.zoom,
			});
		}
	};

	// Background dot grid calculation
	const gridSize = gridStep * viewport.zoom;
	const gridOffsetX = ((viewport.x % gridSize) + gridSize) % gridSize;
	const gridOffsetY = ((viewport.y % gridSize) + gridSize) % gridSize;

	const rootCls = ["dsh-cult-canvas-root", className ?? ""]
		.filter(Boolean)
		.join(" ");

	const worldTransform = `matrix(${viewport.zoom}, 0, 0, ${viewport.zoom}, ${viewport.x}, ${viewport.y})`;

	return h(
		"div",
		{
			ref: containerRef,
			className: rootCls,
			style: {
				position: "relative",
				width: "100%",
				height: "100%",
				overflow: "hidden",
				backgroundColor: "var(--dsh-canvas-bg, #0f141c)",
				backgroundImage: `radial-gradient(var(--dsh-canvas-dot, rgba(255, 255, 255, 0.12)) 1px, transparent 1px)`,
				backgroundSize: `${gridSize}px ${gridSize}px`,
				backgroundPosition: `${gridOffsetX}px ${gridOffsetY}px`,
				cursor,
				touchAction: "none",
				userSelect: "none",
			},
			onWheel: handleWheel,
			onPointerDown,
			onPointerMove,
			onPointerUp,
			onPointerLeave: onPointerUp,
		},
		// Transformed canvas scene graph
		h(
			"div",
			{
				className: "dsh-cult-canvas-viewport",
				style: {
					position: "absolute",
					top: 0,
					left: 0,
					width: "100%",
					height: "100%",
					transform: worldTransform,
					transformOrigin: "0 0",
					pointerEvents: "none",
				},
			},
			// 1. SVG Layer for strokes and connections
			h(
				"svg",
				{
					className: "dsh-cult-canvas-svg-layer",
					style: {
						position: "absolute",
						top: 0,
						left: 0,
						width: "100%",
						height: "100%",
						overflow: "visible",
						pointerEvents: "none",
					},
				},
				svgContent,
			),
			// 2. DOM Layer for whiteboard cards, sticky notes, and pipeline nodes
			h(
				"div",
				{
					className: "dsh-cult-canvas-dom-layer",
					style: {
						position: "absolute",
						top: 0,
						left: 0,
						width: 0,
						height: 0,
						overflow: "visible",
						pointerEvents: "auto",
					},
				},
				domContent,
			),
			// 3. Preview Layer for in-flight drawing or drag preview
			h(
				"div",
				{
					className: "dsh-cult-canvas-preview-layer",
					style: {
						position: "absolute",
						top: 0,
						left: 0,
						width: 0,
						height: 0,
						overflow: "visible",
						pointerEvents: "none",
					},
				},
				previewContent,
			),
		),
		// 4. Rubberband Marquee selection box (in screen coordinates)
		marqueeBounds
			? h("div", {
					className: "dsh-selection-marquee",
					style: {
						position: "absolute",
						left: `${marqueeBounds.x}px`,
						top: `${marqueeBounds.y}px`,
						width: `${marqueeBounds.width}px`,
						height: `${marqueeBounds.height}px`,
						border: "1px solid var(--dsh-accent, #38bdf8)",
						backgroundColor: "rgba(56, 189, 248, 0.15)",
						pointerEvents: "none",
						zIndex: 40,
					},
				})
			: null,
	);
}
