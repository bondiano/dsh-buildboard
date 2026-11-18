import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { BaseBoxShapeUtil, HTMLContainer, Rectangle2d, T, } from "tldraw";
import { CARD_CHROME } from "../../../domain/contrast.js";
/** Custom Heptabase-style card shape on the board. */
export class CardShapeUtil extends BaseBoxShapeUtil {
    static type = "card";
    static props = {
        w: T.number,
        h: T.number,
        title: T.string,
        excerpt: T.string,
        kind: T.string,
        cardRef: T.string,
        runStatus: T.string,
    };
    getDefaultProps() {
        return {
            w: 260,
            h: 160,
            title: "Card",
            excerpt: "",
            kind: "note",
            cardRef: "",
            runStatus: "",
        };
    }
    getGeometry(shape) {
        return new Rectangle2d({
            width: shape.props.w,
            height: shape.props.h,
            isFilled: true,
        });
    }
    component(shape) {
        const agent = typeof shape.meta?.["updatedBy"] === "string" &&
            shape.meta["updatedBy"] === "agent";
        return (_jsxs(HTMLContainer, { style: {
                width: shape.props.w,
                height: shape.props.h,
                background: `var(--color-panel, ${CARD_CHROME.background})`,
                border: `1.5px solid var(--color-text-3, ${CARD_CHROME.border})`,
                color: `var(--color-text, ${CARD_CHROME.title})`,
                borderRadius: 10,
                padding: 12,
                boxSizing: "border-box",
                overflow: "hidden",
                pointerEvents: "all",
                display: "flex",
                flexDirection: "column",
                gap: 6,
                boxShadow: "inset 3px 0 0 var(--color-selected, #3b82f6)",
            }, children: [_jsxs("div", { style: {
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 8,
                    }, children: [_jsx("strong", { style: { fontSize: 13 }, children: shape.props.title }), agent ? _jsx("span", { className: "dsh-bb-agent-chip", children: "agent" }) : null] }), _jsxs("div", { style: {
                        fontSize: 11,
                        color: `var(--color-text-3, ${CARD_CHROME.kind})`,
                    }, children: [shape.props.kind, shape.props.runStatus ? ` · ${shape.props.runStatus}` : ""] }), _jsx("div", { style: {
                        fontSize: 12,
                        color: `var(--color-text-1, ${CARD_CHROME.excerpt})`,
                        whiteSpace: "pre-wrap",
                        overflow: "hidden",
                    }, children: shape.props.excerpt })] }));
    }
    indicator(shape) {
        return (_jsx("rect", { width: shape.props.w, height: shape.props.h, rx: 10, ry: 10 }));
    }
}
