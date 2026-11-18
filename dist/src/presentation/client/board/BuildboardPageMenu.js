import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as React from "react";
/**
 * Replaces tldraw's PageMenu: Buildboard stores one page per document, so the
 * native "Page 1" switcher is useless. List workspace boards here instead.
 */
export function BuildboardPageMenu(props) {
    const [open, setOpen] = React.useState(false);
    const current = props.boards.find((board) => board.slug === props.currentSlug) ??
        props.boards[0];
    const title = current?.title || props.currentSlug || "Board";
    const sorted = [...props.boards].sort((a, b) => b.updatedAt - a.updatedAt);
    return (_jsxs("div", { className: "dsh-bb-page-menu", onBlur: (event) => {
            const next = event.relatedTarget;
            if (next instanceof Node && event.currentTarget.contains(next)) {
                return;
            }
            setOpen(false);
        }, children: [_jsxs("button", { type: "button", className: "dsh-bb-page-menu-trigger", "aria-expanded": open, "aria-haspopup": "listbox", title: props.boardsLabel ?? "Boards", onClick: () => setOpen((value) => !value), children: [_jsx("span", { className: "dsh-bb-page-menu-title", children: title }), _jsx("span", { className: "dsh-bb-page-menu-count", "aria-hidden": true, children: sorted.length })] }), open ? (_jsxs("div", { className: "dsh-bb-page-menu-popover", role: "listbox", "aria-label": props.boardsLabel ?? "Boards", children: [sorted.length === 0 ? (_jsx("div", { className: "dsh-bb-page-menu-empty", children: "No boards yet" })) : (sorted.map((board) => {
                        const active = board.slug === props.currentSlug;
                        return (_jsxs("button", { type: "button", role: "option", "aria-selected": active, className: `dsh-bb-page-menu-item${active ? " is-active" : ""}`, onClick: () => {
                                props.onSelectBoard(board.slug);
                                setOpen(false);
                            }, children: [_jsx("span", { className: "dsh-bb-page-menu-item-title", children: board.title }), _jsx("span", { className: "dsh-bb-page-menu-item-slug", children: board.slug })] }, board.id));
                    })), props.onCreateBoard ? (_jsx("button", { type: "button", className: "dsh-bb-page-menu-item dsh-bb-page-menu-create", onClick: () => {
                            props.onCreateBoard?.();
                            setOpen(false);
                        }, children: props.newBoardLabel ?? "New board" })) : null] })) : null] }));
}
