import type { IncomingMessage, ServerResponse } from "node:http";

// ============================================================================
// DeepSeek Harness & Cordis Host Environment Types
// ============================================================================

export interface TextBlock {
	type: "text";
	text: string;
}

export interface Agent {
	session: { id: string };
}

export type Disposer = () => unknown;

export interface ToolExec {
	agent?: Agent;
	signal?: AbortSignal;
	callId?: string;
}

export interface ToolValue {
	text: string;
	[key: string]: unknown;
}

export interface ToolOutput {
	schema: object;
	render(args: unknown, value: ToolValue): TextBlock[];
	presentationMeta(args: unknown, value: ToolValue): object;
}

export interface ToolDefinition {
	name: string;
	description: string;
	parameters: object;
	output: ToolOutput;
	timeoutMs?: number;
	execute(args: unknown, exec: ToolExec): Promise<ToolValue>;
}

export interface WebRoute {
	kind: string;
	path: string;
	handler?: (
		request: IncomingMessage,
		response: ServerResponse,
		...args: unknown[]
	) => unknown;
	resource?: (
		request: Request,
		...args: unknown[]
	) => Response | Promise<Response>;
}

export interface WebServer {
	host?: string;
	getOrigin(): string;
	register(route: WebRoute): Disposer;
}

export interface AuthenticatedWebServer {
	register(route: WebRoute): Disposer;
}

export type HttpResourceRequest = Request;
export type HttpResourceResponse = Response;

export interface HostServices {
	llm?: unknown;
	tools: { register(definition: ToolDefinition): Disposer };
	systemPrompt: {
		getSectionOrder?(section: string): number;
		section(definition: {
			name: string;
			order: number;
			text: string;
		}): Disposer;
	};
	webServer?: WebServer;
	connection?: {
		allowsRemoteAuthorities?: boolean;
		requestRejection(request: {
			headers: IncomingMessage["headers"];
		}): number | undefined;
	};
	workingDirectory?: {
		get(session?: Agent["session"]): string | undefined;
		ensure(parent: Agent, signal?: AbortSignal): Promise<string>;
	};
}

export interface HostContext {
	get<K extends keyof HostServices>(name: K): HostServices[K] | undefined;
	fiber?: { entry?: object };
	logger?: { warn?(message: string): void };
	effect(callback: () => unknown, label?: string): unknown;
	tools: { register(definition: ToolDefinition): Disposer };
	systemPrompt: {
		getSectionOrder?(section: string): number;
		section(definition: {
			name: string;
			order: number;
			text: string;
		}): Disposer;
	};
	inject(
		services: string[],
		callback: (ctx: HostContext & { webServer: WebServer }) => void,
	): void;
}

// ============================================================================
// Client Context & Web Shell Types
// ============================================================================

export interface ClientSlotRegistration {
	name: string;
	key?: string;
	locale?: string;
}

export interface ClientSlots {
	register(target: ClientSlotRegistration, component: unknown): Disposer;
	inject(
		slotName: string,
		generator: () => Generator<Disposer, void, unknown>,
	): void;
}

export interface ClientLocale {
	register(
		namespace: string,
		dicts: Record<string, Record<string, string>>,
	): Disposer;
}

export interface ClientRemote {
	call<T = unknown>(method: string, ...params: unknown[]): Promise<T>;
}

export interface ClientUIWorkspace {
	getActiveSession?(): { id: string } | undefined;
}

export interface ClientContext {
	slots: ClientSlots;
	locale: ClientLocale;
	remote: ClientRemote;
	uiWorkspace: ClientUIWorkspace;
	effect(callback: () => Disposer | void, label?: string): unknown;
}

// ============================================================================
// Canvas Geometry & Styling Primitives
// ============================================================================

export type ShapeType =
	| "rect"
	| "pill"
	| "diamond"
	| "circle"
	| "parallelogram"
	| "document"
	| "database";

export type TextSize = "s" | "m" | "l" | "xl";
export type TextAlign = "left" | "center" | "right";
export type CanvasColorPreset = "1" | "2" | "3" | "4" | "5" | "6";
export type CanvasColor = string;

export interface RectBounds {
	x: number;
	y: number;
	width: number;
	height: number;
}

export interface BoundingBox {
	minX: number;
	minY: number;
	maxX: number;
	maxY: number;
}

export interface Point {
	x: number;
	y: number;
}

// ============================================================================
// Whiteboard Element Models (Cult Canvas & Freehand)
// ============================================================================

