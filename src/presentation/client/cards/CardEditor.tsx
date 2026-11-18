import * as React from "react";
import {
	htmlToMarkdown,
	markdownToHtml,
} from "../../../adapters/markdown-html.js";
import { createCardEditorStore } from "../../../application/card-editor-store.js";
import { useActorStore } from "../hooks/useActorStore.js";

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

function useCardOpen(
	store: {
		send: (event: {
			type: "OPEN";
			scope: string;
			id: string;
			sessionId?: string;
			title: string;
			body: string;
		}) => void;
		runtime: { onSaved?: CardEditorProps["onSaved"] };
	},
	props: CardEditorProps,
): void {
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
export function CardEditor(props: CardEditorProps): React.ReactElement {
	const store = React.useState(() => createCardEditorStore(props.onSaved))[0];
	const snapshot = useActorStore(store);
	const context = snapshot.context;
	useCardOpen(store, props);

	const title = context.title || props.title;
	const status = context.status;
	const error = context.error;
	const tiptap = store.runtime.tiptap;

	if (!tiptap) {
		return (
			<div className="dsh-bb-editor">
				<input
					className="dsh-bb-editor-title"
					value={title}
					onChange={(event) => {
						store.send({ type: "TITLE", title: event.target.value });
					}}
				/>
				<textarea
					className="dsh-bb-editor-fallback"
					value={context.body || props.body}
					onChange={(event) => {
						store.send({ type: "BODY", body: event.target.value });
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
			initialBody={context.body || props.body}
			status={status}
			error={error}
			onTitleChange={(next) => {
				store.send({ type: "TITLE", title: next });
			}}
			onBodyHtml={(html) => {
				store.send({ type: "BODY", body: htmlToMarkdown(html) });
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
