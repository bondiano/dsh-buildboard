/**
 * Frontend Whiteboard Client Shell for DSH Cult Canvas
 *
 * Implements:
 * - Cordis frontend module lifecycle
 * - Registration via window.__ModuleLoader__
 * - Slot injection for canvas tool views and UI workspace
 * - Multi-language locale dictionary registration
 * - Dynamic style injection with clean disposer teardown
 *
 * @module @local/dsh-cult-canvas/presentation/client
 */
import { CANVAS_LOCALES } from "../adapters/locales.js";
import { CanvasToolView } from "./components/CanvasToolView.js";
import { CultCanvasBoard } from "./components/CultCanvasBoard.js";
import { setReact } from "./components/react-binding.js";
import { CANVAS_CLIENT_STYLES } from "./styles.js";
/** Canonical client plugin namespace. */
export const CLIENT_NAMESPACE = "cult-canvas";
/** Plugin style attribute marker for deduplication. */
export const CLIENT_STYLE_ATTR = "data-dsh-plugin";
/** Main interactive canvas host UI slot. */
export const CANVAS_UI_TOOL_SLOT = "@deepseek-ai/dsh-client-ui-tool";
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
];
/** Injected services required by the client plugin. */
export const inject = [
    "slots",
    "locale",
    "remote",
    "styles",
    "uiWorkspace",
];
/**
 * Apply function for Cordis client lifecycle.
 */
export function apply(ctx) {
    // 1. Register multi-language locale dictionaries
    ctx.effect(() => ctx.locale.register(CLIENT_NAMESPACE, CANVAS_LOCALES), "cult-canvas: locales");
    // 2. Dynamic style injection with clean disposer teardown
    ctx.effect(() => {
        if (typeof document === "undefined")
            return () => { };
        for (const prev of document.querySelectorAll(`style[${CLIENT_STYLE_ATTR}="${CLIENT_NAMESPACE}"]`)) {
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
        style[CLIENT_STYLE_ATTR] =
            CLIENT_NAMESPACE;
        style.textContent = CANVAS_CLIENT_STYLES;
        if (document.head && typeof document.head.append === "function") {
            document.head.append(style);
        }
        else if (document.head &&
            typeof document.head.appendChild === "function") {
            document.head.appendChild(style);
        }
        return () => {
            if (typeof style.remove === "function") {
                style.remove();
            }
        };
    }, "cult-canvas: styles");
    // 3. Register main interactive whiteboard slot view
    ctx.slots.inject(CANVAS_UI_TOOL_SLOT, () => ctx.slots.register({
        name: CANVAS_UI_TOOL_SLOT,
        id: CLIENT_NAMESPACE,
        locale: CLIENT_NAMESPACE,
    }, CultCanvasBoard));
    // 4. Register toolview card slots for all canvas agent tools
    ctx.slots.inject("tool.call.toolview", function* () {
        for (const toolName of CANVAS_TOOL_NAMES) {
            yield ctx.slots.register({
                name: "tool.call.toolview",
                key: toolName,
                locale: CLIENT_NAMESPACE,
            }, CanvasToolView);
        }
    });
}
/** Factory function creating client plugin instance with optional React binding. */
export function clientPluginFactory(requireFn) {
    if (typeof requireFn === "function") {
        try {
            const reactInstance = requireFn("react");
            if (reactInstance) {
                setReact(reactInstance);
            }
        }
        catch {
            // fallback or mock React will be used
        }
    }
    return {
        id: "@local/dsh-cult-canvas",
        inject,
        apply,
    };
}
/** Client plugin module descriptor. */
export const clientPlugin = {
    id: "@local/dsh-cult-canvas",
    inject,
    apply,
};
// Auto-register with DSH window.__ModuleLoader__ when running in browser context
if (typeof window !== "undefined") {
    const loader = window.__ModuleLoader__;
    if (loader && typeof loader.load === "function") {
        loader.load({
            id: "@local/dsh-cult-canvas",
            factory: (requireFn) => clientPluginFactory(requireFn),
        });
    }
}
export default clientPlugin;
