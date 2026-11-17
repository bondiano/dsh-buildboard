/**
 * StickyNote Component for DSH Cult Canvas
 *
 * Implements sticky note whiteboard elements ported from cult-canvas:
 * - 220x220 px default size
 * - #FFF59A background with drop shadow
 * - Color selection (#FFF59A, #E3F2FD, #E8F5E9, #FFEBEE, #F3E5F5)
 * - Handwritten font styling with editable text area
 *
 * @module @local/dsh-cult-canvas/presentation/components/StickyNote
 */
import { STICKY_DEFAULT_BG, STICKY_DEFAULT_INK, STICKY_DROP_SHADOW, TEXT_SIZES, } from "../../domain/geometry.js";
import { h, useState } from "./react-binding.js";
/** 5 standard sticky note paper colors. */
export const STICKY_PALETTE_COLORS = [
    "#FFF59A", // Classic Warm Yellow
    "#E3F2FD", // Soft Ice Blue
    "#E8F5E9", // Mint Green
    "#FFEBEE", // Rose Pink
    "#F3E5F5", // Lavender Purple
];
export const DEFAULT_STICKY_SIZE = 220;
export function StickyNote({ id, x = 0, y = 0, width = DEFAULT_STICKY_SIZE, height = DEFAULT_STICKY_SIZE, text, color = STICKY_DEFAULT_BG, fontSize = "m", textAlign = "left", isSelected = false, isEditing = false, onSelect, onPointerDown, onChangeText, onChangeColor, className, }) {
    const [localEditing, setLocalEditing] = useState(isEditing);
    const [editText, setEditText] = useState(text);
    const pxSize = TEXT_SIZES[fontSize] ?? 18;
    const handleDoubleClick = (e) => {
        if (e &&
            typeof e.stopPropagation ===
                "function") {
            e.stopPropagation();
        }
        setLocalEditing(true);
    };
    const handleBlur = () => {
        setLocalEditing(false);
        if (onChangeText && editText !== text) {
            onChangeText(id, editText);
        }
    };
    const handleTextChange = (e) => {
        const target = e?.target;
        if (target && typeof target.value === "string") {
            setEditText(target.value);
        }
    };
    const handleClick = (e) => {
        const shiftKey = Boolean(e?.shiftKey);
        if (onSelect) {
            onSelect(id, shiftKey);
        }
    };
    const handlePointerDown = (e) => {
        if (localEditing)
            return;
        if (e &&
            typeof e.stopPropagation ===
                "function") {
            e.stopPropagation();
        }
        if (onPointerDown) {
            onPointerDown(id, e);
        }
    };
    const style = {
        position: "absolute",
        left: `${x}px`,
        top: `${y}px`,
        width: `${width}px`,
        height: `${height}px`,
        backgroundColor: color,
        color: STICKY_DEFAULT_INK,
        boxShadow: STICKY_DROP_SHADOW,
        fontSize: `${pxSize}px`,
        textAlign,
        boxSizing: "border-box",
    };
    const cls = [
        "dsh-cult-canvas-element",
        "dsh-cult-canvas-sticky",
        isSelected ? "selected" : "",
        localEditing ? "editing" : "",
        className ?? "",
    ]
        .filter(Boolean)
        .join(" ");
    return h("div", {
        id: `sticky-${id}`,
        className: cls,
        style,
        onClick: handleClick,
        onPointerDown: handlePointerDown,
        onDoubleClick: handleDoubleClick,
        "data-element-id": id,
        "data-element-kind": "sticky",
    }, localEditing
        ? h("textarea", {
            className: "dsh-sticky-textarea",
            value: editText,
            autoFocus: true,
            onChange: handleTextChange,
            onBlur: handleBlur,
            style: {
                width: "100%",
                height: "100%",
                background: "transparent",
                border: "none",
                outline: "none",
                resize: "none",
                fontFamily: "inherit",
                fontSize: "inherit",
                textAlign: "inherit",
                color: "inherit",
                padding: "0",
                margin: "0",
            },
        })
        : h("div", {
            className: "dsh-sticky-content",
            style: {
                width: "100%",
                height: "100%",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                overflow: "hidden",
            },
        }, editText || text), 
    // Color quick-selector dots if selected
    isSelected && onChangeColor
        ? h("div", {
            className: "dsh-sticky-color-palette",
            style: {
                position: "absolute",
                bottom: "-32px",
                left: "0",
                display: "flex",
                gap: "6px",
                background: "rgba(15, 23, 42, 0.85)",
                padding: "4px 8px",
                borderRadius: "16px",
                backdropFilter: "blur(4px)",
            },
        }, ...STICKY_PALETTE_COLORS.map((c) => h("button", {
            key: c,
            className: `dsh-color-dot ${c === color ? "active" : ""}`,
            style: {
                width: "16px",
                height: "16px",
                borderRadius: "50%",
                backgroundColor: c,
                border: c === color
                    ? "2px solid #38bdf8"
                    : "1px solid rgba(255,255,255,0.4)",
                cursor: "pointer",
                padding: "0",
            },
            onClick: (e) => {
                if (e &&
                    typeof e
                        .stopPropagation === "function") {
                    e.stopPropagation();
                }
                onChangeColor(id, c);
            },
        })))
        : null);
}
