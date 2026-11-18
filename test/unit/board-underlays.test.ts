import assert from "node:assert/strict";
import { test } from "node:test";
import {
	applyPrettifyPlacements,
	prettifyBoardRecords,
} from "../../src/domain/board-prettify.js";
import {
	bindShapesToUnderlays,
	type UnderlayShape,
} from "../../src/domain/board-underlays.js";
import type { BoardRecord } from "../../src/domain/board.js";

test("bindShapesToUnderlays reparents a page card whose center sits in a frame", () => {
	const shapes: UnderlayShape[] = [
		{
			id: "shape:frame",
			type: "frame",
			parentId: "page:page",
			x: 0,
			y: 0,
			w: 400,
			h: 300,
		},
		{
			id: "shape:card",
			type: "card",
			parentId: "page:page",
			x: 40,
			y: 60,
			w: 120,
			h: 80,
		},
	];
	const bindings = bindShapesToUnderlays(shapes);
	assert.equal(bindings.length, 1);
	assert.equal(bindings[0]!.id, "shape:card");
	assert.equal(bindings[0]!.parentId, "shape:frame");
	assert.equal(bindings[0]!.x, 40);
	assert.equal(bindings[0]!.y, 60);
});

test("prettifyBoardRecords keeps cards inside frames after layout", () => {
	const records: Record<string, BoardRecord> = {
		"page:page": {
			id: "page:page",
			typeName: "page",
			name: "Page 1",
			meta: {},
			index: "a1",
		},
		"shape:f1": {
			id: "shape:f1",
			typeName: "shape",
			type: "frame",
			x: 0,
			y: 0,
			rotation: 0,
			opacity: 1,
			isLocked: false,
			props: { w: 500, h: 400, name: "Bootstrap" },
			parentId: "page:page",
			index: "a1",
			meta: {},
		},
		"shape:f2": {
			id: "shape:f2",
			typeName: "shape",
			type: "frame",
			x: 600,
			y: 0,
			rotation: 0,
			opacity: 1,
			isLocked: false,
			props: { w: 500, h: 400, name: "Sim" },
			parentId: "page:page",
			index: "a2",
			meta: {},
		},
		"shape:a": {
			id: "shape:a",
			typeName: "shape",
			type: "card",
			x: 50,
			y: 80,
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
			index: "a3",
			meta: {},
		},
		"shape:b": {
			id: "shape:b",
			typeName: "shape",
			type: "card",
			x: 650,
			y: 80,
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
			index: "a4",
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
			index: "a5",
			meta: {},
		},
	};

	const result = prettifyBoardRecords(records, { direction: "LR" });
	assert.ok(result.bound >= 2);
	const byId = Object.fromEntries(result.placements.map((p) => [p.id, p]));
	assert.equal(byId["shape:a"]?.parentId, "shape:f1");
	assert.equal(byId["shape:b"]?.parentId, "shape:f2");
	assert.ok(byId["shape:f1"]);
	assert.ok(byId["shape:f2"]);
	assert.ok(byId["shape:f1"]!.x < byId["shape:f2"]!.x);
	const put = applyPrettifyPlacements(records, result);
	assert.ok(
		put.some((r) => r.id === "shape:a" && r["parentId"] === "shape:f1"),
	);
	assert.ok(
		put.some((r) => r.id === "shape:b" && r["parentId"] === "shape:f2"),
	);
});
