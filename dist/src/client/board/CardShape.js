import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { BaseBoxShapeUtil, HTMLContainer, Rectangle2d, T, } from "tldraw";
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
                background: "var(--dsw-alias-bg-secondary, #1e293b)",
                border: "1px solid var(--dsw-alias-stroke-primary, #334155)",
                borderRadius: 10,
                padding: 12,
                boxSizing: "border-box",
                overflow: "hidden",
                pointerEvents: "all",
                display: "flex",
                flexDirection: "column",
                gap: 6,
            }, children: [_jsxs("div", { style: {
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 8,
                    }, children: [_jsx("strong", { style: { fontSize: 13 }, children: shape.props.title }), agent ? _jsx("span", { className: "dsh-bb-agent-chip", children: "agent" }) : null] }), _jsxs("div", { style: { fontSize: 11, opacity: 0.7 }, children: [shape.props.kind, shape.props.runStatus ? ` · ${shape.props.runStatus}` : ""] }), _jsx("div", { style: {
                        fontSize: 12,
                        opacity: 0.85,
                        whiteSpace: "pre-wrap",
                        overflow: "hidden",
                    }, children: shape.props.excerpt })] }));
    }
    indicator(shape) {
        return (_jsx("rect", { width: shape.props.w, height: shape.props.h, rx: 10, ry: 10 }));
    }
}
