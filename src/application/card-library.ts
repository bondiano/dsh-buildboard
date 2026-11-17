import { mkdir, readdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseCard, serializeCard } from "../adapters/markdown.js";
import {
	type CardDocument,
	type CardKind,
	type CardSummary,
	excerptOf,
	extractWikiLinks,
} from "../domain/card.js";
import { createId, type CardScope } from "../domain/ids.js";
import {
	globalCardPath,
	globalCardsDir,
	projectCardPath,
	projectCardsDir,
} from "./paths.js";

export interface CardLibraryOptions {
	workspace?: string;
	dshHome: string;
	maxCards?: number;
}

/** Two-scope card store: project workspace + global user library. */
export class CardLibrary {
	readonly #dshHome: string;
	readonly #maxCards: number;
	#workspace: string | undefined;
	#cache = new Map<string, CardDocument>();
	#backlinks = new Map<string, Set<string>>();

	constructor(options: CardLibraryOptions) {
		this.#dshHome = options.dshHome;
		this.#workspace = options.workspace;
		this.#maxCards = options.maxCards ?? 10_000;
	}

	setWorkspace(workspace: string | undefined): void {
		if (workspace === this.#workspace) return;
		this.#workspace = workspace;
		const stale: string[] = [];
		for (const key of this.#cache.keys()) {
			if (key.startsWith("project:")) stale.push(key);
		}
		for (const key of stale) this.#cache.delete(key);
		this.#rebuildBacklinks();
	}

	async ensureReady(): Promise<void> {
		await mkdir(globalCardsDir(this.#dshHome), { recursive: true });
		if (this.#workspace) {
			await mkdir(projectCardsDir(this.#workspace), { recursive: true });
		}
		await this.#loadScope("global");
		if (this.#workspace) await this.#loadScope("project");
	}

	list(filter?: {
		scope?: CardScope;
		query?: string;
		tag?: string;
	}): CardSummary[] {
		const query = filter?.query?.trim().toLowerCase();
		const rows: CardSummary[] = [];
		for (const card of this.#cache.values()) {
			if (filter?.scope && card.scope !== filter.scope) continue;
			if (filter?.tag && !card.tags.includes(filter.tag)) continue;
			if (
				query &&
				!card.title.toLowerCase().includes(query) &&
				!card.body.toLowerCase().includes(query) &&
				!card.tags.some((t) => t.toLowerCase().includes(query))
			) {
				continue;
			}
			rows.push({
				id: card.id,
				scope: card.scope,
				title: card.title,
				kind: card.kind,
				tags: card.tags,
				updatedAt: card.updatedAt,
				excerpt: excerptOf(card.body),
				runStatus: card.run?.status,
			});
		}
		return rows.sort((a, b) => b.updatedAt - a.updatedAt);
	}

	get(scope: CardScope, id: string): CardDocument | undefined {
		return this.#cache.get(`${scope}:${id}`);
	}

	backlinksTo(target: string): string[] {
		return [...(this.#backlinks.get(target) ?? [])].sort();
	}

	async write(input: {
		id?: string;
		scope: CardScope;
		title: string;
		kind?: CardKind;
		tags?: string[];
		body?: string;
		updatedBy?: "user" | "agent";
		run?: CardDocument["run"];
	}): Promise<CardDocument> {
		if (input.scope === "project" && !this.#workspace) {
			throw new Error("project scope requires a workspace");
		}
		if (this.#cache.size >= this.#maxCards && !input.id) {
			throw new Error("maxCards limit reached");
		}
		const now = Date.now();
		const existing = input.id ? this.get(input.scope, input.id) : undefined;
		const card: CardDocument = {
			id: input.id ?? createId("card"),
			scope: input.scope,
			title: input.title,
			kind: input.kind ?? existing?.kind ?? "note",
			tags: input.tags ?? existing?.tags ?? [],
			body: input.body ?? existing?.body ?? "",
			createdAt: existing?.createdAt ?? now,
			updatedAt: now,
			updatedBy: input.updatedBy,
			run: input.run ?? existing?.run,
		};
		await this.#persist(card);
		this.#cache.set(`${card.scope}:${card.id}`, card);
		this.#indexCard(card);
		return card;
	}

	async #persist(card: CardDocument): Promise<void> {
		const path =
			card.scope === "global"
				? globalCardPath(this.#dshHome, card.id)
				: projectCardPath(this.#workspace!, card.id);
		await mkdir(join(path, ".."), { recursive: true });
		const tmp = `${path}.${process.pid}.tmp`;
		await writeFile(tmp, serializeCard(card), "utf8");
		await rename(tmp, path);
	}

	async #loadScope(scope: CardScope): Promise<void> {
		const dir =
			scope === "global"
				? globalCardsDir(this.#dshHome)
				: projectCardsDir(this.#workspace!);
		let names: string[];
		try {
			names = await readdir(dir);
		} catch {
			return;
		}
		for (const name of names) {
			if (!name.endsWith(".md")) continue;
			const id = name.slice(0, -3);
			try {
				const raw = await readFile(join(dir, name), "utf8");
				const card = parseCard(raw, { id, scope });
				this.#cache.set(`${scope}:${card.id}`, card);
			} catch {
				// skip corrupt files
			}
		}
		this.#rebuildBacklinks();
	}

	#rebuildBacklinks(): void {
		this.#backlinks.clear();
		for (const card of this.#cache.values()) this.#indexCard(card);
	}

	#indexCard(card: CardDocument): void {
		const key = `${card.scope}:${card.id}`;
		for (const [target, sources] of this.#backlinks) {
			if (sources.delete(key) && sources.size === 0)
				this.#backlinks.delete(target);
		}
		for (const target of extractWikiLinks(card.body)) {
			let set = this.#backlinks.get(target);
			if (!set) {
				set = new Set();
				this.#backlinks.set(target, set);
			}
			set.add(key);
		}
	}
}
