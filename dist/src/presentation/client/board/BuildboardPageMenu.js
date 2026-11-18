import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import * as React from "react";
/**
 * Replaces tldraw's PageMenu: Buildboard stores one page per document, so the
 * native "Page 1" switcher is useless. List workspace boards here instead.
 *
 * Selection uses pointerdown (not click+blur): blur was closing the popover
 * before the item click landed, so the menu vanished without switching boards.
 */
export function BuildboardPageMenu(props) {
    const [open, setOpen] = React.useState(false);
    const current = props.boards.find((board) => board.slug === props.currentSlug) ??
        props.boards[0];
    const title = current?.title || props.currentSlug || "Board";
    const sorted = [...props.boards].sort((a, b) => b.updatedAt - a.updatedAt);
    const choose = (slug) => {
        props.onSelectBoard(slug);
        setOpen(false);
    };
    return (_jsxs("div", { className: "dsh-bb-page-menu", children: [_jsxs("button", { type: "button", className: "dsh-bb-page-menu-trigger", "aria-expanded": open, "aria-haspopup": "listbox", title: props.boardsLabel ?? "Boards", onPointerDown: (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setOpen((value) => !value);
                }, children: [_jsx("span", { className: "dsh-bb-page-menu-title", children: title }), _jsx("span", { className: "dsh-bb-page-menu-count", "aria-hidden": true, children: sorted.length })] }), open ? (_jsxs(_Fragment, { children: [_jsx("button", { type: "button", className: "dsh-bb-page-menu-backdrop", "aria-label": "Close boards menu", onPointerDown: (event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            setOpen(false);
                        } }), _jsxs("div", { className: "dsh-bb-page-menu-popover", role: "listbox", "aria-label": props.boardsLabel ?? "Boards", onPointerDown: (event) => {
                            event.stopPropagation();
                        }, children: [sorted.length === 0 ? (_jsx("div", { className: "dsh-bb-page-menu-empty", children: "No boards yet" })) : (sorted.map((board) => {
                                const active = board.slug === props.currentSlug;
                                return (_jsxs("button", { type: "button", role: "option", "aria-selected": active, className: `dsh-bb-page-menu-item${active ? " is-active" : ""}`, onPointerDown: (event) => {
                                        event.preventDefault();
                                        event.stopPropagation();
                                        choose(board.slug);
                                    }, children: [_jsx("span", { className: "dsh-bb-page-menu-item-title", children: board.title }), _jsx("span", { className: "dsh-bb-page-menu-item-slug", children: board.slug })] }, board.id));
                            })), props.onCreateBoard ? (_jsx("button", { type: "button", className: "dsh-bb-page-menu-item dsh-bb-page-menu-create", onPointerDown: (event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    props.onCreateBoard?.();
                                    setOpen(false);
                                }, children: props.newBoardLabel ?? "New board" })) : null] })] })) : null] }));
}