export interface BaseElement {
	id: string;
	x: number;
	y: number;
	width: number;
	height: number;
	zIndex?: number;
	pinned?: boolean;
	type?: string;
	text?: string;
	label?: string;
	color?: CanvasColor;
	file?: string;
	url?: string;
	shape?: string;
	styleAttributes?: Record<string, unknown>;
	gbStroke?: MarkerStrokeData;
	mediaParams?: Record<string, unknown>;
	data?: Record<string, unknown>;
	status?: PipelineNodeStatus;
	[key: string]: unknown;
}

export interface StickyNote extends BaseElement {
	kind: "sticky";
	text: string;
	color?: CanvasColor; // Default: #FFF59A
	fontSize?: TextSize; // Default: m
	textAlign?: TextAlign; // Default: left
}

export interface WhiteboardShape extends BaseElement {
	kind: "shape";
	shapeType: ShapeType;
	text: string;
	color?: CanvasColor;
	fontSize?: TextSize;
	textAlign?: TextAlign; // Default: center
	border?: "solid" | "dashed" | "dotted";
}

export interface TextCard extends BaseElement {
	kind: "text";
	text: string;
	fontSize?: TextSize; // s: 14px, m: 18px, l: 26px, xl: 38px
	textAlign?: TextAlign; // Default: left
	color?: CanvasColor;
}

export interface MarkerStrokeData {
	v: number;
	size: number;
	w: number;
	h: number;
	points: Array<[number, number]>;
}

export interface MarkerStroke extends BaseElement {
	kind: "stroke";
	color: string;
	strokeWidth: number;
	points: Array<[number, number]>; // Coordinates relative to (x, y)
	origWidth: number;
	origHeight: number;
}

export interface GroupFrame extends BaseElement {
	kind: "group";
	label?: string;
	color?: CanvasColor;
	background?: string;
	backgroundStyle?: "cover" | "ratio" | "repeat";
}

export interface FileCard extends BaseElement {
	kind: "file";
	file: string;
	subpath?: string;
	color?: CanvasColor;
}

export interface LinkCard extends BaseElement {
	kind: "link";
	url: string;
	color?: CanvasColor;
}

// ============================================================================
// Media Pipeline Nodes & Port Taxonomy (DSH Infinite Canvas)
// ============================================================================

export type PortKind = "text" | "image" | "video" | "audio" | "file";
export type PortDirection = "input" | "output";

export interface PortDefinition {
	id: string;
	kind: PortKind;
	label?: string;
	description?: string;
}

export interface NodePortConfiguration {
	inputs: PortDefinition[];
	outputs: PortDefinition[];
}

export interface PortConnection {
	fromNode: string;
	fromPort: string;
	toNode: string;
	toPort: string;
}

export type PipelineNodeKind =
	| "script"
	| "storyboard"
	| "image"
	| "video"
	| "audio"
	| "finalcut";

export type PipelineNodeStatus =
	| "idle"
	| "queued"
	| "running"
	| "completed"
	| "failed";

export interface BasePipelineNode extends BaseElement {
	label: string;
	status: PipelineNodeStatus;
	progress?: string | number | null;
	error?: string | null;
	genWarn?: string | null;
	history?: string[];
	model?: string | null;
	provider?: string | null;
}

export interface ScriptNode extends BasePipelineNode {
	kind: "script";
	text: string;
	idea?: string;
}

export interface StoryboardNode extends BasePipelineNode {
	kind: "storyboard";
	shots: Shot[];
	targetDuration?: number;
	combatMode?: "auto" | "on" | "off";
}

export interface ImageNode extends BasePipelineNode {
	kind: "image";
	prompt: string;
	ratio: string;
	size: string;
	assetId?: string | null;
	refOrder?: string[];
}

export interface VideoNode extends BasePipelineNode {
	kind: "video";
	prompt: string;
	ratio: string;
	duration: number;
	resolution: string;
	frameMode?: "auto" | "hard" | "off";
	assetId?: string | null;
	lastAssetId?: string | null;
	lastPickAssetId?: string | null;
	seam?: { ok: boolean; sim?: number; thr?: number; note?: string };
}

export interface AudioNode extends BasePipelineNode {
	kind: "audio";
	prompt: string;
	audioType?: "speech" | "sfx" | "music";
	duration?: number;
	assetId?: string | null;
}

export interface FinalcutNode extends BasePipelineNode {
	kind: "finalcut";
	assetId?: string | null;
	totalDuration?: number;
	sequence?: string[];
}

// ============================================================================
// Unified Elements, Connectors & Canvas Document
// ============================================================================

