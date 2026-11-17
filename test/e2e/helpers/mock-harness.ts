/**
 * Mock Harness for dsh-cult-canvas E2E Test Suite
 * Provides mocks for Cordis HostContext, ToolExec, authenticatedWebServer,
 * and pure contract-level implementations of the unified canvas store,
 * graph DAG engine, pipeline runner, agent tools, and client loader.
 */
import { Readable } from "node:stream";
import { isIP } from "node:net";
import type {
	IncomingHttpHeaders,
	IncomingMessage,
	ServerResponse,
} from "node:http";
import { stripUndefined } from "./assertion-helpers.js";
import { CanvasStore as ProductionCanvasStore } from "../../../canvas-model.js";
import type { CanvasElement as ProdCanvasElement } from "../../../types.js";

// ============================================================================
// 1. Tool and DSH Interfaces
// ============================================================================

export interface TextBlock {
	type: "text";
	text: string;
}

export interface ToolOutput {
	schema: Record<string, unknown>;
	render(args: unknown, value: unknown): TextBlock[];
	presentationMeta?(args: unknown, value: unknown): Record<string, unknown>;
}

export interface ToolExec {
	agent?: {
		session?: {
			id: string;
		};
	};
	signal?: AbortSignal;
	callId?: string;
}

export interface ToolDefinition {
	name: string;
	description: string;
	parameters: Record<string, unknown>;
	output: ToolOutput;
	timeoutMs?: number;
	execute(args: unknown, exec?: ToolExec): Promise<unknown>;
}

// ============================================================================
// 2. Web Server & Authentication Interfaces
// ============================================================================

export interface WebRoute {
	kind: "exact" | "prefix";
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

export interface WebConnection {
	allowsRemoteAuthorities?: boolean;
	requestRejection?(request: {
		headers: IncomingHttpHeaders;
	}): number | undefined;
}

export interface WebAuthContext {
	get?(name: "connection"): WebConnection | undefined;
	connection?: WebConnection;
	logger?: { warn?(message: string): void };
}

export interface WebServer {
	host?: string;
	getOrigin(): string;
	register(route: WebRoute): () => void;
}

// ============================================================================
// 3. Mock Cordis HostContext & Registries
// ============================================================================

export class MockToolsRegistry {
	private readonly tools = new Map<string, ToolDefinition>();

	register(tool: ToolDefinition): () => void {
		this.tools.set(tool.name, tool);
		return () => {
			this.tools.delete(tool.name);
		};
	}

	get(name: string): ToolDefinition | undefined {
		return this.tools.get(name);
	}

	list(): ToolDefinition[] {
		return Array.from(this.tools.values());
	}

	async execute(
		name: string,
		args: unknown,
		exec?: ToolExec,
	): Promise<unknown> {
		const tool = this.tools.get(name);
		if (!tool) {
			throw new Error(`Tool not found: ${name}`);
		}
		const result = await tool.execute(args, exec ?? createMockToolExec());
		return stripUndefined(result);
	}

	clear(): void {
		this.tools.clear();
	}
}

export class MockSystemPromptRegistry {
	private readonly sections: Array<{
		name: string;
		order: number;
		text: string;
	}> = [];

	section(options: { name: string; order: number; text: string }): () => void {
		this.sections.push(options);
		this.sections.sort((a, b) => a.order - b.order);
		return () => {
			const idx = this.sections.findIndex((s) => s.name === options.name);
			if (idx !== -1) {
				this.sections.splice(idx, 1);
			}
		};
	}

	list(): Array<{ name: string; order: number; text: string }> {
		return [...this.sections];
	}

	clear(): void {
		this.sections.length = 0;
	}
}

export class MockWebServer implements WebServer {
	host?: string;
	private port: number;
	readonly routes: WebRoute[] = [];

	constructor(host = "127.0.0.1", port = 3344) {
		this.host = host;
		this.port = port;
	}

	getOrigin(): string {
		return `http://${this.host ?? "127.0.0.1"}:${this.port}`;
	}

	register(route: WebRoute): () => void {
		this.routes.push(route);
		return () => {
			const idx = this.routes.indexOf(route);
			if (idx !== -1) {
				this.routes.splice(idx, 1);
			}
		};
	}

	clear(): void {
		this.routes.length = 0;
	}
}

export class MockSidebarRight {
	readonly openTabs: string[] = [];

