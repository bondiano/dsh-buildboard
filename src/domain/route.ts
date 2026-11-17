/** Shared API route identity for host and client. */

/** Canonical web route prefix. */
export const BUILDBOARD_API_ROUTE = "/plugin-api/buildboard";

/** Project-local storage directory name. */
export const PROJECT_DIR_NAME = ".buildboard";

/** Legacy cult-canvas file imported once into the main board. */
export const LEGACY_CANVAS_FILE = "cult-canvas.canvas";

/** API / command error when the session has no project folder. */
export const WORKSPACE_REQUIRED = "workspace_required";

/** Stable message thrown by BoardRegistry.create without a workspace. */
export const WORKSPACE_REQUIRED_MESSAGE = "board create requires a workspace";

/** User-facing guidance for /canvas and empty Buildboard state. */
export const WORKSPACE_REQUIRED_HINT =
	"This session has no workspace, so a board cannot be saved. Open a session from a project folder, or open Buildboard and click “Create local board”.";

export function isWorkspaceRequiredError(error: unknown): boolean {
	return (
		error instanceof Error &&
		(error.message === WORKSPACE_REQUIRED_MESSAGE ||
			error.message.includes(WORKSPACE_REQUIRED_MESSAGE))
	);
}