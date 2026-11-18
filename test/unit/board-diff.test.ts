import assert from "node:assert/strict";
import { test } from "node:test";
import { applyBoardDiff } from "../../src/domain/board.js";
import { importJsonCanvas } from "../../src/adapters/legacy-json-canvas.js";
import { nextRunStatus } from "../../src/domain/machines/run.machine.js";
import { buildCanvasBrief } from "../../src/application/canvas-brief.js";

test("applyBoardDiff put and remove with actor stamp", () => {
	const records: Record<string, Record<string, unknown> & { id?: string }> = {};
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
	assert.equal((created.meta as { updatedBy?: string }).updatedBy, "agent");
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
});
