/**
 * Presentation Module / Plugin Entrypoint for DSH Cult Canvas
 *
 * Implements:
 * - Cordis lifecycle injection ("tools", "systemPrompt", dynamic "webServer")
 * - Configuration resolution with safe defaults from cordis.patch.yml
 * - Unified CanvasStore, GraphEngine, and PipelineEngine instantiation
 * - Registration of 12 AI agent tools with disposer tracking
 * - Authenticated WebServer route serving /plugin-api/cult-canvas/state
 * - System prompt section injection ("tool:canvas")
 * - Clean, leak-free disposer lifecycle
 *
 * @module @local/dsh-cult-canvas/presentation
 */
import { CanvasStore } from "../application/canvas-store.js";
import { GraphEngine } from "../application/graph-engine.js";
import { PipelineEngine } from "../application/pipeline-engine.js";
import { authenticatedWebServer } from "../infrastructure/web-route-auth.js";
import { buildCanvasTools } from "../adapters/tools.js";
/** Services required for basic plugin initialization. */
export const inject = ["tools", "systemPrompt"];
/** Canonical web route prefix for canvas API endpoints. */
export const CANVAS_API_ROUTE = "/plugin-api/cult-canvas";
/** System prompt section identity. */
export const CANVAS_SYSTEM_PROMPT_NAME = "tool:canvas";
/** Fallback system prompt order. */
export const CANVAS_SYSTEM_PROMPT_ORDER = 2800;
/** Guidance text injected into the system prompt for AI agents. */
export const CANVAS_GUIDANCE = `DSH Cult Canvas active: Freehand whiteboard and media pipeline tools are available.
Use the canvas tools to interact with the visual whiteboard and media generation pipeline:
- Inspect state: use canvas_get_state for overview/serialization and canvas_query_elements for spatial or type filtering.
- Whiteboard & nodes: use canvas_create_element, canvas_update_element, and canvas_delete_element for notes, shapes, script, storyboard, image, video, audio, and finalcut elements.
- Graph & execution: use canvas_connect to link ports, canvas_layout_elements to organize DAG flows, canvas_run_pipeline to execute workflows, and canvas_node_status to monitor progress.
- Worldview & formats: use canvas_get_bible and canvas_update_bible for characters, scenes, and style anchors; use canvas_import_export for JSON Canvas 1.0 interchange.`;
/** Safe defaults matching cordis.patch.yml. */
export const DEFAULT_CONFIG = Object.freeze({
    defaultCanvasWidth: 8192,
    defaultCanvasHeight: 8192,
    maxElements: 5000,
    snapToGrid: true,
    gridSize: 20,
});
function isPlainObject(value) {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        return false;
    }
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
}
function clampInt(value, min, max, fallback) {
    const parsed = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
    if (typeof parsed !== "number" || !Number.isInteger(parsed))
        return fallback;
    return Math.min(max, Math.max(min, parsed));
}
/**
 * Resolve raw configuration input into typed plugin configuration with safe clamping.
 */
export function resolveCanvasConfig(raw) {
    const input = isPlainObject(raw) ? raw : {};
    return {
        defaultCanvasWidth: clampInt(input["defaultCanvasWidth"], 100, 100_000, DEFAULT_CONFIG.defaultCanvasWidth),
        defaultCanvasHeight: clampInt(input["defaultCanvasHeight"], 100, 100_000, DEFAULT_CONFIG.defaultCanvasHeight),
        maxElements: clampInt(input["maxElements"], 1, 50_000, DEFAULT_CONFIG.maxElements),
        snapToGrid: typeof input["snapToGrid"] === "boolean"
            ? input["snapToGrid"]
            : DEFAULT_CONFIG.snapToGrid,
        gridSize: clampInt(input["gridSize"], 1, 500, DEFAULT_CONFIG.gridSize),
    };
}
/**
 * Build the JSON-serializable canvas state response with execution metadata.
 */
