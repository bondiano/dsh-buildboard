/**
 * Board merge rules shared by the Host route and the Client board.
 *
 * Two parties write one board: the user in the browser and the agent through
 * tools. Stored elements carry `updatedBy`/`updatedAt` and both directions use
 * the same last-writer-wins key, so a reload, a poll and a POST cannot disagree
 * about who won.
 *
 * @module @local/dsh-cult-canvas/application/board-sync
 */
/** Millisecond stamp of one element, `0` when it carries none. */
function stampOf(element) {
    return typeof element.updatedAt === "number" ? element.updatedAt : 0;
}
/**
 * Merge one browser snapshot into the Host store, last writer wins.
 *
 * An element the store lacks is created; one whose incoming stamp is not older
 * replaces the stored copy. A removal only lands while the stored copy is not
 * newer than the client clock, so an agent edit that arrived mid-flight is not
 * deleted by a stale click.
 *
 * @param store - Host board store.
 * @param payload - the posted snapshot.
 * @returns counts of applied element changes.
 */
export function applyUserSnapshot(store, payload) {
    let created = 0;
    let updated = 0;
    let deleted = 0;
    for (const incoming of payload.elements ?? []) {
        if (typeof incoming?.id !== "string")
            continue;
        const existing = store.getElementById(incoming.id);
        const next = {
            ...incoming,
            // Only the two known writers may claim a stamp.
            updatedBy: incoming.updatedBy === "agent" ? "agent" : "user",
            updatedAt: stampOf(incoming) || payload.clientTime,
        };
        if (existing === undefined) {
            store.setElement(next);
            created += 1;
            continue;
        }
        if (stampOf(next) >= stampOf(existing)) {
            store.setElement(next);
            updated += 1;
        }
    }
    for (const edge of payload.edges ?? []) {
        if (typeof edge?.id !== "string")
            continue;
        store.addEdge(edge);
    }
    for (const id of payload.removeIds ?? []) {
        const existing = store.getElementById(id);
        if (existing === undefined) {
            if (store.deleteEdge(id))
                deleted += 1;
            continue;
        }
        if (stampOf(existing) <= payload.clientTime) {
            const removed = store.deleteElements([id]);
            deleted += removed.deletedElements.length;
            continue;
        }
        // A newer write won the race: keep the element, drop any stale edge.
        store.deleteEdge(id);
    }
    return { created, updated, deleted };
}
/**
 * Fold a server snapshot into the local board.
 *
 * The server is authoritative, except for local elements stamped after the last
 * successful sync: those survive and the caller re-posts them. Ids the server no
 * longer has and the user did not just create are dropped.
 *
 * @param local - board state in the browser.
 * @param server - board state from `GET /state`.
 * @param lastSyncedAt - client clock of the last accepted sync.
 * @returns the reconciled board and the ids still owed to the server.
 */
export function reconcileFromServer(local, server, lastSyncedAt) {
    const serverById = new Map(server.elements.map((el) => [el.id, el]));
    const pendingIds = [];
    const merged = [];
    for (const [id, element] of serverById) {
        const mine = local.elements.find((el) => el.id === id);
        if (mine !== undefined && stampOf(mine) > lastSyncedAt) {
            merged.push(mine);
            pendingIds.push(id);
            continue;
        }
        merged.push(element);
    }
    for (const element of local.elements) {
        if (serverById.has(element.id))
            continue;
        if (stampOf(element) > lastSyncedAt) {
            merged.push(element);
            pendingIds.push(element.id);
        }
    }
    return { elements: merged, edges: server.edges, pendingIds };
}
