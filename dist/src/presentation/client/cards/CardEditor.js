import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as React from "react";
import { htmlToMarkdown, markdownToHtml, } from "../../../adapters/markdown-html.js";
import { createCardEditorStore } from "../../../application/card-editor-store.js";
import { useActorStore } from "../hooks/useActorStore.js";
function useCardOpen(store, props) {
    store.runtime.onSaved = props.onSaved;
    const key = `${props.scope}:${props.id}:${props.sessionId ?? ""}`;
    const last = React.useRef("");
    if (last.current !== key) {
        last.current = key;
        queueMicrotask(() => {
            store.send({
                type: "OPEN",
                scope: props.scope,
                id: props.id,
                sessionId: props.sessionId,
                title: props.title,
                body: props.body,
            });
        });
    }
}
/**
 * TipTap card editor with markdown round-trip to the host card store.
 */
export function CardEditor(props) {
    const store = React.useState(() => createCardEditorStore(props.onSaved))[0];
    const snapshot = useActorStore(store);
    const context = snapshot.context;
    useCardOpen(store, props);
    const title = context.title || props.title;
    const status = context.status;
    const error = context.error;
    const tiptap = store.runtime.tiptap;
    if (!tiptap) {
        return (_jsxs("div", { className: "dsh-bb-editor", children: [_jsx("input", { className: "dsh-bb-editor-title", value: title, onChange: (event) => {
                        store.send({ type: "TITLE", title: event.target.value });
                    } }), _jsx("textarea", { className: "dsh-bb-editor-fallback", value: context.body || props.body, onChange: (event) => {
                        store.send({ type: "BODY", body: event.target.value });
                    }, rows: 16 }), _jsx("p", { className: "meta", children: status })] }));
    }
    return (_jsx(TipTapMount, { tiptap: tiptap, title: title, initialBody: context.body || props.body, status: status, error: error, onTitleChange: (next) => {
            store.send({ type: "TITLE", title: next });
        }, onBodyHtml: (html) => {
            store.send({ type: "BODY", body: htmlToMarkdown(html) });
        } }, props.id));
}
function TipTapMount(props) {
    const { useEditor, EditorContent } = props.tiptap.react;
    const editor = useEditor({
        extensions: [props.tiptap.starter],
        content: markdownToHtml(props.initialBody),
        onUpdate: ({ editor: current }) => {
            props.onBodyHtml(current.getHTML());
        },
    });
    return (_jsxs("div", { className: "dsh-bb-editor", children: [_jsx("input", { className: "dsh-bb-editor-title", value: props.title, onChange: (event) => props.onTitleChange(event.target.value) }), _jsxs("div", { className: "dsh-bb-editor-toolbar", children: [_jsx("button", { type: "button", onClick: () => editor?.chain().focus().toggleBold().run(), children: "Bold" }), _jsx("button", { type: "button", onClick: () => editor?.chain().focus().toggleItalic().run(), children: "Italic" }), _jsx("button", { type: "button", onClick: () => editor?.chain().focus().toggleBulletList().run(), children: "List" }), _jsx("button", { type: "button", onClick: () => editor?.chain().focus().toggleHeading({ level: 2 }).run(), children: "H2" })] }), _jsx(EditorContent, { editor: editor, className: "dsh-bb-editor-body" }), _jsx("p", { className: "meta", role: "status", children: props.error ?? props.status })] }));
}
