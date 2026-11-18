import { projectAssetsDir } from "../../application/paths.js";
import { applyPrettifyPlacements, prettifyBoardRecords, } from "../../domain/board-prettify.js";
import { validateBoardRecords } from "../../domain/board-validate.js";
import { createId, parseCardRef } from "../../domain/ids.js";
import { IMAGE_SETUP_HINT, buildImageShapeRecords, generateOpenAIImage, normalizeImageModel, resolveImageAuth, writeGeneratedAsset, } from "../openai-images.js";
function textOutput() {
    return {
        schema: { type: "object", additionalProperties: true },
        render(_args, value) {
            return [{ type: "text", text: JSON.stringify(value, null, 2) }];
        },
    };
}
/** Register board / card / run tools on the host. */
export function buildBuildboardTools(_ctx, services) {
    const boardOf = async (exec, board) => {
        const workspace = services.resolveWorkspace(exec);
        await services.boards.attachWorkspace(workspace);
        services.cards.setWorkspace(workspace);
        await services.cards.ensureReady();
        const sessionId = exec?.agent?.session?.id;
        if (sessionId)
            services.runs.bindSession(sessionId);
        const id = board ?? "main";
        let doc = services.boards.get(id);
        if (!doc && id === "main") {
            doc = await services.boards.create({ title: "Main", slug: "main" });
        }
        if (!doc)
            throw new Error(`board not found: ${id}`);
        return doc;
    };
    return [
        {
            name: "board_get_state",
            description: "Read a buildboard: title, revision and records.",
            parameters: {
                type: "object",
                properties: {
                    board: {
                        type: "string",
                        description: "Board id or slug (default main)",
                    },
                },
            },
            output: textOutput(),
            async execute(args, exec) {
                const board = String(args.board ?? "main");
                const doc = await boardOf(exec, board);
                return services.boards.snapshot(doc.id);
            },
        },
        {
            name: "board_query",
            description: "Filter board records by typeName or shape type.",
            parameters: {
                type: "object",
                properties: {
                    board: { type: "string" },
                    typeName: { type: "string" },
                    type: { type: "string" },
                },
            },
            output: textOutput(),
            async execute(args, exec) {
                const a = args;
                const doc = await boardOf(exec, a.board);
                const records = Object.values(doc.records).filter((record) => {
                    if (a.typeName && record.typeName !== a.typeName)
                        return false;
                    if (a.type && record["type"] !== a.type)
                        return false;
                    return true;
                });
                return { board: doc.slug, count: records.length, records };
            },
        },
        {
            name: "board_create_shape",
            description: "Create a shape record on the board (card, note, text, frame, arrow, …).",
            parameters: {
                type: "object",
                required: ["type"],
                properties: {
                    board: { type: "string" },
                    type: { type: "string" },
                    x: { type: "number" },
                    y: { type: "number" },
                    props: { type: "object" },
                    id: { type: "string" },
                },
            },
            output: textOutput(),
            async execute(args, exec) {
                const a = args;
                const doc = await boardOf(exec, a.board);
                const id = a.id ?? `shape:${createId()}`;
                const record = {
                    id,
                    typeName: "shape",
                    type: a.type,
                    x: a.x ?? 0,
                    y: a.y ?? 0,
                    rotation: 0,
                    opacity: 1,
                    isLocked: false,
                    props: a.props ?? {},
                    parentId: "page:page",
                    index: "a1",
                    meta: {},
                };
                const snap = services.boards.applyDiff(doc.id, {
                    put: [record],
                    actor: "agent",
                    clientTime: Date.now(),
                });
                return { id, revision: snap.revision };
            },
        },
        {
            name: "board_update_shape",
            description: "Patch an existing shape record.",
            parameters: {
                type: "object",
                required: ["id"],
                properties: {
                    board: { type: "string" },
                    id: { type: "string" },
                    patch: { type: "object" },
                },
            },
            output: textOutput(),
            async execute(args, exec) {
                const a = args;
                const doc = await boardOf(exec, a.board);
                const prev = doc.records[a.id];
                if (!prev)
                    throw new Error(`shape not found: ${a.id}`);
                const next = { ...prev, id: a.id };
                if (a.patch && typeof a.patch === "object") {
                    Object.assign(next, a.patch, { id: a.id });
                }
                const snap = services.boards.applyDiff(doc.id, {
                    put: [next],
                    actor: "agent",
                    clientTime: Date.now(),
                });
                return { id: a.id, revision: snap.revision };
            },
        },
        {
            name: "board_delete_shape",
            description: "Delete shapes by id.",
            parameters: {
                type: "object",
                required: ["ids"],
                properties: {
                    board: { type: "string" },
                    ids: { type: "array", items: { type: "string" } },
                },
            },
            output: textOutput(),
            async execute(args, exec) {
                const a = args;
                const doc = await boardOf(exec, a.board);
                const snap = services.boards.applyDiff(doc.id, {
                    remove: a.ids,
                    actor: "agent",
                    clientTime: Date.now(),
                });
                return { removed: a.ids, revision: snap.revision };
            },
        },
        {
            name: "board_connect",
            description: "Create an arrow between two shapes.",
            parameters: {
                type: "object",
                required: ["from", "to"],
                properties: {
                    board: { type: "string" },
                    from: { type: "string" },
                    to: { type: "string" },
                    label: { type: "string" },
                },
            },
            output: textOutput(),
            async execute(args, exec) {
                const a = args;
                const doc = await boardOf(exec, a.board);
                const id = `shape:${createId("arrow")}`;
                const record = {
                    id,
                    typeName: "shape",
                    type: "arrow",
                    x: 0,
                    y: 0,
                    rotation: 0,
                    opacity: 1,
                    isLocked: false,
                    props: {
                        start: {
                            type: "binding",
                            boundShapeId: a.from,
                            normalizedAnchor: { x: 0.5, y: 0.5 },
                            isExact: false,
                        },
                        end: {
                            type: "binding",
                            boundShapeId: a.to,
                            normalizedAnchor: { x: 0.5, y: 0.5 },
                            isExact: false,
                        },
                        text: a.label ?? "",
                    },
                    parentId: "page:page",
                    index: "a1",
                    meta: {},
                };
                const snap = services.boards.applyDiff(doc.id, {
                    put: [record],
                    actor: "agent",
                    clientTime: Date.now(),
                });
                return { id, revision: snap.revision };
            },
        },
        {
            name: "board_layout",
            description: 'Layout shapes: mode "prettify" (Sugiyama flow by arrows, default) or "grid". Omit ids to prettify the whole board.',
            parameters: {
                type: "object",
                properties: {
                    board: { type: "string" },
                    ids: { type: "array", items: { type: "string" } },
                    mode: {
                        type: "string",
                        enum: ["prettify", "grid"],
                        description: "prettify = flow layout (default); grid = simple columns",
                    },
                    columns: { type: "number" },
                    gap: { type: "number" },
                    direction: { type: "string", enum: ["LR", "TB"] },
                },
            },
            output: textOutput(),
            async execute(args, exec) {
                const a = args;
                const doc = await boardOf(exec, a.board);
                const mode = a.mode ?? "prettify";
                if (mode === "prettify") {
                    const result = prettifyBoardRecords(doc.records, {
                        onlyIds: a.ids && a.ids.length > 0 ? a.ids : undefined,
                        direction: a.direction ?? "LR",
                        rankGap: a.gap ?? 96,
                        nodeGap: a.gap ?? 48,
                    });
                    const put = applyPrettifyPlacements(doc.records, result);
                    const snap = services.boards.applyDiff(doc.id, {
                        put,
                        actor: "agent",
                        clientTime: Date.now(),
                    });
                    return {
                        mode,
                        laidOut: put.length,
                        revision: snap.revision,
                    };
                }
                const ids = a.ids ?? [];
                const columns = a.columns ?? 3;
                const gap = a.gap ?? 40;
                const put = ids.flatMap((id, index) => {
                    const prev = doc.records[id];
                    if (!prev)
                        return [];
                    const col = index % columns;
                    const row = Math.floor(index / columns);
                    return [
                        {
                            ...prev,
                            x: col * (280 + gap),
                            y: row * (180 + gap),
                        },
                    ];
                });
                const snap = services.boards.applyDiff(doc.id, {
                    put,
                    actor: "agent",
                    clientTime: Date.now(),
                });
                return { mode, laidOut: put.length, revision: snap.revision };
            },
        },
        {
            name: "board_validate",
            description: "Fast-check board records for tldraw ValidationError causes (rotation/opacity/isLocked, card props, unbound/orphan/non-touching arrows, WCAG contrast). Optionally repair base fields and run the /canvas architecture recipe checks.",
            parameters: {
                type: "object",
                properties: {
                    board: { type: "string" },
                    repair: {
                        type: "boolean",
                        description: "Normalize missing shape base/card fields and write them back",
                    },
                    recipe: {
                        type: "string",
                        enum: ["architecture", "none"],
                        description: "Extra completeness checks; use architecture after /canvas builds",
                    },
                    contrast: {
                        type: "boolean",
                        description: "Force WCAG AA contrast checks (default on for architecture recipe)",
                    },
                },
            },
            output: textOutput(),
            async execute(args, exec) {
                const a = args;
                const doc = await boardOf(exec, a.board);
                const result = validateBoardRecords(doc.records, {
                    repair: a.repair === true,
                    recipe: a.recipe ?? "none",
                    contrast: a.contrast,
                });
                let revision = doc.revision;
                if (a.repair === true && (result.repaired?.length ?? 0) > 0) {
                    const snap = services.boards.applyDiff(doc.id, {
                        put: result.repaired,
                        actor: "agent",
                        clientTime: Date.now(),
                    });
                    revision = snap.revision;
                    const again = validateBoardRecords(snap.records, {
                        recipe: a.recipe ?? "none",
                        contrast: a.contrast,
                    });
                    return {
                        board: doc.slug,
                        revision,
                        repairedCount: result.repaired?.length ?? 0,
                        ...again,
                    };
                }
                return {
                    board: doc.slug,
                    revision,
                    repairedCount: 0,
                    ...result,
                    repaired: undefined,
                };
            },
        },
        {
            name: "board_generate_image",
            description: "Generate an image with OpenAI Images 2.6 and place it on the board (and/or return a markdown URL for card bodies). Requires OPENAI_API_KEY or Buildboard openaiApiKey setting.",
            parameters: {
                type: "object",
                required: ["prompt"],
                properties: {
                    board: { type: "string" },
                    prompt: { type: "string" },
                    x: { type: "number" },
                    y: { type: "number" },
                    w: { type: "number" },
                    h: { type: "number" },
                    placeOnBoard: {
                        type: "boolean",
                        description: "Put a tldraw image shape on the board (default true)",
                    },
                    model: {
                        type: "string",
                        enum: ["gpt-image-2.6-sunburst", "gpt-image-2.6-flare"],
                    },
                },
            },
            output: textOutput(),
            async execute(args, exec) {
                const a = args;
                const doc = await boardOf(exec, a.board);
                const workspace = services.resolveWorkspace(exec);
                if (!workspace) {
                    throw new Error("board_generate_image requires a workspace");
                }
                const imageSettings = services.getImageSettings?.() ?? {
                    openaiApiKey: "",
                    openaiImageModel: normalizeImageModel(undefined),
                };
                const auth = resolveImageAuth({
                    settingsKey: imageSettings.openaiApiKey,
                    settingsModel: a.model ?? imageSettings.openaiImageModel,
                });
                if (!auth.apiKey) {
                    return {
                        ok: false,
                        error: "openai_api_key_missing",
                        setup: IMAGE_SETUP_HINT,
                        model: auth.model,
                    };
                }
                const generated = await generateOpenAIImage({
                    prompt: a.prompt,
                    apiKey: auth.apiKey,
                    model: auth.model,
                });
                const written = await writeGeneratedAsset({
                    bytes: generated.bytes,
                    assetsDir: projectAssetsDir(workspace),
                });
                const w = typeof a.w === "number" ? a.w : 512;
                const h = typeof a.h === "number" ? a.h : 512;
                const placeOnBoard = a.placeOnBoard !== false;
                let revision = doc.revision;
                let shapeId;
                let assetId;
                if (placeOnBoard) {
                    assetId = `asset:${written.id}`;
                    shapeId = `shape:${written.id}`;
                    const records = buildImageShapeRecords({
                        assetId,
                        shapeId,
                        src: written.apiPath,
                        w,
                        h,
                        x: a.x ?? 0,
                        y: a.y ?? 0,
                        name: `${written.id}.png`,
                    });
                    const snap = services.boards.applyDiff(doc.id, {
                        put: Object.values(records),
                        actor: "agent",
                        clientTime: Date.now(),
                    });
                    revision = snap.revision;
                }
                return {
                    ok: true,
                    board: doc.slug,
                    revision,
                    model: generated.model,
                    keySource: auth.source,
                    assetPath: written.absolutePath,
                    markdownUrl: written.markdownUrl,
                    markdown: `![${a.prompt.slice(0, 80)}](${written.markdownUrl})`,
                    shapeId,
                    assetId,
                };
            },
        },
        {
            name: "card_list",
            description: "List cards in project and/or global libraries.",
            parameters: {
                type: "object",
                properties: {
                    scope: { type: "string", enum: ["project", "global"] },
                    query: { type: "string" },
                    tag: { type: "string" },
                },
            },
            output: textOutput(),
            async execute(args, exec) {
                await boardOf(exec);
                const a = args;
                return { cards: services.cards.list(a) };
            },
        },
        {
            name: "card_read",
            description: "Read one card by scope:id or id in project scope.",
            parameters: {
                type: "object",
                required: ["ref"],
                properties: { ref: { type: "string" } },
            },
            output: textOutput(),
            async execute(args, exec) {
                await boardOf(exec);
                const ref = String(args.ref);
                const parsed = parseCardRef(ref) ?? {
                    scope: "project",
                    id: ref,
                };
                const card = services.cards.get(parsed.scope, parsed.id);
                if (!card)
                    throw new Error(`card not found: ${ref}`);
                return {
                    card,
                    backlinks: services.cards
                        .backlinksTo(card.id)
                        .concat(services.cards.backlinksTo(`${card.scope}:${card.id}`)),
                };
            },
        },
        {
            name: "card_write",
            description: "Create or update a markdown card.",
            parameters: {
                type: "object",
                required: ["title"],
                properties: {
                    ref: { type: "string" },
                    scope: { type: "string", enum: ["project", "global"] },
                    title: { type: "string" },
                    body: { type: "string" },
                    kind: { type: "string", enum: ["note", "research", "task"] },
                    tags: { type: "array", items: { type: "string" } },
                },
            },
            output: textOutput(),
            async execute(args, exec) {
                await boardOf(exec);
                const a = args;
                const parsed = a.ref ? parseCardRef(a.ref) : undefined;
                const card = await services.cards.write({
                    id: parsed?.id,
                    scope: parsed?.scope ?? a.scope ?? "project",
                    title: a.title,
                    body: a.body,
                    kind: a.kind,
                    tags: a.tags,
                    updatedBy: "agent",
                });
                return { ref: `${card.scope}:${card.id}`, card };
            },
        },
        {
            name: "card_search",
            description: "Search cards by free text.",
            parameters: {
                type: "object",
                required: ["query"],
                properties: {
                    query: { type: "string" },
                    scope: { type: "string", enum: ["project", "global"] },
                },
            },
            output: textOutput(),
            async execute(args, exec) {
                await boardOf(exec);
                const a = args;
                return {
                    cards: services.cards.list({ query: a.query, scope: a.scope }),
                };
            },
        },
        {
            name: "run_report",
            description: "Report progress or completion of a board-started run.",
            parameters: {
                type: "object",
                required: ["runId", "ok", "summary"],
                properties: {
                    runId: { type: "string" },
                    ok: { type: "boolean" },
                    summary: { type: "string" },
                    error: { type: "string" },
                },
            },
            output: textOutput(),
            async execute(args) {
                const a = args;
                const run = await services.runs.report(a.runId, a);
                return { run, summary: a.summary };
            },
        },
    ];
}
