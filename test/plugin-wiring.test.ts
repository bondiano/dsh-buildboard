/**
 * The plugin's wiring: tools, board and file all follow the calling session.
 */

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import type {
	HostContext,
	ToolDefinition,
	ToolExec,
} from "../src/domain/types.js";
import { apply, resolveCanvasConfig } from "../src/presentation/index.js";

interface Harness {
	ctx: HostContext;
	tools: Map<string, ToolDefinition>;
}

/** A host with a working-directory service, which is where the board file goes. */
function hostWithWorkspace(workspace: string | undefined): Harness {
	const tools = new Map<string, ToolDefinition>();
	const services: Record<string, unknown> = {
		workingDirectory: {
			get: (session?: { id?: string }) =>
				session === undefined
					? undefined
					: session.id === "s-1"
						? workspace
						: undefined,
		},
	};
	const ctx = {
		tools: {
			register(definition: ToolDefinition) {
				tools.set(definition.name, definition);
				return () => {};
			},
		},
		systemPrompt: { section: () => () => {} },
		effect(callback: () => unknown) {
			const disposer = callback();
			return typeof disposer === "function" ? disposer : () => {};
		},
		get(name: string) {
			return services[name];
		},
		inject: () => {},
		logger: { warn: () => {} },
	} as unknown as HostContext;
	return { ctx, tools };
}

const exec = { agent: { session: { id: "s-1" } } } as ToolExec;

describe("plugin wiring", () => {
	it("writes the agent's element to the session workspace and keeps it there", async () => {
		const dir = await mkdtemp(join(tmpdir(), "cult-canvas-wiring-"));
		const { ctx, tools } = hostWithWorkspace(dir);
		const registry = apply(ctx, resolveCanvasConfig({ maxElements: 10 }));

		const create = tools.get("canvas_create_element");
		assert.ok(create !== undefined);
		await create.execute(
			{
				id: "agent-1",
				kind: "sticky",
				x: 5,
				y: 6,
				width: 200,
				height: 200,
				text: "hello",
			},
			exec,
		);

		const record = registry.record("s-1");
		assert.equal(record.workspace, dir);
		assert.equal(record.store.getElementById("agent-1")?.updatedBy, "agent");
		await record.flush();
		const written = await import("node:fs").then(
			(fs) =>
				JSON.parse(
					fs.readFileSync(join(dir, "cult-canvas.canvas"), "utf8"),
				) as {
					nodes: Array<{
						id: string;
						styleAttributes?: { gbUpdatedBy?: string };
					}>;
				},
		);
		assert.equal(written.nodes.length, 1);
		assert.equal(written.nodes[0]!.id, "agent-1");
		assert.equal(written.nodes[0]!.styleAttributes?.gbUpdatedBy, "agent");

		registry.dispose();
		await rm(dir, { recursive: true, force: true });
	});

	it("keeps the board in memory when the session has no workspace", async () => {
		const { ctx, tools } = hostWithWorkspace(undefined);
		const registry = apply(ctx, {});
		const create = tools.get("canvas_create_element");
		assert.ok(create !== undefined);
		await create.execute(
			{
				id: "agent-2",
				kind: "sticky",
				x: 0,
				y: 0,
				width: 200,
				height: 200,
				text: "x",
			},
			exec,
		);

		const record = registry.record("s-1");
		assert.equal(record.workspace, undefined);
		assert.equal(record.store.getElementById("agent-2")?.text, "x");
		registry.dispose();
	});

	it("registers twelve tools and the canvas system prompt section", () => {
		const { ctx, tools } = hostWithWorkspace(undefined);
		const registry = apply(ctx, {});
		assert.equal(tools.size, 12);
		assert.equal(existsSync("/nonexistent/cult-canvas.canvas"), false);
		registry.dispose();
	});
});
