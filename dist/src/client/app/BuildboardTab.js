import { jsx as _jsx } from "react/jsx-runtime";
import * as React from "react";
import { SETTINGS_NAMESPACE } from "../../domain/settings-ns.js";
import { BuildboardApp } from "./BuildboardApp.js";
import { TabErrorBoundary } from "./TabErrorBoundary.js";
export const BUILDBOARD_PANEL_ID = "buildboard";
function readSettingsSnapshot(settings) {
    if (!settings)
        return undefined;
    try {
        return settings.getSnapshot();
    }
    catch {
        return undefined;
    }
}
export function BuildboardTab(props) {
    let visible = true;
    try {
        visible = props.useTabInfo?.().tab?.visible !== false;
    }
    catch {
        visible = true;
    }
    const [snapshot, setSnapshot] = React.useState(() => readSettingsSnapshot(props.settings));
    React.useEffect(() => {
        if (!props.settings?.subscribe)
            return;
        try {
            return props.settings.subscribe(() => setSnapshot(readSettingsSnapshot(props.settings)));
        }
        catch {
            return undefined;
        }
    }, [props.settings]);
    const licenseKey = typeof snapshot?.value?.["tldrawLicenseKey"] === "string"
        ? snapshot.value["tldrawLicenseKey"]
        : "";
    const pollIntervalMs = typeof snapshot?.value?.["pollIntervalMs"] === "number"
        ? snapshot.value["pollIntervalMs"]
        : 2000;
    const sessionId = props.sessionId ?? props.uiWorkspace?.getActiveSession?.()?.id;
    return (_jsx("div", { className: "dsh-bb-host", "data-buildboard-tab-host": "", children: _jsx(TabErrorBoundary, { t: props.t, children: _jsx(BuildboardApp, { sessionId: sessionId, compact: true, visible: visible, licenseKey: licenseKey, pollIntervalMs: pollIntervalMs, t: props.t, onFullscreen: props.layout
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
