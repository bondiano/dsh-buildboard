import assert from "node:assert/strict";
import { createActor, fromCallback, fromPromise } from "xstate";
import { test } from "node:test";
import {
	preferBoard,
	appShellMachine,
	type AppShellCatalog,
} from "../../src/domain/machines/app-shell.machine.js";
import { boardSessionMachine } from "../../src/domain/machines/board-session.machine.js";
import { cardEditorMachine } from "../../src/domain/machines/card-editor.machine.js";
import { nextSyncStatus } from "../../src/domain/machines/board-sync.machine.js";
import { nextRunStatus } from "../../src/domain/machines/run.machine.js";
import { createActorStore } from "../../src/application/actor-store.js";

test("preferBoard keeps an explicit selection including main", () => {
	const boards = [
		{
			id: "1",
			slug: "main",
			title: "Main",
			updatedAt: 1,
			revision: 1,
		},
		{
			id: "2",
			slug: "session-abc",
			title: "Session",
			updatedAt: 99,
			revision: 1,
		},
	];
	assert.equal(preferBoard(boards, "main"), "main");
	assert.equal(preferBoard(boards, "session-abc"), "session-abc");
	assert.equal(preferBoard(boards, "missing"), "session-abc");
});

test("run machine rejects illegal transitions", () => {
	assert.throws(() => nextRunStatus("draft", "START"));
	assert.equal(nextRunStatus("draft", "QUEUE"), "queued");
});

test("board sync machine rejects illegal transitions", () => {
	assert.throws(() => nextSyncStatus("idle", "OK"));
	assert.equal(nextSyncStatus("idle", "PULL"), "pulling");
});

test("app shell refreshes into ready when workspace exists", async () => {
	const catalog: AppShellCatalog = {
		workspace: "/tmp/ws",
		boards: [
			{ id: "1", slug: "main", title: "Main", updatedAt: 1, revision: 0 },
		],
		cards: [],
		runs: [],
	};
	const machine = appShellMachine.provide({
		actors: {
			refreshCatalog: fromPromise(
				async (): Promise<AppShellCatalog> => catalog,
			),
			ensureWorkspace: fromPromise(async (): Promise<AppShellCatalog> => {
				throw new Error("should not ensure");
			}),
			loadCard: fromPromise(async () => ({ title: "", body: "" })),
			pollTicks: fromCallback(() => () => {}),
		},
	});
	const actor = createActor(machine);
	actor.start();
	actor.send({ type: "CONFIGURE", visible: true, pollIntervalMs: 60_000 });
	await new Promise((resolve) => setTimeout(resolve, 20));
	assert.equal(actor.getSnapshot().value, "ready");
	assert.equal(actor.getSnapshot().context.workspace, "/tmp/ws");
	actor.stop();
});

test("board session loads module then becomes active", async () => {
	const machine = boardSessionMachine.provide({
		actors: {
			loadModule: fromPromise(async (): Promise<void> => undefined),
			pullOnce: fromPromise(async (): Promise<void> => undefined),
			pollTicks: fromCallback(() => () => {}),
		},
	});
	const actor = createActor(machine);
	actor.start();
	actor.send({
		type: "CONFIGURE",
		board: "main",
		visible: true,
		pollIntervalMs: 60_000,
	});
	await new Promise((resolve) => setTimeout(resolve, 20));
	assert.equal(actor.getSnapshot().matches("active"), true);
	actor.stop();
});

test("card editor debounce leads to save", async () => {
	let saved = 0;
	const machine = cardEditorMachine.provide({
		actors: {
			loadTipTap: fromPromise(async (): Promise<void> => undefined),
			persistCard: fromPromise(async ({ input }) => {
				saved += 1;
				return { title: input.title, body: input.body };
			}),
		},
	});
	const actor = createActor(machine);
	actor.start();
	await new Promise((resolve) => setTimeout(resolve, 20));
	actor.send({
		type: "OPEN",
		scope: "project",
		id: "c1",
		title: "T",
		body: "B",
	});
	await new Promise((resolve) => setTimeout(resolve, 20));
	actor.send({ type: "BODY", body: "B2" });
	await new Promise((resolve) => setTimeout(resolve, 700));
	assert.equal(saved, 1);
	assert.equal(actor.getSnapshot().context.status, "saved");
	actor.stop();
});

test("actor store starts on subscribe and stops on last unsubscribe", () => {
	const empty: AppShellCatalog = {
		workspace: null,
		boards: [],
		cards: [],
		runs: [],
	};
	const machine = appShellMachine.provide({
		actors: {
			refreshCatalog: fromPromise(async (): Promise<AppShellCatalog> => empty),
			ensureWorkspace: fromPromise(async (): Promise<AppShellCatalog> => ({
				workspace: "/tmp",
				boards: [],
				cards: [],
				runs: [],
			})),
			loadCard: fromPromise(async () => ({ title: "", body: "" })),
			pollTicks: fromCallback(() => () => {}),
		},
	});
	const store = createActorStore(machine);
	assert.equal(store.getActor(), null);
	const off = store.subscribe(() => {});
	assert.ok(store.getActor());
	off();
	assert.equal(store.getActor(), null);
});
