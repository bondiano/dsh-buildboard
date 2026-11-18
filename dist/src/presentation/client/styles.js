export const BUILDBOARD_STYLES = `
.dsh-bb-root {
	display: flex;
	flex-direction: column;
	position: absolute;
	inset: 0;
	width: 100%;
	height: 100%;
	min-height: 240px;
	box-sizing: border-box;
	background: var(--dsw-alias-bg-primary, #111);
	color: var(--dsw-alias-text-primary, #eee);
}
.dsh-bb-host {
	position: relative;
	flex: 1 1 auto;
	width: 100%;
	height: 100%;
	min-height: 240px;
	overflow: hidden;
}
.dsh-bb-empty {
	display: flex;
	flex-direction: column;
	gap: 12px;
	align-items: flex-start;
	justify-content: center;
	flex: 1;
	padding: 24px;
	max-width: 420px;
}
.dsh-bb-empty strong {
	font-size: 15px;
}
.dsh-bb-empty p {
	margin: 0;
	opacity: 0.8;
	font-size: 13px;
	line-height: 1.45;
}
.dsh-bb-empty button {
	appearance: none;
	border: 1px solid var(--dsw-alias-stroke-primary, #444);
	background: var(--dsw-alias-state-info-primary, #3b82f6);
	color: #fff;
	border-radius: 8px;
	padding: 8px 14px;
	cursor: pointer;
	font-size: 13px;
}
.dsh-bb-empty button:disabled {
	opacity: 0.6;
	cursor: default;
}
.dsh-bb-empty-error {
	color: #fca5a5;
	font-size: 12px;
}
.dsh-bb-shell {
	display: grid;
	grid-template-columns: 220px 1fr 280px;
	gap: 0;
	flex: 1;
	min-height: 0;
}
.dsh-bb-shell.is-compact {
	grid-template-columns: 1fr;
}
.dsh-bb-side, .dsh-bb-board, .dsh-bb-detail {
	min-height: 0;
	overflow: auto;
}
.dsh-bb-side, .dsh-bb-detail {
	border-inline: 1px solid var(--dsw-alias-stroke-primary, #333);
	padding: 8px;
	font-size: 13px;
}
.dsh-bb-board {
	position: relative;
}
.dsh-bb-board .tl-container {
	position: absolute;
	inset: 0;
}
.dsh-bb-list-item {
	padding: 6px 8px;
	border-radius: 6px;
	cursor: pointer;
}
.dsh-bb-list-item:hover, .dsh-bb-list-item.is-active {
	background: var(--dsw-alias-bg-secondary, #222);
}
.dsh-bb-list-item .meta {
	opacity: 0.65;
	font-size: 11px;
}
.dsh-bb-agent-chip {
	display: inline-block;
	margin-left: 6px;
	padding: 0 6px;
	border-radius: 999px;
	font-size: 10px;
	background: var(--dsw-alias-state-info-primary, #1d4ed8);
	color: #fff;
}
.dsh-bb-settings-help {
	margin: 0 0 12px;
	font-size: 11px;
	line-height: 1.4;
	opacity: 0.75;
}
.dsh-bb-page-menu {
	position: relative;
	z-index: 3;
	pointer-events: all;
}
.dsh-bb-page-menu-trigger {
	display: inline-flex;
	align-items: center;
	gap: 8px;
	max-width: 220px;
	appearance: none;
	border: 1px solid var(--color-muted-1, rgba(0,0,0,.12));
	background: var(--color-panel, #fff);
	color: var(--color-text, #111);
	border-radius: 8px;
	padding: 6px 10px;
	font: inherit;
	font-size: 12px;
	cursor: pointer;
}
.dsh-bb-page-menu-title {
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	font-weight: 600;
}
.dsh-bb-page-menu-count {
	flex: 0 0 auto;
	min-width: 1.4em;
	padding: 0 5px;
	border-radius: 999px;
	background: var(--color-muted-1, rgba(0,0,0,.08));
	font-size: 10px;
	text-align: center;
}
.dsh-bb-page-menu-popover {
	position: absolute;
	top: calc(100% + 6px);
	left: 0;
	min-width: 240px;
	max-width: 320px;
	max-height: 320px;
	overflow: auto;
	border: 1px solid var(--color-muted-1, rgba(0,0,0,.12));
	border-radius: 10px;
	background: var(--color-panel, #fff);
	color: var(--color-text, #111);
	box-shadow: 0 8px 24px rgba(0,0,0,.18);
	padding: 6px;
}
.dsh-bb-page-menu-item {
	display: flex;
	flex-direction: column;
	align-items: flex-start;
	gap: 2px;
	width: 100%;
	appearance: none;
	border: 0;
	background: transparent;
	color: inherit;
	border-radius: 8px;
	padding: 8px 10px;
	text-align: left;
	cursor: pointer;
	font: inherit;
}
.dsh-bb-page-menu-item:hover,
.dsh-bb-page-menu-item.is-active {
	background: var(--color-muted-2, rgba(0,0,0,.06));
}
.dsh-bb-page-menu-item-title {
	font-size: 12px;
	font-weight: 600;
}
.dsh-bb-page-menu-item-slug {
	font-size: 10px;
	opacity: 0.65;
}
.dsh-bb-page-menu-create {
	margin-top: 4px;
	border-top: 1px solid var(--color-muted-1, rgba(0,0,0,.1));
	border-radius: 0 0 8px 8px;
	font-weight: 600;
}
.dsh-bb-page-menu-empty {
	padding: 10px;
	font-size: 12px;
	opacity: 0.7;
}
.dsh-bb-fallback {
	padding: 24px;
	opacity: 0.8;
}
.dsh-bb-settings label {
	display: flex;
	flex-direction: column;
	gap: 4px;
	margin-bottom: 12px;
	font-size: 12px;
}
.dsh-bb-settings input {
	padding: 6px 8px;
	border-radius: 6px;
	border: 1px solid var(--dsw-alias-stroke-primary, #444);
	background: var(--dsw-alias-bg-secondary, #1a1a1a);
	color: inherit;
}
.dsh-bb-search, .dsh-bb-editor-title, .dsh-bb-editor-fallback {
	width: 100%;
	box-sizing: border-box;
	margin: 6px 0;
	padding: 6px 8px;
	border-radius: 6px;
	border: 1px solid var(--dsw-alias-stroke-primary, #444);
	background: var(--dsw-alias-bg-secondary, #1a1a1a);
	color: inherit;
	font: inherit;
}
.dsh-bb-sync {
	position: absolute;
	top: 8px;
	right: 8px;
	z-index: 2;
	font-size: 11px;
	padding: 2px 8px;
	border-radius: 999px;
	background: rgba(0,0,0,.55);
	pointer-events: none;
}
.dsh-bb-sync[data-sync="offline"], .dsh-bb-sync[data-sync="pushing"], .dsh-bb-sync[data-sync="pulling"] {
	opacity: 0.9;
}
.dsh-bb-editor {
	display: flex;
	flex-direction: column;
	gap: 6px;
	min-height: 0;
}
.dsh-bb-editor-title {
	width: 100%;
	box-sizing: border-box;
	padding: 6px 8px;
	border-radius: 6px;
	border: 1px solid var(--dsw-alias-stroke-primary, #444);
	background: var(--dsw-alias-bg-secondary, #1a1a1a);
	color: inherit;
	font: inherit;
	font-weight: 600;
}
.dsh-bb-editor-toolbar {
	display: flex;
	flex-wrap: wrap;
	gap: 4px;
}
.dsh-bb-editor-toolbar button {
	appearance: none;
	border: 1px solid var(--dsw-alias-stroke-primary, #444);
	background: var(--dsw-alias-bg-secondary, #1a1a1a);
	color: inherit;
	border-radius: 6px;
	padding: 2px 8px;
	cursor: pointer;
	font-size: 11px;
}
.dsh-bb-editor-body, .dsh-bb-editor-fallback {
	min-height: 180px;
	padding: 8px;
	border-radius: 6px;
	border: 1px solid var(--dsw-alias-stroke-primary, #444);
	background: var(--dsw-alias-bg-secondary, #1a1a1a);
	font-size: 12px;
	line-height: 1.45;
}
.dsh-bb-editor-body .ProseMirror {
	outline: none;
	min-height: 160px;
}
.dsh-bb-editor-fallback {
	resize: vertical;
	font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
.dsh-bb-board-error {
	position: absolute;
	left: 8px;
	bottom: 8px;
	margin: 0;
	padding: 4px 8px;
	font-size: 11px;
	background: rgba(0,0,0,.55);
	border-radius: 6px;
}
`;
