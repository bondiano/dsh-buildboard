import { isIP } from "node:net";
import type {
	IncomingHttpHeaders,
	IncomingMessage,
	ServerResponse,
} from "node:http";

export interface WebConnection {
	allowsRemoteAuthorities?: boolean;
	requestRejection?(request: {
		headers: IncomingHttpHeaders;
	}): number | undefined;
}

export interface WebServer {
	host?: string | null;
	register(route: {
		kind: "exact" | "prefix";
		path: string;
		handler?: (req: IncomingMessage, res: ServerResponse) => unknown;
	}): () => void;
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

function connectionFor(ctx: WebAuthContext): WebConnection | undefined {
	return (
		(typeof ctx.get === "function" ? ctx.get("connection") : undefined) ??
		ctx.connection
	);
}

function admission(
	ctx: WebAuthContext,
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
				if (origins.length === 0) return { status: 403 };
				for (const origin of origins) {
					try {
						if (!loopback(new URL(origin).hostname)) return { status: 403 };
					} catch {
						return { status: 403 };
					}
				}
			}
			return { required: false };
		}
		const rejected = connection?.requestRejection?.({ headers });
		if (typeof rejected === "number") return { status: rejected };
		return { required: true };
	} catch {
		return { status: 500 };
	}
}

/** Wrap a webServer so every registered handler is gated. */
export function authenticatedWebServer(
	ctx: WebAuthContext,
	server: WebServer | undefined,
): WebServer | undefined {
	if (!server) return undefined;
	return {
		host: server.host,
		register(route) {
			const handler = route.handler;
			if (!handler) return server.register(route);
			return server.register({
				...route,
				handler(req, res) {
					const result = admission(ctx, server, req);
					if (result.status !== undefined) {
						res.writeHead(result.status, { "content-type": "text/plain" });
						res.end(result.status === 403 ? "Forbidden" : "Error");
						return;
					}
					return handler(req, res);
				},
			});
		},
	};
}