export type WhiteboardElement =
	| StickyNote
	| WhiteboardShape
	| TextCard
	| MarkerStroke
	| GroupFrame
	| FileCard
	| LinkCard;

export type PipelineElement =
	| ScriptNode
	| StoryboardNode
	| ImageNode
	| VideoNode
	| AudioNode
	| FinalcutNode;

export type CanvasElement = WhiteboardElement | PipelineElement;

export interface CanvasEdge {
	id: string;
	fromNode: string;
	fromPort?: string;
	fromSide?: "top" | "right" | "bottom" | "left";
	fromEnd?: "none" | "arrow";
	toNode: string;
	toPort?: string;
	toSide?: "top" | "right" | "bottom" | "left";
	toEnd?: "none" | "arrow";
	color?: string;
	label?: string;
	styleAttributes?: {
		pathfindingMethod?: "straight" | "curved" | "square";
		path?: "solid" | "dashed" | "dotted";
	};
}

export interface BibleEntity {
	name: string;
	desc: string;
	avatarAssetId?: string;
	tags?: string[];
}

export interface SeriesBible {
	worldview?: string;
	style?: string;
	styleAnchor?: string; // <= 40 chars
	characters: BibleEntity[];
	scenes: BibleEntity[];
	props: BibleEntity[];
}

export interface Shot {
	id?: string;
	index?: number;
	title?: string;
	visual: string;
	motion: string;
	tail?: string;
	start?: string;
	cam?: string;
	seg?:
		| "opening"
		| "continuation"
		| "scene_change"
		| "new_character"
		| "closeup"
		| "state_jump";
	join?: "strict" | "loose" | "cut";
	characters: string[];
	scene: string;
	props: string[];
	duration: number;
	dialogue?: Array<{ speaker: string; text: string }>;
	sfx?: string;
	timeBeats?: string[];
	vfx?: string;
	negative?: string;
}

export interface ShotSegment {
	shotIndex: number;
	segmentIndex: number;
	startSec: number;
	endSec: number;
	duration: number;
	prompt: string;
	refAssetIds: string[];
	firstFrameAssetId?: string;
	tailFrameAssetId?: string;
}

export interface CanvasDocument {
	id: string;
	title: string;
	version: number;
	elements: Record<string, CanvasElement>;
	edges: Record<string, CanvasEdge>;
	bible?: SeriesBible;
	viewport?: { x: number; y: number; zoom: number };
	updatedAt: number;
	createdAt: number;
}

// ============================================================================
// JSON Canvas 1.0 Specification Types (jsoncanvas.org)
// ============================================================================

export type JSONCanvasColor = string;
export type JSONCanvasSide = "top" | "right" | "bottom" | "left";
export type JSONCanvasEnd = "none" | "arrow";

export interface BaseJSONCanvasNode {
	id: string;
	x: number;
	y: number;
	width: number;
	height: number;
	color?: JSONCanvasColor;
}

export interface JSONCanvasTextNode extends BaseJSONCanvasNode {
	type: "text";
	text: string;
	styleAttributes?: Record<string, unknown>;
	gbStroke?: MarkerStrokeData;
}

export interface JSONCanvasFileNode extends BaseJSONCanvasNode {
	type: "file";
	file: string;
	subpath?: string;
	styleAttributes?: Record<string, unknown>;
}

export interface JSONCanvasLinkNode extends BaseJSONCanvasNode {
	type: "link";
	url: string;
	styleAttributes?: Record<string, unknown>;
}

export interface JSONCanvasGroupNode extends BaseJSONCanvasNode {
	type: "group";
	label?: string;
	background?: string;
	backgroundStyle?: "cover" | "ratio" | "repeat";
	styleAttributes?: Record<string, unknown>;
}

export type JSONCanvasNode =
	| JSONCanvasTextNode
	| JSONCanvasFileNode
	| JSONCanvasLinkNode
	| JSONCanvasGroupNode;

export interface JSONCanvasEdge {
	id: string;
	fromNode: string;
	fromSide?: JSONCanvasSide;
	fromEnd?: JSONCanvasEnd;
	toNode: string;
	toSide?: JSONCanvasSide;
	toEnd?: JSONCanvasEnd;
	color?: JSONCanvasColor;
	label?: string;
	styleAttributes?: Record<string, unknown>;
	fromPort?: string;
	toPort?: string;
}

export interface JSONCanvasDocument {
	nodes?: JSONCanvasNode[];
	edges?: JSONCanvasEdge[];
}
