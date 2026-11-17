import type { IncomingMessage, ServerResponse } from "node:http";
import type { BoardRegistry } from "../application/board-document.js";
import type { CardLibrary } from "../application/card-library.js";
import type { RunService } from "../application/run-service.js";
import type { BoardDiff } from "../domain/board.js";
import { BUILDBOARD_API_ROUTE } from "../domain/route.js";
import { parseCardRef, type CardScope } from "../domain/ids.js";

export interface RouteServices {
	boards: BoardRegistry;
	cards: CardLibrary;
	runs: RunService;
	resolveWorkspace: (session?: string) => string | undefined;
}

export interface RouteQuery {
	session?: string;
	workspace?: string;
	board?: string;
	since?: number;
}

export function parseQuery(rawUrl: string): RouteQuery {
	try {
		const url = new URL(rawUrl, "http://127.0.0.1");
		const rawSince = url.searchParams.get("since");
		const since = rawSince === null ? Number.NaN : Number(rawSince);
		return {
			session: url.searchParams.get("session") ?? undefined,
			workspace: url.searchParams.get("workspace") ?? undefined,
			board: url.searchParams.get("board") ?? undefined,
			since: Number.isInteger(since) && since >= 0 ? since : undefined,
		};
	} catch {
		return {};
	}
}

async function prepare(
	services: RouteServices,
	query: RouteQuery,
): Promise<void> {
	const workspace = query.workspace ?? services.resolveWorkspace(query.session);
	await services.boards.attachWorkspace(workspace);
	services.cards.setWorkspace(workspace);
	await services.cards.ensureReady();
}

export async function respondBuildboard(
	services: RouteServices,
	request: { method?: string; url: string; body?: string },
): Promise<{ status: number; body: unknown }> {
	const method = (request.method ?? "GET").toUpperCase();
	const pathname = (() => {
		try {
			return new URL(request.url, "http://127.0.0.1").pathname.replace(
				/\/+$/,
				"",
			);
		} catch {
			return request.url.replace(/\/+$/, "");
		}
	})();
	const query = parseQuery(request.url);
	const base = BUILDBOARD_API_ROUTE;

	if (pathname === `${base}/boards` && method === "GET") {
		await prepare(services, query);
		return { status: 200, body: { boards: services.boards.list() } };
	}

	if (pathname === `${base}/boards` && method === "POST") {
		await prepare(services, query);
		const payload = jsonObject(request.body);
		const title =
			typeof payload?.["title"] === "string" ? payload["title"] : "Board";
		const board = await services.boards.create({
			title,
			slug: typeof payload?.["slug"] === "string" ? payload["slug"] : undefined,
			sessionId:
				typeof payload?.["sessionId"] === "string"
					? payload["sessionId"]
					: query.session,
		});
		return { status: 200, body: services.boards.snapshot(board.id) };
	}

	if (pathname.endsWith("/state")) {
		await prepare(services, query);
		const boardId = query.board ?? "main";
		let board = services.boards.get(boardId);
		if (!board && boardId === "main") {
			board = await services.boards.create({ title: "Main", slug: "main" });
		}
		if (!board) return { status: 404, body: "board not found" };
		if (method === "GET" || method === "HEAD") {
			if (query.since !== undefined && query.since === board.revision) {
				return { status: 200, body: { revision: board.revision } };
			}
			return { status: 200, body: services.boards.snapshot(board.id) };
		}
		if (method === "POST") {
			const payload = jsonObject(request.body) as BoardDiff | undefined;
			if (!payload) return { status: 400, body: "invalid diff" };
			const snap = services.boards.applyDiff(board.id, {
				...payload,
				actor: payload.actor ?? "user",
			});
			return { status: 200, body: { revision: snap.revision } };
		}
		return { status: 405, body: "Method Not Allowed" };
	}

	if (pathname.endsWith("/flush") && method === "POST") {
		await prepare(services, query);
		await services.boards.flush(query.board);
		return {
			status: 200,
			body: { ok: true, workspace: services.boards.workspace },
		};
	}

	if (pathname === `${base}/cards` && method === "GET") {
		await prepare(services, query);
		const url = new URL(request.url, "http://127.0.0.1");
		return {
			status: 200,
			body: {
				cards: services.cards.list({
					scope:
						(url.searchParams.get("scope") as CardScope | null) ?? undefined,
					query: url.searchParams.get("query") ?? undefined,
					tag: url.searchParams.get("tag") ?? undefined,
				}),
			},
		};
	}

	if (pathname === `${base}/cards` && method === "POST") {
		await prepare(services, query);
		const payload = jsonObject(request.body);
		if (!payload || typeof payload["title"] !== "string") {
			return { status: 400, body: "title required" };
		}
		const ref =
			typeof payload["ref"] === "string"
				? parseCardRef(payload["ref"])
				: undefined;
		const card = await services.cards.write({
			id: ref?.id,
			scope: ref?.scope ?? (payload["scope"] as CardScope) ?? "project",
			title: payload["title"],
			body: typeof payload["body"] === "string" ? payload["body"] : undefined,
			kind: payload["kind"] as "note" | "research" | "task" | undefined,
			tags: Array.isArray(payload["tags"])
				? payload["tags"].map(String)
				: undefined,
			updatedBy: "user",
		});
		return { status: 200, body: { card } };
	}

	if (pathname.startsWith(`${base}/cards/`) && method === "GET") {
		await prepare(services, query);
		const refRaw = decodeURIComponent(pathname.slice(`${base}/cards/`.length));
		const parsed = parseCardRef(refRaw) ?? {
			scope: "project" as const,
			id: refRaw,
		};
		const card = services.cards.get(parsed.scope, parsed.id);
		if (!card) return { status: 404, body: "card not found" };
		return {
			status: 200,
			body: {
				card,
				backlinks: services.cards.backlinksTo(card.id),
			},
		};
	}

	if (pathname === `${base}/runs` && method === "GET") {
		return { status: 200, body: { runs: services.runs.list() } };
	}

	return { status: 404, body: "Not Found" };
}

export async function handleBuildboardHttp(
	services: RouteServices,
	req: IncomingMessage,
	res: ServerResponse,
): Promise<void> {
	const method = (req.method ?? "GET").toUpperCase();
	const body =
		method === "GET" || method === "HEAD" ? undefined : await readBody(req);
	const reply = await respondBuildboard(services, {
		method,
		url: req.url || "",
		body,
	});
	const payload =
		typeof reply.body === "string" ? reply.body : JSON.stringify(reply.body);
	res.writeHead(reply.status, {
		"content-type":
			typeof reply.body === "string"
				? "text/plain; charset=utf-8"
				: "application/json; charset=utf-8",
	});
	res.end(payload);
}

function jsonObject(
	body: string | undefined,
): Record<string, unknown> | undefined {
	if (!body) return undefined;
	try {
		const parsed: unknown = JSON.parse(body);
		if (
			typeof parsed === "object" &&
			parsed !== null &&
			!Array.isArray(parsed)
		) {
			return parsed as Record<string, unknown>;
		}
	} catch {
		return undefined;
	}
	return undefined;
}

async function readBody(req: IncomingMessage): Promise<string> {
	const chunks: Buffer[] = [];
	let size = 0;
	for await (const chunk of req) {
		const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
		size += buffer.length;
		if (size > 8 * 1024 * 1024) throw new Error("payload too large");
		chunks.push(buffer);
	}
	return Buffer.concat(chunks).toString("utf8");
}
