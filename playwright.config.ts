import { defineConfig } from "@playwright/test";

export default defineConfig({
	testDir: "./test/e2e",
	timeout: 60_000,
	fullyParallel: false,
	workers: 1,
	retries: 0,
	reporter: [["list"]],
	use: {
		viewport: { width: 1600, height: 1000 },
	},
});
