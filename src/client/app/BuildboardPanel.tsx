import * as React from "react";
import { BuildboardApp } from "./BuildboardApp.js";
import { SETTINGS_NAMESPACE } from "../../settings.js";

export interface BuildboardPanelProps {
	t?: (key: string) => string;
	configForms?: {
		get(namespace: string): {
			getSnapshot(): { value?: Record<string, unknown> };
			subscribe(listener: () => void): () => void;
		};
	};
	uiWorkspace?: {
		startSession?(
			workspaceId?: string,
			options?: { prompt?: string; whenDraftExists?: string },
		): void;
		getActiveSession?(): { id: string } | undefined;
	};
	layout?: { selectPanel(id: string | null): void };
}

export function BuildboardPanel(
	props: BuildboardPanelProps,
): React.ReactElement {
	const form = props.configForms?.get(SETTINGS_NAMESPACE);
	const [snapshot, setSnapshot] = React.useState(() => form?.getSnapshot());
	React.useEffect(
		() => form?.subscribe(() => setSnapshot(form.getSnapshot())),
		[form],
	);

	const sessionId = props.uiWorkspace?.getActiveSession?.()?.id;
	const licenseKey =
		typeof snapshot?.value?.["tldrawLicenseKey"] === "string"
			? snapshot.value["tldrawLicenseKey"]
			: "";
	const pollIntervalMs =
		typeof snapshot?.value?.["pollIntervalMs"] === "number"
			? snapshot.value["pollIntervalMs"]
			: 2000;

	return (
		<BuildboardApp
			sessionId={sessionId}
			compact={false}
			visible
			licenseKey={licenseKey}
			pollIntervalMs={pollIntervalMs}
			t={props.t}
			onFullscreen={() => props.layout?.selectPanel(null)}
			canStartSession={typeof props.uiWorkspace?.startSession === "function"}
			onStartRun={(_kind, _board, prompt) => {
				props.uiWorkspace?.startSession?.(undefined, {
					prompt:
						prompt ??
						"Buildboard run. Use board_* and card_* tools, then run_report.",
					whenDraftExists: "append",
				});
			}}
		/>
	);
}
