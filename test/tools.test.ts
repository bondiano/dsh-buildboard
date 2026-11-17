import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	buildCanvasTools,
	createCanvasTools,
	deepMerge,
	stripUndefined,
} from "../tools.js";
import { CanvasStore } from "../canvas-model.js";
import { inject as clientInject } from "../client.js";
import type { HostContext, ToolExec } from "../types.js";

function mockHostContext(): HostContext {
	return {
		get: () => undefined,
		tools: {
			register() {
				return () => {};
			},
		},
		systemPrompt: {
			section() {
				return () => {};
			},
		},
		effect(cb) {
			return cb();
		},
		inject(_services, cb) {
			cb(this as HostContext & { webServer: any });
		},
	};
}

describe("tools: stripUndefined & deepMerge", () => {
	it("stripUndefined strips undefined keys in objects and preserves valid values", () => {
		const input = {
			a: "hello",
			b: undefined,
			c: 42,
			d: null,
			e: true,
			nested: {
				f: undefined,
				g: "world",
			},
		};
		const output = stripUndefined(input);
		assert.deepEqual(output, {
			a: "hello",
			c: 42,
			d: null,
			e: true,
			nested: {
				g: "world",
			},
		});
		assert.equal("b" in output, false);
		assert.equal("f" in output.nested, false);
	});

	it("stripUndefined maps undefined array elements and non-finite numbers to null", () => {
		const arr = [1, undefined, NaN, Infinity, -Infinity, "text", null];
		const res = stripUndefined(arr);
		assert.deepEqual(res, [1, null, null, null, null, "text", null]);
	});

	it("stripUndefined handles circular references without RangeError and maps cycles to null", () => {
		const cyclic: Record<string, unknown> = { a: 1 };
		cyclic.self = cyclic;
		const stripped = stripUndefined(cyclic);
		assert.equal(stripped.a, 1);
		assert.equal(stripped.self, null);

		const cyclicArr: unknown[] = [1, 2];
		cyclicArr.push(cyclicArr);
		const strippedArr = stripUndefined(cyclicArr);
		assert.equal(strippedArr[0], 1);
		assert.equal(strippedArr[1], 2);
		assert.equal(strippedArr[2], null);
	});

	it("deepMerge handles circular references without RangeError", () => {
		const cyclic: Record<string, unknown> = { a: 1 };
		cyclic.self = cyclic;
		const target = { b: 2 };
		const result = deepMerge(target, cyclic);
		assert.equal(result.b, 2);
		assert.equal(result.a, 1);
	});

	it("deepMerge recursively merges nested objects without overwriting siblings", () => {
		const target = {
			title: "Original",
			nested: {
				count: 1,
				keep: "preserved",
			},
		};
		const source = {
			nested: {
				count: 2,
				added: "new",
			},
		};
		const result = deepMerge(target, source);
		assert.deepEqual(result, {
			title: "Original",
			nested: {
				count: 2,
				keep: "preserved",
				added: "new",
			},
		});
	});
});