	openTab(id: string): void {
		this.openTabs.push(id);
	}
}

export interface HostContext {
	tools: MockToolsRegistry;
	systemPrompt: MockSystemPromptRegistry;
	webServer: MockWebServer;
	sidebarRight: MockSidebarRight;
	connection?: WebConnection;
	logger?: {
		warn?(msg: string): void;
		info?(msg: string): void;
		error?(msg: string): void;
	};
	get<T = unknown>(serviceName: string): T | undefined;
	inject(deps: string[], callback: (ctx: HostContext) => void): void;
	effect(fn: () => (() => void) | void): () => void;
	dispose(): void;
}

export function createMockHostContext(
	options: {
		host?: string;
		connection?: WebConnection;
	} = {},
): HostContext {
	const tools = new MockToolsRegistry();
	const systemPrompt = new MockSystemPromptRegistry();
	const webServer = new MockWebServer(options.host ?? "127.0.0.1");
	const sidebarRight = new MockSidebarRight();
	const disposers: Array<() => void> = [];

	const services: Record<string, unknown> = {
		tools,
		systemPrompt,
		webServer,
		sidebarRight,
		connection: options.connection,
	};

	const ctx: HostContext = {
		tools,
		systemPrompt,
		webServer,
		sidebarRight,
		connection: options.connection,
		logger: {
			warn: () => {},
			info: () => {},
			error: () => {},
		},
		get<T>(serviceName: string): T | undefined {
			return services[serviceName] as T | undefined;
		},
		inject(deps: string[], callback: (c: HostContext) => void): void {
			callback(ctx);
		},
		effect(fn: () => (() => void) | void): () => void {
			const res = fn();
			const disposer = typeof res === "function" ? res : () => {};
			disposers.push(disposer);
			return () => {
				const idx = disposers.indexOf(disposer);
				if (idx !== -1) {
					disposers.splice(idx, 1);
				}
				disposer();
			};
		},
		dispose(): void {
			while (disposers.length > 0) {
				const d = disposers.pop();
				try {
					d?.();
				} catch {
					// ignore dispose errors
				}
			}
			tools.clear();
			systemPrompt.clear();
			webServer.clear();
		},
	};

	return ctx;
}

// ============================================================================
// 4. Mock ToolExec & HTTP Helpers
// ============================================================================

export function createMockToolExec(
	options: {
		sessionId?: string;
		signal?: AbortSignal;
		callId?: string;
	} = {},
): ToolExec & { abortController: AbortController } {
	const abortController = new AbortController();
	return {
		agent: {
			session: {
				id: options.sessionId ?? "session_test_01",
			},
		},
		signal: options.signal ?? abortController.signal,
		callId: options.callId ?? "call_01",
		abortController,
	};
}

export function createMockServerResponse(): ServerResponse & {
	statusCode: number;
	headers: Record<string, string>;
	body: string;
	writeHead(status: number, headers?: Record<string, string>): void;
	end(chunk?: unknown): void;
} {
	const res = {
		statusCode: 200,
		headers: {} as Record<string, string>,
		body: "",
		writeHead(status: number, headers?: Record<string, string>) {
			res.statusCode = status;
			if (headers) {
				Object.assign(res.headers, headers);
			}
		},
		end(chunk?: unknown) {
			if (chunk !== undefined) {
				res.body += typeof chunk === "string" ? chunk : "";
			}
		},
	};
	return res as unknown as ServerResponse & typeof res;
}

export function createMockIncomingMessage(options: {
	method?: string;
	url?: string;
	headers?: IncomingHttpHeaders;
	body?: string;
}): IncomingMessage {
	const stream = Readable.from(options.body ? [options.body] : []);
	return Object.assign(stream, {
		method: options.method ?? "GET",
		url: options.url ?? "/",
		headers: options.headers ?? { host: "127.0.0.1:3344" },
	}) as unknown as IncomingMessage;
}

// ============================================================================
// 5. Authenticated Web Server Wrapper
// ============================================================================

function loopback(host: string | undefined | null): boolean {
	const value = String(host ?? "")
		.replace(/^\[|\]$/g, "")
		.toLowerCase();
	return (
		value === "localhost" ||
		value === "::1" ||
		(isIP(value) === 4 && value.startsWith("127."))
	);
}

function legacyHeaders(
	server: WebServer,
	original: Record<string, string>,
): Record<string, string>;
function legacyHeaders(
	server: WebServer,
	original: IncomingHttpHeaders,
): IncomingHttpHeaders;
function legacyHeaders(
	server: WebServer,
	original: IncomingHttpHeaders,
): IncomingHttpHeaders {
	const origin = new URL(server.getOrigin());
	origin.hostname = "127.0.0.1";
	const headers: IncomingHttpHeaders = { ...original, host: origin.host };
	if (headers.origin !== undefined) headers.origin = origin.origin;
	return headers;
}

function nodeRequest(
	request: IncomingMessage,
	headers: IncomingHttpHeaders,
): IncomingMessage {
	return new Proxy(request, {
		get(target, key) {
			if (key === "headers") return headers;
			const value = Reflect.get(target, key, target);
			return typeof value === "function" ? value.bind(target) : value;
		},
	});
}

function admission(
	ctx: WebAuthContext,
	server: WebServer,
	request: { headers: IncomingHttpHeaders },
): { required?: boolean; status?: number } {
	try {
		const headers = request.headers;
		// 1. Cross-site requests from untrusted origins are strictly forbidden on private plugin routes
		if (headers["sec-fetch-site"] === "cross-site") {
			return { status: 403 };
		}

		const connection =
			typeof ctx.get === "function" ? ctx.get("connection") : ctx.connection;
		const required =
			Boolean(process.env.WORKSTATION_DSH_LAN_AUTHORITY?.trim()) ||
			connection?.allowsRemoteAuthorities === true ||
			(server.host != null && !loopback(server.host));

		if (!required) {
			// On loopback routes: if origin header is present, it must be loopback
			const origin = headers.origin;
			if (origin && typeof origin === "string") {
				try {
					const parsed = new URL(origin);
					if (!loopback(parsed.hostname)) {
						return { status: 403 };
					}
				} catch {
					return { status: 403 };
				}
			}
			return { required: false };
		}

		if (typeof connection?.requestRejection !== "function") {
			return { status: 503 };
		}
		const status = connection.requestRejection(request);
		return status === undefined
			? { required: true }
			: { status: status === 403 ? 403 : 401 };
	} catch {
		ctx.logger?.warn?.("private web route authentication failed");
		return { status: 503 };
	}
}

export function authenticatedWebServer<
	Server extends WebServer | undefined | null,
>(ctx: WebAuthContext, server: Server): Server {
	if (!server) return server;
	return new Proxy(server, {
		get(target, key) {
			if (key !== "register") {
				const value = Reflect.get(target, key, target);
				return typeof value === "function" ? value.bind(target) : value;
			}
			return (route: WebRoute) => {
				const wrapped = { ...route };
				if (route.handler) {
					wrapped.handler = (request, response, ...args) => {
						const result = admission(ctx, target, request);
						if (result.status) {
							response.writeHead(result.status, {
								"content-type": "text/plain; charset=utf-8",
								"cache-control": "no-store",
							});
							response.end(
								result.status === 503
									? "authentication unavailable"
									: "access denied",
							);
							return;
						}
						return route.handler!(
							result.required
								? nodeRequest(request, legacyHeaders(target, request.headers))
								: request,
							response,
							...args,
						);
					};
				}
				if (typeof route.resource === "function") {
					wrapped.resource = async (request, ...args) => {
						const original = Object.fromEntries(request.headers);
						const result = admission(ctx, target, { headers: original });
						if (result.status) {
							return new Response(
								result.status === 503
									? "authentication unavailable"
									: "access denied",
								{
									status: result.status,
									headers: { "cache-control": "no-store" },
								},
							);
						}
						return route.resource!(
							result.required
								? new Request(request, {
										headers: legacyHeaders(target, original),
									})
								: request,
							...args,
						);
					};
				}
				return target.register(wrapped);
			};
		},
	});
}

// ============================================================================
// 6. Unified Canvas Store Contract Implementation
// ============================================================================

export type CanvasElement = ProdCanvasElement & {
	type?: string;
	kind?: string;
};

export type CanvasElementInput = Partial<ProdCanvasElement> & {
	type?: string;
	kind?: string;
	[key: string]: unknown;
};

export interface CanvasEdge {
	id: string;
	fromNode: string;
	toNode: string;
	fromSide?: "top" | "right" | "bottom" | "left";
	toSide?: "top" | "right" | "bottom" | "left";
	fromEnd?: "none" | "arrow";
	toEnd?: "none" | "arrow";
	fromPort?: string;
	toPort?: string;
	label?: string;
	color?: string;
	routing?: "curved" | "square" | "straight";
}

export type CanvasEdgeInput = Omit<CanvasEdge, "id"> & { id?: string };

interface CanvasSnapshot {
	elements: CanvasElement[];
	edges: CanvasEdge[];
	bible: Record<string, unknown>;
}

export class CanvasStore extends ProductionCanvasStore {
	private maxElements = 5000;
	private customBible: Record<string, unknown> = {};
	private undoStack: CanvasSnapshot[] = [];
	private redoStack: CanvasSnapshot[] = [];

	constructor(config: { maxElements?: number } = {}) {
		super();
		if (config.maxElements) {
			this.maxElements = config.maxElements;
		}
	}

	private snapshot(): void {
		const currentSnapshot: CanvasSnapshot = structuredClone({
			elements: this.getAllElements(),
			edges: this.getAllEdges(),
			bible: this.getBible() || {},
		});
		this.undoStack.push(currentSnapshot);
		if (this.undoStack.length > 50) {
			this.undoStack.shift();
		}
		this.redoStack.length = 0;
	}

	override getBible(): any {
		const prod = super.getBible();
		if (!prod && Object.keys(this.customBible).length === 0) {
			return undefined;
		}
		return { ...prod, ...this.customBible };
	}

	override updateBible(patch: any): any {
		this.snapshot();
		this.customBible = { ...this.customBible, ...patch };
		try {
			super.updateBible(patch);
		} catch {
			// ignore
		}
		return { ...super.getBible(), ...this.customBible };
	}

