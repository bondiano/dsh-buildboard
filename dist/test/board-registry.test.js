/**
 * Per-project board storage: load, autosave, refusal and failure handling.
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import { BOARD_FILE_NAME, BoardRegistry, } from "../src/application/board-registry.js";
const workspaces = [];
async function workspace() {
    const dir = await mkdtemp(join(tmpdir(), "cult-canvas-registry-"));
    workspaces.push(dir);
    return dir;
}
after(async () => {
    await Promise.all(workspaces.map((dir) => rm(dir, { recursive: true, force: true })));
});
describe("board-registry", () => {
    it("loads an existing board file into the store", async () => {
        const dir = await workspace();
        await writeFile(join(dir, BOARD_FILE_NAME), JSON.stringify({
            nodes: [
                {
                    id: "n1",
                    type: "text",
                    x: 12,
                    y: 34,
                    width: 200,
                    height: 200,
                    text: "hello",
                    styleAttributes: {
                        gbKind: "sticky",
                        gbUpdatedBy: "agent",
                        gbUpdatedAt: 42,
                    },
                },
            ],
            edges: [],
        }), "utf8");
        const registry = new BoardRegistry({ resolveWorkspace: () => dir });
        const record = registry.record("s1");
        await record.ready;
        const loaded = record.store.getElementById("n1");
        assert.equal(loaded?.text, "hello");
        assert.equal(loaded?.updatedBy, "agent");
        assert.equal(loaded?.updatedAt, 42);
        registry.dispose();
    });
    it("starts empty when the workspace has no board yet", async () => {
        const dir = await workspace();
        const registry = new BoardRegistry({ resolveWorkspace: () => dir });
        const record = registry.record("s1");
        await record.ready;
        assert.equal(record.store.getAllElements().length, 0);
        assert.equal(record.workspace, dir);
        registry.dispose();
    });
    it("warns and starts empty on an unreadable board file", async () => {
        const dir = await workspace();
        await writeFile(join(dir, BOARD_FILE_NAME), "{ not json", "utf8");
        const warnings = [];
        const registry = new BoardRegistry({
            resolveWorkspace: () => dir,
            warn: (message) => warnings.push(message),
        });
        const record = registry.record("s1");
        await record.ready;
        assert.equal(record.store.getAllElements().length, 0);
        assert.equal(warnings.length, 1);
        assert.match(warnings[0], /invalid board/);
        registry.dispose();
    });
    it("writes a valid JSON Canvas document on flush", async () => {
        const dir = await workspace();
        const registry = new BoardRegistry({ resolveWorkspace: () => dir });
        const record = registry.record("s1");
        await record.ready;
        record.store.createElement({
            id: "n1",
            kind: "sticky",
            x: 1,
            y: 2,
            width: 200,
            height: 200,
            text: "saved",
        });
        await record.flush();
        const written = JSON.parse(await readFile(join(dir, BOARD_FILE_NAME), "utf8"));
        assert.equal(written.nodes.length, 1);
        assert.equal(written.nodes[0].id, "n1");
        assert.equal(written.nodes[0].text, "saved");
        assert.deepEqual(written.edges, []);
        registry.dispose();
    });
    it("refuses element creation past maxElements", async () => {
        const dir = await workspace();
        const registry = new BoardRegistry({
            resolveWorkspace: () => dir,
            maxElements: 1,
        });
        const record = registry.record("s1");
        await record.ready;
        record.store.createElement({
            id: "n1",
            kind: "sticky",
            x: 0,
            y: 0,
            width: 200,
            height: 200,
            text: "first",
        });
        assert.throws(() => record.store.createElement({
            id: "n2",
            kind: "sticky",
            x: 0,
            y: 0,
            width: 200,
            height: 200,
            text: "second",
        }), /Max canvas elements limit reached/);
        registry.dispose();
    });
    it("keys one board per session and attaches the workspace when it becomes known", async () => {
        const dir = await workspace();
        let resolved;
        const registry = new BoardRegistry({
            resolveWorkspace: () => resolved,
        });
        // The browser tab asks first and the Host does not know the folder yet.
        const first = registry.record("session-1");
        await first.ready;
        first.store.createElement({
            id: "n1",
            kind: "sticky",
            x: 0,
            y: 0,
            width: 200,
            height: 200,
            text: "drawn before the Host knew",
        });
        assert.equal(first.workspace, undefined);
        // The agent of that session resolves the folder: same store, now a file.
        resolved = dir;
        const second = registry.record("session-1");
        assert.equal(second.store, first.store);
        assert.equal(second.workspace, dir);
        await second.ready;
        await second.flush();
        const written = JSON.parse(await readFile(join(dir, BOARD_FILE_NAME), "utf8"));
        assert.deepEqual(written.nodes.map((node) => node.id), ["n1"]);
        registry.dispose();
    });
    it("keeps one board per session and a shared board without one", async () => {
        const first = await workspace();
        const second = await workspace();
        const registry = new BoardRegistry({
            resolveWorkspace: (session) => session === "a" ? first : session === "b" ? second : undefined,
        });
        const a = registry.record("a");
        const b = registry.record("b");
        const shared = registry.record(undefined);
        assert.notEqual(a.store, b.store);
        assert.notEqual(a.store, shared.store);
        assert.equal(registry.record("a").store, a.store);
        assert.equal(shared.workspace, undefined);
        assert.equal(a.workspace, first);
        assert.equal(b.workspace, second);
        registry.dispose();
    });
});
