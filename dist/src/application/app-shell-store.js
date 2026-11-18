/**
 * App shell external store: catalog refresh, workspace ensure, card load.
 */
import { fromCallback, fromPromise } from "xstate";
import { BUILDBOARD_API_ROUTE, WORKSPACE_REQUIRED } from "../domain/route.js";
import { appShellMachine, } from "../domain/machines/app-shell.machine.js";
import { createActorStore } from "./actor-store.js";
function sessionQuery(sessionId) {
    return sessionId ? `session=${encodeURIComponent(sessionId)}` : "";
}
async function fetchCatalog(context) {
    const q = sessionQuery(context.sessionId);
    const metaRes = await fetch(`${BUILDBOARD_API_ROUTE}/meta?${q}`);
    const meta = (await metaRes.json());
    const missingWorkspace = metaRes.status === 409 ||
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
    const b = (await bRes.json());
    const c = (await cRes.json());
    const r = (await rRes.json());
    return {
        workspace: typeof b.workspace === "string"
            ? b.workspace
            : typeof meta.workspace === "string"
                ? meta.workspace
                : null,
        boards: b.boards ?? [],
        cards: c.cards ?? [],
        runs: r.runs ?? [],
    };
}
async function ensureWorkspace(context) {
    const q = sessionQuery(context.sessionId);
    const response = await fetch(`${BUILDBOARD_API_ROUTE}/workspace/ensure?${q}`, { method: "POST" });
    const body = (await response.json());
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
async function loadCard(context) {
    const card = context.selectedCard;
    if (!card)
        return { title: "", body: "" };
    const q = sessionQuery(context.sessionId);
    const response = await fetch(`${BUILDBOARD_API_ROUTE}/cards/${card.scope}:${card.id}?${q}`);
    const body = (await response.json());
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
            const timer = setInterval(() => sendBack({ type: "TICK" }), input.pollIntervalMs);
            return () => clearInterval(timer);
        }),
    },
});
export function createAppShellStore() {
    return createActorStore(providedAppShellMachine);
}
