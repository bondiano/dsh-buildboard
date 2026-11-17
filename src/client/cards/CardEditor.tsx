import * as React from "react";
import { BUILDBOARD_API_ROUTE } from "../../domain/route.js";
import {
	htmlToMarkdown,
	markdownToHtml,
} from "../../adapters/markdown-html.js";

export interface CardEditorProps {
	scope: string;
	id: string;
	title: string;
	body: string;
	sessionId?: string;
	onSaved?: (next: { title: string; body: string }) => void;
}

type TipTapModule = typeof import("@tiptap/react");
type StarterKitModule = typeof import("@tiptap/starter-kit");

/**
 * TipTap card editor with markdown round-trip to the host card store.
 */
export function CardEditor(props: CardEditorProps): React.ReactElement {
	const [title, setTitle] = React.useState(props.title);
	const [tiptap, setTiptap] = React.useState<{
		react: TipTapModule;
		starter: StarterKitModule["default"];
	} | null>(null);
	const [status, setStatus] = React.useState<
		"idle" | "saving" | "saved" | "error"
	>("idle");
	const [error, setError] = React.useState<string | null>(null);
	const saveTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(
		undefined,
	);
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

	const persist = React.useCallback(
		async (nextTitle: string, nextBody: string) => {
			setStatus("saving");
			setError(null);
			const params = new URLSearchParams();
			if (props.sessionId) params.set("session", props.sessionId);
			try {
				const response = await fetch(
					`${BUILDBOARD_API_ROUTE}/cards/${props.scope}:${props.id}?${params}`,
					{
						method: "PUT",
						headers: { "content-type": "application/json" },
						body: JSON.stringify({ title: nextTitle, body: nextBody }),
					},
				);
				if (!response.ok) throw new Error(`HTTP ${response.status}`);
				setStatus("saved");
				props.onSaved?.({ title: nextTitle, body: nextBody });
			} catch (err) {
				setStatus("error");
				setError(String(err));
			}
		},
		[props],
	);

	const scheduleSave = React.useCallback(
		(nextTitle: string, nextBody: string) => {
			bodyRef.current = nextBody;
			if (saveTimer.current) clearTimeout(saveTimer.current);
			saveTimer.current = setTimeout(() => {
				void persist(nextTitle, nextBody);
			}, 600);
		},
		[persist],
	);

	React.useEffect(
		() => () => {
			if (saveTimer.current) clearTimeout(saveTimer.current);
		},
		[],
	);

	if (!tiptap) {
		return (
			<div className="dsh-bb-editor">
				<input
					className="dsh-bb-editor-title"
					value={title}
					onChange={(event) => {
						setTitle(event.target.value);
						scheduleSave(event.target.value, bodyRef.current);
					}}
				/>
				<textarea
					className="dsh-bb-editor-fallback"
					value={bodyRef.current}
					onChange={(event) => {
						bodyRef.current = event.target.value;
						scheduleSave(title, event.target.value);
					}}
					rows={16}
				/>
				<p className="meta">{status}</p>
			</div>
		);
	}

	return (
		<TipTapMount
			key={props.id}
			tiptap={tiptap}
			title={title}
			initialBody={props.body}
			status={status}
			error={error}
			onTitleChange={(next) => {
				setTitle(next);
				scheduleSave(next, bodyRef.current);
			}}
			onBodyHtml={(html) => {
				const markdown = htmlToMarkdown(html);
				scheduleSave(title, markdown);
			}}
		/>
	);
}

function TipTapMount(props: {
	tiptap: { react: TipTapModule; starter: StarterKitModule["default"] };
	title: string;
	initialBody: string;
	status: string;
	error: string | null;
	onTitleChange: (title: string) => void;
	onBodyHtml: (html: string) => void;
}): React.ReactElement {
	const { useEditor, EditorContent } = props.tiptap.react;
	const editor = useEditor({
		extensions: [props.tiptap.starter],
		content: markdownToHtml(props.initialBody),
		onUpdate: ({ editor: current }) => {
			props.onBodyHtml(current.getHTML());
		},
	});

	return (
		<div className="dsh-bb-editor">
			<input
				className="dsh-bb-editor-title"
				value={props.title}
				onChange={(event) => props.onTitleChange(event.target.value)}
			/>
			<div className="dsh-bb-editor-toolbar">
				<button
					type="button"
					onClick={() => editor?.chain().focus().toggleBold().run()}
				>
					Bold
				</button>
				<button
					type="button"
					onClick={() => editor?.chain().focus().toggleItalic().run()}
				>
					Italic
				</button>
				<button
					type="button"
					onClick={() => editor?.chain().focus().toggleBulletList().run()}
				>
					List
				</button>
				<button
					type="button"
					onClick={() =>
						editor?.chain().focus().toggleHeading({ level: 2 }).run()
					}
				>
					H2
				</button>
			</div>
			<EditorContent editor={editor} className="dsh-bb-editor-body" />
			<p className="meta" role="status">
				{props.error ?? props.status}
			</p>
		</div>
	);
}
