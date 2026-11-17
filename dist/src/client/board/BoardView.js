import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import * as React from "react";
import { BUILDBOARD_API_ROUTE } from "../../domain/route.js";
import { nextSyncStatus, } from "../../domain/machines/board-sync.machine.js";
import { CardShapeUtil } from "./CardShape.js";
function syncUrl(sessionId, board) {
    const params = new URLSearchParams();
    if (sessionId)
        params.set("session", sessionId);
    params.set("board", board);
    return `${BUILDBOARD_API_ROUTE}/state?${params.toString()}`;
}
function ensureTldrawCss() {
    if (typeof document === "undefined")
        return;
    if (document.querySelector('link[data-dsh-bb-tldraw-css="1"]'))
        return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `${BUILDBOARD_API_ROUTE}/assets/tldraw.css`;
    link.setAttribute("data-dsh-bb-tldraw-css", "1");
    link.onerror = () => {
        link.href = "https://unpkg.com/tldraw@3.15.1/tldraw.css";
    };
    document.head?.append(link);
}
/**
 * Collaborative board: durable TLStore, user→host diffs, host→store merges.
 */
export function BoardView(props) {
    const board = props.board ?? "main";
    const pollIntervalMs = props.pollIntervalMs ?? 2000;
    const [mod, setMod] = React.useState(null);
    const [error, setError] = React.useState(null);
    const [fallback, setFallback] = React.useState(null);
    const [sync, setSync] = React.useState("idle");
    const revisionRef = React.useRef(0);
    const applyingRemote = React.useRef(false);
    const dirtyRef = React.useRef(false);
    const syncRef = React.useRef("idle");
    const storeRef = React.useRef(null);
    const setSyncStatus = React.useCallback((event) => {
        try {
            const next = nextSyncStatus(syncRef.current, event);
            syncRef.current = next;
            setSync(next);
        }
        catch {
            // illegal sync transitions are ignored
        }
    }, []);
    React.useEffect(() => {
        ensureTldrawCss();
        let cancelled = false;
        void import("tldraw")
            .then((loaded) => {
            if (cancelled)
                return;
            if (!storeRef.current) {
                storeRef.current = loaded.createTLStore({
                    shapeUtils: [...loaded.defaultShapeUtils, CardShapeUtil],
                });
            }
            setMod(loaded);
        })
            .catch((err) => {
            if (!cancelled)
                setError(`tldraw unavailable: ${String(err)}`);
        });
        return () => {
            cancelled = true;
        };
    }, []);
    React.useEffect(() => {
        if (props.visible === false)
            return;
        const store = storeRef.current;
        let cancelled = false;
        const url = syncUrl(props.sessionId, board);
        async function pull() {
            if (dirtyRef.current)
                return;
            setSyncStatus("PULL");
            try {
                const response = await fetch(`${url}&since=${revisionRef.current}`);
                if (!response.ok)
                    throw new Error(`HTTP ${response.status}`);
                const body = (await response.json());
                if (cancelled)
                    return;
                if (!("records" in body)) {
                    setSyncStatus("OK");
                    return;
                }
                revisionRef.current = body.revision;
                setFallback(body);
                setError(null);
                if (!store) {
                    setSyncStatus("OK");
                    return;
                }
                applyingRemote.current = true;
                try {
                    store.mergeRemoteChanges(() => {
                        const existing = new Set(Object.keys(store.serialize("document")));
                        const nextIds = new Set(Object.keys(body.records));
                        for (const id of existing) {
                            if (!nextIds.has(id))
                                store.remove([id]);
                        }
                        const put = Object.values(body.records).filter((record) => record &&
                            typeof record === "object" &&
                            typeof record.id === "string");
                        if (put.length > 0)
                            store.put(put);
                    });
                }
                finally {
                    applyingRemote.current = false;
                }
                setSyncStatus("OK");
            }
            catch (err) {
                if (!cancelled) {
                    setError(String(err));
                    setSyncStatus("FAIL");
                }
            }
        }
        void pull();
        const timer = setInterval(() => void pull(), pollIntervalMs);
        return () => {
            cancelled = true;
            clearInterval(timer);
        };
    }, [
        props.sessionId,
        board,
        pollIntervalMs,
        props.visible,
        mod,
        setSyncStatus,
    ]);
    React.useEffect(() => {
        const store = storeRef.current;
        if (!store)
            return;
        let timer;
        const pendingPut = new Map();
        const pendingRemove = new Set();
        const flush = () => {
            if (pendingPut.size === 0 && pendingRemove.size === 0) {
                dirtyRef.current = false;
                return;
            }
            const put = [...pendingPut.values()];
            const remove = [...pendingRemove];
            pendingPut.clear();
            pendingRemove.clear();
            setSyncStatus("PUSH");
            void fetch(syncUrl(props.sessionId, board), {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    put,
                    remove,
                    actor: "user",
                    clientTime: Date.now(),
                }),
            })
                .then(async (response) => {
                if (!response.ok)
                    throw new Error(`HTTP ${response.status}`);
                const body = (await response.json());
                if (typeof body.revision === "number") {
                    revisionRef.current = body.revision;
                }
                dirtyRef.current = pendingPut.size > 0 || pendingRemove.size > 0;
                setSyncStatus("OK");
            })
                .catch(() => {
                dirtyRef.current = true;
                setSyncStatus("FAIL");
            });
        };
        const unlisten = store.listen((entry) => {
            if (applyingRemote.current)
                return;
            if (entry.source !== "user")
                return;
            dirtyRef.current = true;
            for (const [id, change] of Object.entries(entry.changes.added)) {
                pendingPut.set(id, change);
                pendingRemove.delete(id);
            }
            for (const [id, [, next]] of Object.entries(entry.changes.updated)) {
                pendingPut.set(id, next);
                pendingRemove.delete(id);
            }
            for (const id of Object.keys(entry.changes.removed)) {
                pendingPut.delete(id);
                pendingRemove.add(id);
            }
            if (timer)
                clearTimeout(timer);
            timer = setTimeout(flush, 400);
        }, { source: "user", scope: "document" });
        return () => {
            unlisten();
            if (timer)
                clearTimeout(timer);
        };
    }, [props.sessionId, board, mod, setSyncStatus]);
    if (mod && storeRef.current) {
        const { Tldraw, defaultShapeUtils } = mod;
        return (_jsxs("div", { className: "dsh-bb-board", "data-buildboard-board": board, children: [_jsxs("div", { className: "dsh-bb-sync", "data-sync": sync, children: ["sync: ", sync] }), _jsx(Tldraw, { licenseKey: props.licenseKey || undefined, store: storeRef.current, shapeUtils: [...defaultShapeUtils, CardShapeUtil] }), error ? (_jsx("p", { className: "dsh-bb-board-error", role: "status", children: error })) : null] }));
    }
    return (_jsx("div", { className: "dsh-bb-board", "data-buildboard-board": board, children: _jsxs("div", { className: "dsh-bb-fallback", children: [_jsx("strong", { children: fallback?.title ?? board }), error ? _jsx("p", { role: "status", children: error }) : null, _jsx("ul", { children: Object.values(fallback?.records ?? {})
                        .filter((r) => r.typeName === "shape")
                        .slice(0, 40)
                        .map((record) => (_jsxs("li", { children: [typeof record.type === "string" ? record.type : "shape", " \u00B7", " ", typeof record.id === "string" ? record.id : "?", record.meta
                                ?.updatedBy === "agent" ? (_jsx("span", { className: "dsh-bb-agent-chip", children: "agent" })) : null] }, String(record.id)))) })] }) }));
}
