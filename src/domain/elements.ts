import type {
	AudioNode,
	CanvasColor,
	CanvasElement,
	FileCard,
	FinalcutNode,
	GroupFrame,
	ImageNode,
	LinkCard,
	MarkerStroke,
	PipelineElement,
	ScriptNode,
	ShapeType,
	Shot,
	StickyNote,
	StoryboardNode,
	TextCard,
	TextSize,
	VideoNode,
	WhiteboardElement,
	WhiteboardShape,
} from "./types.js";
import {
	buildStrokeNode,
	clampMarkerWidth,
	MARKER_COLORS,
	SHAPE_DEFINITIONS,
	STICKY_DEFAULT_BG,
} from "./geometry.js";

// ============================================================================
// Factory Helpers
// ============================================================================

export function createStickyNote(
	id: string,
	x: number,
	y: number,
	text: string,
	options: {
		color?: CanvasColor;
		width?: number;
		height?: number;
		fontSize?: TextSize;
		textAlign?: "left" | "center" | "right";
		zIndex?: number;
		pinned?: boolean;
	} = {},
): StickyNote {
	return {
		id,
		kind: "sticky",
		x,
		y,
		width: options.width ?? 220,
		height: options.height ?? 220,
		text,
		color: options.color ?? STICKY_DEFAULT_BG,
		fontSize: options.fontSize ?? "m",
		textAlign: options.textAlign ?? "left",
		zIndex: options.zIndex,
		pinned: options.pinned,
	};
}

export function createWhiteboardShape(
	id: string,
	shapeType: ShapeType,
	x: number,
	y: number,
	text: string,
	options: {
		color?: CanvasColor;
		width?: number;
		height?: number;
		fontSize?: TextSize;
		textAlign?: "left" | "center" | "right";
		border?: "solid" | "dashed" | "dotted";
		zIndex?: number;
		pinned?: boolean;
	} = {},
): WhiteboardShape {
	const shapeDef = SHAPE_DEFINITIONS[shapeType];
	return {
		id,
		kind: "shape",
		shapeType,
		x,
		y,
		width: options.width ?? shapeDef?.defaultWidth ?? 220,
		height: options.height ?? shapeDef?.defaultHeight ?? 220,
		text,
		color: options.color,
		fontSize: options.fontSize ?? "m",
		textAlign: options.textAlign ?? "center",
		border: options.border ?? "solid",
		zIndex: options.zIndex,
		pinned: options.pinned,
	};
}

export function createTextCard(
	id: string,
	x: number,
	y: number,
	text: string,
	options: {
		fontSize?: TextSize;
		width?: number;
		height?: number;
		textAlign?: "left" | "center" | "right";
		color?: CanvasColor;
		zIndex?: number;
		pinned?: boolean;
	} = {},
): TextCard {
	return {
		id,
		kind: "text",
		x,
		y,
		width: options.width ?? 260,
		height: options.height ?? 100,
		text,
		fontSize: options.fontSize ?? "m",
		textAlign: options.textAlign ?? "left",
		color: options.color,
		zIndex: options.zIndex,
		pinned: options.pinned,
	};
}

export function createMarkerStroke(
	id: string,
	points: Array<[number, number]>,
	size = 4,
	color: string = MARKER_COLORS[0],
	options: { zIndex?: number; pinned?: boolean } = {},
): MarkerStroke {
	const clampedSize = clampMarkerWidth(size);
	const strokeBox = buildStrokeNode(points, clampedSize);
	return {
		id,
		kind: "stroke",
		x: strokeBox.x,
		y: strokeBox.y,
		width: strokeBox.width,
		height: strokeBox.height,
		color,
		strokeWidth: clampedSize,
		points: strokeBox.gbStroke.points,
		origWidth: strokeBox.gbStroke.w,
		origHeight: strokeBox.gbStroke.h,
		zIndex: options.zIndex,
		pinned: options.pinned,
	};
}

export function createGroupFrame(
	id: string,
	x: number,
	y: number,
	width: number,
	height: number,
	options: {
		label?: string;
		color?: CanvasColor;
		background?: string;
		backgroundStyle?: "cover" | "ratio" | "repeat";
		zIndex?: number;
		pinned?: boolean;
	} = {},
): GroupFrame {
	return {
		id,
		kind: "group",
		x,
		y,
		width,
		height,
		label: options.label,
		color: options.color,
		background: options.background,
		backgroundStyle: options.backgroundStyle,
		zIndex: options.zIndex,
		pinned: options.pinned,
	};
}

export function createScriptNode(
	id: string,
	x: number,
	y: number,
	text: string,
	options: {
		label?: string;
		idea?: string;
		width?: number;
		height?: number;
		model?: string;
		provider?: string;
		zIndex?: number;
		pinned?: boolean;
	} = {},
): ScriptNode {
	return {
		id,
		kind: "script",
		label: options.label ?? "Screenplay",
		status: "idle",
		x,
		y,
		width: options.width ?? 320,
		height: options.height ?? 220,
		text,
		idea: options.idea,
		model: options.model,
		provider: options.provider,
		zIndex: options.zIndex,
		pinned: options.pinned,
	};
}

