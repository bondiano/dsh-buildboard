import * as React from "react";
import { SETTINGS_NAMESPACE } from "../../settings.js";
import { BuildboardApp } from "./BuildboardApp.js";

export interface BuildboardTabProps {
	sessionId?: string;
	useTabInfo?: () => { tab?: { visible?: boolean } };
	t?: (key: string) => string;
	settings?: {
		getSnapshot(): { value?: Record<string, unknown> };
		subscribe(listener: () => void): () => void;
	};
	uiWorkspace?: {
		startSession?(
			workspaceId?: string,
			options?: { prompt?: string; whenDraftExists?: string },
		): void;
	};
	layout?: { selectPanel(id: string | null): void };
}

export const BUILDBOARD_PANEL_ID = "buildboard";

export function BuildboardTab(props: BuildboardTabProps): React.ReactElement {
	const visible = props.useTabInfo?.().tab?.visible !== false;
	const [snapshot, setSnapshot] = React.useState(() =>
		props.settings?.getSnapshot(),
	);

	React.useEffect(
		() =>
			props.settings?.subscribe(() =>
				setSnapshot(props.settings?.getSnapshot()),
			),
		[props.settings],
	);

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
			sessionId={props.sessionId}
			compact
			visible={visible}
			licenseKey={licenseKey}
			pollIntervalMs={pollIntervalMs}
			t={props.t}
			onFullscreen={
				props.layout
					? () => props.layout?.selectPanel(BUILDBOARD_PANEL_ID)
					: undefined
			}
			canStartSession={typeof props.uiWorkspace?.startSession === "function"}
			onStartRun={(kind, board) => {
				props.uiWorkspace?.startSession?.(undefined, {
					prompt: `Buildboard ${kind} on board ${board}. Use board_* and card_* tools, then run_report.`,
					whenDraftExists: "append",
				});
			}}
		/>
	);
}

export function buildboardTabInject(ctx: {
	configForms?: BuildboardTabProps["settings"] extends undefined
		? {
				get?(namespace: string): BuildboardTabProps["settings"];
			}
		: {
				get?(namespace: string): BuildboardTabProps["settings"];
			};
	uiWorkspace?: BuildboardTabProps["uiWorkspace"];
	layout?: BuildboardTabProps["layout"];
	get?(name: string): unknown;
}): (sessionId?: string) => Record<string, unknown> {
	const form = ctx.configForms?.get?.(SETTINGS_NAMESPACE);
	return (sessionId?: string) => ({
		sessionId:
			sessionId ??
			(
				ctx.uiWorkspace as
					| { getActiveSession?(): { id: string } | undefined }
					| undefined
			)?.getActiveSession?.()?.id,
		settings: form,
		uiWorkspace: ctx.uiWorkspace,
		layout: ctx.layout ?? (ctx.get?.("layout") as BuildboardTabProps["layout"]),
	});
}
