import { BUILDBOARD_LOCALES } from "../adapters/locales.js";
import { SETTINGS_NAMESPACE } from "../domain/settings-ns.js";
import { BUILDBOARD_PANEL_ID, BuildboardTab, buildboardTabInject, } from "./app/BuildboardTab.js";
import { BuildboardPanel } from "./app/BuildboardPanel.js";
import { SettingsCard } from "./settings/SettingsCard.js";
import { BUILDBOARD_STYLES } from "./styles.js";
export const CLIENT_NAMESPACE = "buildboard";
export const BUNDLE_PACKAGE = "@local/dsh-buildboard";
export const BUILDBOARD_TAB_ID = "@local/dsh-buildboard/board";
export const BUILDBOARD_TAB_KIND = "buildboard";
export const CLIENT_STYLE_ATTR = "data-dsh-plugin";
export const inject = [
    "slots",
    "locale",
    "sidebarRightTabs",
    "configForms",
    "uiWorkspace",
];
function CanvasIcon() {
    return null;
}
export function apply(ctx) {
    const t = ctx.locale.bind(CLIENT_NAMESPACE);
    ctx.effect(() => ctx.locale.register(CLIENT_NAMESPACE, BUILDBOARD_LOCALES), "buildboard: locales");
    ctx.effect(() => {
        if (typeof document === "undefined")
            return () => { };
        for (const prev of document.querySelectorAll(`style[${CLIENT_STYLE_ATTR}="${CLIENT_NAMESPACE}"]`)) {
            prev.remove();
        }
        const style = document.createElement("style");
        style.setAttribute(CLIENT_STYLE_ATTR, CLIENT_NAMESPACE);
        style.textContent = BUILDBOARD_STYLES;
        document.head?.append(style);
        return () => style.remove();
    }, "buildboard: styles");
    ctx.inject?.(["sidebarRightTabs"], (tabsCtx) => {
        const tabs = tabsCtx.sidebarRightTabs;
        if (!tabs)
            return;
        tabsCtx.effect(() => tabs.register({
            id: BUILDBOARD_TAB_ID,
            kind: BUILDBOARD_TAB_KIND,
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
        }), "buildboard: sidebar tab type");
    });
    const injectTab = buildboardTabInject(ctx);
    ctx.slots.inject("sidebar.right.pane.tab", function* () {
        // Hosts look up the body by tab id and/or kind — register both keys.
        for (const key of [BUILDBOARD_TAB_ID, BUILDBOARD_TAB_KIND, BUNDLE_PACKAGE]) {
            yield ctx.slots.register({
                name: "sidebar.right.pane.tab",
                key,
                locale: CLIENT_NAMESPACE,
                inject: injectTab,
            }, BuildboardTab);
        }
    });
    ctx.slots.inject("main", function* () {
        yield ctx.slots.register({
            name: "main",
            key: BUILDBOARD_PANEL_ID,
            locale: CLIENT_NAMESPACE,
            inject: () => ({
                configForms: ctx.configForms,
                uiWorkspace: ctx.uiWorkspace,
                // Cordis 4 throws on undeclared inject props — use get() only.
                layout: ctx.get?.("layout"),
            }),
        }, BuildboardPanel);
    });
    ctx.slots.inject("sidebar.panellist", function* () {
        yield ctx.slots.register({
            name: "sidebar.panellist",
            id: BUILDBOARD_PANEL_ID,
            order: 42,
            label: () => t("tab.title"),
            locale: CLIENT_NAMESPACE,
        }, CanvasIcon);
    });
    const form = ctx.configForms?.get(SETTINGS_NAMESPACE);
    const offSettings = ctx.configForms?.whileServed([SETTINGS_NAMESPACE], () => {
        ctx.slots.inject("plugins.bundle.config", function* () {
            yield ctx.slots.register({
                name: "plugins.bundle.config",
                key: BUNDLE_PACKAGE,
                locale: CLIENT_NAMESPACE,
                inject: () => ({
                    getSnapshot: () => form?.getSnapshot(),
                    subscribe: (listener) => form?.subscribe(listener) ?? (() => { }),
                    write: (field, value) => form?.set(field, value) ?? Promise.resolve(false),
                }),
            }, SettingsCard);
        });
        return () => { };
    });
    if (offSettings) {
        ctx.effect(() => () => offSettings(), "buildboard: settings card");
    }
}
export function clientPluginFactory(requireFn) {
    if (typeof requireFn === "function") {
        try {
            requireFn("react");
            requireFn("react-dom");
        }
        catch {
            // host table may omit react-dom in tests
        }
    }
    return { id: BUNDLE_PACKAGE, inject, apply };
}
export const clientPlugin = {
    id: BUNDLE_PACKAGE,
    inject,
    apply,
};
export default clientPlugin;
