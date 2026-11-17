import type { NodePortConfiguration, PortKind } from "./types.js";

// ============================================================================
// Media Pipeline Port Taxonomy (DSH Infinite Canvas)
// ============================================================================

export const PORT_TABLE: Record<string, NodePortConfiguration> = {
	text: {
		inputs: [],
		outputs: [{ id: "out", kind: "text", label: "Text Output" }],
	},
	shot: {
		inputs: [
			{ id: "char", kind: "image", label: "Character Ref" },
			{ id: "scene", kind: "image", label: "Scene Ref" },
			{ id: "prop", kind: "image", label: "Prop Ref" },
		],
		outputs: [
			{ id: "visual", kind: "text", label: "Visual Prompt" },
			{ id: "motion", kind: "text", label: "Motion Prompt" },
		],
	},
	script: {
		inputs: [],
		outputs: [{ id: "out", kind: "text", label: "Script Markdown" }],
	},
	storyboard: {
		inputs: [
			{ id: "prev", kind: "text", label: "Previous Storyboard" },
			{ id: "script", kind: "text", label: "Script Input" },
		],
		outputs: [
			{ id: "out", kind: "text", label: "Storyboard Output" },
			{ id: "tail", kind: "text", label: "Tail Continuity" },
		],
	},
	image: {
		inputs: [
			{ id: "prompt", kind: "text", label: "Prompt" },
			{ id: "ref", kind: "image", label: "Visual References" },
		],
		outputs: [{ id: "out", kind: "image", label: "Image Asset" }],
	},
	video: {
		inputs: [
			{ id: "prompt", kind: "text", label: "Prompt" },
			{ id: "frame", kind: "image", label: "First Frame / Tailpick" },
			{ id: "ref", kind: "image", label: "Reference Images" },
		],
		outputs: [
			{ id: "out", kind: "video", label: "Video Clip" },
			{ id: "tailpick", kind: "image", label: "Tail Frame (Selected)" },
			{ id: "last", kind: "image", label: "Last Raw Frame" },
		],
	},
	audio: {
		inputs: [{ id: "prompt", kind: "text", label: "Audio Script/Prompt" }],
		outputs: [{ id: "out", kind: "audio", label: "Audio Track" }],
	},
	finalcut: {
		inputs: [
			{ id: "in", kind: "video", label: "Video Clips" },
			{ id: "audio", kind: "audio", label: "Audio Tracks" },
		],
		outputs: [{ id: "out", kind: "video", label: "Master Video" }],
	},
	group: { inputs: [], outputs: [] },
	sticky: {
		inputs: [],
		outputs: [{ id: "out", kind: "text", label: "Sticky Note Text" }],
	},
	shape: {
		inputs: [],
		outputs: [{ id: "out", kind: "text", label: "Shape Label" }],
	},
	file: {
		inputs: [],
		outputs: [
			{ id: "out", kind: "file", label: "File Reference" },
			{ id: "ref", kind: "image", label: "Visual Reference" },
			{ id: "text", kind: "text", label: "File Content Text" },
		],
	},
	link: {
		inputs: [],
		outputs: [
			{ id: "out", kind: "text", label: "Link URL" },
			{ id: "url", kind: "text", label: "URL Reference" },
		],
	},
};

export const MULTI_INPUT_PORTS = new Set([
	"ref",
	"char",
	"scene",
	"prop",
	"audio",
	"in",
]);

export function isPortCompatible(
	fromKind: PortKind,
	toKind: PortKind,
): boolean {
	return fromKind === toKind;
}
