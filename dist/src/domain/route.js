/**
 * Shared API route identity.
 *
 * The Host registers the prefix route and the Client polls it, so the string
 * lives where both halves can import it without touching the other's entry.
 *
 * @module @local/dsh-cult-canvas/domain/route
 */
/** Canonical web route prefix for canvas API endpoints. */
export const CANVAS_API_ROUTE = "/plugin-api/cult-canvas";
/** Board file name inside the workspace directory. */
export const BOARD_FILE_NAME = "cult-canvas.canvas";
