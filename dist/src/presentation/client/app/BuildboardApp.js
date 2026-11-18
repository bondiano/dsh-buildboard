import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import * as React from "react";
import { createAppShellStore } from "../../../application/app-shell-store.js";
import { BUILDBOARD_API_ROUTE } from "../../../domain/route.js";
import { BoardView } from "../board/BoardView.js";
import { CardEditor } from "../cards/CardEditor.js";
import { useActorStore } from "../hooks/useActorStore.js";
function label(t, key, fallback) {
    return t ? t(key) : fallback;
}
function useConfigure(store, sessionId, visible, pollIntervalMs) {
    const key = `${sessionId ?? ""}:${visible}:${pollIntervalMs}`;
    const last = React.useRef("");
    if (last.current !== key) {
        last.current = key;
        queueMicrotask(() => {
            store.send({
                type: "CONFIGURE",
                sessionId,
                visible,
                pollIntervalMs,
            });
        });
    }
}
export function BuildboardApp(props) {
    const store = React.useState(() => createAppShellStore())[0];
    const snapshot = useActorStore(store);
    const context = snapshot.context;
    useConfigure(store, props.sessionId, props.visible !== false, props.pollIntervalMs ?? 2000);
    const startRun = async (kind) => {
        const board = context.board;
        const brief = `Buildboard ${kind} on board ${board}. Use board_* and card_* tools, then run_report.`;
        const sessionQuery = props.sessionId
            ? `session=${encodeURIComponent(props.sessionId)}`
            : "";
        try {
            const response = await fetch(`${BUILDBOARD_API_ROUTE}/runs?${sessionQuery}`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ kind, boardSlug: board, brief }),
            });
            const body = (await response.json());
            const runId = body.run?.id;
            const prompt = runId
                ? `${brief}\n\nRun id: ${runId}. Open board slug: ${board}.`
                : brief;
            props.onStartRun?.(kind, board, prompt);
        }
        catch {
            props.onStartRun?.(kind, board, brief);
        }
    };
    const rootStyle = {
        display: "flex",
        flexDirection: "column",
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        minHeight: 240,
        boxSizing: "border-box",
        background: "#111",
        color: "#eee",
    };
    if (context.workspace === null) {
        return (_jsx("div", { className: "dsh-bb-root", "data-buildboard-app": "", "data-empty": "workspace", style: rootStyle, children: _jsxs("div", { className: "dsh-bb-empty", role: "status", style: { padding: 16 }, children: [_jsx("strong", { children: context.ensureError
                            ? label(props.t, "empty.noWorkspace", "У сессии нет workspace — доску сохранить некуда.")
                            : label(props.t, "empty.creating", "Создаём локальную доску…") }), context.ensureError ? (_jsxs(_Fragment, { children: [_jsx("p", { className: "dsh-bb-empty-error", role: "alert", children: context.ensureError }), _jsx("button", { type: "button", onClick: () => store.send({ type: "ENSURE" }), children: label(props.t, "empty.createLocal", "Создать локальную доску") })] })) : null] }) }));
    }
    return (_jsx("div", { className: "dsh-bb-root", "data-buildboard-app": "", style: rootStyle, children: _jsxs("div", { className: `dsh-bb-shell${props.compact ? " is-compact" : ""}`, children: [props.compact ? null : (_jsxs("aside", { className: "dsh-bb-side", children: [_jsx("strong", { children: label(props.t, "boards.title", "Boards") }), context.boards.map((item) => (_jsxs("div", { className: `dsh-bb-list-item${item.slug === context.board ? " is-active" : ""}`, onClick: () => store.send({ type: "SET_BOARD", board: item.slug }), onKeyDown: (event) => {
                                if (event.key === "Enter") {
                                    store.send({ type: "SET_BOARD", board: item.slug });
                                }
                            }, role: "button", tabIndex: 0, children: [item.title, _jsx("div", { className: "meta", children: item.slug })] }, item.id))), _jsx("strong", { children: label(props.t, "library.title", "Cards") }), context.cards.map((item) => (_jsxs("div", { className: `dsh-bb-list-item${context.selectedCard?.id === item.id ? " is-active" : ""}`, onClick: () => store.send({ type: "SELECT_CARD", card: item }), onKeyDown: (event) => {
                                if (event.key === "Enter") {
                                    store.send({ type: "SELECT_CARD", card: item });
                                }
                            }, role: "button", tabIndex: 0, children: [item.title, _jsxs("div", { className: "meta", children: [item.scope, " \u00B7 ", item.excerpt] })] }, `${item.scope}:${item.id}`)))] })), context.workspace === undefined ? (_jsx("div", { className: "dsh-bb-board dsh-bb-fallback", role: "status", style: { padding: 16, color: "#eee" }, children: label(props.t, "empty.loading", "Загрузка доски…") })) : (_jsx(BoardView, { sessionId: props.sessionId, board: context.board, licenseKey: props.licenseKey, pollIntervalMs: props.pollIntervalMs, visible: props.visible, researchLabel: label(props.t, "toolbar.research", "Research"), implementLabel: label(props.t, "toolbar.implement", "Implement"), prettifyLabel: label(props.t, "toolbar.prettify", "Prettify layout"), onResearch: () => {
                        void startRun("research");
                    }, onImplement: () => {
                        void startRun("implement");
                    } })), props.compact ? null : (_jsxs("aside", { className: "dsh-bb-detail", children: [context.selectedCard ? (_jsx(CardEditor, { scope: context.selectedCard.scope, id: context.selectedCard.id, title: context.cardTitle || context.selectedCard.title, body: context.cardBody, sessionId: props.sessionId, onSaved: (next) => {
                                store.send({
                                    type: "CARD_SAVED",
                                    title: next.title,
                                    body: next.body,
                                });
                            } })) : (_jsx("strong", { children: label(props.t, "runs.title", "Runs") })), context.runs.map((run) => (_jsxs("div", { className: "dsh-bb-list-item", children: [run.kind, " \u00B7 ", run.status, _jsx("div", { className: "meta", children: run.boardSlug })] }, run.id)))] }))] }) }));
}
