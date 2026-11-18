import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { applyBoardPrettify } from "./apply-prettify.js";
/** Research / Implement / Prettify entries inside tldraw's hamburger MainMenu. */
export function BuildboardMainMenu(props) {
    const { DefaultMainMenu, DefaultMainMenuContent, TldrawUiMenuGroup, TldrawUiMenuItem, useEditor, } = props.mod;
    const editor = useEditor();
    return (_jsxs(DefaultMainMenu, { children: [_jsxs(TldrawUiMenuGroup, { id: "buildboard-agent", children: [_jsx(TldrawUiMenuItem, { id: "buildboard-research", label: props.researchLabel, readonlyOk: true, onSelect: () => {
                            props.onResearch?.();
                        } }), _jsx(TldrawUiMenuItem, { id: "buildboard-implement", label: props.implementLabel, readonlyOk: true, onSelect: () => {
                            props.onImplement?.();
                        } }), _jsx(TldrawUiMenuItem, { id: "buildboard-prettify", label: props.prettifyLabel, readonlyOk: true, onSelect: () => {
                            applyBoardPrettify(editor);
                        } })] }), _jsx(DefaultMainMenuContent, {})] }));
}
