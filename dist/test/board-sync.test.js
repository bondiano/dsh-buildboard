/**
 * Board merge rules: last-writer-wins between the browser and the agent.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyUserSnapshot, reconcileFromServer, } from "../src/application/board-sync.js";
import { CanvasStore } from "../src/application/canvas-store.js";
function sticky(id, text, updatedAt, updatedBy = "user") {
    return {
        id,
        kind: "sticky",
        x: 0,
        y: 0,
        width: 200,
        height: 200,
        text,
        updatedBy,
        updatedAt,
    };
}
describe("board-sync: applyUserSnapshot", () => {
    it("creates an unknown element as a user write stamped with the client clock", () => {
        const store = new CanvasStore();
        const result = applyUserSnapshot(store, {
            clientTime: 1_000,
            elements: [
                {
                    id: "a",
                    kind: "sticky",
                    x: 10,
                    y: 20,
                    width: 200,
                    height: 200,
                    text: "",
                },
            ],
        });
        assert.equal(result.created, 1);
        const created = store.getElementById("a");
        assert.equal(created?.updatedBy, "user");
        assert.equal(created?.updatedAt, 1_000);
    });
    it("keeps a newer agent version over a stale posted copy", () => {
        const store = new CanvasStore();
        store.setElement(sticky("a", "agent text", 2_000, "agent"));
        applyUserSnapshot(store, {
            clientTime: 1_500,
            elements: [sticky("a", "stale", 1_000)],
        });
        assert.equal(store.getElementById("a")?.text, "agent text");
        assert.equal(store.getElementById("a")?.updatedBy, "agent");
    });
    it("replaces an older stored copy and re-stamps it as the user's", () => {
        const store = new CanvasStore();
        store.setElement(sticky("a", "agent text", 1_000, "agent"));
        applyUserSnapshot(store, {
            clientTime: 2_000,
            elements: [sticky("a", "edited", 2_000)],
        });
        assert.equal(store.getElementById("a")?.text, "edited");
        assert.equal(store.getElementById("a")?.updatedBy, "user");
    });
    it("does not delete an element the agent rewrote after the client clock", () => {
        const store = new CanvasStore();
        store.setElement(sticky("a", "kept", 3_000, "agent"));
        const result = applyUserSnapshot(store, {
            clientTime: 2_000,
            elements: [],
            removeIds: ["a"],
        });
        assert.equal(result.deleted, 0);
        assert.equal(store.getElementById("a")?.text, "kept");
    });
    it("deletes an element the user removed while holding the newest write", () => {
        const store = new CanvasStore();
        store.setElement(sticky("a", "old", 1_000));
        const result = applyUserSnapshot(store, {
            clientTime: 2_000,
            elements: [],
            removeIds: ["a"],
        });
        assert.equal(result.deleted, 1);
        assert.equal(store.getElementById("a"), undefined);
    });
    it("merges connectors by id", () => {
        const store = new CanvasStore();
        applyUserSnapshot(store, {
            clientTime: 1_000,
            elements: [],
            edges: [{ id: "e1", fromNode: "a", toNode: "b" }],
        });
        assert.equal(store.getEdge("e1")?.toNode, "b");
    });
});
describe("board-sync: reconcileFromServer", () => {
    it("keeps local edits newer than the last sync and re-posts their ids", () => {
        const result = reconcileFromServer({ elements: [sticky("a", "mine", 5_000)], edges: [] }, { elements: [sticky("a", "theirs", 1_000, "agent")], edges: [] }, 3_000);
        assert.equal(result.elements.length, 1);
        assert.equal(result.elements[0]?.text, "mine");
        assert.deepEqual(result.pendingIds, ["a"]);
    });
    it("takes the server copy when the local one is not newer", () => {
        const result = reconcileFromServer({ elements: [sticky("a", "mine", 1_000)], edges: [] }, { elements: [sticky("a", "theirs", 1_500, "agent")], edges: [] }, 3_000);
        assert.equal(result.elements[0]?.text, "theirs");
        assert.deepEqual(result.pendingIds, []);
    });
    it("drops a local element the server no longer has unless it is new", () => {
        const result = reconcileFromServer({
            elements: [
                sticky("gone", "removed elsewhere", 100),
                sticky("fresh", "drawn now", 9_000),
            ],
            edges: [],
        }, { elements: [], edges: [] }, 5_000);
        assert.deepEqual(result.elements.map((el) => el.id), ["fresh"]);
        assert.deepEqual(result.pendingIds, ["fresh"]);
    });
});