export function buildCanvasStatePayload(store) {
    const state = store.exportJsonCanvas();
    const nodes = (state.nodes || []).map((n) => {
        const el = store.getElementById(n.id);
        return {
            ...n,
            ...(el?.status ? { status: el.status } : {}),
            ...(el?.data ? { data: el.data } : {}),
        };
    });
    return {
        ...state,
        nodes,
    };
}
/**
 * Handle incoming Node HTTP requests for the canvas web API.
 */
function handleCanvasHttp(store, req, res) {
    const rawUrl = req.url || "";
    let pathname = rawUrl;
    try {
        pathname = new URL(rawUrl, "http://127.0.0.1").pathname;
    }
    catch {
        // Use raw path if parsing fails
    }
    const normalized = pathname.replace(/\/+$/, "");
    if (normalized.endsWith("/state")) {
        const payload = buildCanvasStatePayload(store);
        const body = JSON.stringify(payload);
        res.writeHead(200, {
            "content-type": "application/json; charset=utf-8",
            "x-received-host": req.headers["host"] || "",
            "x-received-origin": req.headers["origin"] || "",
        });
        res.end(body);
        return;
    }
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not Found");
}
/**
 * Handle incoming Fetch standard Requests for the canvas web API.
 */
async function handleCanvasResource(store, req) {
    let pathname = "";
    try {
        const url = new URL(req.url);
        pathname = url.pathname.replace(/\/+$/, "");
    }
    catch {
        return new Response("Bad Request", { status: 400 });
    }
    if (pathname.endsWith("/state")) {
        const payload = buildCanvasStatePayload(store);
        return new Response(JSON.stringify(payload), {
            status: 200,
            headers: {
                "content-type": "application/json; charset=utf-8",
                "x-received-host": req.headers.get("host") || "",
                "x-received-origin": req.headers.get("origin") || "",
            },
        });
    }
    return new Response("Not Found", { status: 404 });
}
/**
 * Apply the dsh-cult-canvas plugin surface to a Cordis HostContext.
 */
export function apply(ctx, rawConfig = {}) {
    const config = resolveCanvasConfig(rawConfig);
    // 1. Core engine instances
    const store = new CanvasStore();
    const graphEngine = new GraphEngine();
    const pipelineEngine = new PipelineEngine();
    // 2. Disposer for state cleanup on plugin unload
    ctx.effect(() => () => {
        if (typeof store.dispose ===
            "function") {
            store.dispose();
        }
        else if (typeof store.clear === "function") {
            store.clear();
        }
    });
    // 3. Register AI agent tools with disposers
    const tools = buildCanvasTools(ctx, store, {
        graphEngine,
        pipelineEngine,
        config,
    });
    for (const tool of tools) {
        ctx.effect(() => ctx.tools.register(tool));
    }
    // 4. Dynamic injection of authenticated webServer route
    ctx.inject(["webServer"], (routeCtx) => {
        const rawServer = routeCtx.webServer ??
            routeCtx.get?.("webServer");
        if (!rawServer)
            return;
        const webServer = authenticatedWebServer(routeCtx, rawServer);
        routeCtx.effect(() => webServer.register({
            kind: "prefix",
            path: CANVAS_API_ROUTE,
            handler: (req, res) => handleCanvasHttp(store, req, res),
            resource: (req) => handleCanvasResource(store, req),
        }), "cult-canvas: web route");
    });
    // 5. System prompt guidance section
    const order = typeof ctx.systemPrompt?.getSectionOrder === "function"
        ? (ctx.systemPrompt.getSectionOrder("TOOL_CANVAS") ??
            CANVAS_SYSTEM_PROMPT_ORDER)
        : CANVAS_SYSTEM_PROMPT_ORDER;
    ctx.effect(() => ctx.systemPrompt.section({
        name: CANVAS_SYSTEM_PROMPT_NAME,
        order,
        text: CANVAS_GUIDANCE,
    }));
    return store;
}
export const applyCanvasPlugin = apply;
export default apply;
