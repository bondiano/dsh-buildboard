import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import * as React from "react";
import { createBoardSessionStore } from "../../../application/board-session-store.js";
import { useActorStore } from "../hooks/useActorStore.js";
import { BuildboardMainMenu } from "./BuildboardMenu.js";
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
    if (mod && tlStore && snapshot.matches("active")) {
        const { Tldraw, defaultShapeUtils } = mod;
        const researchLabel = props.researchLabel ?? "Research";
        const implementLabel = props.implementLabel ?? "Implement";
        const prettifyLabel = props.prettifyLabel ?? "Prettify layout";
        return (_jsxs("div", { className: "dsh-bb-board", "data-buildboard-board": context.board, style: boardStyle, children: [_jsxs("div", { className: "dsh-bb-sync", "data-sync": context.sync, children: ["sync: ", context.sync] }), _jsx(Tldraw, { licenseKey: props.licenseKey || undefined, store: tlStore, shapeUtils: [...defaultShapeUtils, CardShapeUtil], components: {
                        MainMenu: () => (_jsx(BuildboardMainMenu, { mod: mod, researchLabel: researchLabel, implementLabel: implementLabel, prettifyLabel: prettifyLabel, onResearch: props.onResearch, onImplement: props.onImplement })),
                    }, onMount: (editor) => {
                        store.setEditor(editor);
                        const shapeCount = Object.keys(tlStore.serialize("document") ?? {}).filter((id) => id.startsWith("shape:")).length;
                        if (shapeCount > 0) {
                            try {
                                editor.zoomToFit({ animation: { duration: 0 } });
                            }
                            catch {
                                // ignore
                            }
                        }
                    } }), context.error ? (_jsx("p", { className: "dsh-bb-board-error", role: "status", children: context.error })) : null] }));
    }
    const fallback = runtime.fallback;
    return (_jsx("div", { className: "dsh-bb-board", "data-buildboard-board": context.board, style: boardStyle, children: _jsxs("div", { className: "dsh-bb-fallback", style: { padding: 16 }, children: [_jsx("strong", { children: fallback?.title ?? context.board }), context.error ? _jsx("p", { role: "status", children: context.error }) : null, !context.error && !fallback ? (_jsx("p", { role: "status", children: "Loading canvas\u2026" })) : null, _jsx("ul", { children: Object.values(fallback?.records ?? {})
                        .filter((r) => r.typeName === "shape")
                        .slice(0, 40)
                        .map((record) => (_jsxs("li", { children: [typeof record.type === "string" ? record.type : "shape", " \u00B7", " ", typeof record.id === "string" ? record.id : "?", record.meta
                                ?.updatedBy === "agent" ? (_jsx("span", { className: "dsh-bb-agent-chip", children: "agent" })) : null] }, String(record.id)))) })] }) }));
}
