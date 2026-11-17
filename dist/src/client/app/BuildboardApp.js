import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import * as React from "react";
import { BUILDBOARD_API_ROUTE } from "../../domain/route.js";
import { BoardView } from "../board/BoardView.js";
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
    const sessionQuery = props.sessionId
        ? `session=${encodeURIComponent(props.sessionId)}`
        : "";
    React.useEffect(() => {
        if (props.visible === false)
            return;
        let cancelled = false;
        async function refresh() {
            try {
                const [b, c, r] = await Promise.all([
                    fetch(`${BUILDBOARD_API_ROUTE}/boards?${sessionQuery}`).then((x) => x.json()),
                    fetch(`${BUILDBOARD_API_ROUTE}/cards?${sessionQuery}`).then((x) => x.json()),
                    fetch(`${BUILDBOARD_API_ROUTE}/runs`).then((x) => x.json()),
                ]);
                if (cancelled)
                    return;
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
    React.useEffect(() => {
        if (!selectedCard) {
            setCardBody("");
            return;
        }
        let cancelled = false;
        void fetch(`${BUILDBOARD_API_ROUTE}/cards/${selectedCard.scope}:${selectedCard.id}?${sessionQuery}`)
            .then((r) => r.json())
            .then((body) => {
            if (!cancelled)
                setCardBody(body.card?.body ?? "");
        })
            .catch(() => {
            if (!cancelled)
                setCardBody("");
        });
        return () => {
            cancelled = true;
        };
    }, [selectedCard, sessionQuery]);
    return (_jsxs("div", { className: "dsh-bb-root", "data-buildboard-app": "", children: [_jsxs("div", { className: "dsh-bb-toolbar", children: [_jsx("button", { type: "button", onClick: () => props.onStartRun?.("research", board), children: label(props.t, "toolbar.research", "Research") }), _jsx("button", { type: "button", onClick: () => props.onStartRun?.("implement", board), children: label(props.t, "toolbar.implement", "Implement") }), props.onFullscreen ? (_jsx("button", { type: "button", onClick: props.onFullscreen, children: label(props.t, "toolbar.fullscreen", "Fullscreen") })) : null] }), _jsxs("div", { className: `dsh-bb-shell${props.compact ? " is-compact" : ""}`, children: [props.compact ? null : (_jsxs("aside", { className: "dsh-bb-side", children: [_jsx("strong", { children: label(props.t, "boards.title", "Boards") }), boards.map((item) => (_jsxs("div", { className: `dsh-bb-list-item${item.slug === board ? " is-active" : ""}`, onClick: () => setBoard(item.slug), onKeyDown: (event) => {
                                    if (event.key === "Enter")
                                        setBoard(item.slug);
                                }, role: "button", tabIndex: 0, children: [item.title, _jsx("div", { className: "meta", children: item.slug })] }, item.id))), _jsx("strong", { children: label(props.t, "library.title", "Cards") }), cards.map((item) => (_jsxs("div", { className: `dsh-bb-list-item${selectedCard?.id === item.id ? " is-active" : ""}`, onClick: () => setSelectedCard(item), onKeyDown: (event) => {
                                    if (event.key === "Enter")
                                        setSelectedCard(item);
                                }, role: "button", tabIndex: 0, children: [item.title, _jsxs("div", { className: "meta", children: [item.scope, " \u00B7 ", item.excerpt] })] }, `${item.scope}:${item.id}`)))] })), _jsx(BoardView, { sessionId: props.sessionId, board: board, licenseKey: props.licenseKey, pollIntervalMs: props.pollIntervalMs, visible: props.visible }), props.compact ? null : (_jsxs("aside", { className: "dsh-bb-detail", children: [selectedCard ? (_jsxs(_Fragment, { children: [_jsx("strong", { children: selectedCard.title }), _jsx("pre", { style: { whiteSpace: "pre-wrap", fontSize: 12 }, children: cardBody })] })) : (_jsx("strong", { children: label(props.t, "runs.title", "Runs") })), runs.map((run) => (_jsxs("div", { className: "dsh-bb-list-item", children: [run.kind, " \u00B7 ", run.status, _jsx("div", { className: "meta", children: run.boardSlug })] }, run.id)))] }))] })] }));
}
