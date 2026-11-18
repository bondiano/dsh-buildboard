import assert from "node:assert/strict";
import { test } from "node:test";
import { applyBoardDiff } from "../../src/domain/board.js";
import { validateBoardRecords } from "../../src/domain/board-validate.js";
import { importJsonCanvas } from "../../src/adapters/legacy-json-canvas.js";
import { nextRunStatus } from "../../src/domain/machines/run.machine.js";
import { buildCanvasBrief } from "../../src/application/canvas-brief.js";
test("applyBoardDiff put and remove with actor stamp", () => {
    const records = {};
    applyBoardDiff(records, {
        put: [{ id: "shape:1", typeName: "shape", type: "note" }],
        actor: "agent",
        clientTime: 10,
    });
    const created = records["shape:1"];
    assert.ok(created);
    assert.equal(created.type, "note");
    assert.equal(created.rotation, 0);
    assert.equal(created.opacity, 1);
    assert.equal(created.isLocked, false);
    assert.equal(created.meta.updatedBy, "agent");
    applyBoardDiff(records, { remove: ["shape:1"] });
    assert.equal(records["shape:1"], undefined);
});
test("legacy json canvas import creates shapes", () => {
    const records = importJsonCanvas({
        nodes: [
            {
                id: "1",
                type: "text",
                x: 0,
                y: 0,
                width: 100,
                height: 80,
                text: "hi",
                color: "1",
            },
            {
                id: "2",
                type: "script",
                x: 120,
                y: 0,
                width: 160,
                height: 100,
                text: "script",
            },
        ],
        edges: [{ id: "e1", fromNode: "1", toNode: "2", label: "flow" }],
    });
    assert.ok(records["page:page"]);
    assert.equal(records["shape:1"]?.type, "note");
    assert.equal(records["shape:2"]?.type, "card");
    assert.ok(Object.values(records).some((r) => r.type === "arrow"));
});
test("run machine transitions", () => {
    assert.equal(nextRunStatus("draft", "QUEUE"), "queued");
    assert.equal(nextRunStatus("queued", "START"), "running");
    assert.equal(nextRunStatus("running", "REVIEW"), "review");
    assert.equal(nextRunStatus("review", "ACCEPT"), "done");
    assert.throws(() => nextRunStatus("done", "START"));
});
test("canvas brief defaults to architecture request", () => {
    const brief = buildCanvasBrief({ request: "", boardSlug: "session-board" });
    assert.match(brief, /architecture/i);
    assert.match(brief, /board_\*/);
    assert.match(brief, /session-board/);
    assert.match(brief, /board_validate/);
    assert.match(brief, /board_generate_image/);
    assert.match(brief, /contrast|WCAG/i);
    assert.match(brief, /parentId/);
    assert.match(brief, /\.buildboard\/boards\/.*\.board\.json/);
});
test("validateBoardRecords flags missing rotation and repairs", () => {
    const records = {
        "page:page": {
            id: "page:page",
            typeName: "page",
            name: "Page 1",
            meta: {},
            index: "a1",
        },
        "shape:1": {
            id: "shape:1",
            typeName: "shape",
            type: "card",
            x: 0,
            y: 0,
            props: { w: 100, h: 80, title: "A", excerpt: "", kind: "note" },
            parentId: "page:page",
            index: "a1",
            meta: {},
        },
    };
    const bad = validateBoardRecords(records);
    assert.equal(bad.ok, false);
    assert.ok(bad.errors.some((issue) => issue.code === "missing_rotation"));
    const repaired = validateBoardRecords(records, { repair: true });
    assert.ok((repaired.repaired?.length ?? 0) >= 1);
    const fixed = repaired.repaired[0];
    assert.equal(fixed.rotation, 0);
    assert.equal(fixed.isLocked, false);
    assert.equal(fixed.props.cardRef, "");
});