	override createElement(element: any): any {
		if (this.getAllElements().length >= this.maxElements) {
			throw new Error(
				`Max canvas elements limit reached (${this.maxElements})`,
			);
		}
		this.snapshot();
		const id =
			element.id ||
			`elem_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
		const full: CanvasElement = {
			...element,
			id,
			type:
				element.type ??
				(element.kind ? (element.kind === "group" ? "group" : "text") : "text"),
			x: element.x ?? 0,
			y: element.y ?? 0,
			width: Math.max(1, element.width ?? 100),
			height: Math.max(1, element.height ?? 100),
		} as CanvasElement;
		super.createElement(full as any);
		return { ...full };
	}

	override updateElement(id: string, patch: any): any {
		const existing = this.getElementById(id);
		if (!existing) {
			throw new Error(`Element not found: ${id}`);
		}
		this.snapshot();
		const updatedPatch: Partial<CanvasElement> = { ...patch };
		if (patch.mediaParams || existing.mediaParams) {
			updatedPatch.mediaParams = {
				...existing.mediaParams,
				...patch.mediaParams,
			};
		}
		if (patch.data || existing.data) {
			updatedPatch.data = { ...existing.data, ...patch.data };
		}
		const res = super.updateElement(
			id,
			updatedPatch as any,
		) as unknown as CanvasElement;
		return { ...res };
	}

	override deleteElements(ids: string[]): {
		deletedElements: string[];
		deletedEdges: string[];
		deletedCount: number;
		removedEdgesCount: number;
	} {
		this.snapshot();
		const res = super.deleteElements(ids);
		return {
			deletedElements: res.deletedElements,
			deletedEdges: res.deletedEdges,
			deletedCount: res.deletedElements.length,
			removedEdgesCount: res.deletedEdges.length,
		};
	}

	override queryBounds<T = CanvasElement>(bbox: any): T[] {
		const minX = bbox.minX ?? bbox.x ?? 0;
		const minY = bbox.minY ?? bbox.y ?? 0;
		const maxX = bbox.maxX ?? minX + (bbox.width ?? 0);
		const maxY = bbox.maxY ?? minY + (bbox.height ?? 0);
		return super.queryBounds<T>({ minX, minY, maxX, maxY });
	}

	override connect(edge: CanvasEdgeInput): CanvasEdge {
		if (!this.getElementById(edge.fromNode)) {
			throw new Error(`Source element not found: ${edge.fromNode}`);
		}
		if (!this.getElementById(edge.toNode)) {
			throw new Error(`Target element not found: ${edge.toNode}`);
		}
		this.snapshot();
		const id =
			edge.id ||
			`edge_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
		const full: CanvasEdge = {
			...edge,
			id,
			toEnd: edge.toEnd ?? "arrow",
		};
		super.connect(full as any);
		return { ...full };
	}

	override disconnect(edgeId: string): boolean {
		this.snapshot();
		return super.disconnect(edgeId);
	}

	override exportJsonCanvas(): any {
		const nodes = this.getAllElements().map((el: any) => {
			const jcType = ["text", "file", "link", "group"].includes(el.type)
				? el.type
				: el.file
					? "file"
					: "text";
			const jcNode: Record<string, unknown> = {
				id: el.id,
				type: jcType,
				x: el.x,
				y: el.y,
				width: el.width,
				height: el.height,
			};
			if (el.color) jcNode.color = el.color;
			if (el.text !== undefined) jcNode.text = el.text;
			else if (jcType === "text") jcNode.text = "";
			if (el.label !== undefined) jcNode.label = el.label;
			if (el.file !== undefined) jcNode.file = el.file;
			if (el.url !== undefined) jcNode.url = el.url;
			if (el.styleAttributes) jcNode.styleAttributes = el.styleAttributes;
			if (el.gbStroke) jcNode.gbStroke = el.gbStroke;
			if (el.kind) jcNode.kind = el.kind;
			else if (!["text", "file", "link", "group"].includes(el.type))
				jcNode.kind = el.type;
			if (el.mediaParams) jcNode.mediaParams = el.mediaParams;
			if (el.data) jcNode.data = el.data;
			if (el.status) jcNode.status = el.status;
			return jcNode;
		});

		const edges = this.getAllEdges().map((ed: any) => {
			const jcEdge: Record<string, unknown> = {
				id: ed.id,
				fromNode: ed.fromNode,
				toNode: ed.toNode,
			};
			if (ed.fromSide) jcEdge.fromSide = ed.fromSide;
			if (ed.toSide) jcEdge.toSide = ed.toSide;
			if (ed.fromEnd) jcEdge.fromEnd = ed.fromEnd;
			if (ed.toEnd) jcEdge.toEnd = ed.toEnd;
			if (ed.fromPort) jcEdge.fromPort = ed.fromPort;
			if (ed.toPort) jcEdge.toPort = ed.toPort;
			if (ed.label) jcEdge.label = ed.label;
			if (ed.color) jcEdge.color = ed.color;
			return jcEdge;
		});

		return { nodes, edges };
	}

	override importJsonCanvas(doc: any): any {
		if (!doc || !Array.isArray(doc.nodes) || !Array.isArray(doc.edges)) {
			throw new Error("Invalid JSON Canvas document structure");
		}
		this.snapshot();
		this.clear();

		let importedNodes = 0;
		for (const n of doc.nodes as CanvasElement[]) {
			if (!n.id || typeof n.x !== "number" || typeof n.y !== "number") {
				throw new Error("Malformed node in JSON Canvas document");
			}
			super.createElement({ ...n } as any);
			importedNodes++;
		}

		let importedEdges = 0;
		for (const e of doc.edges as CanvasEdge[]) {
			if (!e.id || !e.fromNode || !e.toNode) {
				throw new Error("Malformed edge in JSON Canvas document");
			}
			if (this.getElementById(e.fromNode) && this.getElementById(e.toNode)) {
				super.connect({ ...e } as any);
				importedEdges++;
			}
		}

		return {
			nodeCount: importedNodes,
			edgeCount: importedEdges,
			importedNodes,
			importedEdges,
		};
	}

	override clear(): void {
		super.clear();
		this.customBible = {};
	}

	public undo(): boolean {
		if (this.undoStack.length === 0) return false;
		const previous = this.undoStack.pop()!;
		const currentSnapshot: CanvasSnapshot = structuredClone({
			elements: this.getAllElements(),
			edges: this.getAllEdges(),
			bible: (this.getBible() || {}) as Record<string, unknown>,
		});
		this.redoStack.push(currentSnapshot);

		this.clear();
		for (const el of previous.elements) {
			super.createElement(structuredClone(el) as any);
		}
		for (const ed of previous.edges) {
			super.connect(structuredClone(ed) as any);
		}
		this.customBible = structuredClone(previous.bible || {});
		try {
			if (previous.bible && Object.keys(previous.bible).length > 0) {
				super.updateBible(structuredClone(previous.bible) as any);
			}
		} catch {
			// ignore
		}
		return true;
	}

	public redo(): boolean {
		if (this.redoStack.length === 0) return false;
		const next = this.redoStack.pop()!;
		const currentSnapshot: CanvasSnapshot = structuredClone({
			elements: this.getAllElements(),
			edges: this.getAllEdges(),
			bible: (this.getBible() || {}) as Record<string, unknown>,
		});
		this.undoStack.push(currentSnapshot);

		this.clear();
		for (const el of next.elements) {
			super.createElement(structuredClone(el) as any);
		}
		for (const ed of next.edges) {
			super.connect(structuredClone(ed) as any);
		}
		this.customBible = structuredClone(next.bible || {});
		try {
			if (next.bible && Object.keys(next.bible).length > 0) {
				super.updateBible(structuredClone(next.bible) as any);
			}
		} catch {
			// ignore
		}
		return true;
	}

