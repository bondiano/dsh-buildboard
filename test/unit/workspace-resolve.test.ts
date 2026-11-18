import assert from "node:assert/strict";
import { test } from "node:test";

/**
 * Mirrors host session→workspace preference: live WD object wins, then the
 * remembered map (so HTTP `{ id }` picks up the project path tools already saw).
 */
function resolveWorkspace(input: {
	session: unknown;
	workingDirectoryGet: (session: unknown) => string | undefined;
	remembered: Map<string, string>;
}): string | undefined {
	const sessionId =
		typeof input.session === "object" &&
		input.session !== null &&
		"id" in input.session &&
		typeof (input.session as { id: unknown }).id === "string"
			? (input.session as { id: string }).id
			: undefined;
	if (input.session && typeof input.session === "object") {
		const fromWd = input.workingDirectoryGet(input.session);
		if (fromWd) {
			if (sessionId) input.remembered.set(sessionId, fromWd);
			return fromWd;
		}
	}
	if (sessionId) return input.remembered.get(sessionId);
	return undefined;
}

test("HTTP {id} reuses project cwd remembered from live agent session", () => {
	const remembered = new Map<string, string>();
	const live = { id: "session-abc" };
	const project = "/Users/me/per-the-spec";
	const first = resolveWorkspace({
		session: live,
		workingDirectoryGet: (session) => (session === live ? project : undefined),
		remembered,
	});
	assert.equal(first, project);
	assert.equal(remembered.get("session-abc"), project);

	const viaHttp = resolveWorkspace({
		session: { id: "session-abc" },
		workingDirectoryGet: () => undefined,
		remembered,
	});
	assert.equal(viaHttp, project);
});

test("scratch is not preferred once a project cwd is remembered", () => {
	const remembered = new Map<string, string>([
		["session-abc", "/tmp/scratch-should-lose"],
	]);
	const live = { id: "session-abc" };
	const project = "/Users/me/per-the-spec";
	const path = resolveWorkspace({
		session: live,
		workingDirectoryGet: () => project,
		remembered,
	});
	assert.equal(path, project);
	assert.equal(remembered.get("session-abc"), project);
});
