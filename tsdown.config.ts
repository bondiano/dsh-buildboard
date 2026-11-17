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
		alwaysBundle: [
			"tldraw",
			"xstate",
			"@tldraw/editor",
			"@tldraw/store",
			"@tldraw/tlschema",
			"@tldraw/utils",
			"@tldraw/validate",
			"@tiptap/core",
			"@tiptap/react",
			"@tiptap/starter-kit",
			"@tiptap/pm",
			// Subpath exports are separate resolvers; list each one the starter-kit pulls in.
			"@tiptap/pm/state",
			"@tiptap/pm/view",
			"@tiptap/pm/model",
			"@tiptap/pm/transform",
			"@tiptap/pm/commands",
			"@tiptap/pm/keymap",
			"@tiptap/pm/schema-list",
			"@tiptap/pm/dropcursor",
			"@tiptap/pm/gapcursor",
			"@tiptap/pm/history",
			"@tiptap/pm/schema-basic",
			"@tiptap/pm/inputrules",
			"prosemirror-state",
			"prosemirror-view",
			"prosemirror-model",
			"prosemirror-transform",
			"prosemirror-commands",
			"prosemirror-keymap",
			"prosemirror-schema-list",
			"prosemirror-dropcursor",
			"prosemirror-gapcursor",
			"prosemirror-history",
			"prosemirror-schema-basic",
			"prosemirror-inputrules",
		],
	},
	inputOptions: { platform: "browser" },
	banner: `window.__ModuleLoader__.load({id:${JSON.stringify(name)},factory(require){const exports = {}; const module = { exports };`,
	footer:
		"return module.exports.clientPluginFactory ? module.exports.clientPluginFactory(require) : module.exports; }});",
	outputOptions: { exports: "named", codeSplitting: false },
});
