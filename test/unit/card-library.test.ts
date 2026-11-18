import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { BoardRegistry } from "../../src/application/board-document.js";
import { CardLibrary } from "../../src/application/card-library.js";
import { RunService } from "../../src/application/run-service.js";
import { respondBuildboard } from "../../src/presentation/routes.js";

test("card library persists and indexes backlinks", async () => {
	const root = await mkdtemp(join(tmpdir(), "bb-cards-"));
	const workspace = join(root, "ws");
	const dshHome = join(root, "home");
	try {
		const library = new CardLibrary({ workspace, dshHome });
		await library.ensureReady();
		const a = await library.write({
			scope: "project",
			title: "A",
			body: "links [[b]]",
			updatedBy: "user",
		});
		await library.write({
			id: "b",
			scope: "project",
			title: "B",
			body: "target",
		});
		assert.deepEqual(library.backlinksTo("b"), [`project:${a.id}`]);
		assert.equal(library.list({ query: "target" }).length, 1);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("board registry create apply flush and http state", async () => {
	const root = await mkdtemp(join(tmpdir(), "bb-boards-"));
	const workspace = join(root, "ws");
	const dshHome = join(root, "home");
	try {
		const boards = new BoardRegistry();
		const cards = new CardLibrary({ workspace, dshHome });
		const runs = new RunService(cards);
		await boards.attachWorkspace(workspace);
		const board = await boards.create({ title: "Main", slug: "main" });
		boards.applyDiff(board.id, {
			put: [
				{
					id: "shape:x",
					typeName: "shape",
					type: "note",
					props: { text: "hi" },
				},
			],
			actor: "agent",
		});
		await boards.flush(board.id);

		const services = {
			boards,
			cards,
			runs,
			resolveWorkspace: () => workspace,
			ensureSessionWorkspace: async () => workspace,
		};
		const get = await respondBuildboard(services, {
			method: "GET",
			url: "/plugin-api/buildboard/state?board=main",
		});
		assert.equal(get.status, 200);
		assert.equal((get.body as { slug: string }).slug, "main");

		const post = await respondBuildboard(services, {
			method: "POST",
			url: "/plugin-api/buildboard/state?board=main",
			body: JSON.stringify({
				put: [{ id: "shape:y", typeName: "shape", type: "text" }],
				actor: "user",
			}),
		});
		assert.equal(post.status, 200);
		assert.ok((post.body as { revision: number }).revision >= 2);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
