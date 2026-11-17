/**
 * ShapeElement Component for DSH Cult Canvas
 *
 * Implements 7 geometric whiteboard shapes ported from cult-canvas:
 * - rect, pill, diamond, circle, parallelogram, document, database
 * - Inset text padding compensation (diamond 22%, circle 14%, database translateY 20px)
 * - Editable text, configurable borders (solid, dashed, dotted), and fill colors
 *
 * @module @local/dsh-cult-canvas/presentation/components/ShapeElement
 */

import {
	getShapePaddingCompensation,
	SHAPE_DEFINITIONS,
	TEXT_SIZES,
} from "../../domain/geometry.js";
import type { ShapeType, TextSize } from "../../domain/types.js";
import { type ClientNode, h, useState } from "./react-binding.js";

export const SUPPORTED_SHAPES: ShapeType[] = [
	"rect",
	"pill",
	"diamond",
	"circle",
	"parallelogram",
	"document",
	"database",
];

export interface ShapeElementProps {
	id: string;
	shapeType: ShapeType;
	x?: number;
	y?: number;
	width?: number;
	height?: number;
	text: string;
	color?: string;
	borderColor?: string;
	border?: "solid" | "dashed" | "dotted";
	fontSize?: TextSize;
	textAlign?: "left" | "center" | "right";
	isSelected?: boolean;
	isEditing?: boolean;
	onSelect?: (id: string, shiftKey?: boolean) => void;
	onPointerDown?: (id: string, e: unknown) => void;
	onChangeText?: (id: string, newText: string) => void;
	className?: string;
}

/**
 * Returns SVG path or polygon definition for non-rectangular shape backgrounds.
 */
export function getShapeSvgPath(
	shapeType: ShapeType,
	w: number,
	hVal: number,
): string {
	switch (shapeType) {
		case "diamond":
			return `M ${w / 2} 0 L ${w} ${hVal / 2} L ${w / 2} ${hVal} L 0 ${hVal / 2} Z`;
		case "parallelogram": {
			const skew = w * 0.15;
			return `M ${skew} 0 L ${w} 0 L ${w - skew} ${hVal} L 0 ${hVal} Z`;
		}
		case "document": {
			const fold = Math.min(24, Math.min(w, hVal) * 0.2);
			return `M 0 0 L ${w} 0 L ${w} ${hVal - fold} L ${w - fold} ${hVal} L 0 ${hVal} Z`;
		}
		case "database": {
			const ry = Math.min(24, hVal * 0.15);
			return `M 0 ${ry} A ${w / 2} ${ry} 0 0 1 ${w} ${ry} L ${w} ${hVal - ry} A ${w / 2} ${ry} 0 0 1 0 ${hVal - ry} Z`;
		}
		case "rect":
		case "pill":
		case "circle":
			return "";
	}
}

