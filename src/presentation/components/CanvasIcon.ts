/**
 * Cult Canvas glyph for the guide card and the tab chip.
 *
 * The paths are the plugin's own `icon.svg`, drawn inline so the card needs no
 * asset fetch and inherits the shell's colour scheme.
 *
 * @module @local/dsh-cult-canvas/presentation/components/CanvasIcon
 */

import { type ClientNode, h } from "./react-binding.js";

export interface CanvasIconProps {
	/** Glyph edge in pixels; the shell passes its own icon size. */
	size?: number;
	/** Extra class from the host icon slot. */
	className?: string;
}

export function CanvasIcon({
	size = 20,
	className,
}: CanvasIconProps): ClientNode {
	return h(
		"svg",
		{
			width: size,
			height: size,
			viewBox: "0 0 64 64",
			className,
			role: "img",
			"aria-label": "Cult Canvas",
			xmlns: "http://www.w3.org/2000/svg",
		},
		h("rect", {
			x: 3,
			y: 3,
			width: 58,
			height: 58,
			rx: 14,
			fill: "currentColor",
			opacity: 0.08,
		}),
		h("path", {
			d: "M16 22 C26 22, 26 42, 36 42",
			stroke: "currentColor",
			strokeWidth: 2.5,
			strokeLinecap: "round",
			fill: "none",
		}),
		h("rect", {
			x: 10,
			y: 14,
			width: 16,
			height: 16,
			rx: 3,
			fill: "#fff59a",
			stroke: "#3a3500",
			strokeWidth: 1.2,
		}),
		h("rect", {
			x: 36,
			y: 34,
			width: 18,
			height: 16,
			rx: 4,
			fill: "none",
			stroke: "currentColor",
			strokeWidth: 1.8,
		}),
		h("circle", { cx: 48, cy: 20, r: 7, fill: "#ff5a3d" }),
	);
}
