import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { buildBuildboardTools } from "../adapters/tools/index.js";
import { BoardRegistry } from "../application/board-document.js";
import { buildCanvasBrief, DEFAULT_CANVAS_REQUEST, } from "../application/canvas-brief.js";
import { CardLibrary } from "../application/card-library.js";
import { sessionScratchWorkspace, sessionWorkspaceMapPath, } from "../application/paths.js";
import { RunService } from "../application/run-service.js";
import { BUILDBOARD_API_ROUTE } from "../domain/route.js";
import { slugify } from "../domain/ids.js";
import { authenticatedWebServer } from "../infrastructure/web-route-auth.js";
import { Config, DEFAULT_SETTINGS, resolveSettings, SETTINGS_NAMESPACE, } from "../settings.js";
import { handleBuildboardHttp } from "./routes.js";
export { Config, SETTINGS_NAMESPACE, DEFAULT_SETTINGS, resolveSettings, };
export { BUILDBOARD_API_ROUTE };
export const inject = ["tools", "systemPrompt"];
export const BUILDBOARD_GUIDANCE = `DSH Buildboard is active: cards and boards live in the Buildboard tab (and the fullscreen Buildboard panel).
- Read first: board_get_state / board_query / card_list / card_read / card_search.
- Edit surgically with board_create_shape, board_update_shape, board_delete_shape, board_connect, board_layout, board_generate_image, card_write.
- Underlays: create frames first, then create cards with parentId = that frame id (x/y relative to the frame). Prettify / board_layout bind loose cards onto frames they sit on, then layout hierarchically — without parentId, grouping breaks.
- Arrows must bind both ends (use board_connect); unbound or non-touching arrows fail board_validate.
- Colors must meet WCAG AA (including card chrome). board_validate checks contrast on architecture recipe.
- Illustrate with board_generate_image (OpenAI Images 2.6); embed returned markdown in cards when useful. If openai_api_key_missing, tell the user to set OPENAI_API_KEY or Buildboard openaiApiKey.
- After building or repairing a board, call board_validate (recipe "architecture" for /canvas). Use repair true for missing rotation/opacity/isLocked/card props and loose underlay children.
- Edits appear live and are marked "agent" until the user touches the same shape.
- Project data: <workspace>/.buildboard/; global cards: $DSH_HOME/buildboard/.
- /canvas builds a board about the current session; Research/Implement start runs — call run_report when done.
- When finished, reply with a markdown link to \`.buildboard/boards/<slug>.board.json\` (relative path) so a click opens the Buildboard tab on the right — never HTTP and never a bare slug.
- Prefer cards + frames + labeled arrows over dumping long text into chat.`;
function resolveDshHome() {
    const fromEnv = process.env.DSH_HOME?.trim();
    if (fromEnv)
        return fromEnv;
    return join(homedir(), ".dsh");
}
function createUserMessage(text) {
    return {
        role: "user",
        content: [{ type: "text", text }],
        source: { kind: "user" },
    };
}
/** Apply the buildboard host plugin. */
export function apply(ctx, rawConfig = {}) {
    const config = resolveSettings(rawConfig);
    const dshHome = resolveDshHome();
    const boards = new BoardRegistry({
        maxBoards: config.maxBoards,
        warn: (message) => ctx.logger?.warn?.(message),
    });
    const cards = new CardLibrary({
        dshHome,
        maxCards: config.maxCards,
    });
    const runs = new RunService(cards);
    /** sessionId → last known project cwd (real WD wins over scratch). */
    const sessionWorkspaces = new Map();
    const mapPath = sessionWorkspaceMapPath(dshHome);
    if (existsSync(mapPath)) {
        try {
            const raw = JSON.parse(readFileSync(mapPath, "utf8"));
            if (raw && typeof raw === "object") {
                for (const [key, value] of Object.entries(raw)) {
                    if (typeof value === "string" && value.trim()) {
                        sessionWorkspaces.set(key, value);
                    }
                }
            }
        }
        catch {
            // corrupt map — start empty
        }
    }
    const persistSessionWorkspaceMap = () => {
        void mkdir(join(mapPath, ".."), { recursive: true })
            .then(() => writeFile(mapPath, `${JSON.stringify(Object.fromEntries(sessionWorkspaces), null, 2)}\n`, "utf8"))
            .catch(() => {
            // non-fatal
        });
    };
    const sessionIdOf = (session) => {
        if (typeof session === "object" &&
            session !== null &&
            "id" in session &&
            typeof session.id === "string") {
            return session.id.trim() || undefined;
        }
        if (typeof session === "string" && session.trim())
            return session.trim();
        return undefined;
    };
    const rememberWorkspace = (session, path) => {
        const id = sessionIdOf(session);
        if (!id || !path)
            return;
        const previous = sessionWorkspaces.get(id);
        sessionWorkspaces.set(id, path);
        if (previous !== path)
            persistSessionWorkspaceMap();
    };
    const cwdFromProjCache = (sessionId) => {
        const cachePath = join(dshHome, "storages", "session_projcache", "sessions", `${sessionId}.json`);
        if (!existsSync(cachePath))
            return undefined;
        try {
            const raw = JSON.parse(readFileSync(cachePath, "utf8"));
            const cwd = raw.record?.identity?.cwd;
            return typeof cwd === "string" && cwd.trim() ? cwd.trim() : undefined;
        }
        catch {
            return undefined;
        }
    };
    const workspaceOf = (session) => {
        const sessionId = sessionIdOf(session);
        if (session && typeof session === "object") {
            try {
                const wd = ctx.get?.("workingDirectory");
                const fromSession = wd?.get?.(session);
                if (fromSession) {
                    rememberWorkspace(session, fromSession);
                    return fromSession;
                }
            }
            catch {
                // workingDirectory may be unavailable in some profiles
            }
        }
        if (sessionId) {
            const cached = sessionWorkspaces.get(sessionId);
            if (cached)
                return cached;
            const fromProj = cwdFromProjCache(sessionId);
            if (fromProj) {
                rememberWorkspace(sessionId, fromProj);
                return fromProj;
            }
        }
        return sessionWorkspaces.get("local");
    };
    const ensureSessionWorkspace = async (session) => {
        const existing = workspaceOf(session ? { id: session } : undefined);
        if (existing)
            return existing;
        const key = session?.trim() || "local";
        const cached = sessionWorkspaces.get(key);
        if (cached)
            return cached;
        const path = sessionScratchWorkspace(dshHome, key);
        await mkdir(path, { recursive: true });
        sessionWorkspaces.set(key, path);
        return path;
    };
    const services = {
        boards,
        cards,
        runs,
        resolveWorkspace: (session) => workspaceOf(session === undefined ? undefined : { id: session }),
        ensureSessionWorkspace,
    };
    ctx.effect(() => () => boards.dispose());
    // Drive run.machine from live agent lifecycle events.
    if (typeof ctx.on === "function") {
        ctx.effect(() => {
            const offStatus = ctx.on("agent/status", (event) => {
                const payload = event;
                const sessionId = payload.agent?.session?.id;
                const status = payload.status;
                if (!sessionId || (status !== "idle" && status !== "running"))
                    return;
                void runs.onAgentStatus(sessionId, status).catch((error) => {
                    ctx.logger?.warn?.(`buildboard: agent/status handler failed: ${String(error)}`);
                });
            });
            const offCreated = ctx.on("agent/created", (event) => {
                const payload = event;
                const sessionId = payload.agent?.session?.id;
                if (sessionId)
                    runs.bindSession(sessionId);
            });
            return () => {
                offStatus?.();
                offCreated?.();
            };
        }, "buildboard: agent lifecycle");
    }
    const tools = buildBuildboardTools(ctx, {
        boards,
        cards,
        runs,
        resolveWorkspace: (exec) => {
            const session = exec?.agent?.session;
            const path = workspaceOf(session);
            rememberWorkspace(session, path);
            return path;
        },
        getImageSettings: () => ({
            openaiApiKey: config.openaiApiKey,
            openaiImageModel: config.openaiImageModel,
        }),
    });
    for (const tool of tools) {
        ctx.effect(() => ctx.tools.register(tool));
    }
    ctx.inject?.(["settings"], (settingsCtx) => {
        settingsCtx.effect(() => settingsCtx.settings?.configure({ auto: false }, ctx.fiber) ??
            (() => { }), "buildboard: settings presentation");
    });
    ctx.inject?.(["webServer"], (routeCtx) => {
        const webServer = authenticatedWebServer(routeCtx, routeCtx.webServer);
        if (!webServer)
            return;
        routeCtx.effect(() => webServer.register({
            kind: "prefix",
            path: BUILDBOARD_API_ROUTE,
            handler: (req, res) => {
                void handleBuildboardHttp(services, req, res).catch((error) => {
                    ctx.logger?.warn?.(`buildboard: ${req.method} ${req.url} failed: ${String(error)}`);
                    if (res.headersSent) {
                        res.destroy();
                        return;
                    }
                    res.writeHead(500, { "content-type": "text/plain" });
                    res.end("Internal Error");
                });
            },
        }), "buildboard: web route");
    });
    ctx.inject?.(["commands"], (cmdCtx) => {
        if (!cmdCtx.commands)
            return;
        cmdCtx.effect(() => cmdCtx.commands.register({
            name: "canvas",
            description: "Build a Buildboard about this session (default: explain architecture).",
            input: { hint: "<what to show>" },
            handler: async (invocation) => {
                const request = invocation.rawInput?.trim() || DEFAULT_CANVAS_REQUEST;
                const session = invocation.agent.session;
                const sessionId = session?.id;
                // Prefer the live session cwd (project). Fake {id} misses WD.
                let workspace = workspaceOf(session);
                if (!workspace) {
                    workspace = await ensureSessionWorkspace(sessionId);
                }
                else {
                    rememberWorkspace(session, workspace);
                }
                await boards.attachWorkspace(workspace);
                cards.setWorkspace(workspace);
                await cards.ensureReady();
                if (!boards.get("main")) {
                    await boards.create({ title: "Main", slug: "main" });
                }
                const slug = slugify(`session-${(sessionId ?? "local").slice(0, 8)}-${request}`, "session-board");
                const board = await boards.create({
                    title: request.slice(0, 80),
                    slug,
                    sessionId,
                });
                const brief = buildCanvasBrief({
                    request,
                    boardSlug: board.slug,
                    workspace,
                    sessionId,
                });
                const run = await runs.create({
                    kind: "canvas",
                    boardSlug: board.slug,
                    brief,
                    sessionId,
                });
                await runs.transition(run.id, "QUEUE");
                await runs.transition(run.id, "START");
                try {
                    invocation.agent.followup(createUserMessage(`${brief}\n\nRun id: ${run.id}. Open board slug: ${board.slug}.`));
                }
                catch (error) {
                    await runs.transition(run.id, "FAIL", {
                        error: String(error),
                    });
                    return {
                        kind: "error",
                        text: `Created board ${board.slug} but could not wake the agent: ${String(error)}`,
                    };
                }
                return {
                    kind: "success",
                    text: `Opened board "${board.slug}" and asked the agent to build it.`,
                };
            },
        }), "buildboard: /canvas");
    });
    const order = typeof ctx.systemPrompt.getSectionOrder === "function"
        ? (ctx.systemPrompt.getSectionOrder("TOOL_CANVAS") ?? 2800)
        : 2800;
    ctx.effect(() => ctx.systemPrompt.section({
        name: "tool:buildboard",
        order,
        text: BUILDBOARD_GUIDANCE,
    }));
    return { boards, cards, runs };
}