export function ShapeElement({
	id,
	shapeType,
	x = 0,
	y = 0,
	width,
	height,
	text,
	color = "#1e293b",
	borderColor = "#475569",
	border = "solid",
	fontSize = "m",
	textAlign = "center",
	isSelected = false,
	isEditing = false,
	onSelect,
	onPointerDown,
	onChangeText,
	className,
}: ShapeElementProps): ClientNode {
	const [localEditing, setLocalEditing] = useState(isEditing);
	const [editText, setEditText] = useState(text);

	const shapeDef = SHAPE_DEFINITIONS[shapeType] ?? SHAPE_DEFINITIONS["rect"]!;
	const w = width ?? shapeDef.defaultWidth;
	const hVal = height ?? shapeDef.defaultHeight;

	const { paddingInlinePercent, textOffsetY } =
		getShapePaddingCompensation(shapeType);

	const pxSize = TEXT_SIZES[fontSize] ?? 18;

	const handleDoubleClick = (e: unknown) => {
		if (
			e &&
			typeof (e as { stopPropagation?: () => void }).stopPropagation ===
				"function"
		) {
			(e as { stopPropagation: () => void }).stopPropagation();
		}
		setLocalEditing(true);
	};

	const handleBlur = () => {
		setLocalEditing(false);
		if (onChangeText && editText !== text) {
			onChangeText(id, editText);
		}
	};

	const handleTextChange = (e: unknown) => {
		const target = (e as { target?: { value?: string } })?.target;
		if (target && typeof target.value === "string") {
			setEditText(target.value);
		}
	};

	const handleClick = (e: unknown) => {
		const shiftKey = Boolean((e as { shiftKey?: boolean })?.shiftKey);
		if (onSelect) {
			onSelect(id, shiftKey);
		}
	};

	const handlePointerDown = (e: unknown) => {
		if (localEditing) return;
		if (
			e &&
			typeof (e as { stopPropagation?: () => void }).stopPropagation ===
				"function"
		) {
			(e as { stopPropagation: () => void }).stopPropagation();
		}
		if (onPointerDown) {
			onPointerDown(id, e);
		}
	};

	const containerStyle: Record<string, unknown> = {
		position: "absolute",
		left: `${x}px`,
		top: `${y}px`,
		width: `${w}px`,
		height: `${hVal}px`,
		boxSizing: "border-box",
	};

	// Determine shape styling
	let shapeBorderRadius = "8px";
	let isCustomSvg = false;
	if (shapeType === "pill") {
		shapeBorderRadius = "9999px";
	} else if (shapeType === "circle") {
		shapeBorderRadius = "50%";
	} else if (
		shapeType === "diamond" ||
		shapeType === "parallelogram" ||
		shapeType === "document" ||
		shapeType === "database"
	) {
		isCustomSvg = true;
	}

	const textContainerStyle: Record<string, unknown> = {
		position: "absolute",
		inset: "0",
		display: "flex",
		alignItems: "center",
		justifyContent:
			textAlign === "center"
				? "center"
				: textAlign === "right"
					? "flex-end"
					: "flex-start",
		paddingLeft: `${Math.max(12, (w * paddingInlinePercent) / 100)}px`,
		paddingRight: `${Math.max(12, (w * paddingInlinePercent) / 100)}px`,
		transform: textOffsetY ? `translateY(${textOffsetY}px)` : undefined,
		boxSizing: "border-box",
		fontSize: `${pxSize}px`,
		textAlign,
		color: "var(--dsh-canvas-fg, #e2e8f0)",
		pointerEvents: localEditing ? "auto" : "none",
	};

	const cls = [
		"dsh-cult-canvas-element",
		`dsh-cult-canvas-shape`,
		`shape-${shapeType}`,
		isSelected ? "selected" : "",
		className ?? "",
	]
		.filter(Boolean)
		.join(" ");

	const strokeDash =
		border === "dashed" ? "6 6" : border === "dotted" ? "2 4" : undefined;

	return h(
		"div",
		{
			id: `shape-${id}`,
			className: cls,
			style: containerStyle,
			onClick: handleClick,
			onPointerDown: handlePointerDown,
			onDoubleClick: handleDoubleClick,
			"data-element-id": id,
			"data-element-kind": "shape",
			"data-shape-type": shapeType,
		},
		// Shape graphic background
		isCustomSvg
			? h(
					"svg",
					{
						className: "dsh-shape-svg-bg",
						width: w,
						height: hVal,
						style: { position: "absolute", inset: "0", pointerEvents: "none" },
					},
					h("path", {
						d: getShapeSvgPath(shapeType, w, hVal),
						fill: color,
						stroke: borderColor,
						strokeWidth: 2,
						strokeDasharray: strokeDash,
					}),
					// Additional top rim line for database cylinder
					shapeType === "database"
						? h("ellipse", {
								cx: w / 2,
								cy: Math.min(24, hVal * 0.15),
								rx: w / 2 - 1,
								ry: Math.min(24, hVal * 0.15) - 1,
								fill: "none",
								stroke: borderColor,
								strokeWidth: 1.5,
								strokeDasharray: strokeDash,
							})
						: null,
				)
			: h("div", {
					className: "dsh-shape-css-bg",
					style: {
						position: "absolute",
						inset: "0",
						backgroundColor: color,
						borderRadius: shapeBorderRadius,
						border: `2px ${border} ${borderColor}`,
						boxSizing: "border-box",
						pointerEvents: "none",
					},
				}),
		// Text content layer
		h(
			"div",
			{
				className: "dsh-shape-text-wrapper",
				style: textContainerStyle,
			},
			localEditing
				? h("textarea", {
						className: "dsh-shape-textarea",
						value: editText,
						autoFocus: true,
						onChange: handleTextChange,
						onBlur: handleBlur,
						style: {
							width: "100%",
							maxHeight: "100%",
							background: "transparent",
							border: "none",
							outline: "none",
							resize: "none",
							fontFamily: "inherit",
							fontSize: "inherit",
							textAlign: "inherit",
							color: "inherit",
							padding: "0",
							margin: "0",
						},
					})
				: h(
						"span",
						{
							className: "dsh-shape-text",
							style: {
								whiteSpace: "pre-wrap",
								wordBreak: "break-word",
								lineHeight: 1.3,
							},
						},
						editText || text,
					),
		),
	);
}

export { getShapePaddingCompensation };
