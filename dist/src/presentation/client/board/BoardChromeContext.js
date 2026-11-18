import { jsx as _jsx } from "react/jsx-runtime";
/**
 * Stable Tldraw chrome: MainMenu / PageMenu must keep component identity across
 * catalog and sync polls. Inline `components={{ PageMenu: () => ... }}` remounts
 * the burger and board switcher every tick (open menus vanish / flicker).
 */
import * as React from "react";
import { BuildboardMainMenu } from "./BuildboardMenu.js";
import { BuildboardPageMenu } from "./BuildboardPageMenu.js";
export const BoardChromeContext = React.createContext(null);
/** Module-stable MainMenu slot — never recreate this function identity. */
export function BuildboardMainMenuSlot() {
    const chrome = React.useContext(BoardChromeContext);
    if (!chrome?.mod)
        return null;
    return (_jsx(BuildboardMainMenu, { mod: chrome.mod, researchLabel: chrome.researchLabel, implementLabel: chrome.implementLabel, prettifyLabel: chrome.prettifyLabel, onResearch: chrome.onResearch, onImplement: chrome.onImplement }));
}
/** Module-stable PageMenu slot — never recreate this function identity. */
export function BuildboardPageMenuSlot() {
    const chrome = React.useContext(BoardChromeContext);
    if (!chrome)
        return null;
    return (_jsx(BuildboardPageMenu, { boards: chrome.boards, currentSlug: chrome.currentSlug, boardsLabel: chrome.boardsLabel, newBoardLabel: chrome.newBoardLabel, onSelectBoard: (slug) => chrome.onSelectBoard?.(slug), onCreateBoard: chrome.onCreateBoard }));
}
/** Pass once to `<Tldraw components={...} />` — object identity is stable. */
export const BUILDBOARD_TLDRAW_COMPONENTS = {
    MainMenu: BuildboardMainMenuSlot,
    PageMenu: BuildboardPageMenuSlot,
};
