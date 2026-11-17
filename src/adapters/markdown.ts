import type {
	CardDocument,
	CardKind,
	CardRunState,
	RunKind,
	RunStatus,
} from "../domain/card.js";
import type { CardScope } from "../domain/ids.js";

/** Serialize a card to markdown with YAML-like frontmatter. */
export function serializeCard(card: CardDocument): string {
	const lines = [
		"---",
		`id: ${card.id}`,
		`scope: ${card.scope}`,
		`title: ${jsonString(card.title)}`,
		`kind: ${card.kind}`,
		`tags: [${card.tags.map(jsonString).join(", ")}]`,
		`createdAt: ${card.createdAt}`,
		`updatedAt: ${card.updatedAt}`,
	];
	if (card.updatedBy) lines.push(`updatedBy: ${card.updatedBy}`);
	if (card.run) {
		lines.push(`run.id: ${card.run.id}`);
		lines.push(`run.kind: ${card.run.kind}`);
		lines.push(`run.status: ${card.run.status}`);
		if (card.run.sessionId) lines.push(`run.sessionId: ${card.run.sessionId}`);
		if (card.run.error) lines.push(`run.error: ${jsonString(card.run.error)}`);
		lines.push(`run.updatedAt: ${card.run.updatedAt}`);
	}
	lines.push("---", "", card.body.replace(/^\n+/, ""));
	return `${lines.join("\n").replace(/\n+$/, "")}\n`;
}

/** Parse a card markdown file; throws on missing required fields. */
export function parseCard(
	raw: string,
	fallback: { id: string; scope: CardScope },
): CardDocument {
	const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw);
	const meta: Record<string, string> = {};
	let body = raw;
	if (match) {
		for (const line of match[1]!.split(/\r?\n/)) {
			const idx = line.indexOf(":");
			if (idx <= 0) continue;
			meta[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
		}
		body = match[2] ?? "";
	}
	const tags = parseTags(meta["tags"] ?? "[]");
	const run = parseRun(meta);
	return {
		id: meta["id"] || fallback.id,
		scope: (meta["scope"] as CardScope) || fallback.scope,
		title: unquote(meta["title"] ?? fallback.id),
		kind: parseKind(meta["kind"]),
		tags,
		body: body.replace(/^\n+/, "").replace(/\n+$/, ""),
		createdAt: numberOr(meta["createdAt"], Date.now()),
		updatedAt: numberOr(meta["updatedAt"], Date.now()),
		updatedBy:
			meta["updatedBy"] === "agent"
				? "agent"
				: meta["updatedBy"] === "user"
					? "user"
					: undefined,
		run,
	};
}

function parseKind(raw: string | undefined): CardKind {
	if (raw === "research" || raw === "task" || raw === "note") return raw;
	return "note";
}

function parseTags(raw: string): string[] {
	const inner = raw.replace(/^\[/, "").replace(/\]$/, "");
	if (!inner.trim()) return [];
	return inner
		.split(",")
		.map((part) => unquote(part.trim()))
		.filter(Boolean);
}

function parseRun(meta: Record<string, string>): CardRunState | undefined {
	const id = meta["run.id"];
	if (!id) return undefined;
	const kind = meta["run.kind"] as RunKind | undefined;
	const status = meta["run.status"] as RunStatus | undefined;
	if (!kind || !status) return undefined;
	return {
		id,
		kind,
		status,
		sessionId: meta["run.sessionId"],
		error: meta["run.error"] ? unquote(meta["run.error"]) : undefined,
		updatedAt: numberOr(meta["run.updatedAt"], Date.now()),
	};
}

function jsonString(value: string): string {
	return JSON.stringify(value);
}

function unquote(value: string): string {
	if (
		(value.startsWith('"') && value.endsWith('"')) ||
		(value.startsWith("'") && value.endsWith("'"))
	) {
		try {
			return JSON.parse(value.replace(/^'/, '"').replace(/'$/, '"')) as string;
		} catch {
			return value.slice(1, -1);
		}
	}
	return value;
}

function numberOr(raw: string | undefined, fallback: number): number {
	if (raw === undefined) return fallback;
	const n = Number(raw);
	return Number.isFinite(n) ? n : fallback;
}
