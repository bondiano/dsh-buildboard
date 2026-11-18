import * as React from "react";

export interface BuildboardMenuProps {
	mod: typeof import("tldraw");
	researchLabel: string;
	implementLabel: string;
	onResearch?: () => void;
	onImplement?: () => void;
}

/** Research / Implement entries inside tldraw's hamburger MainMenu. */
export function BuildboardMainMenu(
	props: BuildboardMenuProps,
): React.ReactElement {
	const {
		DefaultMainMenu,
		DefaultMainMenuContent,
		TldrawUiMenuGroup,
		TldrawUiMenuItem,
	} = props.mod;
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
			</TldrawUiMenuGroup>
			<DefaultMainMenuContent />
		</DefaultMainMenu>
	);
}