	public dispose(): void {
		this.clear();
		this.undoStack.length = 0;
		this.redoStack.length = 0;
	}
}

// ============================================================================
// 7. Graph Engine Contract Implementation (DAG & Ports)
// ============================================================================

export const PORT_TABLE: Record<
	string,
	{
		inputs: Array<{ id: string; kind: string }>;
		outputs: Array<{ id: string; kind: string }>;
	}
> = {
	text: { inputs: [], outputs: [{ id: "out", kind: "text" }] },
	sticky: { inputs: [], outputs: [{ id: "out", kind: "text" }] },
	shape: { inputs: [], outputs: [{ id: "out", kind: "text" }] },
	script: { inputs: [], outputs: [{ id: "out", kind: "text" }] },
	storyboard: {
		inputs: [
			{ id: "prev", kind: "text" },
			{ id: "script", kind: "text" },
		],
		outputs: [
			{ id: "out", kind: "text" },
			{ id: "tail", kind: "text" },
		],
	},
	image: {
		inputs: [
			{ id: "prompt", kind: "text" },
			{ id: "ref", kind: "image" },
		],
		outputs: [{ id: "out", kind: "image" }],
	},
	video: {
		inputs: [
			{ id: "prompt", kind: "text" },
			{ id: "frame", kind: "image" },
			{ id: "ref", kind: "image" },
		],
		outputs: [
			{ id: "out", kind: "video" },
			{ id: "tailpick", kind: "image" },
			{ id: "last", kind: "image" },
		],
	},
	audio: {
		inputs: [{ id: "prompt", kind: "text" }],
		outputs: [{ id: "out", kind: "audio" }],
	},
	finalcut: {
		inputs: [
			{ id: "in", kind: "video" },
			{ id: "audio", kind: "audio" },
		],
		outputs: [],
	},
	group: { inputs: [], outputs: [] },
	file: {
		inputs: [],
		outputs: [
			{ id: "out", kind: "file" },
			{ id: "ref", kind: "image" },
			{ id: "text", kind: "text" },
		],
	},
	link: {
		inputs: [],
		outputs: [
			{ id: "out", kind: "text" },
			{ id: "url", kind: "text" },
		],
	},
};

export { GraphEngine, validatePortConnection } from "../../../graph-engine.js";
export {
	PipelineEngine,
	planShotSegments,
	shotContinuityPlan,
	shotVisualText,
	isCutPoint,
	type PlanShotSegment,
} from "../../../pipeline-engine.js";
import { GraphEngine } from "../../../graph-engine.js";
import { PipelineEngine } from "../../../pipeline-engine.js";

// ============================================================================
// 9. Agent Tools Factory Implementation
// ============================================================================

export function buildCanvasTools(
	ctx: HostContext,
	store: CanvasStore,
): ToolDefinition[] {
	const graphEngine = new GraphEngine();
	const pipelineEngine = new PipelineEngine();

	const tools: ToolDefinition[] = [
		// 1. canvas_get_state
		{
			name: "canvas_get_state",
			description:
				"Inspect the canvas state including elements, edges, bounding box, and project bible.",
			parameters: {
				type: "object",
				properties: {
					boundingBox: {
						type: "object",
						properties: {
							minX: { type: "number" },
							minY: { type: "number" },
							maxX: { type: "number" },
							maxY: { type: "number" },
						},
					},
					kind: { type: "string" },
				},
			},
			output: {
				schema: {
					type: "object",
					properties: {
						ok: { type: "boolean" },
						elements: { type: "array" },
						edges: { type: "array" },
						count: { type: "integer" },
						bible: {
							type: "object",
							properties: {
								worldview: { type: "string" },
								style: { type: "string" },
								styleAnchor: { type: "string" },
								characters: { type: "array" },
								scenes: { type: "array" },
								props: { type: "array" },
							},
						},
					},
				},
				render(_args, val) {
					return [
						{
							type: "text",
							text: `Canvas State: ${(val as { count: number }).count} elements`,
						},
					];
				},
				presentationMeta(_args, val) {
					return {
						title: "Canvas State",
						view: "canvas",
						count: (val as { count: number }).count,
					};
				},
			},
			async execute(args, exec) {
				if (exec?.signal?.aborted) throw new Error("Aborted");
				const params = (args || {}) as {
					boundingBox?: {
						minX: number;
						minY: number;
						maxX: number;
						maxY: number;
					};
					kind?: string;
				};
				let elements = params.boundingBox
					? store.queryBounds(params.boundingBox)
					: store.getAllElements();
				if (params.kind) {
					elements = elements.filter(
						(e) => e.kind === params.kind || e.type === params.kind,
					);
				}
				const edges = store.getAllEdges();
				return stripUndefined({
					ok: true,
					elements,
					edges,
					count: elements.length,
					bible: store.getBible(),
				});
			},
		},

		// 2. canvas_create_element
		{
			name: "canvas_create_element",
			description:
				"Create a new whiteboard element or media generation pipeline node.",
			parameters: {
				type: "object",
				properties: {
					kind: { type: "string" },
					type: { type: "string" },
					x: { type: "number" },
					y: { type: "number" },
					width: { type: "number" },
					height: { type: "number" },
					text: { type: "string" },
					shape: { type: "string" },
					color: { type: "string" },
					mediaParams: { type: "object" },
				},
				required: ["x", "y"],
			},
			output: {
				schema: {
					type: "object",
					properties: {
						ok: { type: "boolean" },
						elementId: { type: "string" },
						element: { type: "object" },
					},
				},
				render(_args, val) {
					return [
						{
							type: "text",
							text: `Created element: ${(val as { elementId: string }).elementId}`,
						},
					];
				},
				presentationMeta(_args, val) {
					const v = (val || {}) as { elementId?: string };
					return stripUndefined({
						title: "Created Element",
						view: "card",
						elementId: v.elementId,
					});
				},
			},
			async execute(args, exec) {
				if (exec?.signal?.aborted) throw new Error("Aborted");
				const p = (args || {}) as Partial<CanvasElement>;
				if (
					p.x === undefined ||
					p.y === undefined ||
					typeof p.x !== "number" ||
					typeof p.y !== "number" ||
					!Number.isFinite(p.x) ||
					!Number.isFinite(p.y)
				) {
					throw new Error(
						"Missing or invalid required parameters: x and y must be finite numbers",
					);
				}
				const type =
					p.type ||
					(p.kind && ["sticky", "shape", "stroke"].includes(p.kind)
						? "text"
						: p.kind || "text");
				const created = store.createElement({
					...p,
					type,
					x: p.x,
					y: p.y,
					width: p.width ?? 200,
					height: p.height ?? 150,
				});
				return stripUndefined({
					ok: true,
					elementId: created.id,
					element: created,
				});
			},
		},

		// 3. canvas_update_element
		{
			name: "canvas_update_element",
			description:
				"Update an existing canvas element's text, dimensions, color, or media parameters.",
			parameters: {
				type: "object",
				properties: {
					id: { type: "string" },
					patch: { type: "object" },
				},
				required: ["id", "patch"],
			},
			output: {
				schema: {
					type: "object",
					properties: {
						ok: { type: "boolean" },
						element: { type: "object" },
					},
				},
				render(_args, val) {
					return [
						{
							type: "text",
							text: `Updated element: ${(val as { element: { id: string } }).element.id}`,
						},
					];
				},
				presentationMeta(_args, _val) {
					return { title: "Updated Element", view: "card" };
				},
			},
			async execute(args, exec) {
				if (exec?.signal?.aborted) throw new Error("Aborted");
				const { id, patch } = args as {
					id: string;
					patch: Partial<CanvasElement>;
				};
				const updated = store.updateElement(id, patch);
				return stripUndefined({
					ok: true,
					element: updated,
				});
			},
		},

		// 4. canvas_delete_element
		{
			name: "canvas_delete_element",
			description: "Delete elements by ID and clean up incident edges.",
			parameters: {
				type: "object",
				properties: {
					ids: { type: "array", items: { type: "string" } },
				},
				required: ["ids"],
			},
			output: {
				schema: {
					type: "object",
					properties: {
						ok: { type: "boolean" },
						deletedCount: { type: "integer" },
						removedEdgesCount: { type: "integer" },
					},
				},
				render(_args, val) {
					return [
						{
							type: "text",
							text: `Deleted ${(val as { deletedCount: number }).deletedCount} elements`,
						},
					];
				},
				presentationMeta(_args, _val) {
					return { title: "Deleted Elements", view: "card" };
				},
			},
			async execute(args, exec) {
				if (exec?.signal?.aborted) throw new Error("Aborted");
				const { ids } = args as { ids: string[] };
				const res = store.deleteElements(ids);
				return stripUndefined({
					ok: true,
					deletedCount: res.deletedCount,
					removedEdgesCount: res.removedEdgesCount,
				});
			},
		},

		// 5. canvas_connect
		{
			name: "canvas_connect",
			description:
				"Connect two elements with a directed edge or workflow wire.",
			parameters: {
				type: "object",
				properties: {
					fromNode: { type: "string" },
					toNode: { type: "string" },
					fromPort: { type: "string" },
					toPort: { type: "string" },
					fromSide: { type: "string" },
					toSide: { type: "string" },
					label: { type: "string" },
				},
				required: ["fromNode", "toNode"],
			},
			output: {
				schema: {
					type: "object",
					properties: {
						ok: { type: "boolean" },
						edge: { type: "object" },
					},
				},
				render(_args, val) {
					return [
						{
							type: "text",
							text: `Connected edge: ${(val as { edge: { id: string } }).edge.id}`,
						},
					];
				},
				presentationMeta(_args, _val) {
					return { title: "Connected Edge", view: "wire" };
				},
			},
			async execute(args, exec) {
				if (exec?.signal?.aborted) throw new Error("Aborted");
				const p = args as CanvasEdge;
				const fromNode = store.getElementById(p.fromNode);
				const toNode = store.getElementById(p.toNode);
				if (!fromNode || !toNode) {
					throw new Error("Source or target node not found");
				}

				// Validate port compatibility if ports are provided
				if (p.fromPort || p.toPort) {
					const fromType = fromNode.kind || (fromNode as any).type;
					const toType = toNode.kind || (toNode as any).type;
					const portValidation = graphEngine.validatePortConnection(
						fromType,
						p.fromPort,
						toType,
						p.toPort,
					);
					if (!portValidation.valid) {
						throw new Error(portValidation.reason || "Invalid port connection");
					}
				}

				// Check cycle creation
				const currentEdges = store.getAllEdges();
				const testEdges = [
					...currentEdges,
					{ fromNode: p.fromNode, toNode: p.toNode },
				];
				const allNodeIds = store.getAllElements().map((e) => e.id);
				graphEngine.buildGraph(allNodeIds, testEdges);
				if (graphEngine.hasCycles()) {
					throw new Error("Connection would create a cycle in the DAG");
				}

				const edge = store.connect(p);
				return stripUndefined({
					ok: true,
					edge,
				});
			},
		},

		// 6. canvas_run_pipeline
		{
			name: "canvas_run_pipeline",
			description: "Execute a single pipeline node or full workflow.",
			parameters: {
				type: "object",
				properties: {
					nodeId: { type: "string" },
					mode: { type: "string", enum: ["step", "all"] },
				},
			},
			output: {
				schema: {
					type: "object",
					properties: {
						ok: { type: "boolean" },
						status: { type: "string" },
						executedNodes: {
							type: "array",
							items: { type: "string" },
						},
						failedNodes: {
							type: "array",
							items: { type: "string" },
						},
						assetId: { type: "string" },
						error: { type: "string" },
					},
				},
				render(_args, val) {
					return [
						{
							type: "text",
							text: `Pipeline run status: ${(val as { status: string }).status}`,
						},
					];
				},
				presentationMeta(_args, val) {
					const v = (val || {}) as { status?: string };
					return stripUndefined({
						title: "Pipeline Execution",
						view: "pipeline",
						status: v.status,
					});
				},
			},
			async execute(args, exec) {
				if (exec?.signal?.aborted) throw new Error("Aborted");
				const p = (args || {}) as { nodeId?: string; mode?: "step" | "all" };
				if (p.nodeId && p.mode !== "all") {
					const res = await pipelineEngine.executeNode(p.nodeId, store, {
						signal: exec?.signal,
					});
					return stripUndefined({
						ok: res.ok,
						status: res.status,
						assetId: res.assetId,
						error: res.error,
					});
				} else {
					const res = await pipelineEngine.runWorkflow(store, {
						rootNodeIds: p.nodeId ? [p.nodeId] : undefined,
						signal: exec?.signal,
					});
					return stripUndefined({
						ok: res.ok,
						status: res.ok ? "completed" : "failed",
						executedNodes: res.executedNodes,
						failedNodes: res.failedNodes,
					});
				}
			},
		},

		// 7. canvas_import_export
		{
			name: "canvas_import_export",
			description: "Export to or import from JSON Canvas 1.0 format.",
			parameters: {
				type: "object",
				properties: {
					action: { type: "string", enum: ["export", "import"] },
					document: { type: "object" },
				},
				required: ["action"],
			},
			output: {
				schema: {
					type: "object",
					properties: {
						ok: { type: "boolean" },
					},
				},
				render(_args, val) {
					return [
						{
							type: "text",
							text: `Import/Export completed: ${(val as { ok: boolean }).ok}`,
						},
					];
				},
				presentationMeta(_args, _val) {
					return { title: "Import / Export", view: "canvas" };
				},
			},
			async execute(args, exec) {
				if (exec?.signal?.aborted) throw new Error("Aborted");
				const { action, document: doc } = args as {
					action: "export" | "import";
					document?: { nodes: unknown[]; edges: unknown[] };
				};
				if (action === "export") {
					const exported = store.exportJsonCanvas();
					return stripUndefined({ ok: true, document: exported });
				} else {
					if (!doc) throw new Error("Document payload required for import");
					const res = store.importJsonCanvas(doc);
					return stripUndefined({ ok: true, ...res });
				}
			},
		},

		// 8. canvas_node_status
		{
			name: "canvas_node_status",
			description:
				"Inspect detailed status and generated assets for a specific node.",
			parameters: {
				type: "object",
				properties: {
					nodeId: { type: "string" },
				},
				required: ["nodeId"],
			},
			output: {
				schema: {
					type: "object",
					properties: {
						ok: { type: "boolean" },
						nodeId: { type: "string" },
						status: { type: "string" },
					},
				},
				render(_args, val) {
					return [
						{
							type: "text",
							text: `Node ${(val as { nodeId: string }).nodeId} status: ${(val as { status: string }).status}`,
						},
					];
				},
				presentationMeta(_args, val) {
					const v = (val || {}) as { status?: string };
					return stripUndefined({
						title: "Node Status",
						view: "node",
						status: v.status,
					});
				},
			},
			async execute(args, exec) {
				if (exec?.signal?.aborted) throw new Error("Aborted");
				const { nodeId } = args as { nodeId: string };
				const node = store.getElementById(nodeId);
				if (!node) throw new Error(`Node not found: ${nodeId}`);
				return stripUndefined({
					ok: true,
					nodeId,
					status: node.status || "idle",
					data: node.data || {},
					mediaParams: node.mediaParams || {},
				});
			},
		},

		// 9. canvas_get_bible & 10. canvas_update_bible
		{
			name: "canvas_get_bible",
			description: "Get the project narrative and visual bible.",
			parameters: { type: "object", properties: {} },
			output: {
				schema: {
					type: "object",
					properties: { ok: { type: "boolean" }, bible: { type: "object" } },
				},
				render(_args, _val) {
					return [{ type: "text", text: "Fetched project bible" }];
				},
				presentationMeta(_args, _val) {
					return { title: "Project Bible", view: "bible" };
				},
			},
			async execute(_args, exec) {
				if (exec?.signal?.aborted) throw new Error("Aborted");
				return stripUndefined({ ok: true, bible: store.getBible() || {} });
			},
		},
		{
			name: "canvas_update_bible",
			description: "Update the project narrative and visual bible.",
			parameters: {
				type: "object",
				properties: { patch: { type: "object" } },
				required: ["patch"],
			},
			output: {
				schema: {
					type: "object",
					properties: { ok: { type: "boolean" }, bible: { type: "object" } },
				},
				render(_args, _val) {
					return [{ type: "text", text: "Updated project bible" }];
				},
				presentationMeta(_args, _val) {
					return { title: "Updated Bible", view: "bible" };
				},
			},
			async execute(args, exec) {
				if (exec?.signal?.aborted) throw new Error("Aborted");
				const { patch } = args as { patch: Record<string, unknown> };
				const updated = store.updateBible(patch);
				return stripUndefined({ ok: true, bible: updated });
			},
		},

		// 11. canvas_layout_elements
		{
			name: "canvas_layout_elements",
			description: "Set positions and layout bounds for multiple elements.",
			parameters: {
				type: "object",
				properties: {
					layouts: {
						type: "array",
						items: {
							type: "object",
							properties: {
								id: { type: "string" },
								x: { type: "number" },
								y: { type: "number" },
								width: { type: "number" },
								height: { type: "number" },
								pinned: { type: "boolean" },
							},
							required: ["id", "x", "y"],
						},
					},
				},
				required: ["layouts"],
			},
			output: {
				schema: {
					type: "object",
					properties: {
						ok: { type: "boolean" },
						updatedCount: { type: "integer" },
					},
				},
				render(_args, val) {
					return [
						{
							type: "text",
							text: `Updated layout for ${(val as { updatedCount: number }).updatedCount} elements`,
						},
					];
				},
				presentationMeta(_args, _val) {
					return { title: "Layout Elements", view: "canvas" };
				},
			},
			async execute(args, exec) {
				if (exec?.signal?.aborted) throw new Error("Aborted");
				const p = (args || {}) as {
					layouts?: Array<{
						id: string;
						x: number;
						y: number;
						width?: number;
						height?: number;
						pinned?: boolean;
					}>;
				};
				if (!Array.isArray(p.layouts)) {
					throw new Error(
						"Missing or invalid required parameter: layouts must be an array",
					);
				}
				let updatedCount = 0;
				for (const item of p.layouts) {
					if (
						!item ||
						typeof item.id !== "string" ||
						typeof item.x !== "number" ||
						typeof item.y !== "number" ||
						!Number.isFinite(item.x) ||
						!Number.isFinite(item.y)
					) {
						throw new Error(
							"Invalid layout entry: id, finite numeric x, and finite numeric y are required",
						);
					}
					store.updateElement(item.id, {
						x: item.x,
						y: item.y,
						width: item.width,
						height: item.height,
						pinned: item.pinned,
					});
					updatedCount++;
				}
				return stripUndefined({ ok: true, updatedCount });
			},
		},
	];

	return tools;
}

// ============================================================================
// 10. Plugin Apply Function (Server Lifecycle)
// ============================================================================

export function applyCanvasPlugin(
	ctx: HostContext,
	config: {
		defaultCanvasWidth?: number;
		defaultCanvasHeight?: number;
		maxElements?: number;
	} = {},
): CanvasStore {
	const store = new CanvasStore(config);

	ctx.effect(() => () => store.dispose());

	const tools = buildCanvasTools(ctx, store);
	for (const tool of tools) {
		ctx.effect(() => ctx.tools.register(tool));
	}

	ctx.inject(["webServer"], (routeCtx) => {
		const webServer = authenticatedWebServer(routeCtx, routeCtx.webServer);
		routeCtx.effect(() =>
			webServer.register({
				kind: "prefix",
				path: "/plugin-api/cult-canvas",
				handler: (req: IncomingMessage, res: ServerResponse) => {
					const url = req.url || "";
					if (url.endsWith("/state")) {
						const state = store.exportJsonCanvas();
						res.writeHead(200, {
							"content-type": "application/json",
							"x-received-host": (req.headers["host"] as string) || "",
							"x-received-origin": (req.headers["origin"] as string) || "",
						});
						res.end(JSON.stringify(state));
						return;
					}
					res.writeHead(404, { "content-type": "text/plain" });
					res.end("Not Found");
				},
				resource: async (req: Request) => {
					const url = new URL(req.url);
					if (url.pathname.endsWith("/state")) {
						const state = store.exportJsonCanvas();
						return new Response(JSON.stringify(state), {
							headers: {
								"content-type": "application/json",
								"x-received-host": req.headers.get("host") || "",
								"x-received-origin": req.headers.get("origin") || "",
							},
						});
					}
					return new Response("Not Found", { status: 404 });
				},
			}),
		);
	});

	ctx.effect(() =>
		ctx.systemPrompt.section({
			name: "tool:canvas",
			order: 2800,
			text: "DSH Cult Canvas active: Freehand whiteboard and media pipeline tools are available.",
		}),
	);

	return store;
}

// ============================================================================
// 11. Client Contract Harness & Frontend Mocks
// ============================================================================

export interface ModuleLoaderEntry {
	id: string;
	factory: (requireFn?: (id: string) => unknown) => unknown;
}

/**
 * Mock implementation of window.__ModuleLoader__.
 * Enforces non-empty string module IDs and callable factory functions,
 * storing registered modules in an internal registry.
 */
export class MockModuleLoader {
	private readonly modules = new Map<string, ModuleLoaderEntry>();

