import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { createRequire } from "node:module";
import { dirname, extname, join } from "node:path";
import type { BoardRegistry } from "../application/board-document.js";
import { buildRunBrief } from "../application/canvas-brief.js";
import type { CardLibrary } from "../application/card-library.js";
import type { RunService } from "../application/run-service.js";
import type { BoardDiff } from "../domain/board.js";
import type { RunKind } from "../domain/card.js";
import {
	BUILDBOARD_API_ROUTE,
	WORKSPACE_REQUIRED,
	WORKSPACE_REQUIRED_HINT,
	isWorkspaceRequiredError,
} from "../domain/route.js";
import { parseCardRef, type CardScope } from "../domain/ids.js";

const require = createRequire(import.meta.url);

export interface RouteServices {
	boards: BoardRegistry;
	cards: CardLibrary;
	runs: RunService;
	resolveWorkspace: (session?: string) => string | undefined;
	ensureSessionWorkspace: (session?: string) => Promise<string>;
}

function workspaceRequiredBody(): {
	error: typeof WORKSPACE_REQUIRED;
	message: string;
} {
	return { error: WORKSPACE_REQUIRED, message: WORKSPACE_REQUIRED_HINT };
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

	if (pathname === `${base}/meta` && method === "GET") {
		await prepare(services, query);
		return {
			status: 200,
			body: {
				workspace: services.boards.workspace ?? null,
				session: query.session ?? null,
				canEnsure: true,
			},
		};
	}

	if (pathname === `${base}/workspace/ensure` && method === "POST") {
		const workspace = await services.ensureSessionWorkspace(query.session);
		await services.boards.attachWorkspace(workspace);
		services.cards.setWorkspace(workspace);
		await services.cards.ensureReady();
		if (!services.boards.get("main")) {
			await services.boards.create({ title: "Main", slug: "main" });
		}
		return {
			status: 200,
			body: {
				workspace,
				boards: services.boards.list(),
			},
		};
	}

	if (pathname === `${base}/boards` && method === "GET") {
		await prepare(services, query);
		return {
			status: 200,
			body: {
				boards: services.boards.list(),
				workspace: services.boards.workspace ?? null,
			},
		};
	}

	if (pathname === `${base}/boards` && method === "POST") {
		await prepare(services, query);
		if (!services.boards.workspace) {
			return { status: 409, body: workspaceRequiredBody() };
		}
		const payload = jsonObject(request.body);
		const title =
			typeof payload?.["title"] === "string" ? payload["title"] : "Board";
		try {
			const board = await services.boards.create({
				title,
				slug:
					typeof payload?.["slug"] === "string" ? payload["slug"] : undefined,
				sessionId:
					typeof payload?.["sessionId"] === "string"
						? payload["sessionId"]
						: query.session,
			});
			return { status: 200, body: services.boards.snapshot(board.id) };
		} catch (error) {
			if (isWorkspaceRequiredError(error)) {
				return { status: 409, body: workspaceRequiredBody() };
			}
			throw error;
		}
	}

	if (pathname.endsWith("/state")) {
		await prepare(services, query);
		const boardId = query.board ?? "main";
		let board = services.boards.get(boardId);
		if (!board && boardId === "main") {
			if (!services.boards.workspace) {
				return { status: 409, body: workspaceRequiredBody() };
			}
			try {
				board = await services.boards.create({ title: "Main", slug: "main" });
			} catch (error) {
				if (isWorkspaceRequiredError(error)) {
					return { status: 409, body: workspaceRequiredBody() };
				}
				throw error;
			}
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
				backlinks: services.cards
					.backlinksTo(card.id)
					.concat(services.cards.backlinksTo(`${card.scope}:${card.id}`)),
			},
		};
	}

	if (pathname.startsWith(`${base}/cards/`) && method === "PUT") {
		await prepare(services, query);
		const refRaw = decodeURIComponent(pathname.slice(`${base}/cards/`.length));
		const parsed = parseCardRef(refRaw) ?? {
			scope: "project" as const,
			id: refRaw,
		};
		const payload = jsonObject(request.body);
		const existing = services.cards.get(parsed.scope, parsed.id);
		if (!existing && typeof payload?.["title"] !== "string") {
			return { status: 400, body: "title required for new card" };
		}
		const card = await services.cards.write({
			id: parsed.id,
			scope: parsed.scope,
			title:
				typeof payload?.["title"] === "string"
					? payload["title"]
					: (existing?.title ?? "Untitled"),
			body:
				typeof payload?.["body"] === "string"
					? payload["body"]
					: existing?.body,
			kind:
				(payload?.["kind"] as "note" | "research" | "task" | undefined) ??
				existing?.kind,
			tags: Array.isArray(payload?.["tags"])
				? payload!["tags"].map(String)
				: existing?.tags,
			updatedBy: "user",
		});
		return { status: 200, body: { card } };
	}

	if (pathname === `${base}/runs` && method === "GET") {
		return { status: 200, body: { runs: services.runs.list() } };
	}

	if (pathname === `${base}/runs` && method === "POST") {
		await prepare(services, query);
		const payload = jsonObject(request.body);
		const kind = payload?.["kind"];
		if (kind !== "research" && kind !== "implement" && kind !== "canvas") {
			return { status: 400, body: "kind required" };
		}
		const boardSlug =
			typeof payload?.["boardSlug"] === "string"
				? payload["boardSlug"]
				: typeof payload?.["board"] === "string"
					? payload["board"]
					: "main";
		const cardRefs = Array.isArray(payload?.["cardRefs"])
			? payload!["cardRefs"].map(String)
			: undefined;
		const brief =
			typeof payload?.["brief"] === "string"
				? payload["brief"]
				: buildRunBrief({
						kind: kind as Exclude<RunKind, "canvas">,
						boardSlug,
						cardTitles: cardRefs ?? [],
						cardBodies: [],
					});
		const created = await services.runs.create({
			kind: kind as RunKind,
			boardSlug,
			brief,
			cardRef: cardRefs?.[0],
			sessionId: query.session,
		});
		await services.runs.transition(created.id, "QUEUE");
		const run = await services.runs.transition(created.id, "START");
		return { status: 200, body: { run, brief } };
	}

	if (pathname.startsWith(`${base}/assets/`) && method === "GET") {
		const asset = pathname.slice(`${base}/assets/`.length);
		const file = resolveAssetPath(asset);
		if (!file) return { status: 404, body: "asset not found" };
		const bytes = await readFile(file);
		return {
			status: 200,
			body: {
				__raw: true,
				bytes,
				contentType: contentTypeFor(file),
			},
		};
	}

	return { status: 404, body: "Not Found" };
}

