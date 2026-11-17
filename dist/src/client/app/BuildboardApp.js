import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
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
    const [ensuring, setEnsuring] = React.useState(false);
    const [ensureError, setEnsureError] = React.useState(null);
    const sessionQuery = props.sessionId
        ? `session=${encodeURIComponent(props.sessionId)}`
        : "";
    React.useEffect(() => {
        if (props.visible === false)
            return;
        let cancelled = false;
        async function refresh() {
            try {
                const [metaRes, bRes, cRes, rRes] = await Promise.all([
                    fetch(`${BUILDBOARD_API_ROUTE}/meta?${sessionQuery}`),
                    fetch(`${BUILDBOARD_API_ROUTE}/boards?${sessionQuery}`),
                    fetch(`${BUILDBOARD_API_ROUTE}/cards?${sessionQuery}`),
                    fetch(`${BUILDBOARD_API_ROUTE}/runs`),
                ]);
                if (cancelled)
                    return;
                const meta = (await metaRes.json());
                if (metaRes.status === 409 || meta.error === WORKSPACE_REQUIRED) {
                    setWorkspace(null);
                    setBoards([]);
                    setCards([]);
                    setRuns([]);
                    return;
                }
                setWorkspace(typeof meta.workspace === "string" ? meta.workspace : null);
                const b = (await bRes.json());
                const c = (await cRes.json());
                const r = (await rRes.json());
                if (typeof b.workspace === "string")
                    setWorkspace(b.workspace);
                else if (b.workspace === null)
                    setWorkspace(null);
                setBoards(b.boards ?? []);
                setCards(c.cards ?? []);
                setRuns(r.runs ?? []);
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
    }, [props.sessionId, props.visible, props.pollIntervalMs, sessionQuery]);
    const createLocalBoard = async () => {
        setEnsuring(true);
        setEnsureError(null);
        try {
            const response = await fetch(`${BUILDBOARD_API_ROUTE}/workspace/ensure?${sessionQuery}`, { method: "POST" });
            const body = (await response.json());
            if (!response.ok) {
                setEnsureError(body.message ?? `HTTP ${response.status}`);
                return;
            }
            setWorkspace(body.workspace ?? null);
            setBoards(body.boards ?? []);
            setBoard("main");
        }
        catch (error) {
            setEnsureError(String(error));
        }
        finally {
            setEnsuring(false);
        }
    };
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
    if (workspace === null) {
        return (_jsx("div", { className: "dsh-bb-root", "data-buildboard-app": "", "data-empty": "workspace", children: _jsxs("div", { className: "dsh-bb-empty", role: "status", children: [_jsx("strong", { children: label(props.t, "empty.noWorkspace", "У сессии нет workspace — доску сохранить некуда.") }), _jsx("p", { children: label(props.t, "empty.hint", "Открой сессию из проекта слева, или создай локальную доску для этой сессии.") }), _jsx("button", { type: "button", disabled: ensuring, onClick: () => void createLocalBoard(), children: ensuring
                            ? label(props.t, "empty.creating", "Создаём…")
                            : label(props.t, "empty.createLocal", "Создать локальную доску") }), ensureError ? (_jsx("p", { className: "dsh-bb-empty-error", role: "alert", children: ensureError })) : null] }) }));
    }
    return (_jsxs("div", { className: "dsh-bb-root", "data-buildboard-app": "", children: [_jsx("p", { className: "dsh-bb-help", role: "note", children: label(props.t, "help.howto", "Рисуйте на холсте (tldraw). Research/Implement стартуют агента. В чате: /canvas — собрать доску по сессии.") }), _jsxs("div", { className: "dsh-bb-toolbar", children: [_jsx("button", { type: "button", onClick: () => void startRun("research"), children: label(props.t, "toolbar.research", "Research") }), _jsx("button", { type: "button", onClick: () => void startRun("implement"), children: label(props.t, "toolbar.implement", "Implement") }), props.onFullscreen ? (_jsx("button", { type: "button", onClick: props.onFullscreen, children: label(props.t, "toolbar.fullscreen", "Fullscreen") })) : null] }), _jsxs("div", { className: `dsh-bb-shell${props.compact ? " is-compact" : ""}`, children: [props.compact ? null : (_jsxs("aside", { className: "dsh-bb-side", children: [_jsx("strong", { children: label(props.t, "boards.title", "Boards") }), boards.map((item) => (_jsxs("div", { className: `dsh-bb-list-item${item.slug === board ? " is-active" : ""}`, onClick: () => setBoard(item.slug), onKeyDown: (event) => {
                                    if (event.key === "Enter")
                                        setBoard(item.slug);
                                }, role: "button", tabIndex: 0, children: [item.title, _jsx("div", { className: "meta", children: item.slug })] }, item.id))), _jsx("strong", { children: label(props.t, "library.title", "Cards") }), cards.map((item) => (_jsxs("div", { className: `dsh-bb-list-item${selectedCard?.id === item.id ? " is-active" : ""}`, onClick: () => setSelectedCard(item), onKeyDown: (event) => {
                                    if (event.key === "Enter")
                                        setSelectedCard(item);
                                }, role: "button", tabIndex: 0, children: [item.title, _jsxs("div", { className: "meta", children: [item.scope, " \u00B7 ", item.excerpt] })] }, `${item.scope}:${item.id}`)))] })), workspace === undefined ? (_jsx("div", { className: "dsh-bb-board dsh-bb-fallback", role: "status", children: label(props.t, "empty.loading", "Загрузка доски…") })) : (_jsx(BoardView, { sessionId: props.sessionId, board: board, licenseKey: props.licenseKey, pollIntervalMs: props.pollIntervalMs, visible: props.visible })), props.compact ? null : (_jsxs("aside", { className: "dsh-bb-detail", children: [selectedCard ? (_jsx(CardEditor, { scope: selectedCard.scope, id: selectedCard.id, title: cardTitle || selectedCard.title, body: cardBody, sessionId: props.sessionId, onSaved: (next) => {
                                    setCardBody(next.body);
                                    setCardTitle(next.title);
                                    setSelectedCard({
                                        ...selectedCard,
                                        title: next.title,
                                        excerpt: next.body.split("\n").find((l) => l.trim()) ?? "",
                                    });
                                } })) : (_jsx("strong", { children: label(props.t, "runs.title", "Runs") })), runs.map((run) => (_jsxs("div", { className: "dsh-bb-list-item", children: [run.kind, " \u00B7 ", run.status, _jsx("div", { className: "meta", children: run.boardSlug })] }, run.id)))] }))] })] }));
}
