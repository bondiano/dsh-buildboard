import { expect, test } from "@playwright/test";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

async function startHarness(): Promise<{
	port: number;
	kill: () => void;
	tools: string[];
}> {
	const child = spawn(process.execPath, [join(here, "harness/server.ts")], {
		cwd: join(here, "../.."),
		stdio: ["ignore", "pipe", "pipe"],
	});
	const line = await new Promise<string>((resolve, reject) => {
		let buf = "";
		let err = "";
		child.stdout?.on("data", (chunk: Buffer) => {
			buf += chunk.toString("utf8");
			const start = buf.indexOf("{");
			if (start >= 0) resolve(buf.slice(start).trim());
		});
		child.stderr?.on("data", (chunk: Buffer) => {
			err += chunk.toString("utf8");
		});
		child.on("exit", (code) =>
			reject(new Error(`harness exited ${code}: ${err || buf}`)),
		);
	});
	const info = JSON.parse(line) as { port: number; tools: string[] };
	return {
		port: info.port,
		tools: info.tools,
		kill: () => {
			child.kill("SIGINT");
		},
	};
}

test("/canvas creates a board and agent tools can populate it", async () => {
	const harness = await startHarness();
	try {
		const base = `http://127.0.0.1:${harness.port}`;
		expect(harness.tools).toContain("board_create_shape");
		expect(harness.tools).toContain("board_validate");
		expect(harness.tools).toContain("card_write");
		expect(harness.tools).toContain("run_report");

		const boardsBefore = (await (
			await fetch(`${base}/plugin-api/buildboard/boards`)
		).json()) as { boards: Array<{ slug: string }> };

		const create = await fetch(`${base}/plugin-api/buildboard/boards`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				title: "Explain the architecture",
				slug: "session-deadbeef-explain-the-architecture",
				sessionId: "deadbeef",
			}),
		});
		expect(create.status).toBe(200);
		const created = (await create.json()) as { slug: string };
		expect(created.slug).toContain("session-deadbeef");

		const boardsAfter = (await (
			await fetch(`${base}/plugin-api/buildboard/boards`)
		).json()) as { boards: Array<{ slug: string }> };
		expect(boardsAfter.boards.length).toBeGreaterThan(
			boardsBefore.boards.length,
		);

		const second = await fetch(`${base}/plugin-api/buildboard/boards`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				title: "Auth flow",
				slug: "session-deadbeef-auth-flow",
				sessionId: "deadbeef",
			}),
		});
		expect(second.status).toBe(200);
		const secondBody = (await second.json()) as { slug: string };
		expect(secondBody.slug).not.toBe(created.slug);

		await fetch(
			`${base}/plugin-api/buildboard/state?board=${encodeURIComponent(created.slug)}`,
			{
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					actor: "agent",
					put: [
						{
							id: "shape:layer",
							typeName: "shape",
							type: "frame",
							x: 40,
							y: 40,
							props: { w: 480, h: 260, name: "Host" },
							meta: { updatedBy: "agent" },
						},
						{
							id: "shape:host-card",
							typeName: "shape",
							type: "card",
							x: 80,
							y: 90,
							props: {
								w: 240,
								h: 140,
								title: "Host plugin",
								excerpt: "tools + /canvas",
								kind: "note",
								cardRef: "",
								runStatus: "",
							},
							meta: { updatedBy: "agent" },
						},
					],
				}),
			},
		);

		const state = (await (
			await fetch(
				`${base}/plugin-api/buildboard/state?board=${encodeURIComponent(created.slug)}`,
			)
		).json()) as {
			records: Record<string, { meta?: { updatedBy?: string }; type?: string }>;
		};
		expect(state.records["shape:host-card"]?.type).toBe("card");
		expect(state.records["shape:host-card"]?.meta?.updatedBy).toBe("agent");
	} finally {
		harness.kill();
	}
});