function resolveAssetPath(asset: string): string | undefined {
	if (!asset || asset.includes("..") || asset.includes("\\")) return undefined;
	try {
		// tldraw does not export package.json; resolve the entry then climb to root.
		const entry = require.resolve("tldraw");
		let dir = dirname(entry);
		for (let i = 0; i < 6; i += 1) {
			if (existsSync(join(dir, "tldraw.css"))) break;
			dir = dirname(dir);
		}
		if (asset === "tldraw.css") {
			const css = join(dir, "tldraw.css");
			return existsSync(css) ? css : undefined;
		}
		const candidate = join(dir, asset);
		return existsSync(candidate) ? candidate : undefined;
	} catch {
		return undefined;
	}
}

function contentTypeFor(path: string): string {
	switch (extname(path)) {
		case ".css":
			return "text/css; charset=utf-8";
		case ".woff":
			return "font/woff";
		case ".woff2":
			return "font/woff2";
		case ".svg":
			return "image/svg+xml";
		case ".png":
			return "image/png";
		default:
			return "application/octet-stream";
	}
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
	if (
		typeof reply.body === "object" &&
		reply.body !== null &&
		(reply.body as { __raw?: boolean }).__raw === true
	) {
		const raw = reply.body as {
			bytes: Buffer;
			contentType: string;
		};
		res.writeHead(reply.status, {
			"content-type": raw.contentType,
			"cache-control": "public, max-age=86400",
		});
		res.end(raw.bytes);
		return;
	}
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
