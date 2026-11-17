import { readFileSync } from "node:fs";
import { defineConfig } from "tsdown";

const { name } = JSON.parse(
	readFileSync(new URL("package.json", import.meta.url), "utf8"),
) as { name: string };

/**
 * Client-сборка: один CJS-чанк в формате ленивой таблицы модулей Harness.
 *
 * Загрузчик исполняет client-entry как classic script, поэтому бандл открывает
 * фабрику сам и возвращает ровно то, что даёт `clientPluginFactory`: React
 * приходит из таблицы модулей через `require`, а не бандлится. `xstate`
 * бандлится (его нет в таблице), `react`/`react-dom` остаются внешними.
 *
 * Host-половина собирается tsc в `dist/`, поэтому entry один.
 */
export default defineConfig({
	entry: { client: "src/presentation/client.ts" },
	platform: "browser",
	format: "cjs",
	target: "es2022",
	outDir: "lib",
	outExtensions: () => ({ js: ".js" }),
	clean: false,
	dts: false,
	deps: { neverBundle: ["react", "react-dom"], alwaysBundle: ["xstate"] },
	inputOptions: { platform: "browser" },
	banner: `window.__ModuleLoader__.load({id:${JSON.stringify(name)},factory(require){const exports = {}; const module = { exports };`,
	footer:
		"return module.exports.clientPluginFactory ? module.exports.clientPluginFactory(require) : module.exports; }});",
	outputOptions: { exports: "named", codeSplitting: false },
});