describe("tools: Inspection Suite", () => {
	it("canvas_get_state returns elements, edges, count, and bible", async () => {
		const store = new CanvasStore();
		store.createElement({
			id: "elem1",
			kind: "text",
			x: 10,
			y: 10,
			width: 100,
			height: 100,
			text: "Hello",
		});
		const tools = buildCanvasTools(mockHostContext(), store);
		const getState = tools.find((t) => t.name === "canvas_get_state")!;
		assert.ok(getState);

		const res = (await getState.execute({}, {})) as unknown as {
			ok: boolean;
			count: number;
			elements: unknown[];
		};
		assert.equal(res.ok, true);
		assert.equal(res.count, 1);
		assert.equal(res.elements.length, 1);
	});

	it("canvas_get_state with zero-area bounding box returns 0 elements", async () => {
		const store = new CanvasStore();
		store.createElement({
			id: "elem1",
			kind: "text",
			x: 10,
			y: 10,
			width: 100,
			height: 100,
			text: "Hello",
		});
		const tools = buildCanvasTools(mockHostContext(), store);
		const getState = tools.find((t) => t.name === "canvas_get_state")!;

		const res = (await getState.execute(
			{ boundingBox: { minX: 100, minY: 100, maxX: 100, maxY: 100 } },
			{},
		)) as unknown as { count: number };
		assert.equal(res.count, 0);
	});

	it("canvas_query_elements filters by boundingBox, kind, and tags", async () => {
		const store = new CanvasStore();
		store.createElement({
			id: "node_1",
			kind: "sticky",
			x: 0,
			y: 0,
			width: 100,
			height: 100,
			text: "Sticky 1",
			data: { tags: ["action", "hero"] },
		});
		store.createElement({
			id: "node_2",
			kind: "shape",
			shapeType: "rect",
			text: "Shape 2",
			x: 500,
			y: 500,
			width: 100,
			height: 100,
			data: { tags: ["scene"] },
		});

		const tools = buildCanvasTools(mockHostContext(), store);
		const queryTool = tools.find((t) => t.name === "canvas_query_elements")!;
		assert.ok(queryTool);

		// Spatial query
		const spatialRes = (await queryTool.execute(
			{ boundingBox: { minX: -50, minY: -50, maxX: 150, maxY: 150 } },
			{},
		)) as unknown as { count: number; elements: Array<{ id: string }> };
		assert.equal(spatialRes.count, 1);
		assert.equal(spatialRes.elements[0]!.id, "node_1");

		// Kind & tags query
		const tagRes = (await queryTool.execute(
			{ tags: ["action"] },
			{},
		)) as unknown as { count: number };
		assert.equal(tagRes.count, 1);
	});

	it("canvas_node_status returns status and throws error if node is missing", async () => {
		const store = new CanvasStore();
		store.createElement({
			id: "script_1",
			kind: "script",
			label: "Script 1",
			text: "Scene 1 script",
			x: 0,
			y: 0,
			width: 100,
			height: 100,
			status: "completed",
			data: { output: "Scene 1" },
		});

		const tools = buildCanvasTools(mockHostContext(), store);
		const statusTool = tools.find((t) => t.name === "canvas_node_status")!;
		assert.ok(statusTool);

		const res = (await statusTool.execute(
			{ nodeId: "script_1" },
			{},
		)) as unknown as {
			ok: boolean;
			status: string;
			data: { output: string };
		};
		assert.equal(res.ok, true);
		assert.equal(res.status, "completed");
		assert.equal(res.data.output, "Scene 1");

		await assert.rejects(async () => {
			await statusTool.execute({ nodeId: "non_existent" }, {});
		}, /Node not found/);
	});

	it("canvas_get_bible returns empty object on clean store", async () => {
		const store = new CanvasStore();
		const tools = buildCanvasTools(mockHostContext(), store);
		const getBible = tools.find((t) => t.name === "canvas_get_bible")!;
		assert.ok(getBible);

		const res = (await getBible.execute({}, {})) as unknown as {
			ok: boolean;
			bible: Record<string, unknown>;
		};
		assert.equal(res.ok, true);
		assert.deepEqual(res.bible, {});
	});
});

