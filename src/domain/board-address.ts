/**
 * Parse board slugs from sidebar resource addresses / workspace-relative paths.
 * Chat markdown links to `.buildboard/boards/<slug>.board.json` open via
 * `dsh-resource://file/...` — Buildboard claims those addresses in the right sidebar.
 */

const BOARD_FILE_SUFFIX = ".board.json";
const BOARDS_SEGMENT = "/.buildboard/boards/";

/** True when an address or path is a Buildboard board file. */
export function isBuildboardBoardAddress(address: string): boolean {
	const path = normalizeAddress(address);
	if (!path.endsWith(BOARD_FILE_SUFFIX)) return false;
	return (
		path.includes(BOARDS_SEGMENT) || path.startsWith(".buildboard/boards/")
	);
}

/**
 * Extract the board slug from a sidebar resource address or relative path.
 * Returns undefined when the address is not a board file.
 */
export function boardSlugFromAddress(address: string): string | undefined {
	const path = normalizeAddress(address);
	if (!isBuildboardBoardAddress(path)) return undefined;

	const marker = path.lastIndexOf(BOARDS_SEGMENT);
	const relative =
		marker >= 0
			? path.slice(marker + BOARDS_SEGMENT.length)
			: path.replace(/^\.buildboard\/boards\//, "");
	const base = relative.split("/").pop() ?? "";
	if (!base.endsWith(BOARD_FILE_SUFFIX)) return undefined;
	const slug = base.slice(0, -BOARD_FILE_SUFFIX.length);
	return slug.length > 0 ? slug : undefined;
}

/** Chip title for a board file address. */
export function boardTitleFromAddress(address: string): string {
	return boardSlugFromAddress(address) ?? "Buildboard";
}

/** Relative workspace path agents should use in markdown links. */
export function boardMarkdownPath(slug: string): string {
	return `.buildboard/boards/${slug}.board.json`;
}

function normalizeAddress(address: string): string {
	let value = address.trim();
	try {
		value = decodeURIComponent(value);
	} catch {
		// keep raw
	}
	value = value.replace(/\\/g, "/");
	const resourcePrefix = "dsh-resource://file/";
	if (value.toLowerCase().startsWith(resourcePrefix)) {
		value = value.slice(resourcePrefix.length);
		// Drop scope: session/<id>/ or absolute/
		const first = value.indexOf("/");
		if (first >= 0) value = value.slice(first + 1);
	}
	// absolute/home/... still contains /.buildboard/boards/
	if (!value.startsWith("/") && !value.startsWith(".buildboard/")) {
		value = `/${value}`;
	}
	return value;
}
