import assert from "node:assert/strict";
import { test } from "node:test";
import { parseCard, serializeCard } from "../../src/adapters/markdown.js";
import { extractWikiLinks } from "../../src/domain/card.js";

test("serialize and parse card round-trip", () => {
	const card = {
		id: "card_a",
		scope: "project" as const,
		title: 'Hello "world"',
		kind: "note" as const,
		tags: ["arch", "core"],
		body: "See [[card_b]] and [[global:x]].",
		createdAt: 1,
		updatedAt: 2,
		updatedBy: "agent" as const,
	};
	const raw = serializeCard(card);
	const parsed = parseCard(raw, { id: "card_a", scope: "project" });
	assert.equal(parsed.id, "card_a");
	assert.equal(parsed.title, 'Hello "world"');
	assert.deepEqual(parsed.tags, ["arch", "core"]);
	assert.equal(parsed.body, card.body);
	assert.equal(parsed.updatedBy, "agent");
});

test("extract wiki links", () => {
	assert.deepEqual(extractWikiLinks("a [[one]] b [[two|label]]"), [
		"one",
		"two",
	]);
});
