import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { BoardRegistry } from "../../src/application/board-document.js";
import { CardLibrary } from "../../src/application/card-library.js";
import { RunService } from "../../src/application/run-service.js";
import { WORKSPACE_REQUIRED, WORKSPACE_REQUIRED_HINT, WORKSPACE_REQUIRED_MESSAGE, } from "../../src/domain/route.js";
import { respondBuildboard } from "../../src/host/routes.js";
test("board create without workspace throws stable message", async () => {
    const boards = new BoardRegistry();
    await assert.rejects(() => boards.create({ title: "Main", slug: "main" }), (error) => error instanceof Error && error.message === WORKSPACE_REQUIRED_MESSAGE);
});
test("/state without workspace returns workspace_required proposal", async () => {
    const root = await mkdtemp(join(tmpdir(), "bb-ws-"));
    try {
        const boards = new BoardRegistry();
        const cards = new CardLibrary({ dshHome: root });
        const runs = new RunService(cards);
        const reply = await respondBuildboard({
            boards,
            cards,
            runs,
            resolveWorkspace: () => undefined,
            ensureSessionWorkspace: async () => {
                throw new Error("ensure should not run for GET /state");
            },
        }, { method: "GET", url: "/plugin-api/buildboard/state?board=main" });
        assert.equal(reply.status, 409);
        assert.deepEqual(reply.body, {
            error: WORKSPACE_REQUIRED,
            message: WORKSPACE_REQUIRED_HINT,
        });
    }
    finally {
        await rm(root, { recursive: true, force: true });
    }
});
test("/workspace/ensure creates scratch board", async () => {
    const root = await mkdtemp(join(tmpdir(), "bb-ensure-"));
    try {
        const boards = new BoardRegistry();
        const cards = new CardLibrary({ dshHome: root });
        const runs = new RunService(cards);
        const scratch = join(root, "scratch-session");
        const reply = await respondBuildboard({
            boards,
            cards,
            runs,
            resolveWorkspace: () => undefined,
            ensureSessionWorkspace: async () => scratch,
        }, {
            method: "POST",
            url: "/plugin-api/buildboard/workspace/ensure?session=abc",
        });
        assert.equal(reply.status, 200);
        const body = reply.body;
        assert.equal(body.workspace, scratch);
        assert.ok(body.boards.some((board) => board.slug === "main"));
    }
    finally {
        await rm(root, { recursive: true, force: true });
    }
});
