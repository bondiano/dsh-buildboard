/** Identity helpers for cards, boards and runs. */

const ID_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

/** Create a short opaque id (12 chars). */
export function createId(prefix = ""): string {
	const bytes = new Uint8Array(12);
	crypto.getRandomValues(bytes);
	let out = "";
	for (const byte of bytes) {
		out += ID_ALPHABET[byte % ID_ALPHABET.length];
	}
	return prefix ? `${prefix}_${out}` : out;
}

/** Scope of a card library: project workspace or global user library. */
export type CardScope = "project" | "global";

/** Fully-qualified card address: `project:abc` or `global:abc`. */
export type CardRef = `${CardScope}:${string}`;

/** Parse `scope:id`; returns undefined when the form is wrong. */
export function parseCardRef(
	raw: string,
): { scope: CardScope; id: string } | undefined {
	const match = /^(project|global):([a-z0-9_-]+)$/i.exec(raw.trim());
	if (!match) return undefined;
	return { scope: match[1]!.toLowerCase() as CardScope, id: match[2]! };
}

/** Format a card address. */
export function formatCardRef(scope: CardScope, id: string): CardRef {
	return `${scope}:${id}`;
}

/** Slugify a title for board filenames. */
export function slugify(input: string, fallback = "board"): string {
	const slug = input
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 48);
	return slug || fallback;
}