	load(entry: { id?: string; factory?: unknown }): void {
		if (!entry || typeof entry.id !== "string" || entry.id.trim() === "") {
			throw new Error("ModuleLoader: invalid module id");
		}
		if (typeof entry.factory !== "function") {
			throw new Error("ModuleLoader: invalid factory");
		}
		this.modules.set(entry.id, {
			id: entry.id,
			factory: entry.factory as (
				requireFn?: (id: string) => unknown,
			) => unknown,
		});
	}

	get(id: string): ModuleLoaderEntry | undefined {
		return this.modules.get(id);
	}

	getModule(id: string): ModuleLoaderEntry | undefined {
		return this.modules.get(id);
	}

	has(id: string): boolean {
		return this.modules.has(id);
	}

	hasModule(id: string): boolean {
		return this.modules.has(id);
	}

	get size(): number {
		return this.modules.size;
	}

	clear(): void {
		this.modules.clear();
	}

	executeModule<T = unknown>(
		id: string,
		requireFn: (moduleName: string) => unknown = () => ({}),
	): T {
		const entry = this.modules.get(id);
		if (!entry) {
			throw new Error(`ModuleLoader: module not found: ${id}`);
		}
		return entry.factory(requireFn) as T;
	}

	installGlobal(
		targetWindow: Record<string, unknown> = (typeof window !== "undefined"
			? window
			: globalThis) as unknown as Record<string, unknown>,
	): () => void {
		const prev = targetWindow.__ModuleLoader__;
		targetWindow.__ModuleLoader__ = this;
		return () => {
			if (prev !== undefined) {
				targetWindow.__ModuleLoader__ = prev;
			} else {
				delete targetWindow.__ModuleLoader__;
			}
		};
	}
}

export interface MockSlotRegistrationOptions {
	name: string;
	key?: string;
	id?: string;
	order?: number;
	locale?: string;
}

/**
 * Mock implementation of DSH ClientSlots service.
 * Manages card and component registrations with clean overwrite semantics and disposers.
 */
export class MockSlotService {
	private readonly slots = new Map<string, unknown>();
	private readonly disposers = new Map<string, Set<() => void>>();

