import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/** Research / Implement entries inside tldraw's hamburger MainMenu. */
export function BuildboardMainMenu(props) {
    const { DefaultMainMenu, DefaultMainMenuContent, TldrawUiMenuGroup, TldrawUiMenuItem, } = props.mod;
    return (_jsxs(DefaultMainMenu, { children: [_jsxs(TldrawUiMenuGroup, { id: "buildboard-agent", children: [_jsx(TldrawUiMenuItem, { id: "buildboard-research", label: props.researchLabel, readonlyOk: true, onSelect: () => {
                            props.onResearch?.();
                        } }), _jsx(TldrawUiMenuItem, { id: "buildboard-implement", label: props.implementLabel, readonlyOk: true, onSelect: () => {
                            props.onImplement?.();
                        } })] }), _jsx(DefaultMainMenuContent, {})] }));
}
