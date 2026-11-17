/**
 * Frontend Whiteboard Client Shell for DSH Cult Canvas
 *
 * Implements:
 * - Cordis frontend module lifecycle (classic-script bundle, module-table require)
 * - A right-sidebar tab type with a guide card on the Start screen
 * - A keyed settings card on the plugin's page in Settings → Plugins
 * - Toolview card slots for every canvas agent tool
 * - Multi-language locale dictionary registration
 * - Dynamic style injection with clean disposer teardown
 *
 * @module @local/dsh-cult-canvas/presentation/client
 */

import { CANVAS_LOCALES } from "../adapters/locales.js";
import type { ClientContext as DomainClientContext } from "../domain/types.js";
import { CanvasIcon } from "./components/CanvasIcon.js";
import { CanvasSettingsCard } from "./components/CanvasSettingsCard.js";
import { CanvasToolView } from "./components/CanvasToolView.js";
import { canvasTabInject, CultCanvasTab } from "./components/CultCanvasTab.js";
import { type ClientReact, setReact } from "./components/react-binding.js";
import { CANVAS_CLIENT_STYLES } from "./styles.js";

/** Canonical client plugin namespace. */
export const CLIENT_NAMESPACE = "cult-canvas";

/** Settings namespace; the Host entry id in cordis.patch.yml. */
export const SETTINGS_NAMESPACE = "cult-canvas";

/** Bundle package name: the key the Plugins page dispatches the card by. */
export const BUNDLE_PACKAGE = "@local/dsh-cult-canvas";

/** Tab type identity; the key its body registers under. */
export const CANVAS_TAB_ID = "@local/dsh-cult-canvas/canvas";

/** Tab kind users open from the guide card. */
export const CANVAS_TAB_KIND = "cult-canvas";

/** Plugin style attribute marker for deduplication. */
export const CLIENT_STYLE_ATTR = "data-dsh-plugin";

/** Tool names handled by custom toolview card slots. */
export const CANVAS_TOOL_NAMES = [
	"canvas_get_state",
	"canvas_create_element",
	"canvas_update_element",
	"canvas_delete_element",
	"canvas_connect",
	"canvas_layout_elements",
	"canvas_run_pipeline",
	"canvas_node_status",
	"canvas_import_export",
	"canvas_get_bible",
	"canvas_update_bible",
	"canvas_query_elements",
] as const;

export interface ClientContext extends DomainClientContext {
	locale: DomainClientContext["locale"] & {
		bind(namespace: string): (key: string) => string;
	};
}

/** Injected services required by the client plugin. */
export const inject = [
	"slots",
	"locale",
	"sidebarRightTabs",
	"configForms",
	"uiWorkspace",
] as const;

/**
 * Apply function for Cordis client lifecycle.
 */
export function apply(ctx: ClientContext): void {
	const t = ctx.locale.bind(CLIENT_NAMESPACE);

	// 1. Register multi-language locale dictionaries
	ctx.effect(
		() => ctx.locale.register(CLIENT_NAMESPACE, CANVAS_LOCALES),
		"cult-canvas: locales",
	);

	// 2. Dynamic style injection with clean disposer teardown
	ctx.effect(() => {
		if (typeof document === "undefined") return () => {};

		for (const prev of document.querySelectorAll(
			`style[${CLIENT_STYLE_ATTR}="${CLIENT_NAMESPACE}"]`,
		)) {
			if (typeof prev.remove === "function") {
				prev.remove();
			}
		}

		const style = document.createElement("style");
		if (typeof style.setAttribute === "function") {
			style.setAttribute(CLIENT_STYLE_ATTR, CLIENT_NAMESPACE);
		}
		if (style.dataset) {
			style.dataset["dshPlugin"] = CLIENT_NAMESPACE;
		}
		(style as unknown as Record<string, unknown>)[CLIENT_STYLE_ATTR] =
			CLIENT_NAMESPACE;

		style.textContent = CANVAS_CLIENT_STYLES;
		if (document.head && typeof document.head.append === "function") {
			document.head.append(style);
		} else if (
			document.head &&
			typeof document.head.appendChild === "function"
		) {
			document.head.appendChild(style);
		}

		return () => {
			if (typeof style.remove === "function") {
				style.remove();
			}
		};
	}, "cult-canvas: styles");

	// 3. Register the tab type. The type registry arrives through `ctx.inject`:
	// the right sidebar declares the pane slot before it provides the service,
	// so a static `inject` entry would never see it.
	ctx.inject?.(["sidebarRightTabs"], (tabsCtx) => {
		const tabs = tabsCtx.sidebarRightTabs;
		if (!tabs) return;
		tabsCtx.effect(
			() =>
				tabs.register({
					id: CANVAS_TAB_ID,
					kind: CANVAS_TAB_KIND,
					title: () => t("tab.title"),
					guide: [
						{
							id: "board",
							order: 25,
							title: () => t("tab.title"),
							description: () => t("guide.description"),
							icon: CanvasIcon,
						},
					],
				}),
			"cult-canvas: sidebar tab type",
		);
	});

	// 4. The tab body, dispatched with the definition id as its key
	const injectTab = canvasTabInject(ctx);
	ctx.slots.inject("sidebar.right.pane.tab", function* () {
		yield ctx.slots.register(
			{
				name: "sidebar.right.pane.tab",
				key: CANVAS_TAB_ID,
				locale: CLIENT_NAMESPACE,
				inject: injectTab,
			},
			CultCanvasTab,
		);
	});

	// 5. Settings card on the bundle's own page
	const form = ctx.configForms?.get(SETTINGS_NAMESPACE);
	// `slots.inject` owns the registration and drops it with the slot ledger, so
	// the watch's own disposer has nothing left to unwind.
	const offSettings = ctx.configForms?.whileServed([SETTINGS_NAMESPACE], () => {
		ctx.slots.inject("plugins.bundle.config", function* () {
			yield ctx.slots.register(
				{
					name: "plugins.bundle.config",
					key: BUNDLE_PACKAGE,
					locale: CLIENT_NAMESPACE,
					inject: () => ({
						getSnapshot: () => form?.getSnapshot(),
						subscribe: (listener: () => void) =>
							form?.subscribe(listener) ?? (() => {}),
						write: (field: string, value: unknown) =>
							form?.set(field, value) ?? Promise.resolve(false),
					}),
				},
				CanvasSettingsCard,
			);
		});
		return () => {};
	});
	if (offSettings) {
		ctx.effect(() => () => offSettings(), "cult-canvas: settings card");
	}

	// 6. Toolview card slots for all canvas agent tools
	ctx.slots.inject("tool.call.toolview", function* () {
		for (const toolName of CANVAS_TOOL_NAMES) {
			yield ctx.slots.register(
				{
					name: "tool.call.toolview",
					key: toolName,
					locale: CLIENT_NAMESPACE,
				},
				CanvasToolView,
			);
		}
	});
}

/** Factory function creating client plugin instance with optional React binding. */
export function clientPluginFactory(requireFn?: (mod: string) => unknown): {
	id: string;
	inject: typeof inject;
	apply: typeof apply;
} {
	if (typeof requireFn === "function") {
		try {
			const reactInstance = requireFn("react") as Partial<ClientReact>;
			if (reactInstance) {
				setReact(reactInstance);
			}
		} catch {
			// fallback or mock React will be used
		}
	}
	return {
		id: BUNDLE_PACKAGE,
		inject,
		apply,
	};
}

/** Client plugin module descriptor. */
export const clientPlugin = {
	id: BUNDLE_PACKAGE,
	inject,
	apply,
};

export default clientPlugin;
