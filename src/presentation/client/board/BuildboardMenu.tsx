import * as React from "react";
import { applyBoardPrettify } from "./apply-prettify.js";

export interface BuildboardMenuProps {
	mod: typeof import("tldraw");
	researchLabel: string;
	implementLabel: string;
	prettifyLabel: string;
	onResearch?: () => void;
	onImplement?: () => void;
}

/** Research / Implement / Prettify entries inside tldraw's hamburger MainMenu. */
export function BuildboardMainMenu(
	props: BuildboardMenuProps,
): React.ReactElement {
	const {
		DefaultMainMenu,
		DefaultMainMenuContent,
		TldrawUiMenuGroup,
		TldrawUiMenuItem,
		useEditor,
	} = props.mod;
	const editor = useEditor();
	return (
		<DefaultMainMenu>
			<TldrawUiMenuGroup id="buildboard-agent">
				<TldrawUiMenuItem
					id="buildboard-research"
					label={props.researchLabel}
					readonlyOk
					onSelect={() => {
						props.onResearch?.();
					}}
				/>
				<TldrawUiMenuItem
					id="buildboard-implement"
					label={props.implementLabel}
					readonlyOk
					onSelect={() => {
						props.onImplement?.();
					}}
				/>
				<TldrawUiMenuItem
					id="buildboard-prettify"
					label={props.prettifyLabel}
					readonlyOk
					onSelect={() => {
						applyBoardPrettify(
							editor as unknown as Parameters<typeof applyBoardPrettify>[0],
						);
					}}
				/>
			</TldrawUiMenuGroup>
			<DefaultMainMenuContent />
		</DefaultMainMenu>
	);
}
