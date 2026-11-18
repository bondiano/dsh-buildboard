import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as React from "react";
/** Keep the Buildboard pane visible when a child render throws. */
export class TabErrorBoundary extends React.Component {
    state = { error: null };
    static getDerivedStateFromError(error) {
        return {
            error: error instanceof Error ? error.message : String(error),
        };
    }
    render() {
        if (this.state.error !== null) {
            const label = this.props.t
                ? this.props.t("empty.renderError")
                : "Buildboard failed to render";
            return (_jsxs("div", { "data-buildboard-error": "", style: {
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                    padding: 16,
                    minHeight: 240,
                    height: "100%",
                    boxSizing: "border-box",
                    background: "#111",
                    color: "#eee",
                }, children: [_jsx("strong", { children: label }), _jsx("pre", { style: {
                            margin: 0,
                            whiteSpace: "pre-wrap",
                            fontSize: 12,
                            opacity: 0.85,
                        }, children: this.state.error }), _jsx("button", { type: "button", style: {
                            alignSelf: "flex-start",
                            padding: "8px 14px",
                            borderRadius: 8,
                            border: "1px solid #444",
                            background: "#3b82f6",
                            color: "#fff",
                            cursor: "pointer",
                        }, onClick: () => {
                            this.setState({ error: null });
                        }, children: "Retry" })] }));
        }
        return this.props.children;
    }
}
