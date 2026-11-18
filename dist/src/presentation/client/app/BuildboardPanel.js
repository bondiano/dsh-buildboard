import { jsx as _jsx } from "react/jsx-runtime";
import { SETTINGS_NAMESPACE } from "../../../domain/settings-ns.js";
import { useExternalSnapshot } from "../hooks/useActorStore.js";
import { BuildboardApp } from "./BuildboardApp.js";
const EMPTY_SNAPSHOT = {};
export function BuildboardPanel(props) {
    const form = props.configForms?.get(SETTINGS_NAMESPACE);
    const snapshot = useExternalSnapshot(form?.subscribe.bind(form), () => form?.getSnapshot() ?? EMPTY_SNAPSHOT, EMPTY_SNAPSHOT);
    const sessionId = props.uiWorkspace?.getActiveSession?.()?.id;
    const licenseKey = typeof snapshot?.value?.["tldrawLicenseKey"] === "string"
        ? snapshot.value["tldrawLicenseKey"]
        : "";
    const pollIntervalMs = typeof snapshot?.value?.["pollIntervalMs"] === "number"
        ? snapshot.value["pollIntervalMs"]
        : 2000;
    return (_jsx(BuildboardApp, { sessionId: sessionId, compact: false, visible: true, licenseKey: licenseKey, pollIntervalMs: pollIntervalMs, t: props.t, onFullscreen: () => props.layout?.selectPanel(null), canStartSession: typeof props.uiWorkspace?.startSession === "function", onStartRun: (_kind, _board, prompt) => {
            props.uiWorkspace?.startSession?.(undefined, {
                prompt: prompt ??
                    "Buildboard run. Use board_* and card_* tools, then run_report.",
                whenDraftExists: "append",
            });
        } }));
}
