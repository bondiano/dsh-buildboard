/**
 * Stable Tldraw chrome: MainMenu / PageMenu must keep component identity across
 * catalog and sync polls. Inline `components={{ PageMenu: () => ... }}` remounts
 * the burger and board switcher every tick (open menus vanish / flicker).
 */
import * as React from "react";
import type { BoardSummary } from "../../../domain/board.js";
import { BuildboardMainMenu } from "./BuildboardMenu.js";
import { BuildboardPageMenu } from "./BuildboardPageMenu.js";

export interface BoardChromeValue {
	mod: typeof import("tldraw") | null;
	boards: BoardSummary[];
	currentSlug: string;
	researchLabel: string;
	implementLabel: string;
	prettifyLabel: string;
	boardsLabel?: string;
	newBoardLabel?: string;
	onResearch?: () => void;
	onImplement?: () => void;
	onSelectBoard?: (slug: string) => void;
	onCreateBoard?: () => void;
}

export const BoardChromeContext = React.createContext<BoardChromeValue | null>(
	null,
);

/** Module-stable MainMenu slot — never recreate this function identity. */
export function BuildboardMainMenuSlot(): React.ReactElement | null {
	const chrome = React.useContext(BoardChromeContext);
	if (!chrome?.mod) return null;
	return (
		<BuildboardMainMenu
			mod={chrome.mod}
			researchLabel={chrome.researchLabel}
			implementLabel={chrome.implementLabel}
			prettifyLabel={chrome.prettifyLabel}
			onResearch={chrome.onResearch}
			onImplement={chrome.onImplement}
		/>
	);
}

/** Module-stable PageMenu slot — never recreate this function identity. */
export function BuildboardPageMenuSlot(): React.ReactElement | null {
	const chrome = React.useContext(BoardChromeContext);
	if (!chrome) return null;
	return (
		<BuildboardPageMenu
			boards={chrome.boards}
			currentSlug={chrome.currentSlug}
			boardsLabel={chrome.boardsLabel}
			newBoardLabel={chrome.newBoardLabel}
			onSelectBoard={(slug) => chrome.onSelectBoard?.(slug)}
			onCreateBoard={chrome.onCreateBoard}
		/>
	);
}

/** Pass once to `<Tldraw components={...} />` — object identity is stable. */
export const BUILDBOARD_TLDRAW_COMPONENTS = {
	MainMenu: BuildboardMainMenuSlot,
	PageMenu: BuildboardPageMenuSlot,
};
