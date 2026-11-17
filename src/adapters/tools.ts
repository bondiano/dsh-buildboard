import type {
	CanvasEdge,
	CanvasElement,
	HostContext,
	JSONCanvasDocument,
	SeriesBible,
	TextBlock,
	ToolDefinition,
	ToolExec,
	ToolValue,
} from "../domain/types.js";
import { CanvasStore } from "../application/canvas-store.js";
import { GraphEngine } from "../application/graph-engine.js";
import { PipelineEngine } from "../application/pipeline-engine.js";
import type { GenerationProvider } from "../infrastructure/providers/generation-provider.js";
import { stripUndefined } from "../infrastructure/utils/strip-undefined.js";
import { deepMerge } from "../infrastructure/utils/deep-merge.js";

export { stripUndefined, deepMerge };

/**
 * Options for configuring canvas tools.
 */
export interface CanvasToolsOptions {
	graphEngine?: GraphEngine;
	pipelineEngine?: PipelineEngine;
	config?: unknown;
	/** Media generation backend the pipeline drives; mock when omitted. */
	provider?: GenerationProvider;
}

/** Resolves the board a tool call works on, from the calling session. */
export type CanvasStoreSource =
	| CanvasStore
	| ((exec?: ToolExec) => CanvasStore);

/**
 * Builds the complete 12-tool suite for canvas inspection, manipulation, and execution.
 */
