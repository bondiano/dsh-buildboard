import { isIP } from "node:net";
import type { IncomingHttpHeaders, IncomingMessage } from "node:http";
import type {
	Disposer,
	HostContext,
	WebServer,
	WebRoute,
} from "../domain/types.js";

export interface WebConnection {
	allowsRemoteAuthorities?: boolean;
	requestRejection?(request: {
		headers: IncomingHttpHeaders;
	}): number | undefined;
}

export interface WebAuthContext {
	get?(name: "connection"): WebConnection | undefined;
	connection?: WebConnection;
	logger?: { warn?(message: string): void };
}

type Admission =
	| { required: boolean; status?: never }
	| { status: number; required?: never };

export function loopback(host: string | undefined | null): boolean {
	const raw = String(host ?? "")
		.trim()
		.toLowerCase();
	if (!raw) return false;
	const ipv6Match = raw.match(/^\[([^\]]+)\](?::\d+)?$/);
	let value = ipv6Match ? ipv6Match[1]! : raw;
	if (/^[a-z0-9.-]+:\d+$/.test(value)) {
		value = value.replace(/:\d+$/, "");
	}
	value = value.replace(/^\[|\]$/g, "");
	return (
		value === "localhost" ||
		value === "::1" ||
		(isIP(value) === 4 && value.startsWith("127.")) ||
		(isIP(value) === 6 &&
			(value === "::1" ||
				value.startsWith("::ffff:127.") ||
				value.startsWith("::ffff:7f")))
	);
}

function connectionFor(
	ctx: WebAuthContext | HostContext,
): WebConnection | undefined {
	return (
		(typeof ctx.get === "function" ? ctx.get("connection") : undefined) ??
		(ctx as WebAuthContext).connection
	);
}

function admission(
	ctx: WebAuthContext | HostContext,
	server: WebServer,
	request: { headers: IncomingHttpHeaders },
): Admission {
	try {
		const headers = request.headers ?? {};
		if (headers["sec-fetch-site"] === "cross-site") {
			return { status: 403 };
		}

		const connection = connectionFor(ctx);
		const required =
			Boolean(process.env.WORKSTATION_DSH_LAN_AUTHORITY?.trim()) ||
			connection?.allowsRemoteAuthorities === true ||
			(server.host != null && !loopback(server.host));

		if (!required) {
			const rawOrigin = headers.origin;
			if (rawOrigin !== undefined) {
				const origins = Array.isArray(rawOrigin) ? rawOrigin : [rawOrigin];
				if (origins.length === 0) {
					return { status: 403 };
				}
				for (const origin of origins) {
					if (typeof origin !== "string" || !origin.trim()) {
						return { status: 403 };
					}
					try {
						const parsed = new URL(origin);
						if (parsed.protocol !== "dsh-app:" && !loopback(parsed.hostname)) {
							return { status: 403 };
						}
					} catch {
						return { status: 403 };
					}
				}
			}
			return { required: false };
		}

		if (typeof connection?.requestRejection !== "function") {
			return { status: 503 };
		}
		const status = connection.requestRejection(request);
		return status === undefined
			? { required: true }
			: { status: status === 403 ? 403 : 401 };
	} catch {
		ctx.logger?.warn?.("private web route authentication failed");
		return { status: 503 };
	}
}

function legacyHeaders(
	server: WebServer,
	original: Record<string, string>,
): Record<string, string>;
function legacyHeaders(
	server: WebServer,
	original: IncomingHttpHeaders,
): IncomingHttpHeaders;
function legacyHeaders(
	server: WebServer,
	original: IncomingHttpHeaders,
): IncomingHttpHeaders {
	const origin = new URL(server.getOrigin());
	origin.hostname = "127.0.0.1";
	const headers: IncomingHttpHeaders = { ...original, host: origin.host };
	if (headers.origin !== undefined) headers.origin = origin.origin;
	return headers;
}

function nodeRequest(
	request: IncomingMessage,
	headers: IncomingHttpHeaders,
): IncomingMessage {
	return new Proxy(request, {
		get(target, key) {
			if (key === "headers") return headers;
			const value = Reflect.get(target, key, target);
			return typeof value === "function" ? value.bind(target) : value;
		},
	});
}

/** Protect private plugin routes with native DSH admission before adapting legacy loopback guards.
 * The facade leaves the host server and private-only desktop transports unchanged.
 */
export function authenticatedWebServer<
	Server extends WebServer | undefined | null,
>(ctx: WebAuthContext | HostContext, server: Server): Server {
	if (!server) return server;
	return new Proxy(server, {
		get(target, key) {
			if (key !== "register") {
				const value = Reflect.get(target, key, target);
				return typeof value === "function" ? value.bind(target) : value;
			}
			return (route: WebRoute): Disposer => {
				const wrapped: WebRoute = { ...route };
				if (route.handler) {
					wrapped.handler = (request, response, ...args) => {
						const result = admission(ctx, target, request);
						if (result.status) {
							response.writeHead(result.status, {
								"content-type": "text/plain; charset=utf-8",
								"cache-control": "no-store",
							});
							response.end(
								result.status === 503
									? "authentication unavailable"
									: "access denied",
							);
							return;
						}
						return route.handler!(
							result.required
								? nodeRequest(request, legacyHeaders(target, request.headers))
								: request,
							response,
							...args,
						);
					};
				}
				if (typeof route.resource === "function") {
					wrapped.resource = (request, ...args) => {
						const original = Object.fromEntries(request.headers);
						const result = admission(ctx, target, { headers: original });
						if (result.status) {
							return new Response(
								result.status === 503
									? "authentication unavailable"
									: "access denied",
								{
									status: result.status,
									headers: {
										"content-type": "text/plain; charset=utf-8",
										"cache-control": "no-store",
									},
								},
							);
						}
						return route.resource!(
							result.required
								? new Request(request, {
										headers: legacyHeaders(target, original),
									})
								: request,
							...args,
						);
					};
				}
				return target.register(wrapped);
			};
		},
	});
}