export function createStoryboardNode(
	id: string,
	x: number,
	y: number,
	shots: Shot[] = [],
	options: {
		label?: string;
		width?: number;
		height?: number;
		targetDuration?: number;
		combatMode?: "auto" | "on" | "off";
		zIndex?: number;
		pinned?: boolean;
	} = {},
): StoryboardNode {
	return {
		id,
		kind: "storyboard",
		label: options.label ?? "Storyboard",
		status: "idle",
		x,
		y,
		width: options.width ?? 380,
		height: options.height ?? 260,
		shots,
		targetDuration: options.targetDuration ?? 15,
		combatMode: options.combatMode ?? "auto",
		zIndex: options.zIndex,
		pinned: options.pinned,
	};
}

export function createImageNode(
	id: string,
	x: number,
	y: number,
	prompt: string,
	options: {
		label?: string;
		ratio?: string;
		size?: string;
		width?: number;
		height?: number;
		assetId?: string | null;
		refOrder?: string[];
		zIndex?: number;
		pinned?: boolean;
	} = {},
): ImageNode {
	return {
		id,
		kind: "image",
		label: options.label ?? "Image Generation",
		status: "idle",
		x,
		y,
		width: options.width ?? 280,
		height: options.height ?? 280,
		prompt,
		ratio: options.ratio ?? "16:9",
		size: options.size ?? "1K",
		assetId: options.assetId ?? null,
		refOrder: options.refOrder,
		zIndex: options.zIndex,
		pinned: options.pinned,
	};
}

export function createVideoNode(
	id: string,
	x: number,
	y: number,
	prompt: string,
	options: {
		label?: string;
		ratio?: string;
		duration?: number;
		resolution?: string;
		width?: number;
		height?: number;
		frameMode?: "auto" | "hard" | "off";
		assetId?: string | null;
		zIndex?: number;
		pinned?: boolean;
	} = {},
): VideoNode {
	return {
		id,
		kind: "video",
		label: options.label ?? "Video Generation",
		status: "idle",
		x,
		y,
		width: options.width ?? 320,
		height: options.height ?? 260,
		prompt,
		ratio: options.ratio ?? "16:9",
		duration: options.duration ?? 5,
		resolution: options.resolution ?? "720P",
		frameMode: options.frameMode ?? "auto",
		assetId: options.assetId ?? null,
		zIndex: options.zIndex,
		pinned: options.pinned,
	};
}

export function createAudioNode(
	id: string,
	x: number,
	y: number,
	prompt: string,
	options: {
		label?: string;
		audioType?: "speech" | "sfx" | "music";
		duration?: number;
		width?: number;
		height?: number;
		assetId?: string | null;
		zIndex?: number;
		pinned?: boolean;
	} = {},
): AudioNode {
	return {
		id,
		kind: "audio",
		label: options.label ?? "Audio Track",
		status: "idle",
		x,
		y,
		width: options.width ?? 280,
		height: options.height ?? 180,
		prompt,
		audioType: options.audioType ?? "speech",
		duration: options.duration ?? 5,
		assetId: options.assetId ?? null,
		zIndex: options.zIndex,
		pinned: options.pinned,
	};
}

export function createFinalcutNode(
	id: string,
	x: number,
	y: number,
	options: {
		label?: string;
		sequence?: string[];
		totalDuration?: number;
		width?: number;
		height?: number;
		assetId?: string | null;
		zIndex?: number;
		pinned?: boolean;
	} = {},
): FinalcutNode {
	return {
		id,
		kind: "finalcut",
		label: options.label ?? "Final Cut",
		status: "idle",
		x,
		y,
		width: options.width ?? 340,
		height: options.height ?? 220,
		sequence: options.sequence ?? [],
		totalDuration: options.totalDuration ?? 0,
		assetId: options.assetId ?? null,
		zIndex: options.zIndex,
		pinned: options.pinned,
	};
}

export function createFileCard(
	id: string,
	file: string,
	x: number,
	y: number,
	options: {
		subpath?: string;
		width?: number;
		height?: number;
		color?: CanvasColor;
		zIndex?: number;
		pinned?: boolean;
	} = {},
): FileCard {
	return {
		id,
		kind: "file",
		file,
		subpath: options.subpath,
		x,
		y,
		width: options.width ?? 260,
		height: options.height ?? 200,
		color: options.color,
		zIndex: options.zIndex,
		pinned: options.pinned,
	};
}

export function createLinkCard(
	id: string,
	url: string,
	x: number,
	y: number,
	options: {
		width?: number;
		height?: number;
		color?: CanvasColor;
		zIndex?: number;
		pinned?: boolean;
	} = {},
): LinkCard {
	return {
		id,
		kind: "link",
		url,
		x,
		y,
		width: options.width ?? 260,
		height: options.height ?? 90,
		color: options.color,
		zIndex: options.zIndex,
		pinned: options.pinned,
	};
}

export function isWhiteboardElement(
	el: CanvasElement,
): el is WhiteboardElement {
	return (
		el.kind === "sticky" ||
		el.kind === "shape" ||
		el.kind === "text" ||
		el.kind === "stroke" ||
		el.kind === "group" ||
		el.kind === "file" ||
		el.kind === "link"
	);
}

export function isPipelineElement(el: CanvasElement): el is PipelineElement {
	return (
		el.kind === "script" ||
		el.kind === "storyboard" ||
		el.kind === "image" ||
		el.kind === "video" ||
		el.kind === "audio" ||
		el.kind === "finalcut"
	);
}