describe("tools: Manipulation Suite", () => {
	it("canvas_create_element creates elements, validates numeric x/y, and preserves Unicode", async () => {
		const store = new CanvasStore();
		const tools = buildCanvasTools(mockHostContext(), store);
		const createTool = tools.find((t) => t.name === "canvas_create_element")!;
		assert.ok(createTool);

		const unicodeText = "长安城 2088 🏮 🤖 剑气纵横";
		const res = (await createTool.execute(
			{
				kind: "sticky",
				x: 50,
				y: 60,
				text: unicodeText,
			},
			{},
		)) as unknown as {
			ok: boolean;
			elementId: string;
			element: { text: string };
		};

		assert.equal(res.ok, true);
		assert.equal(res.element.text, unicodeText);
		assert.equal(store.getElementById(res.elementId)?.text, unicodeText);

		// Invalid x/y must throw
		await assert.rejects(async () => {
			await createTool.execute({ x: "invalid", y: 10 }, {});
		}, /Missing or invalid required parameters/);
	});

	it("canvas_create_element strictly enforces positive finite dimensions for width and height", async () => {
		const store = new CanvasStore();
		const tools = buildCanvasTools(mockHostContext(), store);
		const createTool = tools.find((t) => t.name === "canvas_create_element")!;

		// NaN and Infinity inputs must default to 200 and 150 (not null)
		const res1 = (await createTool.execute(
			{ x: 10, y: 10, width: NaN, height: Infinity },
			{},
		)) as unknown as {
			ok: boolean;
			element: { width: number; height: number };
		};
		assert.equal(res1.ok, true);
		assert.equal(typeof res1.element.width, "number");
		assert.equal(typeof res1.element.height, "number");
		assert.equal(res1.element.width, 200);
		assert.equal(res1.element.height, 150);

		// Negative / zero dimensions must default to 200 and 150
		const res2 = (await createTool.execute(
			{ x: 10, y: 10, width: -50, height: 0 },
			{},
		)) as unknown as {
			ok: boolean;
			element: { width: number; height: number };
		};
		assert.equal(res2.ok, true);
		assert.equal(res2.element.width, 200);
		assert.equal(res2.element.height, 150);

		// Valid positive dimensions must be preserved
		const res3 = (await createTool.execute(
			{ x: 10, y: 10, width: 320, height: 240 },
			{},
		)) as unknown as {
			ok: boolean;
			element: { width: number; height: number };
		};
		assert.equal(res3.ok, true);
		assert.equal(res3.element.width, 320);
		assert.equal(res3.element.height, 240);
	});

	it("canvas_update_bible and canvas_create_element prevent state poisoning on cyclic input", async () => {
		const store = new CanvasStore();
		const tools = buildCanvasTools(mockHostContext(), store);
		const updateBible = tools.find((t) => t.name === "canvas_update_bible")!;
		const getState = tools.find((t) => t.name === "canvas_get_state")!;
		const createElement = tools.find(
			(t) => t.name === "canvas_create_element",
		)!;

		const cyclicObj: Record<string, unknown> = { title: "Cyclic Bible" };
		cyclicObj.self = cyclicObj;

		// 1. canvas_update_bible with cyclic patch must not throw and not poison state
		const bibleRes = (await updateBible.execute(
			{ patch: cyclicObj },
			{},
		)) as unknown as { ok: boolean };
		assert.equal(bibleRes.ok, true);

		// 2. canvas_get_state must succeed cleanly afterwards
		const stateRes1 = (await getState.execute({}, {})) as unknown as {
			ok: boolean;
			bible: Record<string, unknown>;
		};
		assert.equal(stateRes1.ok, true);
		assert.equal(stateRes1.bible.title, "Cyclic Bible");
		assert.equal(stateRes1.bible.self, null);

		// 3. canvas_create_element with cyclic data must not throw and not poison state
		const cyclicData: Record<string, unknown> = { payload: "Cyclic Element" };
		cyclicData.cycle = cyclicData;
		const createRes = (await createElement.execute(
			{ x: 0, y: 0, data: cyclicData },
			{},
		)) as unknown as {
			ok: boolean;
			element: { data: Record<string, unknown> };
		};
		assert.equal(createRes.ok, true);
		assert.equal(createRes.element.data.payload, "Cyclic Element");
		assert.equal(createRes.element.data.cycle, null);

		// 4. canvas_get_state must still succeed cleanly
		const stateRes2 = (await getState.execute({}, {})) as unknown as {
			ok: boolean;
			count: number;
		};
		assert.equal(stateRes2.ok, true);
		assert.equal(stateRes2.count, 1);
	});

	it("canvas_update_element updates existing element and throws on missing ID", async () => {
		const store = new CanvasStore();
		const el = store.createElement({
			id: "up_1",
			kind: "text",
			x: 0,
			y: 0,
			width: 100,
			height: 100,
			text: "before",
		});

		const tools = buildCanvasTools(mockHostContext(), store);
		const updateTool = tools.find((t) => t.name === "canvas_update_element")!;
		assert.ok(updateTool);

		const res = (await updateTool.execute(
			{
				id: el.id,
				patch: { text: "after" },
			},
			{},
		)) as unknown as { ok: boolean; element: { text: string } };
		assert.equal(res.ok, true);
		assert.equal(res.element.text, "after");
		assert.equal(store.getElementById(el.id)?.text, "after");

		await assert.rejects(async () => {
			await updateTool.execute({ id: "ghost", patch: { text: "foo" } }, {});
		}, /Element not found/);
	});

	it("canvas_delete_element deletes elements, cascades edges, and handles empty array", async () => {
		const store = new CanvasStore();
		const a = store.createElement({
			id: "del_a",
			kind: "text",
			text: "A",
			x: 0,
			y: 0,
			width: 10,
			height: 10,
		});
		const b = store.createElement({
			id: "del_b",
			kind: "text",
			text: "B",
			x: 20,
			y: 0,
			width: 10,
			height: 10,
		});
		store.connect({ id: "edge_ab", fromNode: a.id, toNode: b.id });

		const tools = buildCanvasTools(mockHostContext(), store);
		const deleteTool = tools.find((t) => t.name === "canvas_delete_element")!;
		assert.ok(deleteTool);

		// Empty array deletes nothing safely
		const emptyRes = (await deleteTool.execute({ ids: [] }, {})) as unknown as {
			ok: boolean;
			deletedCount: number;
		};
		assert.equal(emptyRes.ok, true);
		assert.equal(emptyRes.deletedCount, 0);

		// Delete node A cascades edge
		const res = (await deleteTool.execute({ ids: [a.id] }, {})) as unknown as {
			ok: boolean;
			deletedCount: number;
			removedEdgesCount: number;
		};
		assert.equal(res.ok, true);
		assert.equal(res.deletedCount, 1);
		assert.equal(res.removedEdgesCount, 1);
		assert.equal(store.getAllEdges().length, 0);
	});

	it("canvas_connect connects nodes, checks ports, and rejects cycles in DAG", async () => {
		const store = new CanvasStore();
		const a = store.createElement({
			id: "conn_a",
			kind: "text",
			text: "A",
			x: 0,
			y: 0,
			width: 10,
			height: 10,
		});
		const b = store.createElement({
			id: "conn_b",
			kind: "text",
			text: "B",
			x: 20,
			y: 0,
			width: 10,
			height: 10,
		});
		const tools = buildCanvasTools(mockHostContext(), store);
		const connectTool = tools.find((t) => t.name === "canvas_connect")!;
		assert.ok(connectTool);

		// A -> B
		const res = (await connectTool.execute(
			{ fromNode: a.id, toNode: b.id },
			{},
		)) as unknown as {
			ok: boolean;
			edge: { fromNode: string; toNode: string };
		};
		assert.equal(res.ok, true);
		assert.equal(res.edge.fromNode, a.id);
		assert.equal(res.edge.toNode, b.id);

		// B -> A must be rejected with cycle error
		await assert.rejects(async () => {
			await connectTool.execute({ fromNode: b.id, toNode: a.id }, {});
		}, /cycle in the DAG/);
	});

	it("canvas_layout_elements updates positions and handles empty array", async () => {
		const store = new CanvasStore();
		const a = store.createElement({
			id: "lay_a",
			kind: "text",
			text: "A",
			x: 0,
			y: 0,
			width: 10,
			height: 10,
		});

		const tools = buildCanvasTools(mockHostContext(), store);
		const layoutTool = tools.find((t) => t.name === "canvas_layout_elements")!;
		assert.ok(layoutTool);

		const emptyRes = (await layoutTool.execute(
			{ layouts: [] },
			{},
		)) as unknown as {
			ok: boolean;
			updatedCount: number;
		};
		assert.equal(emptyRes.ok, true);
		assert.equal(emptyRes.updatedCount, 0);

		const res = (await layoutTool.execute(
			{
				layouts: [{ id: a.id, x: 120, y: 150, pinned: true }],
			},
			{},
		)) as unknown as { ok: boolean; updatedCount: number };
		assert.equal(res.ok, true);
		assert.equal(res.updatedCount, 1);

		const updated = store.getElementById(a.id)!;
		assert.equal(updated.x, 120);
		assert.equal(updated.y, 150);
		assert.equal(updated.pinned, true);
		assert.equal(updated.width, 10);
		assert.equal(updated.height, 10);
	});

	it("canvas_layout_elements preserves existing positive width and height when width/height are omitted (Challenger 2 fix)", async () => {
		const store = new CanvasStore();
		const el = store.createElement({
			id: "elem_bounds_1",
			kind: "text",
			text: "Preserved Bounds",
			x: 10,
			y: 20,
			width: 250,
			height: 180,
		});

		const tools = buildCanvasTools(mockHostContext(), store);
		const layoutTool = tools.find((t) => t.name === "canvas_layout_elements")!;
		assert.ok(layoutTool);

		// Call layout without width or height
		await layoutTool.execute(
			{
				layouts: [{ id: el.id, x: 100, y: 200 }],
			},
			{},
		);

		const updated = store.getElementById(el.id)!;
		assert.equal(updated.x, 100);
		assert.equal(updated.y, 200);
		assert.equal(updated.width, 250);
		assert.equal(updated.height, 180);

		// Bounds query should have finite numbers, no NaN!
		const bounds = store.getBounds();
		assert.ok(bounds !== null);
		assert.ok(Number.isFinite(bounds.minX));
		assert.ok(Number.isFinite(bounds.maxX));
		assert.ok(Number.isFinite(bounds.minY));
		assert.ok(Number.isFinite(bounds.maxY));
		assert.equal(bounds.minX, 100);
		assert.equal(bounds.maxX, 350);
	});
});

