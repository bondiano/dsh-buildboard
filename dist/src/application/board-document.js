import { mkdir, readdir, readFile, rename, writeFile } from "node:fs/promises";
import { basename } from "node:path";
import { importJsonCanvas } from "../adapters/legacy-json-canvas.js";
import { applyBoardDiff, normalizeBoardRecords, } from "../domain/board.js";
import { createId, slugify } from "../domain/ids.js";
import { LEGACY_CANVAS_FILE, WORKSPACE_REQUIRED_MESSAGE, } from "../domain/route.js";
import { projectBoardPath, projectBoardsDir } from "./paths.js";
/** In-memory + on-disk board registry for one workspace. */
export class BoardRegistry {
    #maxBoards;
    #warn;
    #workspace;
    #boards = new Map();
    #bySlug = new Map();
    #saveTimers = new Map();
    #legacyImported = false;
    constructor(options = {}) {
        this.#maxBoards = options.maxBoards ?? 200;
        this.#warn = options.warn;
    }
    get workspace() {
        return this.#workspace;
    }
    async attachWorkspace(workspace) {
        if (workspace === this.#workspace)
            return;
        await this.flushAll();
        this.#boards.clear();
        this.#bySlug.clear();
        this.#workspace = workspace;
        this.#legacyImported = false;
        if (!workspace)
            return;
        await mkdir(projectBoardsDir(workspace), { recursive: true });
        await this.#loadAll(workspace);
        await this.#maybeImportLegacy(workspace);
    }
    list() {
        return [...this.#boards.values()]
            .map((board) => ({
            id: board.id,
            slug: board.slug,
            title: board.title,
            updatedAt: board.updatedAt,
            revision: board.revision,
            sessionId: board.sessionId,
        }))
            .sort((a, b) => b.updatedAt - a.updatedAt);
    }
    get(idOrSlug) {
        return (this.#boards.get(idOrSlug) ??
            this.#boards.get(this.#bySlug.get(idOrSlug) ?? ""));
    }
    snapshot(idOrSlug) {
        const board = this.get(idOrSlug);
        if (!board)
            return undefined;
        return {
            id: board.id,
            slug: board.slug,
            title: board.title,
            revision: board.revision,
            records: { ...board.records },
            sessionId: board.sessionId,
        };
    }
    async create(input) {
        if (!this.#workspace)
            throw new Error(WORKSPACE_REQUIRED_MESSAGE);
        if (this.#boards.size >= this.#maxBoards)
            throw new Error("maxBoards limit reached");
        const now = Date.now();
        let slug = slugify(input.slug ?? input.title);
        if (this.#bySlug.has(slug))
            slug = `${slug}-${createId().slice(0, 4)}`;
        const board = {
            id: createId("board"),
            slug,
            title: input.title,
            records: normalizeBoardRecords(input.records ?? emptyPageRecords()),
            revision: 1,
            createdAt: now,
            updatedAt: now,
            sessionId: input.sessionId,
        };
        this.#boards.set(board.id, board);
        this.#bySlug.set(board.slug, board.id);
        await this.#persist(board);
        return board;
    }
    applyDiff(idOrSlug, diff) {
        const board = this.get(idOrSlug);
        if (!board)
            throw new Error(`board not found: ${idOrSlug}`);
        applyBoardDiff(board.records, diff);
        board.revision += 1;
        board.updatedAt = Date.now();
        this.#scheduleSave(board);
        return this.snapshot(board.id);
    }
    async flush(idOrSlug) {
        if (idOrSlug) {
            const board = this.get(idOrSlug);
            if (board)
                await this.#persist(board);
            return;
        }
        await this.flushAll();
    }
    async flushAll() {
        for (const timer of this.#saveTimers.values())
            clearTimeout(timer);
        this.#saveTimers.clear();
        await Promise.all([...this.#boards.values()].map((board) => this.#persist(board)));
    }
    dispose() {
        for (const timer of this.#saveTimers.values())
            clearTimeout(timer);
        this.#saveTimers.clear();
        this.#boards.clear();
        this.#bySlug.clear();
    }
    async #loadAll(workspace) {
        let names;
        try {
            names = await readdir(projectBoardsDir(workspace));
        }
        catch {
            return;
        }
        for (const name of names) {
            if (!name.endsWith(".board.json"))
                continue;
            try {
                const raw = await readFile(projectBoardPath(workspace, basename(name, ".board.json")), "utf8");
                const board = JSON.parse(raw);
                if (!board.id || !board.slug)
                    continue;
                board.records = normalizeBoardRecords(board.records ?? {});
                this.#boards.set(board.id, board);
                this.#bySlug.set(board.slug, board.id);
            }
            catch (error) {
                this.#warn?.(`buildboard: skip board ${name}: ${String(error)}`);
            }
        }
    }
    async #maybeImportLegacy(workspace) {
        if (this.#legacyImported || this.#bySlug.has("main"))
            return;
        const legacyPath = `${workspace}/${LEGACY_CANVAS_FILE}`;
        let raw;
        try {
            raw = await readFile(legacyPath, "utf8");
        }
        catch {
            return;
        }
        try {
            const records = importJsonCanvas(JSON.parse(raw));
            await this.create({ title: "Main", slug: "main", records });
            this.#legacyImported = true;
        }
        catch (error) {
            this.#warn?.(`buildboard: legacy import failed: ${String(error)}`);
        }
    }
    #scheduleSave(board) {
        const prev = this.#saveTimers.get(board.id);
        if (prev)
            clearTimeout(prev);
        this.#saveTimers.set(board.id, setTimeout(() => {
            this.#saveTimers.delete(board.id);
            void this.#persist(board).catch((error) => this.#warn?.(`buildboard: save failed: ${String(error)}`));
        }, 800));
    }
    async #persist(board) {
        if (!this.#workspace)
            return;
        const path = projectBoardPath(this.#workspace, board.slug);
        await mkdir(projectBoardsDir(this.#workspace), { recursive: true });
        const tmp = `${path}.${process.pid}.tmp`;
        await writeFile(tmp, `${JSON.stringify(board, null, "\t")}\n`, "utf8");
        await rename(tmp, path);
    }
}
function emptyPageRecords() {
    return {
        "page:page": {
            id: "page:page",
            typeName: "page",
            name: "Page 1",
            meta: {},
            index: "a1",
        },
    };
}
