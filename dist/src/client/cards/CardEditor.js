import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as React from "react";
import { BUILDBOARD_API_ROUTE } from "../../domain/route.js";
import { htmlToMarkdown, markdownToHtml, } from "../../adapters/markdown-html.js";
/**
 * TipTap card editor with markdown round-trip to the host card store.
 */
export function CardEditor(props) {
    const [title, setTitle] = React.useState(props.title);
    const [tiptap, setTiptap] = React.useState(null);
    const [status, setStatus] = React.useState("idle");
    const [error, setError] = React.useState(null);
    const saveTimer = React.useRef(undefined);
    const bodyRef = React.useRef(props.body);
    React.useEffect(() => {
        setTitle(props.title);
        bodyRef.current = props.body;
    }, [props.id, props.title, props.body]);
    React.useEffect(() => {
        let cancelled = false;
        void Promise.all([
            import("@tiptap/react"),
            import("@tiptap/starter-kit"),
        ]).then(([react, starter]) => {
            if (!cancelled) {
                setTiptap({
                    react,
                    starter: starter.default,
                });
            }
        });
        return () => {
            cancelled = true;
        };
    }, []);
    const persist = React.useCallback(async (nextTitle, nextBody) => {
        setStatus("saving");
        setError(null);
        const params = new URLSearchParams();
        if (props.sessionId)
            params.set("session", props.sessionId);
        try {
            const response = await fetch(`${BUILDBOARD_API_ROUTE}/cards/${props.scope}:${props.id}?${params}`, {
                method: "PUT",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ title: nextTitle, body: nextBody }),
            });
            if (!response.ok)
                throw new Error(`HTTP ${response.status}`);
            setStatus("saved");
            props.onSaved?.({ title: nextTitle, body: nextBody });
        }
        catch (err) {
            setStatus("error");
            setError(String(err));
        }
    }, [props]);
    const scheduleSave = React.useCallback((nextTitle, nextBody) => {
        bodyRef.current = nextBody;
        if (saveTimer.current)
            clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => {
            void persist(nextTitle, nextBody);
        }, 600);
    }, [persist]);
    React.useEffect(() => () => {
        if (saveTimer.current)
            clearTimeout(saveTimer.current);
    }, []);
    if (!tiptap) {
        return (_jsxs("div", { className: "dsh-bb-editor", children: [_jsx("input", { className: "dsh-bb-editor-title", value: title, onChange: (event) => {
                        setTitle(event.target.value);
                        scheduleSave(event.target.value, bodyRef.current);
                    } }), _jsx("textarea", { className: "dsh-bb-editor-fallback", value: bodyRef.current, onChange: (event) => {
                        bodyRef.current = event.target.value;
                        scheduleSave(title, event.target.value);
                    }, rows: 16 }), _jsx("p", { className: "meta", children: status })] }));
    }
    return (_jsx(TipTapMount, { tiptap: tiptap, title: title, initialBody: props.body, status: status, error: error, onTitleChange: (next) => {
            setTitle(next);
            scheduleSave(next, bodyRef.current);
        }, onBodyHtml: (html) => {
            const markdown = htmlToMarkdown(html);
            scheduleSave(title, markdown);
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