describe("tools: Execution & Storage Suite", () => {
	it("canvas_run_pipeline executes workflows and halts on empty canvas or signal abort", async () => {
		const store = new CanvasStore();
		const tools = buildCanvasTools(mockHostContext(), store);
		const runTool = tools.find((t) => t.name === "canvas_run_pipeline")!;
		assert.ok(runTool);

		// Empty canvas succeeds with completed status
		const res = (await runTool.execute({ mode: "all" }, {})) as unknown as {
			ok: boolean;
			status: string;
		};
		assert.equal(res.ok, true);
		assert.equal(res.status, "completed");

		// Signal abort
		const controller = new AbortController();
		controller.abort();
		await assert.rejects(async () => {
			await runTool.execute({}, { signal: controller.signal } as ToolExec);
		}, /Aborted/);
	});

	it("canvas_import_export exports and imports JSON Canvas 1.0 documents", async () => {
		const store = new CanvasStore();
		store.createElement({
			id: "io_1",
			kind: "text",
			x: 10,
			y: 10,
			width: 100,
			height: 100,
			text: "exported text",
		});

		const tools = buildCanvasTools(mockHostContext(), store);
		const ioTool = tools.find((t) => t.name === "canvas_import_export")!;
		assert.ok(ioTool);

		// Export
		const expRes = (await ioTool.execute(
			{ action: "export" },
			{},
		)) as unknown as {
			ok: boolean;
			document: { nodes: Array<{ id: string }> };
		};
		assert.equal(expRes.ok, true);
		assert.equal(expRes.document.nodes.length, 1);

		// Import without document must throw
		await assert.rejects(async () => {
			await ioTool.execute({ action: "import" }, {});
		}, /Document payload required/);

		// Import into fresh store
		const store2 = new CanvasStore();
		const tools2 = buildCanvasTools(mockHostContext(), store2);
		const ioTool2 = tools2.find((t) => t.name === "canvas_import_export")!;
		const impRes = (await ioTool2.execute(
			{ action: "import", document: expRes.document },
			{},
		)) as unknown as { ok: boolean; importedNodes: number };
		assert.equal(impRes.ok, true);
		assert.equal(impRes.importedNodes, 1);
		assert.ok(store2.getElementById("io_1"));
	});

	it("canvas_update_bible merges deeply nested structures cleanly", async () => {
		const store = new CanvasStore();
		store.updateBible({
			worldview: "Cyberpunk 2088",
			styleAnchor: "Neon Noir",
		});

		const tools = buildCanvasTools(mockHostContext(), store);
		const updateBible = tools.find((t) => t.name === "canvas_update_bible")!;
		assert.ok(updateBible);

		// Initialize custom bible fields via canvas_update_bible
		await updateBible.execute(
			{ patch: { author: "Li Bai", nested: { count: 1 } } },
			{},
		);

		// Empty patch doesn't mutate
		const emptyRes = (await updateBible.execute(
			{ patch: {} },
			{},
		)) as unknown as {
			ok: boolean;
			bible: { author: string; worldview: string; nested: { count: number } };
		};
		assert.equal(emptyRes.ok, true);
		assert.equal(emptyRes.bible.author, "Li Bai");
		assert.equal(emptyRes.bible.worldview, "Cyberpunk 2088");
		assert.equal(emptyRes.bible.nested.count, 1);

		// Deep nested merge
		const res = (await updateBible.execute(
			{ patch: { nested: { count: 2, newProp: "ok" } } },
			{},
		)) as unknown as {
			ok: boolean;
			bible: {
				author: string;
				worldview: string;
				nested: { count: number; newProp: string };
			};
		};
		assert.equal(res.ok, true);
		assert.equal(res.bible.author, "Li Bai");
		assert.equal(res.bible.worldview, "Cyberpunk 2088");
		assert.equal(res.bible.nested.count, 2);
		assert.equal(res.bible.nested.newProp, "ok");
	});
});

