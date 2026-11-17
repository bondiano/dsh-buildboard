/**
 * CanvasToolView Component for DSH Cult Canvas
 *
 * Implements toolview cards registered in Cordis slot `tool.call.toolview`:
 * - Displays agent tool execution details, input parameters, and results
 * - Expandable disclosure view for JSON payloads
 * - Status pills and action badges
 *
 * @module @local/dsh-cult-canvas/presentation/components/CanvasToolView
 */
import { h, useState } from "./react-binding.js";
export function CanvasToolView({ toolName, callId, payload, expanded = false, onToggleExpand, className, }) {
    const [localExpanded, setLocalExpanded] = useState(expanded);
    const isExpanded = onToggleExpand ? expanded : localExpanded;
    const toggle = onToggleExpand ?? (() => setLocalExpanded(!localExpanded));
    const status = payload?.status ?? "completed";
    const statusColor = status === "completed"
        ? "#22c55e"
        : status === "running"
            ? "#38bdf8"
            : "#ef4444";
    const cls = ["dsh-cult-canvas-toolview", `tool-${toolName}`, className ?? ""]
        .filter(Boolean)
        .join(" ");
    return h("div", {
        className: cls,
        style: {
            backgroundColor: "rgba(15, 23, 42, 0.85)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            borderRadius: "8px",
            padding: "10px 14px",
            margin: "4px 0",
            fontSize: "12px",
            color: "#e2e8f0",
            fontFamily: "monospace",
        },
    }, 
    // Header row
    h("div", {
        className: "dsh-toolview-header",
        style: {
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            cursor: "pointer",
            userSelect: "none",
        },
        onClick: toggle,
    }, h("div", { style: { display: "flex", alignItems: "center", gap: "8px" } }, h("span", {
        style: {
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            backgroundColor: statusColor,
            display: "inline-block",
        },
    }), h("strong", { style: { color: "#38bdf8" } }, toolName), callId
        ? h("span", { style: { color: "#64748b", fontSize: "11px" } }, `#${callId.slice(0, 8)}`)
        : null), h("span", {
        style: {
            transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
            transition: "transform 0.15s ease",
            display: "inline-block",
            color: "#94a3b8",
        },
    }, "▸")), 
    // Expanded details body
    isExpanded
        ? h("div", {
            className: "dsh-toolview-body",
            style: {
                marginTop: "8px",
                paddingTop: "8px",
                borderTop: "1px solid rgba(255, 255, 255, 0.08)",
                maxHeight: "260px",
                overflow: "auto",
            },
        }, payload?.args
            ? h("div", { style: { marginBottom: "6px" } }, h("div", { style: { color: "#94a3b8", fontSize: "11px" } }, "Parameters:"), h("pre", {
                style: {
                    margin: "2px 0",
                    padding: "6px",
                    backgroundColor: "rgba(0, 0, 0, 0.3)",
                    borderRadius: "4px",
                    fontSize: "11px",
                },
            }, JSON.stringify(payload.args, null, 2)))
            : null, payload?.result !== undefined
            ? h("div", null, h("div", { style: { color: "#94a3b8", fontSize: "11px" } }, "Result:"), h("pre", {
                style: {
                    margin: "2px 0",
                    padding: "6px",
                    backgroundColor: "rgba(0, 0, 0, 0.3)",
                    borderRadius: "4px",
                    fontSize: "11px",
                },
            }, JSON.stringify(payload.result, null, 2)))
            : null, payload?.error
            ? h("div", {
                style: {
                    color: "#f87171",
                    marginTop: "4px",
                    padding: "4px 8px",
                    backgroundColor: "rgba(239, 68, 68, 0.1)",
                    borderRadius: "4px",
                },
            }, `Error: ${payload.error}`)
            : null)
        : null);
}
