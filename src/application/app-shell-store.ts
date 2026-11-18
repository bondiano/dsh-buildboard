/**
 * App shell external store: catalog refresh, workspace ensure, card load.
 */
import { fromCallback, fromPromise } from "xstate";
import { BUILDBOARD_API_ROUTE, WORKSPACE_REQUIRED } from "../domain/route.js";
import {
	appShellMachine,
	type AppShellCatalog,
	type AppShellContext,
	type AppShellEvent,
	type BoardSummary,
	type CardSummary,
	type RunSummary,
} from "../domain/machines/app-shell.machine.js";
import { createActorStore, type ActorStore } from "./actor-store.js";

function sessionQuery(sessionId?: string): string {
	return sessionId ? `session=${encodeURIComponent(sessionId)}` : "";
}

async function fetchCatalog(
	context: AppShellContext,
): Promise<AppShellCatalog> {
	const q = sessionQuery(context.sessionId);
	const metaRes = await fetch(`${BUILDBOARD_API_ROUTE}/meta?${q}`);
	const meta = (await metaRes.json()) as {
		workspace?: string | null;
		error?: string;
	};
	const missingWorkspace =
		metaRes.status === 409 ||
		meta.error === WORKSPACE_REQUIRED ||
		meta.workspace == null;
	if (missingWorkspace) {
		return {
			workspace: null,
			boards: [],
			cards: [],
			runs: [],
		};
	}
	const [bRes, cRes, rRes] = await Promise.all([
		fetch(`${BUILDBOARD_API_ROUTE}/boards?${q}`),
		fetch(`${BUILDBOARD_API_ROUTE}/cards?${q}`),
		fetch(`${BUILDBOARD_API_ROUTE}/runs`),
	]);
	const b = (await bRes.json()) as {
		boards?: BoardSummary[];
		workspace?: string | null;
	};
	const c = (await cRes.json()) as { cards?: CardSummary[] };
	const r = (await rRes.json()) as { runs?: RunSummary[] };
	return {
		workspace:
			typeof b.workspace === "string"
				? b.workspace
				: typeof meta.workspace === "string"
					? meta.workspace
					: null,
		boards: b.boards ?? [],
		cards: c.cards ?? [],
		runs: r.runs ?? [],
	};
}

async function ensureWorkspace(
	context: AppShellContext,
): Promise<AppShellCatalog> {
	const q = sessionQuery(context.sessionId);
	const response = await fetch(
		`${BUILDBOARD_API_ROUTE}/workspace/ensure?${q}`,
		{ method: "POST" },
	);
	const body = (await response.json()) as {
		workspace?: string;
		boards?: BoardSummary[];
		cards?: CardSummary[];
		runs?: RunSummary[];
		message?: string;
	};
	if (!response.ok) {
		throw new Error(body.message ?? `HTTP ${response.status}`);
	}
	return {
		workspace: typeof body.workspace === "string" ? body.workspace : null,
		boards: body.boards ?? [],
		cards: body.cards ?? [],
		runs: body.runs ?? [],
	};
}

async function loadCard(
	context: AppShellContext,
): Promise<{ title: string; body: string }> {
	const card = context.selectedCard;
	if (!card) return { title: "", body: "" };
	const q = sessionQuery(context.sessionId);
	const response = await fetch(
		`${BUILDBOARD_API_ROUTE}/cards/${card.scope}:${card.id}?${q}`,
	);
	const body = (await response.json()) as {
		card?: { body?: string; title?: string };
	};
	return {
		title: body.card?.title ?? card.title,
		body: body.card?.body ?? "",
	};
}

const providedAppShellMachine = appShellMachine.provide({
	actors: {
		refreshCatalog: fromPromise(async ({ input }) => fetchCatalog(input)),
		ensureWorkspace: fromPromise(async ({ input }) => ensureWorkspace(input)),
		loadCard: fromPromise(async ({ input }) => loadCard(input)),
		pollTicks: fromCallback(({ input, sendBack }) => {
			const timer = setInterval(
				() => sendBack({ type: "TICK" satisfies AppShellEvent["type"] }),
				input.pollIntervalMs,
			);
			return () => clearInterval(timer);
		}),
	},
});

export type AppShellStore = ActorStore<typeof providedAppShellMachine>;

export function createAppShellStore(): AppShellStore {
	return createActorStore(providedAppShellMachine);
}

export type { AppShellEvent, AppShellContext };
