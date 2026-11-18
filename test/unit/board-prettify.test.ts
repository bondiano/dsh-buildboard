import assert from "node:assert/strict";
import { test } from "node:test";
import {
	applyPrettifyPlacements,
	prettifyBoardRecords,
	prettifyGraph,
} from "../../src/domain/board-prettify.js";

test("prettifyGraph layers a chain left-to-right", () => {
	const result = prettifyGraph(
		[
			{ id: "a", w: 100, h: 40 },
			{ id: "b", w: 100, h: 40 },
			{ id: "c", w: 100, h: 40 },
		],
		[
			{ from: "a", to: "b" },
			{ from: "b", to: "c" },
		],
		{ direction: "LR", rankGap: 80, nodeGap: 20, originX: 0, originY: 0 },
	);
	assert.equal(result.ranks["a"], 0);
	assert.equal(result.ranks["b"], 1);
	assert.equal(result.ranks["c"], 2);
	const byId = Object.fromEntries(result.placements.map((p) => [p.id, p]));
	assert.ok(byId["a"]!.x < byId["b"]!.x);
	assert.ok(byId["b"]!.x < byId["c"]!.x);
});

test("prettifyGraph reduces a diamond without overlapping columns", () => {
	const result = prettifyGraph(
		[
			{ id: "src", w: 80, h: 40 },
			{ id: "mid1", w: 80, h: 40 },
			{ id: "mid2", w: 80, h: 40 },
			{ id: "sink", w: 80, h: 40 },
		],
		[
			{ from: "src", to: "mid1" },
			{ from: "src", to: "mid2" },
			{ from: "mid1", to: "sink" },
			{ from: "mid2", to: "sink" },
		],
	);
	assert.equal(result.ranks["src"], 0);
	assert.equal(result.ranks["sink"], 2);
	assert.equal(result.placements.length, 4);
});

test("prettifyBoardRecords reads arrows and moves shapes", () => {
	const records = {
		"page:page": {
			id: "page:page",
			typeName: "page",
			name: "Page 1",
			meta: {},
			index: "a1",
		},
		"shape:a": {
			id: "shape:a",
			typeName: "shape",
			type: "card",
			x: 500,
			y: 500,
			rotation: 0,
			opacity: 1,
			isLocked: false,
			props: {
				w: 120,
				h: 80,
				title: "A",
				excerpt: "",
				kind: "note",
				cardRef: "",
				runStatus: "",
			},
			parentId: "page:page",
			index: "a1",
			meta: {},
		},
		"shape:b": {
			id: "shape:b",
			typeName: "shape",
			type: "card",
			x: 0,
			y: 0,
			rotation: 0,
			opacity: 1,
			isLocked: false,
			props: {
				w: 120,
				h: 80,
				title: "B",
				excerpt: "",
				kind: "note",
				cardRef: "",
				runStatus: "",
			},
			parentId: "page:page",
			index: "a2",
			meta: {},
		},
		"shape:arrow": {
			id: "shape:arrow",
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
					boundShapeId: "shape:a",
					normalizedAnchor: { x: 0.5, y: 0.5 },
				},
				end: {
					type: "binding",
					boundShapeId: "shape:b",
					normalizedAnchor: { x: 0.5, y: 0.5 },
				},
				text: "",
			},
			parentId: "page:page",
			index: "a3",
			meta: {},
		},
	};
	const result = prettifyBoardRecords(records, { direction: "LR" });
	const put = applyPrettifyPlacements(records, result);
	assert.equal(put.length, 2);
	const a = put.find((r) => r.id === "shape:a")!;
	const b = put.find((r) => r.id === "shape:b")!;
	assert.ok((a.x as number) < (b.x as number));
});
