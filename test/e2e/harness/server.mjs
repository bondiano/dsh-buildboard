import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const workspace = await mkdtemp(join(tmpdir(), "bb-e2e-"));
const dshHome = await mkdtemp(join(tmpdir(), "bb-e2e-home-"));
process.env.DSH_HOME = dshHome;

const root = join(new URL("../../..", import.meta.url).pathname);
const { apply } = await import(pathToFileURL(join(root, "dist/index.js")).href);
const { handleBuildboardHttp } = await import(
	pathToFileURL(join(root, "dist/src/presentation/routes.js")).href
);

const tools = [];
const ctx = {
	tools: {
		register(tool) {
			tools.push(tool);
			return () => {};
		},
	},
	systemPrompt: {
		section() {
			return () => {};
		},
	},
	effect(disposer) {
		if (typeof disposer === "function") disposer();
	},
	inject() {},
	logger: { warn() {} },
	get() {
		return { get: () => workspace };
	},
};

const services = apply(ctx, {});
await services.boards.attachWorkspace(workspace);
services.cards.setWorkspace(workspace);
await services.cards.ensureReady();
await services.boards.create({ title: "Main", slug: "main" });
services.boards.applyDiff("main", {
	put: [
		{
			id: "shape:sticky",
			typeName: "shape",
			type: "note",
			x: 80,
			y: 120,
			props: { text: "Launch checklist", color: "yellow", w: 220, h: 140 },
			meta: { updatedBy: "agent" },
		},
		{
			id: "shape:card",
			typeName: "shape",
			type: "card",
			x: 360,
			y: 120,
			props: {
				title: "Auth gateway",
				excerpt: "TLS terminate → session cookie",
				w: 260,
				h: 160,
				kind: "note",
			},
		},
		{
			id: "shape:frame",
			typeName: "shape",
			type: "frame",
			x: 60,
			y: 60,
			props: { w: 620, h: 320, name: "Edge" },
		},
	],
	actor: "agent",
});
await services.cards.write({
	scope: "project",
	title: "Auth gateway",
	body: "Terminates TLS and issues session cookies.\n\nSee [[session-store]].",
	tags: ["arch"],
});

const routeServices = {
	boards: services.boards,
	cards: services.cards,
	runs: services.runs,
	resolveWorkspace: () => workspace,
	ensureSessionWorkspace: async () => workspace,
};

const server = createServer(async (req, res) => {
	if (req.url?.startsWith("/plugin-api/buildboard")) {
		res.setHeader("access-control-allow-origin", "*");
		await handleBuildboardHttp(routeServices, req, res);
		return;
	}
	if (req.url === "/" || req.url?.startsWith("/index")) {
		res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
		res.end(`<!doctype html>
<html><head><meta charset="utf-8"/><title>Buildboard demo</title>
<style>
body{margin:0;font-family:ui-sans-serif,system-ui;background:#111;color:#eee}
.wrap{display:grid;grid-template-columns:220px 1fr 260px;height:100vh}
aside,main{padding:16px;border-right:1px solid #333}
.card{background:#1c1c1c;border:1px solid #333;border-radius:10px;padding:12px;margin:12px 0}
.sticky{background:#f5d76e;color:#222;width:200px;min-height:100px;padding:12px;border-radius:4px;position:absolute;left:100px;top:140px}
.shape{background:#1e293b;border:1px solid #334155;width:240px;min-height:120px;padding:12px;border-radius:8px;position:absolute;left:360px;top:140px}
.frame{position:absolute;left:70px;top:70px;width:580px;height:280px;border:1px dashed #475569;border-radius:8px}
.chip{display:inline-block;background:#3b82f6;color:#fff;border-radius:999px;padding:0 8px;font-size:11px;margin-left:6px}
h1{font-size:18px;margin:0 0 12px}
</style></head><body>
<div class="wrap">
<aside><h1>Boards</h1><div class="card">Main</div><h1>Cards</h1><div class="card">Auth gateway</div></aside>
<main style="position:relative;overflow:hidden;background:#0b0b0b">
  <div class="frame"></div>
  <div class="sticky">Launch checklist <span class="chip">agent</span></div>
  <div class="shape"><strong>Auth gateway</strong><div style="opacity:.7;margin-top:8px;font-size:13px">TLS terminate → session cookie</div></div>
</main>
<aside><h1>Runs</h1><div class="card">canvas · running</div></aside>
</div></body></html>`);
		return;
	}
	res.writeHead(404);
	res.end("not found");
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const { port } = server.address();
process.stdout.write(
	JSON.stringify({ port, workspace, dshHome, tools: tools.map((t) => t.name) }),
);

async function shutdown() {
	server.close();
	await rm(workspace, { recursive: true, force: true });
	await rm(dshHome, { recursive: true, force: true });
	process.exit(0);
}
process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
