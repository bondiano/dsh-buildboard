import * as React from "react";
import { boardSlugFromAddress } from "../../../domain/board-address.js";
import { SETTINGS_NAMESPACE } from "../../../domain/settings-ns.js";
import { useExternalSnapshot } from "../hooks/useActorStore.js";
import { BuildboardApp } from "./BuildboardApp.js";
import { TabErrorBoundary } from "./TabErrorBoundary.js";

export interface BuildboardTabInfo {
	tab?: {
		visible?: boolean;
		contentId?: string;
		navigation?: {
			address?: string;
			revision?: number;
		};
	};
}

export interface BuildboardTabProps {
	sessionId?: string;
	useTabInfo?: () => BuildboardTabInfo;
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
		getActiveSession?(): { id: string } | undefined;
	};
	layout?: { selectPanel(id: string | null): void };
}

export const BUILDBOARD_PANEL_ID = "buildboard";

const EMPTY_SNAPSHOT: { value?: Record<string, unknown> } = {};

function readSettingsSnapshot(settings: BuildboardTabProps["settings"]): {
	value?: Record<string, unknown>;
} {
	if (!settings) return EMPTY_SNAPSHOT;
	try {
		return settings.getSnapshot();
	} catch {
		return EMPTY_SNAPSHOT;
	}
}

function readTabNav(useTabInfo: BuildboardTabProps["useTabInfo"]): {
	visible: boolean;
	boardSlug?: string;
	navKey: string;
} {
	try {
		const info = useTabInfo?.();
		const visible = info?.tab?.visible !== false;
		const address =
			info?.tab?.navigation?.address ?? info?.tab?.contentId ?? "";
		const boardSlug = address ? boardSlugFromAddress(address) : undefined;
		const revision = info?.tab?.navigation?.revision ?? 0;
		return {
			visible,
			boardSlug,
			navKey: `${address}:${revision}:${boardSlug ?? ""}`,
		};
	} catch {
		return { visible: true, navKey: "" };
	}
}

export function BuildboardTab(props: BuildboardTabProps): React.ReactElement {
	const tabNav = readTabNav(props.useTabInfo);

	const snapshot = useExternalSnapshot(
		props.settings?.subscribe.bind(props.settings),
		() => readSettingsSnapshot(props.settings),
		EMPTY_SNAPSHOT,
	);

	const licenseKey =
		typeof snapshot?.value?.["tldrawLicenseKey"] === "string"
			? snapshot.value["tldrawLicenseKey"]
			: "";
	const pollIntervalMs =
		typeof snapshot?.value?.["pollIntervalMs"] === "number"
			? snapshot.value["pollIntervalMs"]
			: 2000;
	const sessionId =
		props.sessionId ?? props.uiWorkspace?.getActiveSession?.()?.id;

	return (
		<div className="dsh-bb-host" data-buildboard-tab-host="">
			<TabErrorBoundary t={props.t}>
				<BuildboardApp
					sessionId={sessionId}
					compact
					visible={tabNav.visible}
					initialBoard={tabNav.boardSlug}
					navigationKey={tabNav.navKey}
					licenseKey={licenseKey}
					pollIntervalMs={pollIntervalMs}
					t={props.t}
					onFullscreen={
						props.layout
							? () => props.layout?.selectPanel(BUILDBOARD_PANEL_ID)
							: undefined
					}
					canStartSession={
						typeof props.uiWorkspace?.startSession === "function"
					}
					onStartRun={(_kind, _board, prompt) => {
						props.uiWorkspace?.startSession?.(undefined, {
							prompt:
								prompt ??
								"Buildboard run. Use board_* and card_* tools, then run_report.",
							whenDraftExists: "append",
						});
					}}
				/>
			</TabErrorBoundary>
		</div>
	);
}

export function buildboardTabInject(ctx: {
	configForms?: {
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
		// Cordis 4 throws on undeclared inject props — never read ctx.layout directly.
		layout: ctx.get?.("layout") as BuildboardTabProps["layout"],
	});
}