describe("tools: Schema & Rendering Contracts", () => {
	it("all 12 tools provide valid schemas, renderers, and presentationMeta", () => {
		const store = new CanvasStore();
		const tools = createCanvasTools(store);
		assert.equal(tools.length, 12);

		for (const tool of tools) {
			assert.ok(tool.name.startsWith("canvas_"));
			assert.ok(
				typeof tool.description === "string" && tool.description.length > 0,
			);
			assert.ok(typeof tool.parameters === "object");
			assert.ok(typeof tool.output.schema === "object");
			assert.ok(typeof tool.output.render === "function");
			assert.ok(typeof tool.output.presentationMeta === "function");

			// Test render function
			const rendered = tool.output.render(
				{},
				{ text: "test", ok: true, count: 0, status: "idle" },
			);
			assert.ok(Array.isArray(rendered));
			assert.ok(rendered.length > 0);
			assert.equal(rendered[0]!.type, "text");

			// Test presentationMeta function
			const meta = tool.output.presentationMeta(
				{},
				{ text: "test", ok: true, count: 0, status: "idle" },
			);
			assert.ok(typeof meta === "object" && meta !== null);
		}
	});

	it("aborted ToolExec signal halts all tools immediately", async () => {
		const store = new CanvasStore();
		const tools = buildCanvasTools(mockHostContext(), store);
		const controller = new AbortController();
		controller.abort();
		const exec = { signal: controller.signal } as ToolExec;

		for (const tool of tools) {
			await assert.rejects(async () => {
				await tool.execute({}, exec);
			}, /Aborted/);
		}
	});

	it("client shell declares correct inject services contract", () => {
		assert.deepEqual(clientInject, [
			"slots",
			"locale",
			"remote",
			"styles",
			"uiWorkspace",
		]);
	});
});
