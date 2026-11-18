import { jsx as _jsx } from "react/jsx-runtime";
import { boardSlugFromAddress } from "../../../domain/board-address.js";
import { SETTINGS_NAMESPACE } from "../../../domain/settings-ns.js";
import { useExternalSnapshot } from "../hooks/useActorStore.js";
import { BuildboardApp } from "./BuildboardApp.js";
import { TabErrorBoundary } from "./TabErrorBoundary.js";
export const BUILDBOARD_PANEL_ID = "buildboard";
const EMPTY_SNAPSHOT = {};
function readSettingsSnapshot(settings) {
    if (!settings)
        return EMPTY_SNAPSHOT;
    try {
        return settings.getSnapshot();
    }
    catch {
        return EMPTY_SNAPSHOT;
    }
}
function readTabNav(useTabInfo) {
    try {
        const info = useTabInfo?.();
        const visible = info?.tab?.visible !== false;
        const address = info?.tab?.navigation?.address ?? info?.tab?.contentId ?? "";
        const boardSlug = address ? boardSlugFromAddress(address) : undefined;
        const revision = info?.tab?.navigation?.revision ?? 0;
        return {
            visible,
            boardSlug,
            navKey: `${address}:${revision}:${boardSlug ?? ""}`,
        };
    }
    catch {
        return { visible: true, navKey: "" };
    }
}
export function BuildboardTab(props) {
    const tabNav = readTabNav(props.useTabInfo);
    const snapshot = useExternalSnapshot(props.settings?.subscribe.bind(props.settings), () => readSettingsSnapshot(props.settings), EMPTY_SNAPSHOT);
    const licenseKey = typeof snapshot?.value?.["tldrawLicenseKey"] === "string"
        ? snapshot.value["tldrawLicenseKey"]
        : "";
    const pollIntervalMs = typeof snapshot?.value?.["pollIntervalMs"] === "number"
        ? snapshot.value["pollIntervalMs"]
        : 2000;
    const sessionId = props.sessionId ?? props.uiWorkspace?.getActiveSession?.()?.id;
    return (_jsx("div", { className: "dsh-bb-host", "data-buildboard-tab-host": "", children: _jsx(TabErrorBoundary, { t: props.t, children: _jsx(BuildboardApp, { sessionId: sessionId, compact: true, visible: tabNav.visible, initialBoard: tabNav.boardSlug, navigationKey: tabNav.navKey, licenseKey: licenseKey, pollIntervalMs: pollIntervalMs, t: props.t, onFullscreen: props.layout
                    ? () => props.layout?.selectPanel(BUILDBOARD_PANEL_ID)
                    : undefined, canStartSession: typeof props.uiWorkspace?.startSession === "function", onStartRun: (_kind, _board, prompt) => {
                    props.uiWorkspace?.startSession?.(undefined, {
                        prompt: prompt ??
                            "Buildboard run. Use board_* and card_* tools, then run_report.",
                        whenDraftExists: "append",
                    });
                } }) }) }));
}
export function buildboardTabInject(ctx) {
    const form = ctx.configForms?.get?.(SETTINGS_NAMESPACE);
    return (sessionId) => ({
        sessionId: sessionId ??
            ctx.uiWorkspace?.getActiveSession?.()?.id,
        settings: form,
        uiWorkspace: ctx.uiWorkspace,
        // Cordis 4 throws on undeclared inject props — never read ctx.layout directly.
        layout: ctx.get?.("layout"),
    });
}