	register(
		target: string | MockSlotRegistrationOptions,
		component: unknown,
	): () => void {
		const key = typeof target === "string" ? target : target.key || target.name;
		if (!key || typeof key !== "string" || key.trim() === "") {
			throw new Error("SlotService: invalid slot key");
		}
		this.slots.set(key, component);

		let disposed = false;
		const disposer = () => {
			if (disposed) return;
			disposed = true;
			if (this.slots.get(key) === component) {
				this.slots.delete(key);
			}
		};

		if (!this.disposers.has(key)) {
			this.disposers.set(key, new Set());
		}
		this.disposers.get(key)!.add(disposer);

		return disposer;
	}

	inject(slotName: string, componentOrFactory: unknown): () => void {
		if (typeof componentOrFactory === "function") {
			try {
				const result = (componentOrFactory as () => unknown)();
				if (result && typeof (result as Generator).next === "function") {
					const gen = result as Generator<() => void, void, unknown>;
					let next = gen.next();
					const genDisposers: Array<() => void> = [];
					while (!next.done) {
						if (typeof next.value === "function") {
							genDisposers.push(next.value);
						}
						next = gen.next();
					}
					return () => {
						for (const d of genDisposers) d();
					};
				}
				if (typeof result === "function") {
					return result as () => void;
				}
			} catch {
				// Fall through to register as raw value
			}
		}
		return this.register(slotName, componentOrFactory);
	}

