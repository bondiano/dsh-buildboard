/** Board document: a named map of tldraw store records. */

/** One tldraw store record (opaque JSON). */
export type BoardRecord = Record<string, unknown> & {
	id?: string;
	typeName?: string;
};

/** On-disk board document. */
export interface BoardDocumentData {
	id: string;
	slug: string;
	title: string;
	/** Map of record id → record. */
	records: Record<string, BoardRecord>;
	revision: number;
	createdAt: number;
	updatedAt: number;
	/** Session that owns this board when created by /canvas. */
	sessionId?: string;
}

/** Diff applied by client or agent tools. */
export interface BoardDiff {
	put?: BoardRecord[];
	remove?: string[];
	clientTime?: number;
	actor?: "user" | "agent";
}

/** Snapshot returned to clients and tools. */
export interface BoardSnapshot {
	id: string;
	slug: string;
	title: string;
	revision: number;
	records: Record<string, BoardRecord>;
	sessionId?: string;
}

/** Listing row for the library sidebar. */
export interface BoardSummary {
	id: string;
	slug: string;
	title: string;
	updatedAt: number;
	revision: number;
	sessionId?: string;
}

/** Apply a diff to a mutable record map; returns touched ids. */
export function applyBoardDiff(
	records: Record<string, BoardRecord>,
	diff: BoardDiff,
): { putIds: string[]; removeIds: string[] } {
	const putIds: string[] = [];
	const removeIds: string[] = [];
	for (const id of diff.remove ?? []) {
		if (id in records) {
			delete records[id];
			removeIds.push(id);
		}
	}
	for (const record of diff.put ?? []) {
		const id = typeof record.id === "string" ? record.id : undefined;
		if (!id) continue;
		const prevMeta =
			typeof record["meta"] === "object" &&
			record["meta"] !== null &&
			!Array.isArray(record["meta"])
				? (record["meta"] as Record<string, unknown>)
				: {};
		const stamped =
			diff.actor === undefined
				? record
				: {
						...record,
						meta: {
							...prevMeta,
							updatedBy: diff.actor,
							updatedAt: diff.clientTime ?? Date.now(),
						},
					};
		records[id] = stamped;
		putIds.push(id);
	}
	return { putIds, removeIds };
}
