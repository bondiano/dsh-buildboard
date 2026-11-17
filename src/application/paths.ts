import { join } from "node:path";
import { PROJECT_DIR_NAME } from "../domain/route.js";

/** Project `.buildboard` root. */
export function projectRoot(workspace: string): string {
	return join(workspace, PROJECT_DIR_NAME);
}

export function projectBoardsDir(workspace: string): string {
	return join(projectRoot(workspace), "boards");
}

export function projectCardsDir(workspace: string): string {
	return join(projectRoot(workspace), "cards");
}

export function projectBoardPath(workspace: string, slug: string): string {
	return join(projectBoardsDir(workspace), `${slug}.board.json`);
}

export function projectCardPath(workspace: string, id: string): string {
	return join(projectCardsDir(workspace), `${id}.md`);
}

/** Global library under $DSH_HOME/buildboard. */
export function globalRoot(dshHome: string): string {
	return join(dshHome, "buildboard");
}

export function globalBoardsDir(dshHome: string): string {
	return join(globalRoot(dshHome), "boards");
}

export function globalCardsDir(dshHome: string): string {
	return join(globalRoot(dshHome), "cards");
}

export function globalCardPath(dshHome: string, id: string): string {
	return join(globalCardsDir(dshHome), `${id}.md`);
}
