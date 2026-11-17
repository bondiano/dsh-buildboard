import { homedir } from "node:os";
import { join } from "node:path";
import { buildBuildboardTools } from "../adapters/tools/index.js";
import { BoardRegistry } from "../application/board-document.js";
import { buildCanvasBrief, DEFAULT_CANVAS_REQUEST, } from "../application/canvas-brief.js";
import { CardLibrary } from "../application/card-library.js";
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
- Edit surgically with board_create_shape, board_update_shape, board_delete_shape, board_connect, board_layout, card_write.
- Edits appear live and are marked "agent" until the user touches the same shape.
- Project data: <workspace>/.buildboard/; global cards: $DSH_HOME/buildboard/.
- /canvas builds a board about the current session; Research/Implement start runs — call run_report when done.
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
    const workspaceOf = (session) => {
        if (!session)
            return undefined;
        try {
            const wd = ctx.get?.("workingDirectory");
            return wd?.get?.(session);
        }
        catch {
            return undefined;
        }
    };
    const services = {
        boards,
        cards,
        runs,
        resolveWorkspace: (session) => workspaceOf(session === undefined ? undefined : { id: session }),
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
        resolveWorkspace: (exec) => workspaceOf(exec?.agent?.session),
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
                const sessionId = invocation.agent.session?.id;
                const workspace = workspaceOf(sessionId ? { id: sessionId } : undefined);
                await boards.attachWorkspace(workspace);
                cards.setWorkspace(workspace);
                await cards.ensureReady();
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
export default apply;
