import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import * as React from "react";
import { BUILDBOARD_API_ROUTE, WORKSPACE_REQUIRED, } from "../../domain/route.js";
import { BoardView } from "../board/BoardView.js";
import { CardEditor } from "../cards/CardEditor.js";
function label(t, key, fallback) {
    return t ? t(key) : fallback;
}
export function BuildboardApp(props) {
    const [boards, setBoards] = React.useState([]);
    const [cards, setCards] = React.useState([]);
    const [runs, setRuns] = React.useState([]);
    const [board, setBoard] = React.useState("main");
    const [selectedCard, setSelectedCard] = React.useState(null);
    const [cardBody, setCardBody] = React.useState("");
    const [cardTitle, setCardTitle] = React.useState("");
    const [workspace, setWorkspace] = React.useState(undefined);
    const [ensureError, setEnsureError] = React.useState(null);
    const sessionQuery = props.sessionId
        ? `session=${encodeURIComponent(props.sessionId)}`
        : "";
    const applyWorkspacePayload = React.useCallback((body) => {
        setWorkspace(typeof body.workspace === "string"
            ? body.workspace
            : body.workspace === null
                ? null
                : undefined);
        if (body.boards)
            setBoards(body.boards);
        if (body.cards)
            setCards(body.cards);
        if (body.runs)
            setRuns(body.runs);
    }, []);
    const ensureLocalWorkspace = React.useCallback(async () => {
        setEnsureError(null);
        try {
            const response = await fetch(`${BUILDBOARD_API_ROUTE}/workspace/ensure?${sessionQuery}`, { method: "POST" });
            const body = (await response.json());
            if (!response.ok) {
                setEnsureError(body.message ?? `HTTP ${response.status}`);
                setWorkspace(null);
                return false;
            }
            applyWorkspacePayload(body);
            setBoard("main");
            return true;
        }
        catch (error) {
            setEnsureError(String(error));
            setWorkspace(null);
            return false;
        }
    }, [applyWorkspacePayload, sessionQuery]);
    React.useEffect(() => {
        if (props.visible === false)
            return;
        let cancelled = false;
        async function refresh() {
            try {
                const metaRes = await fetch(`${BUILDBOARD_API_ROUTE}/meta?${sessionQuery}`);
                if (cancelled)
                    return;
                const meta = (await metaRes.json());
                const missingWorkspace = metaRes.status === 409 ||
                    meta.error === WORKSPACE_REQUIRED ||
                    meta.workspace == null;
                if (missingWorkspace) {
                    const ok = await ensureLocalWorkspace();
                    if (cancelled || !ok)
                        return;
                }
                else {
                    setWorkspace(typeof meta.workspace === "string" ? meta.workspace : null);
                }
                const [bRes, cRes, rRes] = await Promise.all([
                    fetch(`${BUILDBOARD_API_ROUTE}/boards?${sessionQuery}`),
                    fetch(`${BUILDBOARD_API_ROUTE}/cards?${sessionQuery}`),
                    fetch(`${BUILDBOARD_API_ROUTE}/runs`),
                ]);
                if (cancelled)
                    return;
                const b = (await bRes.json());
                const c = (await cRes.json());
                const r = (await rRes.json());
                applyWorkspacePayload({
                    workspace: b.workspace ?? meta.workspace,
                    boards: b.boards ?? [],
                    cards: c.cards ?? [],
                    runs: r.runs ?? [],
                });
            }
            catch {
                // host may be temporarily unavailable
            }
        }
        void refresh();
        const timer = setInterval(() => void refresh(), props.pollIntervalMs ?? 2000);
        return () => {
            cancelled = true;
            clearInterval(timer);
        };
    }, [
        props.sessionId,
        props.visible,
        props.pollIntervalMs,
        sessionQuery,
        ensureLocalWorkspace,
        applyWorkspacePayload,
    ]);
    React.useEffect(() => {
        if (!selectedCard) {
            setCardBody("");
            setCardTitle("");
            return;
        }
        let cancelled = false;
        void fetch(`${BUILDBOARD_API_ROUTE}/cards/${selectedCard.scope}:${selectedCard.id}?${sessionQuery}`)
            .then((r) => r.json())
            .then((body) => {
            if (cancelled)
                return;
            setCardBody(body.card?.body ?? "");
            setCardTitle(body.card?.title ?? selectedCard.title);
        })
            .catch(() => {
            if (!cancelled) {
                setCardBody("");
                setCardTitle(selectedCard.title);
            }
        });
        return () => {
            cancelled = true;
        };
    }, [selectedCard, sessionQuery]);
    React.useEffect(() => {
        if (boards.length === 0)
            return;
        const preferred = [...boards].sort((a, b) => b.updatedAt - a.updatedAt).find((item) => item.slug.startsWith("session-")) ??
            [...boards].sort((a, b) => b.updatedAt - a.updatedAt)[0];
        if (!preferred)
            return;
        setBoard((current) => {
            if (boards.some((item) => item.slug === current) && current !== "main") {
                return current;
            }
            return preferred.slug;
        });
    }, [boards]);
    const startRun = async (kind) => {
        const brief = `Buildboard ${kind} on board ${board}. Use board_* and card_* tools, then run_report.`;
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
    if (workspace === null) {
        return (_jsx("div", { className: "dsh-bb-root", "data-buildboard-app": "", "data-empty": "workspace", style: rootStyle, children: _jsxs("div", { className: "dsh-bb-empty", role: "status", style: { padding: 16 }, children: [_jsx("strong", { children: ensureError
                            ? label(props.t, "empty.noWorkspace", "У сессии нет workspace — доску сохранить некуда.")
                            : label(props.t, "empty.creating", "Создаём локальную доску…") }), ensureError ? (_jsxs(_Fragment, { children: [_jsx("p", { className: "dsh-bb-empty-error", role: "alert", children: ensureError }), _jsx("button", { type: "button", onClick: () => void ensureLocalWorkspace(), children: label(props.t, "empty.createLocal", "Создать локальную доску") })] })) : null] }) }));
    }
    return (_jsx("div", { className: "dsh-bb-root", "data-buildboard-app": "", style: rootStyle, children: _jsxs("div", { className: `dsh-bb-shell${props.compact ? " is-compact" : ""}`, children: [props.compact ? null : (_jsxs("aside", { className: "dsh-bb-side", children: [_jsx("strong", { children: label(props.t, "boards.title", "Boards") }), boards.map((item) => (_jsxs("div", { className: `dsh-bb-list-item${item.slug === board ? " is-active" : ""}`, onClick: () => setBoard(item.slug), onKeyDown: (event) => {
                                if (event.key === "Enter")
                                    setBoard(item.slug);
                            }, role: "button", tabIndex: 0, children: [item.title, _jsx("div", { className: "meta", children: item.slug })] }, item.id))), _jsx("strong", { children: label(props.t, "library.title", "Cards") }), cards.map((item) => (_jsxs("div", { className: `dsh-bb-list-item${selectedCard?.id === item.id ? " is-active" : ""}`, onClick: () => setSelectedCard(item), onKeyDown: (event) => {
                                if (event.key === "Enter")
                                    setSelectedCard(item);
                            }, role: "button", tabIndex: 0, children: [item.title, _jsxs("div", { className: "meta", children: [item.scope, " \u00B7 ", item.excerpt] })] }, `${item.scope}:${item.id}`)))] })), workspace === undefined ? (_jsx("div", { className: "dsh-bb-board dsh-bb-fallback", role: "status", style: { padding: 16, color: "#eee" }, children: label(props.t, "empty.loading", "Загрузка доски…") })) : (_jsx(BoardView, { sessionId: props.sessionId, board: board, licenseKey: props.licenseKey, pollIntervalMs: props.pollIntervalMs, visible: props.visible, researchLabel: label(props.t, "toolbar.research", "Research"), implementLabel: label(props.t, "toolbar.implement", "Implement"), onResearch: () => {
                        void startRun("research");
                    }, onImplement: () => {
                        void startRun("implement");
                    } })), props.compact ? null : (_jsxs("aside", { className: "dsh-bb-detail", children: [selectedCard ? (_jsx(CardEditor, { scope: selectedCard.scope, id: selectedCard.id, title: cardTitle || selectedCard.title, body: cardBody, sessionId: props.sessionId, onSaved: (next) => {
                                setCardBody(next.body);
                                setCardTitle(next.title);
                                setSelectedCard({
                                    ...selectedCard,
                                    title: next.title,
                                    excerpt: next.body.split("\n").find((l) => l.trim()) ?? "",
                                });
                            } })) : (_jsx("strong", { children: label(props.t, "runs.title", "Runs") })), runs.map((run) => (_jsxs("div", { className: "dsh-bb-list-item", children: [run.kind, " \u00B7 ", run.status, _jsx("div", { className: "meta", children: run.boardSlug })] }, run.id)))] }))] }) }));
}
