import assert from "node:assert/strict";
import { test } from "node:test";
import {
	htmlToMarkdown,
	markdownToHtml,
} from "../../src/adapters/markdown-html.js";
import { RunService } from "../../src/application/run-service.js";
import { CardLibrary } from "../../src/application/card-library.js";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("markdown html round trip keeps headings and wiki links", () => {
	const md = "# Title\n\nSee [[card_a]] and **bold**.\n";
	const html = markdownToHtml(md);
	assert.match(html, /<h1>/);
	assert.match(html, /wiki:card_a/);
	const back = htmlToMarkdown(html);
	assert.match(back, /Title/);
	assert.match(back, /\*\*bold\*\*/);
});

test("agent status drives run machine", async () => {
	const root = await mkdtemp(join(tmpdir(), "bb-run-"));
	try {
		const cards = new CardLibrary({
			workspace: join(root, "ws"),
			dshHome: join(root, "home"),
		});
		await cards.ensureReady();
		const runs = new RunService(cards);
		const run = await runs.create({
			kind: "research",
			boardSlug: "main",
			brief: "test",
			status: "queued",
		});
		runs.bindSession("sess-1", run.id);
		await runs.onAgentStatus("sess-1", "running");
		assert.equal(runs.get(run.id)?.status, "running");
		await runs.onAgentStatus("sess-1", "idle");
		assert.equal(runs.get(run.id)?.status, "review");
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
