/**
 * Presentation Module / Plugin Entrypoint for DSH Cult Canvas
 *
 * Implements:
 * - Cordis lifecycle injection ("tools", "systemPrompt", "settings", dynamic "webServer")
 * - Configuration resolution with safe defaults and the Schemastery `Config` schema
 * - One board per workspace (BoardRegistry) shared by the agent tools and the tab
 * - Registration of 12 AI agent tools with disposer tracking
 * - Authenticated WebServer route serving the live board protocol
 * - System prompt section injection ("tool:canvas")
 * - Clean, leak-free disposer lifecycle
 *
 * @module @local/dsh-cult-canvas/presentation
 */
import { BoardRegistry } from "../application/board-registry.js";
import { CANVAS_API_ROUTE } from "../domain/route.js";
import { applyUserSnapshot, } from "../application/board-sync.js";
import { GraphEngine } from "../application/graph-engine.js";
import { PipelineEngine } from "../application/pipeline-engine.js";
import { authenticatedWebServer } from "../infrastructure/web-route-auth.js";
import { MockGenerationProvider } from "../infrastructure/providers/mock-provider.js";
import { OpenAIProvider } from "../infrastructure/providers/openai-provider.js";
import { WanxProvider } from "../infrastructure/providers/wanx-provider.js";
import { buildCanvasTools } from "../adapters/tools.js";
import { GENERATION_PROVIDERS, } from "../settings.js";
export { Config, GENERATION_PROVIDERS, SETTINGS_NAMESPACE, } from "../settings.js";
/** Services required for basic plugin initialization. */
export const inject = ["tools", "systemPrompt"];
export { BOARD_FILE_NAME, CANVAS_API_ROUTE } from "../domain/route.js";
/** System prompt section identity. */
export const CANVAS_SYSTEM_PROMPT_NAME = "tool:canvas";
/** Fallback system prompt order. */
export const CANVAS_SYSTEM_PROMPT_ORDER = 2800;
/** Guidance text injected into the system prompt for AI agents. */
export const CANVAS_GUIDANCE = `DSH Cult Canvas active: the user's whiteboard lives in the Cult Canvas tab of the right sidebar.
- Read before writing: canvas_get_state returns the board; canvas_query_elements filters it by kind or area.
- Edit surgically: canvas_create_element, canvas_update_element, canvas_delete_element, canvas_connect and canvas_layout_elements change single elements. Never rewrite the board wholesale.
- Edits appear live in the user's open tab and are marked "agent" until the user touches the same element, so keep changes small and name the element you changed.
- The board is one JSON Canvas 1.0 file per project at <workspace>/cult-canvas.canvas and is saved automatically.
- A session started from the board's "Start project" button arrives with a brief built from the board; treat it as the task description.
- Media pipeline: canvas_run_pipeline executes nodes, canvas_node_status reports progress, canvas_get_bible/canvas_update_bible hold characters, scenes and style anchors.`;
/** Safe defaults matching cordis.patch.yml. */
export const DEFAULT_CONFIG = Object.freeze({
    defaultCanvasWidth: 8192,
    defaultCanvasHeight: 8192,
    maxElements: 5000,
    snapToGrid: true,
    gridSize: 20,
    generationProvider: "mock",
    generationApiKey: "",
    generationBaseUrl: "",
});
/** Longest accepted API key or base URL. */
const MAX_CREDENTIAL_LENGTH = 512;
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
 *
 * shortcut: these clamps duplicate the Schemastery `Config` ranges, revalidate
 * once settings writes are the only source of configuration.
 */
