import { join } from "node:path";
import { PROJECT_DIR_NAME } from "../domain/route.js";
/** Project `.buildboard` root. */
export function projectRoot(workspace) {
    return join(workspace, PROJECT_DIR_NAME);
}
export function projectBoardsDir(workspace) {
    return join(projectRoot(workspace), "boards");
}
export function projectCardsDir(workspace) {
    return join(projectRoot(workspace), "cards");
}
export function projectBoardPath(workspace, slug) {
    return join(projectBoardsDir(workspace), `${slug}.board.json`);
}
export function projectCardPath(workspace, id) {
    return join(projectCardsDir(workspace), `${id}.md`);
}
/** Global library under $DSH_HOME/buildboard. */
export function globalRoot(dshHome) {
    return join(dshHome, "buildboard");
}
export function globalBoardsDir(dshHome) {
    return join(globalRoot(dshHome), "boards");
}
export function globalCardsDir(dshHome) {
    return join(globalRoot(dshHome), "cards");
}
export function globalCardPath(dshHome, id) {
    return join(globalCardsDir(dshHome), `${id}.md`);
}
