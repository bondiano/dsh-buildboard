import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { defineConfig, type LaunchOptions } from "@playwright/test";

/** Prefer an already-cached Chromium over the sandbox cache. */
function chromiumExecutable(): string | undefined {
	const explicit = process.env.DSH_CHROMIUM_PATH;
	if (explicit) return explicit;
	const cache =
		process.env.PLAYWRIGHT_BROWSERS_PATH ??
		join(process.env.HOME ?? "", "Library/Caches/ms-playwright");
	try {
		const revisions = readdirSync(cache)
			.filter((entry) => entry.startsWith("chromium-"))
			.sort()
			.reverse();
		for (const revision of revisions) {
			for (const candidate of [
				join(
					cache,
					revision,
					"chrome-mac-arm64",
					"Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
				),
				join(
					cache,
					revision,
					"chrome-headless-shell-mac-arm64",
					"chrome-headless-shell",
				),
				join(
					cache,
					revision,
					"chrome-mac",
					"Chromium.app/Contents/MacOS/Chromium",
				),
				join(
					cache,
					revision,
					"chrome-headless-shell-mac-x64",
					"chrome-headless-shell",
				),
			]) {
				if (existsSync(candidate)) return candidate;
			}
		}
	} catch {
		// Fall back to Playwright's own resolution.
	}
	return undefined;
}

const executablePath = chromiumExecutable();
const launchOptions: LaunchOptions = executablePath ? { executablePath } : {};

export default defineConfig({
	testDir: "./test/e2e",
	timeout: 60_000,
	fullyParallel: false,
	workers: 1,
	retries: 0,
	reporter: [["list"]],
	use: {
		viewport: { width: 1600, height: 1000 },
		launchOptions,
	},
});
