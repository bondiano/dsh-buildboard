import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as React from "react";
import { BUILDBOARD_API_ROUTE } from "../../domain/route.js";
function syncUrl(sessionId, board) {
    const params = new URLSearchParams();
    if (sessionId)
        params.set("session", sessionId);
    params.set("board", board);
    return `${BUILDBOARD_API_ROUTE}/state?${params.toString()}`;
}
/**
 * Board surface. Loads tldraw when available; otherwise shows a record list
 * so host/unit tests and offline installs still work.
 */
export function BoardView(props) {
    const board = props.board ?? "main";
    const pollIntervalMs = props.pollIntervalMs ?? 2000;
    const [snapshot, setSnapshot] = React.useState(null);
    const [error, setError] = React.useState(null);
    const [TldrawApp, setTldrawApp] = React.useState(null);
    const revisionRef = React.useRef(0);
    React.useEffect(() => {
        let cancelled = false;
        void import("tldraw")
            .then((mod) => {
            if (cancelled)
                return;
            setTldrawApp(() => {
                function Wrapped(inner) {
                    const { Tldraw } = mod;
                    return (_jsx(Tldraw, { licenseKey: inner.licenseKey || undefined, 
                        // Persistence is owned by the host protocol; this mount is visual.
                        onMount: (editor) => {
                            const records = inner.snapshot
                                ?.records;
                            if (!records)
                                return;
                            try {
                                editor.store.mergeRemoteChanges(() => {
                                    for (const record of Object.values(records)) {
                                        if (record && typeof record.id === "string") {
                                            editor.store.put([record]);
                                        }
                                    }
                                });
                            }
                            catch {
                                // Store schema mismatches fall back to the list view data.
                            }
                        } }));
                }
                return Wrapped;
            });
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
        let cancelled = false;
        const url = syncUrl(props.sessionId, board);
        async function pull() {
            try {
                const response = await fetch(`${url}&since=${revisionRef.current}`);
                if (!response.ok)
                    throw new Error(`HTTP ${response.status}`);
                const body = (await response.json());
                if (cancelled)
                    return;
                if ("records" in body) {
                    revisionRef.current = body.revision;
                    setSnapshot(body);
                    setError(null);
                }
            }
            catch (err) {
                if (!cancelled)
                    setError(String(err));
            }
        }
        void pull();
        const timer = setInterval(() => void pull(), pollIntervalMs);
        return () => {
            cancelled = true;
            clearInterval(timer);
        };
    }, [props.sessionId, board, pollIntervalMs, props.visible]);
    return (_jsx("div", { className: "dsh-bb-board", "data-buildboard-board": board, children: TldrawApp ? (_jsx(TldrawApp, { licenseKey: props.licenseKey, snapshot: snapshot ?? undefined })) : (_jsxs("div", { className: "dsh-bb-fallback", children: [_jsx("strong", { children: snapshot?.title ?? board }), error ? _jsx("p", { role: "status", children: error }) : null, _jsx("ul", { children: Object.values(snapshot?.records ?? {})
                        .filter((r) => r.typeName === "shape")
                        .slice(0, 40)
                        .map((record) => (_jsxs("li", { children: [typeof record.type === "string" ? record.type : "shape", " \u00B7", " ", typeof record.id === "string" ? record.id : "?", record.meta
                                ?.updatedBy === "agent" ? (_jsx("span", { className: "dsh-bb-agent-chip", children: "agent" })) : null] }, String(record.id)))) })] })) }));
}