export function resolveCanvasConfig(raw) {
    const input = isPlainObject(raw) ? raw : {};
    const provider = input["generationProvider"];
    const apiKey = input["generationApiKey"];
    const baseUrl = input["generationBaseUrl"];
    return {
        defaultCanvasWidth: clampInt(input["defaultCanvasWidth"], 100, 100_000, DEFAULT_CONFIG.defaultCanvasWidth),
        defaultCanvasHeight: clampInt(input["defaultCanvasHeight"], 100, 100_000, DEFAULT_CONFIG.defaultCanvasHeight),
        maxElements: clampInt(input["maxElements"], 1, 50_000, DEFAULT_CONFIG.maxElements),
        snapToGrid: typeof input["snapToGrid"] === "boolean"
            ? input["snapToGrid"]
            : DEFAULT_CONFIG.snapToGrid,
        gridSize: clampInt(input["gridSize"], 1, 500, DEFAULT_CONFIG.gridSize),
        generationProvider: GENERATION_PROVIDERS.includes(provider)
            ? provider
            : DEFAULT_CONFIG.generationProvider,
        generationApiKey: typeof apiKey === "string"
            ? apiKey.slice(0, MAX_CREDENTIAL_LENGTH)
            : DEFAULT_CONFIG.generationApiKey,
        generationBaseUrl: typeof baseUrl === "string"
            ? baseUrl.slice(0, MAX_CREDENTIAL_LENGTH)
            : DEFAULT_CONFIG.generationBaseUrl,
    };
}
/** Build the media generation backend the configuration names. */
function createGenerationProvider(config) {
    const credentials = {
        apiKey: config.generationApiKey,
        baseUrl: config.generationBaseUrl || undefined,
    };
    if (config.generationProvider === "openai") {
        return new OpenAIProvider(credentials);
    }
    if (config.generationProvider === "wanx") {
        return new WanxProvider(credentials);
    }
    return new MockGenerationProvider();
}
/** Parse the route's query parameters; malformed input yields an empty query. */
export function parseCanvasQuery(rawUrl) {
    let url;
    try {
        url = new URL(rawUrl, "http://127.0.0.1");
    }
    catch {
        return {};
    }
    // A missing parameter is not a zero: `Number(null)` would make every poll
    // look like "I am current" and starve the board of its own elements.
    const rawSince = url.searchParams.get("since");
    const since = rawSince === null ? Number.NaN : Number(rawSince);
    return {
        session: url.searchParams.get("session") ?? undefined,
        workspace: url.searchParams.get("workspace") ?? undefined,
        since: Number.isInteger(since) && since >= 0 ? since : undefined,
    };
}
/**
 * Answer `GET /state` for one board.
 * @param registry - per-workspace board registry.
 * @param query - resolved route query.
 * @returns the board, or the revision alone when the client is current.
 */
export async function readCanvasState(registry, query) {
    const record = registry.record(query.session, query.workspace);
    await record.ready;
    const revision = record.store.revision();
    if (query.since !== undefined && query.since === revision)
        return { revision };
    return {
        revision,
        elements: record.store.getAllElements(),
        edges: record.store.getAllEdges(),
        bible: record.store.getBible(),
    };
}
/** Path of the request without its trailing slashes. */
function requestPath(rawUrl) {
    try {
        return new URL(rawUrl, "http://127.0.0.1").pathname.replace(/\/+$/, "");
    }
    catch {
        return rawUrl.replace(/\/+$/, "");
    }
}
/**
 * Answer one canvas protocol request, whatever carries it.
 *
 * The DSH WebServer hands prefix routes either a Node handler or a Fetch
 * resource; only the Node handler sees a request body, and the server answers
 * 405 for a non-GET resource. The protocol therefore lives here, once, and
 * {@link handleCanvasHttp} is its Node adapter.
 *
 * @param registry - per-workspace board registry.
 * @param request - method, target and body of the request.
 * @returns the status and JSON body to send.
 */
export async function respondCanvasRequest(registry, request) {
    const rawUrl = request.url;
    const pathname = requestPath(rawUrl);
    const query = parseCanvasQuery(rawUrl);
    const method = (request.method ?? "GET").toUpperCase();
    if (pathname.endsWith("/state")) {
        if (method === "GET" || method === "HEAD") {
            return { status: 200, body: await readCanvasState(registry, query) };
        }
        if (method !== "POST")
            return { status: 405, body: "Method Not Allowed" };
        const payload = parseUserPayload(request.body ?? "");
        if (payload === undefined)
            return { status: 400, body: "Invalid canvas snapshot" };
        const record = registry.record(query.session, query.workspace);
        await record.ready;
        applyUserSnapshot(record.store, payload);
        return { status: 200, body: { revision: record.store.revision() } };
    }
    if (pathname.endsWith("/flush")) {
        const record = registry.record(query.session, query.workspace);
        await record.ready;
        await record.flush();
        return { status: 200, body: { ok: true, workspace: record.workspace } };
    }
    return { status: 404, body: "Not Found" };
}
/**
 * Node adapter of the canvas protocol.
 *
 * Registered WITHOUT a Fetch `resource`: the server answers 405 to a non-GET
 * resource before any plugin code runs, and the Client must post its edits.
 */
