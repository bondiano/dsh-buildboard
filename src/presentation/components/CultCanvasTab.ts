/**
 * The Cult Canvas tab body in the right sidebar.
 *
 * Owns the contract between the panel and the DSH shell: which session's board
 * to show, the live sync endpoint, the plugin settings the board obeys, and what
 * "Start project" does. The board itself stays presentation-only.
 *
 * @module @local/dsh-cult-canvas/presentation/components/CultCanvasTab
 */

import { buildProjectBrief } from "../../application/project-brief.js";
import { CANVAS_API_ROUTE } from "../../domain/route.js";
import type {
	CanvasEdge,
	CanvasElement,
	ClientConfigSnapshot,
	ClientConfigForms,
	ClientStartSessionOptions,
	ClientUIWorkspace,
	ClientWorkspaces,
} from "../../domain/types.js";
import { CultCanvasBoard } from "./CultCanvasBoard.js";
import { type ClientNode, h, useEffect, useState } from "./react-binding.js";

/** Settings namespace owned by the Host half (cordis.patch.yml entry id). */
const SETTINGS_NAMESPACE = "cult-canvas";

/** What the shell hands the tab body. */
export interface CultCanvasTabProps {
	/** Session whose workspace the board belongs to. */
	sessionId?: string;
	/** Framework-bound tab information; absent outside the shell. */
	useTabInfo?: () => { tab?: { visible?: boolean } };
	/** Namespace-bound translate. */
	t?: (key: string) => string;
	/** Settings transport of the plugin entry. */
	settings?: ClientConfigFormSource;
	/** Session navigation used by "Start project". */
	uiWorkspace?: ClientUIWorkspace;
	/** Workspace registry, so the started session opens in the board's folder. */
	workspaces?: ClientWorkspaces;
}

/** The two settings faces the tab consumes. */
export interface ClientConfigFormSource {
	getSnapshot(): ClientConfigSnapshot;
	subscribe(listener: () => void): () => void;
}

/** Live sync endpoint of one session's board. */
export function canvasSyncUrl(sessionId?: string): string {
	return sessionId === undefined
		? `${CANVAS_API_ROUTE}/state`
		: `${CANVAS_API_ROUTE}/state?session=${encodeURIComponent(sessionId)}`;
}

export function CultCanvasTab(props: CultCanvasTabProps): ClientNode {
	const { sessionId, useTabInfo, t, settings, uiWorkspace, workspaces } = props;
	const tabInfo = useTabInfo?.();
	const visible = tabInfo?.tab?.visible !== false;
	const [snapshot, setSnapshot] = useState<ClientConfigSnapshot | undefined>(
		() => settings?.getSnapshot(),
	);
	const [error, setError] = useState<string | null>(null);

	// The transport owns the subscription; the tab lives as long as the plugin.
	useEffect(
		() => settings?.subscribe(() => setSnapshot(settings.getSnapshot())),
		[],
	);

	const label = (key: string): string => (t ? t(key) : key);
	const syncUrl = canvasSyncUrl(sessionId);
	// Settings drive the board live; until the namespace is served the board
	// keeps the Host defaults.
	const snapEnabled = snapshot?.value?.["snapToGrid"] !== false;
	const gridSize =
		typeof snapshot?.value?.["gridSize"] === "number"
			? snapshot.value["gridSize"]
			: 20;

	const startProject = async (board: {
		elements: CanvasElement[];
		edges: CanvasEdge[];
		bible?: Record<string, unknown>;
	}): Promise<void> => {
		if (!uiWorkspace || typeof uiWorkspace.startSession !== "function") return;
		setError(null);
		// The board has already posted its pending edits; flush writes the file
		// the new session will read, and names the workspace it landed in.
		let workspace: string | undefined;
		try {
			const response = await fetch(
				`${CANVAS_API_ROUTE}/flush${sessionId === undefined ? "" : `?session=${encodeURIComponent(sessionId)}`}`,
				{ method: "POST" },
			);
			if (response.ok) {
				const body = (await response.json()) as { workspace?: string };
				workspace =
					typeof body.workspace === "string" ? body.workspace : undefined;
			}
		} catch {
			// An unreachable Host still starts the session from the browser's copy.
		}

		const brief = buildProjectBrief(board, workspace);
		const options: ClientStartSessionOptions = {
			prompt: brief,
			whenDraftExists: "append",
		};
		let workspaceId: string | undefined;
		if (workspace !== undefined && typeof workspaces?.create === "function") {
			try {
				workspaceId = (await workspaces.create({ path: workspace }))?.id;
			} catch {
				// An unregistered folder falls back to the current workspace.
			}
		}
		try {
			uiWorkspace.startSession(workspaceId, options);
		} catch (failure) {
			setError(String(failure));
		}
	};

	return h(
		"div",
		{
			"data-cult-canvas-tab": "",
			style: {
				display: "flex",
				flexDirection: "column",
				height: "100%",
				minHeight: 0,
			},
		},
		h(CultCanvasBoard, {
			syncUrl,
			visible,
			snapEnabled,
			gridSize,
			canStartProject: typeof uiWorkspace?.startSession === "function",
			onStartProject: startProject,
			startProjectLabel: label("toolbar.startProject"),
			agentBadgeLabel: label("badge.agent"),
		}),
		error === null
			? null
			: h(
					"p",
					{
						role: "status",
						style: {
							margin: 0,
							padding: "4px 8px",
							fontSize: 12,
							color: "var(--dsw-alias-state-error-primary)",
						},
					},
					error,
				),
	);
}

/** Build the injection closure one tab registration uses. */
export function canvasTabInject(ctx: {
	configForms?: ClientConfigForms;
	uiWorkspace?: ClientUIWorkspace;
	workspaces?: ClientWorkspaces;
	get?: (name: "workspaces") => ClientWorkspaces | undefined;
}): (sessionId?: string) => Record<string, unknown> {
	const form = ctx.configForms?.get(SETTINGS_NAMESPACE);
	// Read lazily: a profile without the workspace controller still gets a tab,
	// it just starts the session in the current workspace.
	const workspaces = ctx.workspaces ?? ctx.get?.("workspaces");
	// The seat normally hands the session id down; when it does not, the shell's
	// active session is the one the tab is showing.
	return (sessionId?: string) => ({
		sessionId: sessionId ?? ctx.uiWorkspace?.getActiveSession?.()?.id,
		settings:
			form === undefined
				? undefined
				: {
						getSnapshot: () => form.getSnapshot(),
						subscribe: (listener: () => void) => form.subscribe(listener),
					},
		uiWorkspace: ctx.uiWorkspace,
		workspaces,
	});
}
