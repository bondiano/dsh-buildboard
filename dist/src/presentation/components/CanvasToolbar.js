/**
 * CanvasToolbar Component for DSH Cult Canvas
 *
 * Implements left toolbar ported from cult-canvas:
 * - 8 primary tool buttons: Select (V), Hand (H), Sticky (S), Text (T), Shape (R), Marker (P), Eraser (E), Frame (F)
 * - Flyout panels for Marker colors/widths, Shapes (7 variants), and Sticky colors
 * - Active tool indicators and keyboard shortcut bindings
 *
 * @module @local/dsh-cult-canvas/presentation/components/CanvasToolbar
 */
import { MARKER_PALETTE_COLORS, MARKER_PRESET_WIDTHS } from "./MarkerStroke.js";
import { h, useState } from "./react-binding.js";
import { SUPPORTED_SHAPES } from "./ShapeElement.js";
import { STICKY_PALETTE_COLORS } from "./StickyNote.js";
export const WHITEBOARD_TOOLS = [
    { id: "select", label: "Select", shortcut: "V", icon: "↖" },
    { id: "hand", label: "Hand / Pan", shortcut: "H", icon: "✋" },
    { id: "sticky", label: "Sticky Note", shortcut: "S", icon: "📝" },
    { id: "text", label: "Text", shortcut: "T", icon: "T" },
    { id: "shape", label: "Shape", shortcut: "R", icon: "◇" },
    { id: "marker", label: "Marker", shortcut: "P", icon: "✎" },
    { id: "eraser", label: "Eraser", shortcut: "E", icon: "⌫" },
    { id: "frame", label: "Frame", shortcut: "F", icon: "▢" },
];
export function CanvasToolbar({ activeTool, onSelectTool, markerColor = MARKER_PALETTE_COLORS[0], onSelectMarkerColor, markerWidth = 4, onSelectMarkerWidth, selectedShape = "rect", onSelectShape, stickyColor = STICKY_PALETTE_COLORS[0], onSelectStickyColor, canStartProject = false, onStartProject, startProjectLabel = "Start project", className, }) {
    const [activeFlyout, setActiveFlyout] = useState(null);
    const handleToolClick = (tool) => {
        onSelectTool(tool);
        if (tool === "marker") {
            setActiveFlyout(activeFlyout === "marker" ? null : "marker");
        }
        else if (tool === "shape") {
            setActiveFlyout(activeFlyout === "shape" ? null : "shape");
        }
        else if (tool === "sticky") {
            setActiveFlyout(activeFlyout === "sticky" ? null : "sticky");
        }
        else {
            setActiveFlyout(null);
        }
    };
    const cls = ["dsh-cult-canvas-toolbar", className ?? ""]
        .filter(Boolean)
        .join(" ");
    // Starting a project is a board-level action, so it sits under the tools.
    const startProjectButton = canStartProject && typeof onStartProject === "function"
        ? h("button", {
            type: "button",
            className: "dsh-cc-start-project",
            title: startProjectLabel,
            style: {
                marginTop: "4px",
                padding: "6px 8px",
                fontSize: "11px",
                fontWeight: 600,
                borderRadius: "8px",
                border: "1px solid rgba(255,255,255,0.2)",
                backgroundColor: "var(--dsh-accent, #38bdf8)",
                color: "#0b1220",
                cursor: "pointer",
            },
            onClick: () => onStartProject(),
        }, startProjectLabel)
        : null;
    return h("aside", {
        className: cls,
        style: {
            position: "absolute",
            top: "20px",
            left: "20px",
            display: "flex",
            flexDirection: "column",
            gap: "6px",
            backgroundColor: "rgba(15, 23, 42, 0.9)",
            backdropFilter: "blur(8px)",
            padding: "8px",
            borderRadius: "12px",
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.4)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            zIndex: 50,
        },
    }, 
    // Main tool buttons
    ...WHITEBOARD_TOOLS.map((tool) => {
        const isCurrent = activeTool === tool.id;
        return h("button", {
            key: tool.id,
            className: `dsh-toolbar-btn tool-${tool.id} ${isCurrent ? "active" : ""}`,
            title: `${tool.label} (${tool.shortcut})`,
            style: {
                width: "38px",
                height: "38px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: isCurrent
                    ? "var(--dsh-accent, #38bdf8)"
                    : "transparent",
                color: isCurrent ? "#0f172a" : "#cbd5e1",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontSize: "16px",
                fontWeight: "bold",
                transition: "all 0.15s ease",
            },
            onClick: () => handleToolClick(tool.id),
        }, tool.icon);
    }), startProjectButton, 
    // Marker Flyout Panel
    activeFlyout === "marker" && onSelectMarkerColor && onSelectMarkerWidth
        ? h("div", {
            className: "dsh-toolbar-flyout flyout-marker",
            style: {
                position: "absolute",
                left: "54px",
                top: "140px",
                backgroundColor: "rgba(15, 23, 42, 0.95)",
                backdropFilter: "blur(8px)",
                padding: "10px",
                borderRadius: "10px",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                zIndex: 60,
                minWidth: "140px",
            },
        }, 
        // Color palette
        h("div", { style: { display: "flex", gap: "6px" } }, ...MARKER_PALETTE_COLORS.map((c) => h("button", {
            key: c,
            className: `dsh-color-swatch ${c === markerColor ? "active" : ""}`,
            style: {
                width: "20px",
                height: "20px",
                borderRadius: "50%",
                backgroundColor: c,
                border: c === markerColor
                    ? "2px solid #38bdf8"
                    : "1px solid rgba(255,255,255,0.3)",
                cursor: "pointer",
                padding: 0,
            },
            onClick: () => onSelectMarkerColor(c),
        }))), 
        // Width presets
        h("div", { style: { display: "flex", gap: "6px", alignItems: "center" } }, ...MARKER_PRESET_WIDTHS.map((w) => h("button", {
            key: w,
            className: `dsh-width-btn ${w === markerWidth ? "active" : ""}`,
            style: {
                flex: 1,
                height: "24px",
                backgroundColor: w === markerWidth
                    ? "rgba(56, 189, 248, 0.3)"
                    : "rgba(255,255,255,0.08)",
                border: w === markerWidth
                    ? "1px solid #38bdf8"
                    : "1px solid rgba(255,255,255,0.15)",
                borderRadius: "4px",
                color: "#e2e8f0",
                fontSize: "11px",
                cursor: "pointer",
                padding: 0,
            },
            onClick: () => onSelectMarkerWidth(w),
        }, `${w}p`))))
        : null, 
    // Shapes Flyout Panel
    activeFlyout === "shape" && onSelectShape
        ? h("div", {
            className: "dsh-toolbar-flyout flyout-shapes",
            style: {
                position: "absolute",
                left: "54px",
                top: "120px",
                backgroundColor: "rgba(15, 23, 42, 0.95)",
                backdropFilter: "blur(8px)",
                padding: "10px",
                borderRadius: "10px",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                gap: "6px",
                zIndex: 60,
                minWidth: "160px",
            },
        }, ...SUPPORTED_SHAPES.map((sh) => h("button", {
            key: sh,
            className: `dsh-shape-opt ${sh === selectedShape ? "active" : ""}`,
            style: {
                padding: "6px 8px",
                backgroundColor: sh === selectedShape
                    ? "rgba(56, 189, 248, 0.3)"
                    : "rgba(255,255,255,0.08)",
                border: sh === selectedShape
                    ? "1px solid #38bdf8"
                    : "1px solid rgba(255,255,255,0.15)",
                borderRadius: "4px",
                color: "#e2e8f0",
                fontSize: "12px",
                textTransform: "capitalize",
                cursor: "pointer",
            },
            onClick: () => onSelectShape(sh),
        }, sh)))
        : null, 
    // Sticky Note Colors Flyout Panel
    activeFlyout === "sticky" && onSelectStickyColor
        ? h("div", {
            className: "dsh-toolbar-flyout flyout-sticky",
            style: {
                position: "absolute",
                left: "54px",
                top: "80px",
                backgroundColor: "rgba(15, 23, 42, 0.95)",
                backdropFilter: "blur(8px)",
                padding: "10px",
                borderRadius: "10px",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
                display: "flex",
                gap: "6px",
                zIndex: 60,
            },
        }, ...STICKY_PALETTE_COLORS.map((c) => h("button", {
            key: c,
            className: `dsh-sticky-dot ${c === stickyColor ? "active" : ""}`,
            style: {
                width: "22px",
                height: "22px",
                borderRadius: "4px",
                backgroundColor: c,
                border: c === stickyColor
                    ? "2px solid #38bdf8"
                    : "1px solid rgba(0,0,0,0.3)",
                cursor: "pointer",
                padding: 0,
            },
            onClick: () => onSelectStickyColor(c),
        })))
        : null);
}
