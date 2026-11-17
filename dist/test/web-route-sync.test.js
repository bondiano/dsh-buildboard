/**
 * The live board protocol: GET with `since`, POST merge, session resolution.
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { BoardRegistry } from "../src/application/board-registry.js";
import { CANVAS_API_ROUTE, parseCanvasQuery, readCanvasState, respondCanvasRequest, } from "../src/presentation/index.js";
function registryFor(sessions) {
    return new BoardRegistry({
        resolveWorkspace: (session) => session === undefined ? undefined : sessions[session],
    });
}
const STATE_URL = `${CANVAS_API_ROUTE}/state`;
const FLUSH_URL = `${CANVAS_API_ROUTE}/flush`;
describe("web route: canvas board protocol", () => {
    it("parses session, workspace and since out of the query", () => {
        assert.deepEqual(parseCanvasQuery(`${CANVAS_API_ROUTE}/state?session=s1&workspace=/tmp/w&since=7`), { session: "s1", workspace: "/tmp/w", since: 7 });
        assert.deepEqual(parseCanvasQuery(`${CANVAS_API_ROUTE}/state?since=oops`), {
            session: undefined,
            workspace: undefined,
            since: undefined,
        });
        assert.deepEqual(parseCanvasQuery(`${CANVAS_API_ROUTE}/state?session=s1`), { session: "s1", workspace: undefined, since: undefined }, "an absent since must not read as revision zero");
    });
    it("answers a current client with the revision alone", async () => {
        const registry = registryFor({});
        const first = (await readCanvasState(registry, {}));
        assert.equal(typeof first.revision, "number");
        const second = await readCanvasState(registry, { since: first.revision });
        assert.deepEqual(second, { revision: first.revision });
        registry.dispose();
    });
    it("merges a posted snapshot and moves the revision on", async () => {
        const registry = registryFor({});
        const before = (await readCanvasState(registry, {}));
        const reply = await respondCanvasRequest(registry, {
            method: "POST",
            url: STATE_URL,
            body: JSON.stringify({
                clientTime: 5_000,
                elements: [
                    {
                        id: "n1",
                        kind: "sticky",
                        x: 0,
                        y: 0,
                        width: 200,
                        height: 200,
                        text: "hi",
                    },
                ],
            }),
        });
        assert.equal(reply.status, 200);
        const after = (await readCanvasState(registry, {
            since: before.revision,
        }));
        assert.ok(after.revision > before.revision);
        assert.equal(after.elements.length, 1);
        assert.equal(after.elements[0].updatedBy, "user");
        registry.dispose();
    });
    it("refuses a posted body that is not a snapshot", async () => {
        const registry = registryFor({});
        const reply = await respondCanvasRequest(registry, {
            method: "POST",
            url: STATE_URL,
            body: JSON.stringify({ nope: 1 }),
        });
        assert.equal(reply.status, 400);
        registry.dispose();
    });
    it("resolves the board from the session's workspace", async () => {
        const registry = registryFor({ alpha: "/tmp/cult-canvas-alpha" });
        const state = (await readCanvasState(registry, { session: "alpha" }));
        assert.deepEqual(state.elements, []);
        assert.equal(registry.record("alpha").workspace, "/tmp/cult-canvas-alpha");
        assert.equal(registry.record(undefined).workspace, undefined);
        registry.dispose();
    });
    it("flushes the session's board to disk and names the workspace", async () => {
        const dir = await mkdtemp(join(tmpdir(), "cult-canvas-route-"));
        const registry = registryFor({ alpha: dir });
        const record = registry.record("alpha");
        await record.ready;
        record.store.createElement({
            id: "n1",
            kind: "sticky",
            x: 0,
            y: 0,
            width: 200,
            height: 200,
            text: "flush me",
        });
        const reply = await respondCanvasRequest(registry, {
            method: "POST",
            url: `${FLUSH_URL}?session=alpha`,
        });
        const body = reply.body;
        assert.equal(body.ok, true);
        assert.equal(body.workspace, dir);
        const written = JSON.parse(await readFile(join(dir, "cult-canvas.canvas"), "utf8"));
        assert.equal(written.nodes.length, 1);
        registry.dispose();
        await rm(dir, { recursive: true, force: true });
    });
});
