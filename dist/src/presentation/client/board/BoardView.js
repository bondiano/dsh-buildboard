import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import * as React from "react";
import { createBoardSessionStore } from "../../../application/board-session-store.js";
import { useActorStore } from "../hooks/useActorStore.js";
import { BoardChromeContext, BUILDBOARD_TLDRAW_COMPONENTS, } from "./BoardChromeContext.js";
import { CardShapeUtil } from "./CardShape.js";
function useBoardConfigure(store, props) {
    const board = props.board ?? "main";
    const key = `${props.sessionId ?? ""}:${board}:${props.visible !== false}:${props.pollIntervalMs ?? 2000}`;
    const last = React.useRef("");
    if (last.current !== key) {
        last.current = key;
        queueMicrotask(() => {
            store.send({
                type: "CONFIGURE",
                sessionId: props.sessionId,
                board,
                visible: props.visible !== false,
                pollIntervalMs: props.pollIntervalMs ?? 2000,
            });
        });
    }
}
/**
 * Collaborative board: durable TLStore, user→host diffs, host→store merges.
 */
export function BoardView(props) {
    const store = React.useState(() => createBoardSessionStore(CardShapeUtil))[0];
    const snapshot = useActorStore(store);
    const context = snapshot.context;
    const runtime = store.runtime;
    useBoardConfigure(store, props);
    const boardStyle = {
        position: "relative",
        flex: 1,
        minHeight: 240,
        width: "100%",
        height: "100%",
        background: "#111",
        color: "#eee",
    };
    const mod = runtime.mod;
    const tlStore = runtime.store;
    const shapeUtils = React.useMemo(() => (mod ? [...mod.defaultShapeUtils, CardShapeUtil] : null), [mod]);
    const chromeValue = React.useMemo(() => ({
        mod,
        boards: props.boards ?? [],
        currentSlug: props.board ?? context.board,
        researchLabel: props.researchLabel ?? "Research",
        implementLabel: props.implementLabel ?? "Implement",
        prettifyLabel: props.prettifyLabel ?? "Prettify layout",
        boardsLabel: props.boardsLabel,
        newBoardLabel: props.newBoardLabel,
        onResearch: props.onResearch,
        onImplement: props.onImplement,
        onSelectBoard: props.onSelectBoard,
        onCreateBoard: props.onCreateBoard,
    }), [
        mod,
        props.boards,
        props.board,
        context.board,
        props.researchLabel,
        props.implementLabel,
        props.prettifyLabel,
        props.boardsLabel,
        props.newBoardLabel,
        props.onResearch,
        props.onImplement,
        props.onSelectBoard,
        props.onCreateBoard,
    ]);
    if (mod && tlStore && shapeUtils && snapshot.matches("active")) {
        return (_jsxs("div", { className: "dsh-bb-board", "data-buildboard-board": context.board, style: boardStyle, children: [_jsxs("div", { className: "dsh-bb-sync", "data-sync": context.sync, children: ["sync: ", context.sync] }), _jsx(BoardChromeContext.Provider, { value: chromeValue, children: _jsx(TldrawCanvas, { mod: mod, tlStore: tlStore, shapeUtils: shapeUtils, licenseKey: props.licenseKey, onEditor: (editor) => {
                            store.setEditor(editor);
                        } }) }), context.error ? (_jsx("p", { className: "dsh-bb-board-error", role: "status", children: context.error })) : Object.keys(tlStore.serialize("document") ?? {}).filter((id) => id.startsWith("shape:")).length === 0 ? (_jsx("p", { className: "dsh-bb-board-error", role: "status", children: "Board empty \u2014 run /canvas or draw shapes" })) : null] }));
    }
    const fallback = runtime.fallback;
    return (_jsx("div", { className: "dsh-bb-board", "data-buildboard-board": context.board, style: boardStyle, children: _jsxs("div", { className: "dsh-bb-fallback", style: { padding: 16 }, children: [_jsx("strong", { children: fallback?.title ?? context.board }), context.error ? _jsx("p", { role: "status", children: context.error }) : null, !context.error && !fallback ? (_jsx("p", { role: "status", children: "Loading canvas\u2026" })) : null, _jsx("ul", { children: Object.values(fallback?.records ?? {})
                        .filter((r) => r.typeName === "shape")
                        .slice(0, 40)
                        .map((record) => (_jsxs("li", { children: [typeof record.type === "string" ? record.type : "shape", " \u00B7", " ", typeof record.id === "string" ? record.id : "?", record.meta
                                ?.updatedBy === "agent" ? (_jsx("span", { className: "dsh-bb-agent-chip", children: "agent" })) : null] }, String(record.id)))) })] }) }));
}
/** Isolate Tldraw so parent catalog/sync churn does not recreate its props bag needlessly. */
function TldrawCanvas(props) {
    const { Tldraw } = props.mod;
    const fitted = React.useRef(false);
    const onEditor = props.onEditor;
    const tlStore = props.tlStore;
    const handleMount = React.useCallback((editor) => {
        onEditor(editor);
        if (fitted.current)
            return;
        const shapeCount = Object.keys(tlStore.serialize("document") ?? {}).filter((id) => id.startsWith("shape:")).length;
        if (shapeCount === 0)
            return;
        fitted.current = true;
        try {
            editor.zoomToFit?.({ animation: { duration: 0 } });
        }
        catch {
            // ignore
        }
    }, [onEditor, tlStore]);
    return (_jsx(Tldraw, { licenseKey: props.licenseKey || undefined, store: props.tlStore, inferDarkMode: true, shapeUtils: props.shapeUtils, components: BUILDBOARD_TLDRAW_COMPONENTS, onMount: handleMount }));
}
