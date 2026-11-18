import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

async function collectSourceFiles(dir: string): Promise<string[]> {
	const entries = await readdir(dir, { withFileTypes: true });
	const files: string[] = [];
	for (const entry of entries) {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) {
			files.push(...(await collectSourceFiles(path)));
			continue;
		}
		if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
			files.push(path);
		}
	}
	return files;
}

test("src has no useEffect calls or imports", async () => {
	const root = join(import.meta.dirname, "../../src");
	const files = await collectSourceFiles(root);
	const offenders: string[] = [];
	for (const file of files) {
		const text = await readFile(file, "utf8");
		if (
			/React\.useEffect\b/.test(text) ||
			/\bimport\s*\{[^}]*\buseEffect\b/.test(text) ||
			/(?<![\w.])useEffect\s*\(/.test(text)
		) {
			offenders.push(file);
		}
	}
	assert.deepEqual(offenders, []);
});