export async function handleCanvasHttp(registry, req, res) {
    const method = (req.method ?? "GET").toUpperCase();
    const body = method === "GET" || method === "HEAD" ? undefined : await readBody(req);
    const reply = await respondCanvasRequest(registry, {
        method,
        url: req.url || "",
        body,
    });
    const payload = typeof reply.body === "string" ? reply.body : JSON.stringify(reply.body);
    res.writeHead(reply.status, {
        "content-type": typeof reply.body === "string"
            ? "text/plain; charset=utf-8"
            : "application/json; charset=utf-8",
    });
    res.end(payload);
}
/** Collect a request body, capped so a malformed caller cannot grow unbounded. */
async function readBody(req) {
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        size += buffer.length;
        if (size > 8 * 1024 * 1024)
            throw new Error("canvas snapshot too large");
        chunks.push(buffer);
    }
    return Buffer.concat(chunks).toString("utf8");
}
/** Parse a posted user snapshot, or undefined when it is not one. */
function parseUserPayload(body) {
    let parsed;
    try {
        parsed = JSON.parse(body);
    }
    catch {
        return undefined;
    }
    if (!isPlainObject(parsed))
        return undefined;
    if (!Array.isArray(parsed["elements"]))
        return undefined;
    const clientTime = parsed["clientTime"];
    return {
        clientTime: typeof clientTime === "number" && Number.isFinite(clientTime)
            ? clientTime
            : Date.now(),
        elements: parsed["elements"],
        edges: Array.isArray(parsed["edges"])
            ? parsed["edges"]
            : undefined,
        removeIds: Array.isArray(parsed["removeIds"])
            ? parsed["removeIds"]
            : undefined,
    };
}
/**
 * Apply the dsh-cult-canvas plugin surface to a Cordis HostContext.
 *
 * @param ctx - Host plugin context.
 * @param rawConfig - configuration as composed in cordis.patch.yml.
 * @returns the per-workspace board registry the plugin serves from.
 */
export function apply(ctx, rawConfig = {}) {
    const config = resolveCanvasConfig(rawConfig);
    // 1. Core engine instances and the per-workspace board registry
    const graphEngine = new GraphEngine();
    const pipelineEngine = new PipelineEngine();
    const provider = createGenerationProvider(config);
    // The working-directory projection answers for a live Session object; a bare
    // id may be an archived or not-yet-published session, and a throw there must
    // not fail the request.
    const workspaceOf = (session) => {
        if (!session)
            return undefined;
        try {
            return ctx.get("workingDirectory")?.get(session);
        }
        catch {
            return undefined;
        }
    };
    const registry = new BoardRegistry({
        resolveWorkspace: (session) => workspaceOf(session === undefined ? undefined : { id: session }),
        maxElements: config.maxElements,
        warn: (message) => ctx.logger?.warn?.(message),
    });
    // 2. Disposer for state cleanup on plugin unload
    ctx.effect(() => () => registry.dispose());
    // 3. Register AI agent tools against the session's own board
    // The agent's own Session object resolves its folder even when the browser
    // only knows the id, so the first agent edit is what puts the board on disk.
    const tools = buildCanvasTools(ctx, (exec) => registry.record(exec?.agent?.session?.id, workspaceOf(exec?.agent?.session)).store, { graphEngine, pipelineEngine, config, provider });
    for (const tool of tools) {
        ctx.effect(() => ctx.tools.register(tool));
    }
    // 4. The plugin draws its own settings card, so no generated page is wanted
    ctx.inject(["settings"], (settingsCtx) => {
        settingsCtx.effect(() => settingsCtx.settings?.configure({ auto: false }, ctx.fiber) ??
            (() => { }), "cult-canvas: settings presentation");
    });
    // 5. Dynamic injection of authenticated webServer route
    ctx.inject(["webServer"], (routeCtx) => {
        const webServer = authenticatedWebServer(routeCtx, routeCtx.webServer);
        if (!webServer)
            return;
        routeCtx.effect(() => webServer.register({
            kind: "prefix",
            path: CANVAS_API_ROUTE,
            handler: (req, res) => {
                void handleCanvasHttp(registry, req, res).catch((error) => {
                    ctx.logger?.warn?.(`cult-canvas: ${req.method} ${req.url} failed: ${String(error)}`);
                    if (res.headersSent) {
                        res.destroy();
                        return;
                    }
                    res.writeHead(500, { "content-type": "text/plain" });
                    res.end("Internal Error");
                });
            },
        }), "cult-canvas: web route");
    });
    // 6. System prompt guidance section
    const order = typeof ctx.systemPrompt?.getSectionOrder === "function"
        ? (ctx.systemPrompt.getSectionOrder("TOOL_CANVAS") ??
            CANVAS_SYSTEM_PROMPT_ORDER)
        : CANVAS_SYSTEM_PROMPT_ORDER;
    ctx.effect(() => ctx.systemPrompt.section({
        name: CANVAS_SYSTEM_PROMPT_NAME,
        order,
        text: CANVAS_GUIDANCE,
    }));
    return registry;
}
export const applyCanvasPlugin = apply;
export default apply;