	get<T = unknown>(key: string): T | undefined {
		return this.slots.get(key) as T | undefined;
	}

	getSlot<T = unknown>(key: string): T | undefined {
		return this.slots.get(key) as T | undefined;
	}

	has(key: string): boolean {
		return this.slots.has(key);
	}

	hasSlot(key: string): boolean {
		return this.slots.has(key);
	}

	get size(): number {
		return this.slots.size;
	}

	clear(): void {
		this.slots.clear();
		this.disposers.clear();
	}

	entries(): IterableIterator<[string, unknown]> {
		return this.slots.entries();
	}

	keys(): IterableIterator<string> {
		return this.slots.keys();
	}
}

export const CANONICAL_CANVAS_LOCALES = {
	en: { title: "Cult Canvas", create: "Create Element", delete: "Delete" },
	ru: { title: "Культ Канвас", create: "Создать элемент", delete: "Удалить" },
	zh: { title: "无限画布", create: "创建元素", delete: "删除" },
};

/**
 * Mock implementation of DSH ClientLocale service.
 * Validates dictionary schemas and provides multi-language fallback resolution.
 */
export class MockLocaleRegistry {
	private readonly registries = new Map<
		string,
		Record<string, Record<string, string>>
	>();

	register(
		namespace: string,
		dicts: Record<string, Record<string, string>>,
	): () => void {
		if (
			!namespace ||
			typeof namespace !== "string" ||
			namespace.trim() === ""
		) {
			throw new Error("LocaleRegistry: invalid namespace");
		}
		if (!dicts || typeof dicts !== "object" || Array.isArray(dicts)) {
			throw new Error("LocaleRegistry: invalid dictionary schema");
		}

		for (const [lang, table] of Object.entries(dicts)) {
			if (!table || typeof table !== "object" || Array.isArray(table)) {
				throw new Error(
					`LocaleRegistry: invalid language dictionary for ${lang}`,
				);
			}
			for (const [key, val] of Object.entries(table)) {
				if (typeof val !== "string") {
					throw new Error(
						`LocaleRegistry: dictionary entry ${lang}.${key} must be a string`,
					);
				}
			}
		}

		this.registries.set(namespace, dicts);

		let disposed = false;
		return () => {
			if (disposed) return;
			disposed = true;
			this.registries.delete(namespace);
		};
	}

	get(namespace: string): Record<string, Record<string, string>> | undefined {
		return this.registries.get(namespace);
	}

	getNamespace(
		namespace: string,
	): Record<string, Record<string, string>> | undefined {
		return this.registries.get(namespace);
	}

	has(namespace: string): boolean {
		return this.registries.has(namespace);
	}

	hasNamespace(namespace: string): boolean {
		return this.registries.has(namespace);
	}

	getDictionary(
		namespace: string,
		lang: string,
	): Record<string, string> | undefined {
		const ns = this.registries.get(namespace);
		return ns ? ns[lang] : undefined;
	}

	resolve(
		namespace: string,
		lang: string,
		key: string,
		fallbackLang = "en",
	): string {
		const ns = this.registries.get(namespace);
		if (!ns) return key;

		// 1. Target language dictionary
		const targetDict = ns[lang];
		if (targetDict && typeof targetDict[key] === "string") {
			return targetDict[key]!;
		}

		// 2. Fallback language dictionary
		const fallbackDict = ns[fallbackLang];
		if (fallbackDict && typeof fallbackDict[key] === "string") {
			return fallbackDict[key]!;
		}

		// 3. Fallback to key
		return key;
	}

	translate(
		namespace: string,
		lang: string,
		key: string,
		fallbackLang = "en",
	): string {
		return this.resolve(namespace, lang, key, fallbackLang);
	}

	resolveLocaleText(
		lang: string,
		key: string,
		namespace = "canvas",
		fallbackLang = "en",
	): string {
		let targetNs = namespace;
		if (!this.registries.has(targetNs) && this.registries.size > 0) {
			const firstKey = this.registries.keys().next().value;
			if (firstKey) targetNs = firstKey;
		}
		return this.resolve(targetNs, lang, key, fallbackLang);
	}

