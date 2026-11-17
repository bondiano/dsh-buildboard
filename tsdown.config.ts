import { readFileSync } from "node:fs";
import { defineConfig } from "tsdown";

const { name } = JSON.parse(
	readFileSync(new URL("package.json", import.meta.url), "utf8"),
) as { name: string };

/**
 * Client build: CJS module-table factory for the Harness loader.
 *
 * The loader runs the entry as a classic script, so the banner opens the
 * factory. React stays external (platform table); tldraw and xstate are bundled.
 * Code splitting stays off until the chunk + require.async path is verified in
 * the live desktop app; the board mounts behind a dynamic import() that the
 * single-chunk build still inlines.
 */
export default defineConfig({
	entry: { client: "src/client/index.ts" },
	platform: "browser",
	format: "cjs",
	target: "es2022",
	outDir: "lib",
	outExtensions: () => ({ js: ".js" }),
	clean: false,
	dts: false,
	deps: {
		neverBundle: ["react", "react-dom", "react/jsx-runtime"],
		alwaysBundle: ["tldraw", "xstate", "@tldraw/editor", "@tldraw/store"],
	},
	inputOptions: { platform: "browser" },
	banner: `window.__ModuleLoader__.load({id:${JSON.stringify(name)},factory(require){const exports = {}; const module = { exports };`,
	footer:
		"return module.exports.clientPluginFactory ? module.exports.clientPluginFactory(require) : module.exports; }});",
	outputOptions: { exports: "named", codeSplitting: false },
});
