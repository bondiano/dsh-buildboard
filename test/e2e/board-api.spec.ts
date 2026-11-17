import { expect, test } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

async function startHarness(): Promise<{
	port: number;
	kill: () => void;
}> {
	const child = spawn(process.execPath, [join(here, "harness/server.mjs")], {
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
	const info = JSON.parse(line) as { port: number };
	return {
		port: info.port,
		kill: () => {
			child.kill("SIGINT");
		},
	};
}

test("board state API and screenshot", async ({ page }) => {
	const harness = await startHarness();
	try {
		const base = `http://127.0.0.1:${harness.port}`;
		const state = await (
			await fetch(`${base}/plugin-api/buildboard/state?board=main`)
		).json();
		expect(state.slug).toBe("main");
		expect(state.records["shape:sticky"].type).toBe("note");

		await page.goto(base);
		await expect(page.getByText("Launch checklist")).toBeVisible();
		await mkdir(join(here, "../../docs/screenshots"), { recursive: true });
		await page.screenshot({
			path: join(here, "../../docs/screenshots/board.png"),
			fullPage: true,
		});
	} finally {
		harness.kill();
	}
});