	bind(
		namespace: string,
		currentLang = "en",
		fallbackLang = "en",
	): (key: string) => string {
		return (key: string) =>
			this.resolve(namespace, currentLang, key, fallbackLang);
	}

	get size(): number {
		return this.registries.size;
	}

	clear(): void {
		this.registries.clear();
	}
}

export interface InjectedStyleTag {
	tag: "style";
	attrs: Record<string, string>;
	removed: boolean;
	setAttribute(k: string, v: string): void;
	remove(): void;
}

export interface InjectedStyleEntry {
	id: string;
	css: string;
	attrs: Record<string, string>;
	attributes: Record<string, string>;
	removed: boolean;
	element: InjectedStyleTag;
}

/**
 * Mock implementation of client CSS style injection manager.
 * Models style elements and unmount disposers without needing a live browser DOM.
 */
export class MockStyleRegistry {
	private readonly styles = new Map<string, InjectedStyleEntry>();

	injectStyle(
		id: string,
		css = "",
		attributes: Record<string, string> = {},
	): () => void {
		if (!id || typeof id !== "string" || id.trim() === "") {
			throw new Error("StyleRegistry: invalid style id");
		}

		const attrs: Record<string, string> = {
			"data-dsh-extension": id,
			...attributes,
		};

		let entry: InjectedStyleEntry;

		const tag: InjectedStyleTag = {
			tag: "style",
			attrs,
			removed: false,
			setAttribute(k: string, v: string) {
				this.attrs[k] = v;
			},
			remove() {
				this.removed = true;
				entry.removed = true;
			},
		};

		entry = {
			id,
			css,
			attrs,
			attributes: attrs,
			removed: false,
			element: tag,
		};

		this.styles.set(id, entry);

		let disposed = false;
		return () => {
			if (disposed) return;
			disposed = true;
			entry.removed = true;
			tag.removed = true;
			this.styles.delete(id);
		};
	}

	inject(
		id: string,
		css = "",
		attributes: Record<string, string> = {},
	): () => void {
		return this.injectStyle(id, css, attributes);
	}

	get(id: string): InjectedStyleEntry | undefined {
		return this.styles.get(id);
	}

	getStyle(id: string): InjectedStyleEntry | undefined {
		return this.styles.get(id);
	}

	has(id: string): boolean {
		return this.styles.has(id);
	}

	hasStyle(id: string): boolean {
		return this.styles.has(id);
	}

	get size(): number {
		return this.styles.size;
	}

	getActiveStyles(): InjectedStyleEntry[] {
		return Array.from(this.styles.values()).filter((s) => !s.removed);
	}

	clear(): void {
		for (const entry of this.styles.values()) {
			entry.removed = true;
			entry.element.removed = true;
		}
		this.styles.clear();
	}
}

/**
 * Mock implementation of client remote service.
 */
export class MockRemoteService {
	private readonly listeners = new Map<string, Set<(value: unknown) => void>>();
	private readonly mockResponses = new Map<string, unknown>();

	async call<T = unknown>(method: string, ..._params: unknown[]): Promise<T> {
		if (this.mockResponses.has(method)) {
			return this.mockResponses.get(method) as T;
		}
		return {} as T;
	}

	async request<T = unknown>(_options: unknown): Promise<T> {
		return {} as T;
	}

	mockMethod(method: string, response: unknown): void {
		this.mockResponses.set(method, response);
	}

	$on(event: string, listener: (value: unknown) => void): () => void {
		if (!this.listeners.has(event)) {
			this.listeners.set(event, new Set());
		}
		this.listeners.get(event)!.add(listener);
		return () => {
			this.listeners.get(event)?.delete(listener);
		};
	}

	$emit(event: string, value: unknown): void {
		const set = this.listeners.get(event);
		if (set) {
			for (const listener of set) {
				listener(value);
			}
		}
	}

	readonly session = {
		modelCatalog: async () => ({
			ok: true,
			value: { groups: [] },
		}),
	};
}

/**
 * Mock implementation of client UI workspace service.
 */
export class MockUiWorkspace {
	private activeSessionId: string | null = null;

	getActive(): { id: string } | null {
		return this.activeSessionId ? { id: this.activeSessionId } : null;
	}

	getActiveSession(): { id: string } | undefined {
		return this.activeSessionId ? { id: this.activeSessionId } : undefined;
	}

	openSession(sessionId: string): void {
		this.activeSessionId = sessionId;
	}

	closeSession(): void {
		this.activeSessionId = null;
	}
}

export interface MockClientContext {
	slots: MockSlotService;
	locale: MockLocaleRegistry;
	styles: MockStyleRegistry;
	remote: MockRemoteService;
	uiWorkspace: MockUiWorkspace;
	effect(callback: () => (() => void) | void, label?: string): () => void;
	dispose(): void;
}

/**
 * Factory creating a client context matching DSH frontend contracts.
 */
export function createMockClientContext(
	options: {
		activeSessionId?: string;
	} = {},
): MockClientContext {
	const slots = new MockSlotService();
	const locale = new MockLocaleRegistry();
	const styles = new MockStyleRegistry();
	const remote = new MockRemoteService();
	const uiWorkspace = new MockUiWorkspace();
	if (options.activeSessionId) {
		uiWorkspace.openSession(options.activeSessionId);
	}

	const disposers: Array<() => void> = [];

	const effect = (
		callback: () => (() => void) | void,
		_label?: string,
	): (() => void) => {
		const res = callback();
		let cleanup: () => void = () => {};
		if (typeof res === "function") {
			cleanup = res;
			disposers.push(cleanup);
		}
		return () => {
			cleanup();
			const idx = disposers.indexOf(cleanup);
			if (idx !== -1) disposers.splice(idx, 1);
		};
	};

	const dispose = (): void => {
		while (disposers.length > 0) {
			const d = disposers.pop();
			if (d) d();
		}
		slots.clear();
		locale.clear();
		styles.clear();
	};

	return {
		slots,
		locale,
		styles,
		remote,
		uiWorkspace,
		effect,
		dispose,
	};
}

export interface ViewportTransform {
	x: number;
	y: number;
	zoom: number;
}

/**
 * Standard affine projection: screen (pixel) to canvas world coordinates.
 * Formula: canvasPt = (screenPt - pan) / zoom
 */
export function screenToCanvas(
	screen: { x: number; y: number },
	viewport: ViewportTransform,
): { x: number; y: number } {
	if (
		viewport.zoom === 0 ||
		Number.isNaN(viewport.zoom) ||
		!Number.isFinite(viewport.zoom)
	) {
		throw new Error("Viewport zoom cannot be zero or non-finite: invalid zoom");
	}
	return {
		x: (screen.x - viewport.x) / viewport.zoom,
		y: (screen.y - viewport.y) / viewport.zoom,
	};
}

/**
 * Standard affine projection: canvas world coordinates to screen (pixel).
 * Formula: screenPt = canvasPt * zoom + pan
 */
export function canvasToScreen(
	canvas: { x: number; y: number },
	viewport: ViewportTransform,
): { x: number; y: number } {
	if (
		viewport.zoom === 0 ||
		Number.isNaN(viewport.zoom) ||
		!Number.isFinite(viewport.zoom)
	) {
		throw new Error("Viewport zoom cannot be zero or non-finite: invalid zoom");
	}
	return {
		x: canvas.x * viewport.zoom + viewport.x,
		y: canvas.y * viewport.zoom + viewport.y,
	};
}
