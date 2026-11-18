import type { BoardRegistry } from "../../application/board-document.js";
import type { CardLibrary } from "../../application/card-library.js";
import type { RunService } from "../../application/run-service.js";
import { createId, parseCardRef, type CardScope } from "../../domain/ids.js";
import type {
	HostContext,
	ToolDefinition,
	ToolExec,
} from "../../domain/types.js";

export interface ToolServices {
	boards: BoardRegistry;
	cards: CardLibrary;
	runs: RunService;
	resolveWorkspace: (exec?: ToolExec) => string | undefined;
}

function textOutput() {
	return {
		schema: { type: "object", additionalProperties: true },
		render(_args: unknown, value: unknown) {
			return [{ type: "text" as const, text: JSON.stringify(value, null, 2) }];
		},
	};
}

/** Register board / card / run tools on the host. */
export function buildBuildboardTools(
	_ctx: HostContext,
	services: ToolServices,
): ToolDefinition[] {
	const boardOf = async (exec?: ToolExec, board?: string) => {
		const workspace = services.resolveWorkspace(exec);
		await services.boards.attachWorkspace(workspace);
		services.cards.setWorkspace(workspace);
		await services.cards.ensureReady();
		const sessionId = exec?.agent?.session?.id;
		if (sessionId) services.runs.bindSession(sessionId);
		const id = board ?? "main";
		let doc = services.boards.get(id);
		if (!doc && id === "main") {
			doc = await services.boards.create({ title: "Main", slug: "main" });
		}
		if (!doc) throw new Error(`board not found: ${id}`);
		return doc;
	};

	return [
		{
			name: "board_get_state",
			description: "Read a buildboard: title, revision and records.",
			parameters: {
				type: "object",
				properties: {
					board: {
						type: "string",
						description: "Board id or slug (default main)",
					},
				},
			},
			output: textOutput(),
			async execute(args, exec) {
				const board = String((args as { board?: string }).board ?? "main");
				const doc = await boardOf(exec, board);
				return services.boards.snapshot(doc.id);
			},
		},
		{
			name: "board_query",
			description: "Filter board records by typeName or shape type.",
			parameters: {
				type: "object",
				properties: {
					board: { type: "string" },
					typeName: { type: "string" },
					type: { type: "string" },
				},
			},
			output: textOutput(),
			async execute(args, exec) {
				const a = args as { board?: string; typeName?: string; type?: string };
				const doc = await boardOf(exec, a.board);
				const records = Object.values(doc.records).filter((record) => {
					if (a.typeName && record.typeName !== a.typeName) return false;
					if (a.type && record["type"] !== a.type) return false;
					return true;
				});
				return { board: doc.slug, count: records.length, records };
			},
		},
		{
			name: "board_create_shape",
			description:
				"Create a shape record on the board (card, note, text, frame, arrow, …).",
			parameters: {
				type: "object",
				required: ["type"],
				properties: {
					board: { type: "string" },
					type: { type: "string" },
					x: { type: "number" },
					y: { type: "number" },
					props: { type: "object" },
					id: { type: "string" },
				},
			},
			output: textOutput(),
			async execute(args, exec) {
				const a = args as {
					board?: string;
					type: string;
					x?: number;
					y?: number;
					props?: Record<string, unknown>;
					id?: string;
				};
				const doc = await boardOf(exec, a.board);
				const id = a.id ?? `shape:${createId()}`;
				const record = {
					id,
					typeName: "shape",
					type: a.type,
					x: a.x ?? 0,
					y: a.y ?? 0,
					rotation: 0,
					opacity: 1,
					isLocked: false,
					props: a.props ?? {},
					parentId: "page:page",
					index: "a1",
					meta: {},
				};
				const snap = services.boards.applyDiff(doc.id, {
					put: [record],
					actor: "agent",
					clientTime: Date.now(),
				});
				return { id, revision: snap.revision };
			},
		},
		{
			name: "board_update_shape",
			description: "Patch an existing shape record.",
			parameters: {
				type: "object",
				required: ["id"],
				properties: {
					board: { type: "string" },
					id: { type: "string" },
					patch: { type: "object" },
				},
			},
			output: textOutput(),
			async execute(args, exec) {
				const a = args as {
					board?: string;
					id: string;
					patch?: Record<string, unknown>;
				};
				const doc = await boardOf(exec, a.board);
				const prev = doc.records[a.id];
				if (!prev) throw new Error(`shape not found: ${a.id}`);
				const next: Record<string, unknown> = { ...prev, id: a.id };
				if (a.patch && typeof a.patch === "object") {
					Object.assign(next, a.patch, { id: a.id });
				}
				const snap = services.boards.applyDiff(doc.id, {
					put: [next],
					actor: "agent",
					clientTime: Date.now(),
				});
				return { id: a.id, revision: snap.revision };
			},
		},
		{
			name: "board_delete_shape",
			description: "Delete shapes by id.",
			parameters: {
				type: "object",
				required: ["ids"],
				properties: {
					board: { type: "string" },
					ids: { type: "array", items: { type: "string" } },
				},
			},
			output: textOutput(),
			async execute(args, exec) {
				const a = args as { board?: string; ids: string[] };
				const doc = await boardOf(exec, a.board);
				const snap = services.boards.applyDiff(doc.id, {
					remove: a.ids,
					actor: "agent",
					clientTime: Date.now(),
				});
				return { removed: a.ids, revision: snap.revision };
			},
		},
		{
			name: "board_connect",
			description: "Create an arrow between two shapes.",
			parameters: {
				type: "object",
				required: ["from", "to"],
				properties: {
					board: { type: "string" },
					from: { type: "string" },
					to: { type: "string" },
					label: { type: "string" },
				},
			},
			output: textOutput(),
			async execute(args, exec) {
				const a = args as {
					board?: string;
					from: string;
					to: string;
					label?: string;
				};
				const doc = await boardOf(exec, a.board);
				const id = `shape:${createId("arrow")}`;
				const record = {
					id,
					typeName: "shape",
					type: "arrow",
					x: 0,
					y: 0,
					rotation: 0,
					opacity: 1,
					isLocked: false,
					props: {
						start: {
							type: "binding",
							boundShapeId: a.from,
							normalizedAnchor: { x: 0.5, y: 0.5 },
							isExact: false,
						},
						end: {
							type: "binding",
							boundShapeId: a.to,
							normalizedAnchor: { x: 0.5, y: 0.5 },
							isExact: false,
						},
						text: a.label ?? "",
					},
					parentId: "page:page",
					index: "a1",
					meta: {},
				};
				const snap = services.boards.applyDiff(doc.id, {
					put: [record],
					actor: "agent",
					clientTime: Date.now(),
				});
				return { id, revision: snap.revision };
			},
		},
		{
			name: "board_layout",
			description: "Simple grid layout for the given shape ids.",
			parameters: {
				type: "object",
				required: ["ids"],
				properties: {
					board: { type: "string" },
					ids: { type: "array", items: { type: "string" } },
					columns: { type: "number" },
					gap: { type: "number" },
				},
			},
			output: textOutput(),
			async execute(args, exec) {
				const a = args as {
					board?: string;
					ids: string[];
					columns?: number;
					gap?: number;
				};
				const doc = await boardOf(exec, a.board);
				const columns = a.columns ?? 3;
				const gap = a.gap ?? 40;
				const put = a.ids.flatMap((id, index) => {
					const prev = doc.records[id];
					if (!prev) return [];
					const col = index % columns;
					const row = Math.floor(index / columns);
					return [
						{
							...prev,
							x: col * (280 + gap),
							y: row * (180 + gap),
						},
					];
				});
				const snap = services.boards.applyDiff(doc.id, {
					put,
					actor: "agent",
					clientTime: Date.now(),
				});
				return { laidOut: put.length, revision: snap.revision };
			},
		},
		{
			name: "card_list",
			description: "List cards in project and/or global libraries.",
			parameters: {
				type: "object",
				properties: {
					scope: { type: "string", enum: ["project", "global"] },
					query: { type: "string" },
					tag: { type: "string" },
				},
			},
			output: textOutput(),
			async execute(args, exec) {
				await boardOf(exec);
				const a = args as { scope?: CardScope; query?: string; tag?: string };
				return { cards: services.cards.list(a) };
			},
		},
		{
			name: "card_read",
			description: "Read one card by scope:id or id in project scope.",
			parameters: {
				type: "object",
				required: ["ref"],
				properties: { ref: { type: "string" } },
			},
			output: textOutput(),
			async execute(args, exec) {
				await boardOf(exec);
				const ref = String((args as { ref: string }).ref);
				const parsed = parseCardRef(ref) ?? {
					scope: "project" as const,
					id: ref,
				};
				const card = services.cards.get(parsed.scope, parsed.id);
				if (!card) throw new Error(`card not found: ${ref}`);
				return {
					card,
					backlinks: services.cards
						.backlinksTo(card.id)
						.concat(services.cards.backlinksTo(`${card.scope}:${card.id}`)),
				};
			},
		},
		{
			name: "card_write",
			description: "Create or update a markdown card.",
			parameters: {
				type: "object",
				required: ["title"],
				properties: {
					ref: { type: "string" },
					scope: { type: "string", enum: ["project", "global"] },
					title: { type: "string" },
					body: { type: "string" },
					kind: { type: "string", enum: ["note", "research", "task"] },
					tags: { type: "array", items: { type: "string" } },
				},
			},
			output: textOutput(),
			async execute(args, exec) {
				await boardOf(exec);
				const a = args as {
					ref?: string;
					scope?: CardScope;
					title: string;
					body?: string;
					kind?: "note" | "research" | "task";
					tags?: string[];
				};
				const parsed = a.ref ? parseCardRef(a.ref) : undefined;
				const card = await services.cards.write({
					id: parsed?.id,
					scope: parsed?.scope ?? a.scope ?? "project",
					title: a.title,
					body: a.body,
					kind: a.kind,
					tags: a.tags,
					updatedBy: "agent",
				});
				return { ref: `${card.scope}:${card.id}`, card };
			},
		},
		{
			name: "card_search",
			description: "Search cards by free text.",
			parameters: {
				type: "object",
				required: ["query"],
				properties: {
					query: { type: "string" },
					scope: { type: "string", enum: ["project", "global"] },
				},
			},
			output: textOutput(),
			async execute(args, exec) {
				await boardOf(exec);
				const a = args as { query: string; scope?: CardScope };
				return {
					cards: services.cards.list({ query: a.query, scope: a.scope }),
				};
			},
		},
		{
			name: "run_report",
			description: "Report progress or completion of a board-started run.",
			parameters: {
				type: "object",
				required: ["runId", "ok", "summary"],
				properties: {
					runId: { type: "string" },
					ok: { type: "boolean" },
					summary: { type: "string" },
					error: { type: "string" },
				},
			},
			output: textOutput(),
			async execute(args) {
				const a = args as {
					runId: string;
					ok: boolean;
					summary: string;
					error?: string;
				};
				const run = await services.runs.report(a.runId, a);
				return { run, summary: a.summary };
			},
		},
	];
}
