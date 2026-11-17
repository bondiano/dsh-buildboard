/**
 * Comprehensive Client Stylesheet for DSH Cult Canvas
 *
 * Provides styling for:
 * - Canvas root, viewport, infinite dot grid
 * - Left toolbar and flyout palettes
 * - Freehand marker strokes and selection halos
 * - Sticky notes with drop shadow and typography
 * - Geometric shapes with SVG and CSS backgrounds
 * - Selection bounds and 8 resize handles
 * - Eraser cursor indicator and interaction overlay
 * - Minimap with camera viewport
 * - Agent toolview cards for slot tool.call.toolview
 * - Pipeline nodes, ports, and status badges
 *
 * @module @local/dsh-cult-canvas/presentation/styles
 */

export const CANVAS_CLIENT_STYLES = `
/* ==========================================================================
   DSH Cult Canvas Root & Infinite Workspace
   ========================================================================== */

:root {
	--dsh-canvas-bg: #0f141c;
	--dsh-canvas-fg: #e2e8f0;
	--dsh-canvas-dot: rgba(255, 255, 255, 0.08);
	--dsh-accent: #38bdf8;
	--dsh-accent-hover: #0ea5e9;
	--dsh-border-color: rgba(255, 255, 255, 0.12);
	--dsh-card-bg: #1e293b;
	--dsh-font-handwriting: "Cult Canvas Shantell", "Caveat", "Comic Sans MS", cursive, sans-serif;
	--dsh-font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.dsh-cult-canvas-board {
	position: relative;
	width: 100%;
	height: 100%;
	min-height: 560px;
	overflow: hidden;
	background-color: var(--dsh-canvas-bg);
	color: var(--dsh-canvas-fg);
	font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
	user-select: none;
}

.dsh-cult-canvas-root {
	position: relative;
	width: 100%;
	height: 100%;
	min-height: 480px;
	overflow: hidden;
	background-color: var(--dsh-canvas-bg);
	user-select: none;
}

.dsh-cult-canvas-viewport {
	position: absolute;
	inset: 0;
	transform-origin: 0 0;
	will-change: transform;
}

.dsh-cult-canvas-svg-layer {
	position: absolute;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	pointer-events: none;
	overflow: visible;
}

.dsh-cult-canvas-dom-layer {
	position: absolute;
	top: 0;
	left: 0;
	width: 0;
	height: 0;
	overflow: visible;
	pointer-events: auto;
}

.dsh-cult-canvas-preview-layer {
	position: absolute;
	top: 0;
	left: 0;
	width: 0;
	height: 0;
	overflow: visible;
	pointer-events: none;
}

/* ==========================================================================
   Left Toolbar & Flyout Panels
   ========================================================================== */

.dsh-cult-canvas-toolbar {
	position: absolute;
	top: 20px;
	left: 20px;
	display: flex;
	flex-direction: column;
	gap: 6px;
	background-color: rgba(15, 23, 42, 0.92);
	backdrop-filter: blur(10px);
	padding: 8px;
	border-radius: 12px;
	box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
	border: 1px solid var(--dsh-border-color);
	z-index: 50;
}

.dsh-toolbar-btn {
	width: 38px;
	height: 38px;
	display: flex;
	align-items: center;
	justify-content: center;
	background-color: transparent;
	color: #94a3b8;
	border: none;
	border-radius: 8px;
	cursor: pointer;
	font-size: 16px;
	font-weight: 600;
	transition: all 0.15s ease;
}

.dsh-toolbar-btn:hover {
	background-color: rgba(255, 255, 255, 0.1);
	color: #f1f5f9;
}

.dsh-toolbar-btn.active {
	background-color: var(--dsh-accent);
	color: #0f172a;
	box-shadow: 0 0 12px rgba(56, 189, 248, 0.4);
}

.dsh-toolbar-flyout {
	position: absolute;
	background-color: rgba(15, 23, 42, 0.96);
	backdrop-filter: blur(12px);
	padding: 10px;
	border-radius: 10px;
	border: 1px solid var(--dsh-border-color);
	box-shadow: 0 12px 30px rgba(0, 0, 0, 0.6);
	z-index: 60;
}

/* ==========================================================================
   Freehand Marker Strokes
   ========================================================================== */

.dsh-cult-canvas-marker-stroke {
	cursor: pointer;
}

.dsh-marker-hit-area {
	pointer-events: stroke;
}

.dsh-marker-fill {
	transition: fill 0.15s ease;
}

.dsh-marker-selection-halo {
	animation: stroke-pulse 2s ease-in-out infinite alternate;
}

@keyframes stroke-pulse {
	0% { opacity: 0.6; }
	100% { opacity: 1; }
}

/* ==========================================================================
   Sticky Notes
   ========================================================================== */

.dsh-cult-canvas-element {
	position: absolute;
	box-sizing: border-box;
	border-radius: 6px;
	cursor: move;
	transition: box-shadow 0.15s ease;
}

.dsh-cult-canvas-sticky {
	background-color: #FFF59A;
	color: #3a3500;
	padding: 14px;
	border-radius: 4px;
	box-shadow: 0 8px 18px rgba(0, 0, 0, 0.38);
	font-family: var(--dsh-font-handwriting);
	line-height: 1.4;
	white-space: pre-wrap;
	word-break: break-word;
}

.dsh-cult-canvas-sticky.selected {
	outline: 2px solid var(--dsh-accent);
	outline-offset: 2px;
}

.dsh-sticky-textarea {
	width: 100%;
	height: 100%;
	background: transparent;
	border: none;
	outline: none;
	resize: none;
	font-family: inherit;
	font-size: inherit;
	color: inherit;
}

/* ==========================================================================
   Geometric Shapes
   ========================================================================== */

.dsh-cult-canvas-shape {
	position: absolute;
	box-sizing: border-box;
}

.dsh-cult-canvas-shape.selected {
	outline: 2px solid var(--dsh-accent);
	outline-offset: 2px;
}

.dsh-shape-text-wrapper {
	position: absolute;
	inset: 0;
	display: flex;
	align-items: center;
	box-sizing: border-box;
}

/* ==========================================================================
   Selection Marquee & Resize Handles
   ========================================================================== */

.dsh-cult-canvas-selection-box {
	position: absolute;
	border: 1.5px dashed var(--dsh-accent);
	box-sizing: border-box;
	pointer-events: none;
}

.dsh-resize-handle {
	position: absolute;
	background-color: #ffffff;
	border: 1.5px solid var(--dsh-accent);
	border-radius: 2px;
	box-sizing: border-box;
	pointer-events: auto;
	box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.dsh-selection-marquee {
	position: absolute;
	border: 1px solid var(--dsh-accent);
	background-color: rgba(56, 189, 248, 0.15);
	pointer-events: none;
	z-index: 40;
}

/* ==========================================================================
   Minimap
   ========================================================================== */

.dsh-cult-canvas-minimap {
	position: absolute;
	bottom: 20px;
	right: 20px;
	width: 180px;
	height: 120px;
	background-color: rgba(15, 23, 42, 0.88);
	border: 1px solid var(--dsh-border-color);
	border-radius: 8px;
	overflow: hidden;
	cursor: crosshair;
	backdrop-filter: blur(8px);
	box-shadow: 0 8px 20px rgba(0, 0, 0, 0.5);
	z-index: 45;
}

.dsh-minimap-camera {
	position: absolute;
	border: 1.5px solid var(--dsh-accent);
	background-color: rgba(56, 189, 248, 0.18);
	border-radius: 2px;
	pointer-events: none;
}

/* ==========================================================================
   Eraser Sweep
   ========================================================================== */

.dsh-cult-canvas-eraser-overlay {
	position: absolute;
	inset: 0;
	cursor: crosshair;
	touch-action: none;
	z-index: 42;
}

.dsh-eraser-cursor-indicator {
	border-radius: 50%;
	border: 1.5px solid rgba(239, 68, 68, 0.85);
	background-color: rgba(239, 68, 68, 0.18);
	pointer-events: none;
	transform: translate3d(0, 0, 0);
}

/* ==========================================================================
   Toolview Cards (slot tool.call.toolview)
   ========================================================================== */

.dsh-cult-canvas-toolview {
	background-color: rgba(15, 23, 42, 0.9);
	border: 1px solid var(--dsh-border-color);
	border-radius: 8px;
	padding: 10px 14px;
	margin: 6px 0;
	font-size: 12px;
	color: #e2e8f0;
	font-family: var(--dsh-font-mono);
}

.dsh-toolview-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	cursor: pointer;
	user-select: none;
}

.dsh-toolview-body {
	margin-top: 8px;
	padding-top: 8px;
	border-top: 1px solid rgba(255, 255, 255, 0.08);
	max-height: 260px;
	overflow: auto;
}

/* ==========================================================================
   Edges, Pipeline Nodes & Ports
   ========================================================================== */

.dsh-cult-canvas-edge {
	fill: none;
	stroke: var(--dsh-edge-color, #64748b);
	stroke-width: 2px;
	transition: stroke 0.15s ease, stroke-width 0.15s ease;
}

.dsh-cult-canvas-edge:hover,
.dsh-cult-canvas-edge.selected {
	stroke: var(--dsh-accent);
	stroke-width: 3px;
}

.dsh-cult-canvas-node {
	background: var(--dsh-node-bg, #1e293b);
	border: 1px solid var(--dsh-node-border, #334155);
	border-radius: 8px;
	box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3);
	display: flex;
	flex-direction: column;
	overflow: hidden;
}

.dsh-cult-canvas-node-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 8px 12px;
	background: #0f172a;
	border-bottom: 1px solid #334155;
	font-size: 12px;
	font-weight: 600;
	letter-spacing: 0.05em;
	text-transform: uppercase;
}

.dsh-cult-canvas-node-body {
	padding: 12px;
	font-size: 13px;
	flex: 1;
	overflow: auto;
}

.dsh-cult-canvas-port {
	width: 10px;
	height: 10px;
	border-radius: 50%;
	background: #94a3b8;
	border: 2px solid #1e293b;
	cursor: crosshair;
	position: absolute;
	transition: transform 0.15s ease, background-color 0.15s ease;
}

.dsh-cult-canvas-port:hover {
	transform: scale(1.3);
	background: var(--dsh-accent);
}

.dsh-cult-canvas-port.input { left: -6px; }
.dsh-cult-canvas-port.output { right: -6px; }

.dsh-cult-canvas-status-badge {
	font-size: 10px;
	padding: 2px 6px;
	border-radius: 9999px;
	font-weight: 500;
}

.dsh-cult-canvas-status-idle { background: #334155; color: #94a3b8; }
.dsh-cult-canvas-status-queued { background: #854d0e; color: #fef08a; }
.dsh-cult-canvas-status-running { background: #1e40af; color: #93c5fd; animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
.dsh-cult-canvas-status-completed { background: #166534; color: #86efac; }
.dsh-cult-canvas-status-failed { background: #991b1b; color: #fca5a5; }

@keyframes pulse {
	0%, 100% { opacity: 1; }
	50% { opacity: 0.5; }
}
`;
