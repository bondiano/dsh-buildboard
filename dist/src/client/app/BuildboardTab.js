import { jsx as _jsx } from "react/jsx-runtime";
import * as React from "react";
import { SETTINGS_NAMESPACE } from "../../domain/settings-ns.js";
import { BuildboardApp } from "./BuildboardApp.js";
export const BUILDBOARD_PANEL_ID = "buildboard";
export function BuildboardTab(props) {
    const visible = props.useTabInfo?.().tab?.visible !== false;
    const [snapshot, setSnapshot] = React.useState(() => props.settings?.getSnapshot());
    React.useEffect(() => props.settings?.subscribe(() => setSnapshot(props.settings?.getSnapshot())), [props.settings]);
    const licenseKey = typeof snapshot?.value?.["tldrawLicenseKey"] === "string"
        ? snapshot.value["tldrawLicenseKey"]
        : "";
    const pollIntervalMs = typeof snapshot?.value?.["pollIntervalMs"] === "number"
        ? snapshot.value["pollIntervalMs"]
        : 2000;
    return (_jsx(BuildboardApp, { sessionId: props.sessionId, compact: true, visible: visible, licenseKey: licenseKey, pollIntervalMs: pollIntervalMs, t: props.t, onFullscreen: props.layout
            ? () => props.layout?.selectPanel(BUILDBOARD_PANEL_ID)
            : undefined, canStartSession: typeof props.uiWorkspace?.startSession === "function", onStartRun: (_kind, _board, prompt) => {
            props.uiWorkspace?.startSession?.(undefined, {
                prompt: prompt ??
                    "Buildboard run. Use board_* and card_* tools, then run_report.",
                whenDraftExists: "append",
            });
        } }));
}
export function buildboardTabInject(ctx) {
    const form = ctx.configForms?.get?.(SETTINGS_NAMESPACE);
    return (sessionId) => ({
        sessionId: sessionId ??
            ctx.uiWorkspace?.getActiveSession?.()?.id,
        settings: form,
        uiWorkspace: ctx.uiWorkspace,
        layout: ctx.layout ?? ctx.get?.("layout"),
    });
}