export function buildCanvasTools(
	_ctx: HostContext,
	source: CanvasStoreSource,
	options?: CanvasToolsOptions,
): ToolDefinition[] {
	const graphEngine = options?.graphEngine ?? new GraphEngine();
	const pipelineEngine = options?.pipelineEngine ?? new PipelineEngine();
	const provider = options?.provider;
	let customBible: Record<string, unknown> = {};

	// One board per session: the agent edits the board of its own workspace.
	const storeFor = (exec?: ToolExec): CanvasStore =>
		typeof source === "function" ? source(exec) : source;
	// Agent writes are stamped so the open board marks them until the user
	// touches the same element.
	const agentStamp = (): { updatedBy: "agent"; updatedAt: number } => ({
		updatedBy: "agent",
		updatedAt: Date.now(),
	});

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
					type: { type: "string" },
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
						bible: { type: "object" },
					},
					required: ["ok", "count"],
				},
				render(_args: unknown, val: ToolValue): TextBlock[] {
					return [
						{
							type: "text",
							text: `Canvas State: ${(val as unknown as { count: number }).count} elements`,
						},
					];
				},
				presentationMeta(_args: unknown, val: ToolValue): object {
					return {
						title: "Canvas State",
						view: "canvas",
						count: (val as unknown as { count: number }).count,
					};
				},
			},
			async execute(args: unknown, exec: ToolExec): Promise<ToolValue> {
				const store = storeFor(exec);
				if (exec?.signal?.aborted) throw new Error("Aborted");
				const params = (args || {}) as {
					boundingBox?: {
						minX: number;
						minY: number;
						maxX: number;
						maxY: number;
					};
					kind?: string;
					type?: string;
				};

				let elements: CanvasElement[];
				if (params.boundingBox) {
					const { minX, minY, maxX, maxY } = params.boundingBox;
					if (minX >= maxX || minY >= maxY) {
						elements = [];
					} else {
						elements = store.queryBounds(params.boundingBox);
					}
				} else {
					elements = store.getAllElements();
				}

				const targetKind = params.kind || params.type;
				if (targetKind) {
					elements = elements.filter(
						(e) =>
							e.kind === targetKind ||
							(e as { type?: string }).type === targetKind,
					);
				}

				const edges = store.getAllEdges();
				const storeBible = (store.getBible() || {}) as Record<string, unknown>;
				const effectiveBible =
					Object.keys(storeBible).length > 0 ||
					Object.keys(customBible).length > 0
						? deepMerge(deepMerge({}, storeBible), customBible)
						: undefined;

				return stripUndefined({
					ok: true,
					text: `Canvas State: ${elements.length} elements, ${edges.length} edges`,
					elements,
					edges,
					count: elements.length,
					bible: effectiveBible,
				}) as ToolValue;
			},
		},

		// 2. canvas_query_elements
		{
			name: "canvas_query_elements",
			description:
				"Query canvas elements matching spatial bounding box, kind, or tags.",
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
					type: { type: "string" },
					tags: { type: "array", items: { type: "string" } },
				},
			},
			output: {
				schema: {
					type: "object",
					properties: {
						ok: { type: "boolean" },
						elements: { type: "array" },
						count: { type: "integer" },
					},
					required: ["ok", "count"],
				},
				render(_args: unknown, val: ToolValue): TextBlock[] {
					return [
						{
							type: "text",
							text: `Query Elements: ${(val as unknown as { count: number }).count} found`,
						},
					];
				},
				presentationMeta(_args: unknown, val: ToolValue): object {
					return {
						title: "Query Elements",
						view: "canvas",
						count: (val as unknown as { count: number }).count,
					};
				},
			},
			async execute(args: unknown, exec: ToolExec): Promise<ToolValue> {
				const store = storeFor(exec);
				if (exec?.signal?.aborted) throw new Error("Aborted");
				const params = (args || {}) as {
					boundingBox?: {
						minX: number;
						minY: number;
						maxX: number;
						maxY: number;
					};
					kind?: string;
					type?: string;
					tags?: string[];
				};

				let elements: CanvasElement[];
				if (params.boundingBox) {
					const { minX, minY, maxX, maxY } = params.boundingBox;
					if (minX >= maxX || minY >= maxY) {
						elements = [];
					} else {
						elements = store.queryBounds(params.boundingBox);
					}
				} else {
					elements = store.getAllElements();
				}

				const targetKind = params.kind || params.type;
				if (targetKind) {
					elements = elements.filter(
						(e) =>
							e.kind === targetKind ||
							(e as { type?: string }).type === targetKind,
					);
				}

				if (Array.isArray(params.tags) && params.tags.length > 0) {
					elements = elements.filter((e) => {
						const eTags =
							((e.data?.["tags"] ||
								(e as { tags?: string[] }).tags) as string[]) || [];
						return params.tags!.every((t) => eTags.includes(t));
					});
				}

				return stripUndefined({
					ok: true,
					text: `Found ${elements.length} elements`,
					elements,
					count: elements.length,
				}) as ToolValue;
			},
		},

		// 3. canvas_node_status
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
						data: { type: "object" },
						mediaParams: { type: "object" },
					},
					required: ["ok", "nodeId", "status"],
				},
				render(_args: unknown, val: ToolValue): TextBlock[] {
					const v = val as unknown as { nodeId?: string; status?: string };
					return [
						{
							type: "text",
							text: `Node ${v.nodeId ?? ""} status: ${v.status ?? ""}`,
						},
					];
				},
				presentationMeta(_args: unknown, val: ToolValue): object {
					const v = (val || {}) as { status?: string };
					return stripUndefined({
						title: "Node Status",
						view: "node",
						status: v.status,
					});
				},
			},
			async execute(args: unknown, exec: ToolExec): Promise<ToolValue> {
				const store = storeFor(exec);
				if (exec?.signal?.aborted) throw new Error("Aborted");
				const { nodeId } = (args || {}) as { nodeId?: string };
				if (!nodeId) throw new Error("Node not found: undefined");

				const node = store.getElementById(nodeId);
				if (!node) throw new Error(`Node not found: ${nodeId}`);

				return stripUndefined({
					ok: true,
					text: `Node ${nodeId} status: ${node.status || "idle"}`,
					nodeId,
					status: node.status || "idle",
					progress: (node as { progress?: unknown }).progress,
					error: (node as { error?: unknown }).error,
					data: node.data || {},
					mediaParams: node.mediaParams || {},
				}) as ToolValue;
			},
		},

		// 4. canvas_create_element
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
					data: { type: "object" },
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
					required: ["ok", "elementId"],
				},
				render(_args: unknown, val: ToolValue): TextBlock[] {
					const v = val as unknown as { elementId?: string };
					return [
						{
							type: "text",
							text: `Created element: ${v.elementId ?? ""}`,
						},
					];
				},
				presentationMeta(_args: unknown, val: ToolValue): object {
					const v = (val as unknown as { elementId?: string }) || {};
					return stripUndefined({
						title: "Created Element",
						view: "card",
						elementId: v.elementId,
					});
				},
			},
			async execute(args: unknown, exec: ToolExec): Promise<ToolValue> {
				const store = storeFor(exec);
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

				const id =
					p.id ||
					`elem_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
				const kind =
					p.kind ||
					(p.type &&
					[
						"sticky",
						"shape",
						"stroke",
						"group",
						"script",
						"storyboard",
						"image",
						"video",
						"audio",
						"finalcut",
					].includes(p.type)
						? p.type
						: "text");
				const type =
					p.type ||
					(p.kind && ["sticky", "shape", "stroke"].includes(p.kind)
						? "text"
						: p.kind || "text");

				const width =
					typeof p.width === "number" && Number.isFinite(p.width) && p.width > 0
						? p.width
						: 200;
				const height =
					typeof p.height === "number" &&
					Number.isFinite(p.height) &&
					p.height > 0
						? p.height
						: 150;

				const element: CanvasElement = {
					...p,
					id,
					kind,
					type,
					x: p.x,
					y: p.y,
					width,
					height,
				} as CanvasElement;

				const sanitizedElement = stripUndefined({
					...element,
					...agentStamp(),
				});
				const created = store.createElement(sanitizedElement);
				return stripUndefined({
					ok: true,
					text: `Created element: ${created.id}`,
					elementId: created.id,
					element: created,
				}) as ToolValue;
			},
		},

		// 5. canvas_update_element
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
					required: ["ok"],
				},
				render(_args: unknown, val: ToolValue): TextBlock[] {
					const v = val as unknown as { element?: { id?: string } };
					return [
						{
							type: "text",
							text: `Updated element: ${v.element?.id ?? "unknown"}`,
						},
					];
				},
				presentationMeta(_args: unknown, _val: ToolValue): object {
					return { title: "Updated Element", view: "card" };
				},
			},
			async execute(args: unknown, exec: ToolExec): Promise<ToolValue> {
				const store = storeFor(exec);
				if (exec?.signal?.aborted) throw new Error("Aborted");
				const { id, patch } = (args || {}) as {
					id?: string;
					patch?: Partial<CanvasElement>;
				};
				if (!id) throw new Error("Element not found: undefined");
				const existing = store.getElementById(id);
				if (!existing) throw new Error(`Element not found: ${id}`);
				if (!patch || typeof patch !== "object") {
					throw new Error("Missing or invalid required parameter: patch");
				}

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
				if (patch.width !== undefined) {
					if (
						typeof patch.width !== "number" ||
						!Number.isFinite(patch.width) ||
						patch.width <= 0
					) {
						delete updatedPatch.width;
					}
				}
				if (patch.height !== undefined) {
					if (
						typeof patch.height !== "number" ||
						!Number.isFinite(patch.height) ||
						patch.height <= 0
					) {
						delete updatedPatch.height;
					}
				}

				const sanitizedPatch = stripUndefined({
					...updatedPatch,
					...agentStamp(),
				});
				const updated = store.updateElement(id, sanitizedPatch);
				return stripUndefined({
					ok: true,
					text: `Updated element: ${id}`,
					element: updated,
				}) as ToolValue;
			},
		},

		// 6. canvas_delete_element
		{
			name: "canvas_delete_element",
			description: "Delete elements by ID and clean up incident edges.",
			parameters: {
				type: "object",
				properties: {
					ids: { type: "array", items: { type: "string" } },
					id: { type: "string" },
				},
			},
			output: {
				schema: {
					type: "object",
					properties: {
						ok: { type: "boolean" },
						deletedCount: { type: "integer" },
						removedEdgesCount: { type: "integer" },
					},
					required: ["ok", "deletedCount", "removedEdgesCount"],
				},
				render(_args: unknown, val: ToolValue): TextBlock[] {
					return [
						{
							type: "text",
							text: `Deleted ${(val as unknown as { deletedCount: number }).deletedCount} elements`,
						},
					];
				},
				presentationMeta(_args: unknown, _val: ToolValue): object {
					return { title: "Deleted Elements", view: "card" };
				},
			},
			async execute(args: unknown, exec: ToolExec): Promise<ToolValue> {
				const store = storeFor(exec);
				if (exec?.signal?.aborted) throw new Error("Aborted");
				const p = (args || {}) as { ids?: string[]; id?: string };
				const ids = Array.isArray(p.ids) ? p.ids : p.id ? [p.id] : [];
				const res = store.deleteElements(ids);
				const deletedCount = res.deletedElements.length;
				const removedEdgesCount = res.deletedEdges.length;

				return stripUndefined({
					ok: true,
					text: `Deleted ${deletedCount} elements, removed ${removedEdgesCount} edges`,
					deletedCount,
					removedEdgesCount,
					deletedElements: res.deletedElements,
					deletedEdges: res.deletedEdges,
				}) as ToolValue;
			},
		},

		// 7. canvas_connect
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
					required: ["ok", "edge"],
				},
				render(_args: unknown, val: ToolValue): TextBlock[] {
					return [
						{
							type: "text",
							text: `Connected edge: ${(val as { edge?: { id?: string } }).edge?.id ?? "unknown"}`,
						},
					];
				},
				presentationMeta(_args: unknown, _val: ToolValue): object {
					return { title: "Connected Edge", view: "wire" };
				},
			},
			async execute(args: unknown, exec: ToolExec): Promise<ToolValue> {
				const store = storeFor(exec);
				if (exec?.signal?.aborted) throw new Error("Aborted");
				const p = (args || {}) as CanvasEdge;
				if (!p.fromNode || !p.toNode) {
					throw new Error(
						"Missing required parameters: fromNode and toNode are required",
					);
				}
				const fromNode = store.getElementById(p.fromNode);
				const toNode = store.getElementById(p.toNode);
				if (!fromNode || !toNode) {
					throw new Error("Source or target node not found");
				}

				if (p.fromPort || p.toPort) {
					const fromType =
						fromNode.kind || (fromNode as { type?: string }).type || "text";
					const toType =
						toNode.kind || (toNode as { type?: string }).type || "text";
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
					text: `Connected edge: ${edge.id}`,
					edge,
				}) as ToolValue;
			},
		},

		// 8. canvas_layout_elements
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
					auto: { type: "boolean" },
				},
			},
			output: {
				schema: {
					type: "object",
					properties: {
						ok: { type: "boolean" },
						updatedCount: { type: "integer" },
					},
					required: ["ok", "updatedCount"],
				},
				render(_args: unknown, val: ToolValue): TextBlock[] {
					return [
						{
							type: "text",
							text: `Updated layout for ${(val as unknown as { updatedCount: number }).updatedCount} elements`,
						},
					];
				},
				presentationMeta(_args: unknown, _val: ToolValue): object {
					return { title: "Layout Elements", view: "canvas" };
				},
			},
			async execute(args: unknown, exec: ToolExec): Promise<ToolValue> {
				const store = storeFor(exec);
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
					auto?: boolean;
				};

				let updatedCount = 0;
				if (Array.isArray(p.layouts)) {
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
						const patch: {
							x: number;
							y: number;
							width?: number;
							height?: number;
							pinned?: boolean;
						} = {
							x: item.x,
							y: item.y,
						};
						if (
							typeof item.width === "number" &&
							Number.isFinite(item.width) &&
							item.width > 0
						) {
							patch.width = item.width;
						}
						if (
							typeof item.height === "number" &&
							Number.isFinite(item.height) &&
							item.height > 0
						) {
							patch.height = item.height;
						}
						if (typeof item.pinned === "boolean") {
							patch.pinned = item.pinned;
						}
						store.updateElement(item.id, { ...patch, ...agentStamp() });
						updatedCount++;
					}
				} else if (p.auto) {
					const coords = graphEngine.computeAutoLayoutCoordinates();
					for (const [id, coord] of coords.entries()) {
						store.updateElement(id, {
							x: coord.x,
							y: coord.y,
							...agentStamp(),
						});
						updatedCount++;
					}
				} else {
					throw new Error(
						"Missing or invalid required parameter: layouts must be an array",
					);
				}

				return stripUndefined({
					ok: true,
					text: `Updated layout for ${updatedCount} elements`,
					updatedCount,
				}) as ToolValue;
			},
		},

		// 9. canvas_run_pipeline
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
						executedNodes: { type: "array", items: { type: "string" } },
						failedNodes: { type: "array", items: { type: "string" } },
						assetId: { type: "string" },
						error: { type: "string" },
					},
					required: ["ok", "status"],
				},
				render(_args: unknown, val: ToolValue): TextBlock[] {
					return [
						{
							type: "text",
							text: `Pipeline run status: ${(val as unknown as { status: string }).status}`,
						},
					];
				},
				presentationMeta(_args: unknown, val: ToolValue): object {
					const v = (val || {}) as { status?: string };
					return stripUndefined({
						title: "Pipeline Execution",
						view: "pipeline",
						status: v.status,
					});
				},
			},
			async execute(args: unknown, exec: ToolExec): Promise<ToolValue> {
				const store = storeFor(exec);
				if (exec?.signal?.aborted) throw new Error("Aborted");
				const p = (args || {}) as { nodeId?: string; mode?: "step" | "all" };

				if (p.nodeId && p.mode !== "all") {
					const res = await pipelineEngine.executeNode(p.nodeId, store, {
						signal: exec?.signal,
						provider,
					});
					return stripUndefined({
						ok: res.ok,
						text: `Pipeline run status: ${res.status}`,
						status: res.status,
						assetId: res.assetId,
						error: res.error,
						nodeId: p.nodeId,
					}) as ToolValue;
				} else {
					const res = await pipelineEngine.runWorkflow(store, {
						rootNodeIds: p.nodeId ? [p.nodeId] : undefined,
						signal: exec?.signal,
						provider,
					});
					return stripUndefined({
						ok: res.ok,
						text: `Pipeline run status: ${res.ok ? "completed" : "failed"}`,
						status: res.ok ? "completed" : "failed",
						executedNodes: res.executedNodes,
						failedNodes: res.failedNodes,
					}) as ToolValue;
				}
			},
		},

		// 10. canvas_import_export
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
						document: { type: "object" },
						importedNodes: { type: "integer" },
						importedEdges: { type: "integer" },
					},
					required: ["ok"],
				},
				render(_args: unknown, val: ToolValue): TextBlock[] {
					return [
						{
							type: "text",
							text: `Import/Export completed: ${(val as unknown as { ok: boolean }).ok}`,
						},
					];
				},
				presentationMeta(_args: unknown, _val: ToolValue): object {
					return { title: "Import / Export", view: "canvas" };
				},
			},
			async execute(args: unknown, exec: ToolExec): Promise<ToolValue> {
				const store = storeFor(exec);
				if (exec?.signal?.aborted) throw new Error("Aborted");
				const { action, document: doc } = (args || {}) as {
					action?: "export" | "import";
					document?: JSONCanvasDocument;
				};

				if (action === "export") {
					const exported = store.exportJsonCanvas();
					return stripUndefined({
						ok: true,
						text: `Exported JSON Canvas with ${exported.nodes.length} nodes and ${exported.edges.length} edges`,
						document: exported,
					}) as ToolValue;
				} else if (action === "import") {
					if (!doc) throw new Error("Document payload required for import");
					const res = store.importJsonCanvas(doc);
					for (const imported of store.getAllElements()) {
						store.updateElement(imported.id, agentStamp());
					}
					return stripUndefined({
						ok: true,
						text: `Imported ${res.importedNodes} nodes and ${res.importedEdges} edges`,
						...res,
					}) as ToolValue;
				} else {
					throw new Error("Invalid action: must be export or import");
				}
			},
		},

		// 11. canvas_get_bible
		{
			name: "canvas_get_bible",
			description: "Get the project narrative and visual bible.",
			parameters: { type: "object", properties: {} },
			output: {
				schema: {
					type: "object",
					properties: {
						ok: { type: "boolean" },
						bible: { type: "object" },
					},
					required: ["ok", "bible"],
				},
				render(_args: unknown, _val: ToolValue): TextBlock[] {
					return [{ type: "text", text: "Fetched project bible" }];
				},
				presentationMeta(_args: unknown, _val: ToolValue): object {
					return { title: "Project Bible", view: "bible" };
				},
			},
			async execute(_args: unknown, exec: ToolExec): Promise<ToolValue> {
				const store = storeFor(exec);
				if (exec?.signal?.aborted) throw new Error("Aborted");
				const storeBible = (store.getBible() || {}) as Record<string, unknown>;
				const effectiveBible = deepMerge(
					deepMerge({}, storeBible),
					customBible,
				);

				return stripUndefined({
					ok: true,
					text: "Fetched project bible",
					bible: effectiveBible,
				}) as ToolValue;
			},
		},

		// 12. canvas_update_bible
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
					properties: {
						ok: { type: "boolean" },
						bible: { type: "object" },
					},
					required: ["ok", "bible"],
				},
				render(_args: unknown, _val: ToolValue): TextBlock[] {
					return [{ type: "text", text: "Updated project bible" }];
				},
				presentationMeta(_args: unknown, _val: ToolValue): object {
					return { title: "Updated Bible", view: "bible" };
				},
			},
			async execute(args: unknown, exec: ToolExec): Promise<ToolValue> {
				const store = storeFor(exec);
				if (exec?.signal?.aborted) throw new Error("Aborted");
				const { patch } = (args || {}) as { patch?: Record<string, unknown> };
				if (!patch || typeof patch !== "object") {
					throw new Error("Missing or invalid required parameter: patch");
				}

				const sanitizedPatch = (stripUndefined(patch) || {}) as Record<
					string,
					unknown
				>;
				const storeBible = (store.getBible() || {}) as Record<string, unknown>;
				const mergedBible = deepMerge(
					deepMerge(customBible, storeBible),
					sanitizedPatch,
				);
				customBible = (stripUndefined(mergedBible) || {}) as Record<
					string,
					unknown
				>;

				try {
					store.updateBible(sanitizedPatch as Partial<SeriesBible>);
				} catch {
					// safe fallback
				}
				if (
					(store as unknown as { customBible?: Record<string, unknown> })
						.customBible
				) {
					(
						store as unknown as { customBible: Record<string, unknown> }
					).customBible = deepMerge(
						(store as unknown as { customBible: Record<string, unknown> })
							.customBible,
						sanitizedPatch,
					);
				}
				const currentStoreBible = store.getBible();
				if (currentStoreBible && typeof currentStoreBible === "object") {
					Object.assign(currentStoreBible, customBible);
				}

				const effectiveBible = deepMerge(
					deepMerge({}, (store.getBible() || {}) as Record<string, unknown>),
					customBible,
				);

				return stripUndefined({
					ok: true,
					text: "Updated project bible",
					bible: effectiveBible,
				}) as ToolValue;
			},
		},
	];

	return tools;
}

export function createCanvasTools(
	store: CanvasStore,
	ctx?: HostContext,
	options?: CanvasToolsOptions,
): ToolDefinition[] {
	return buildCanvasTools(ctx ?? ({} as HostContext), store, options);
}
