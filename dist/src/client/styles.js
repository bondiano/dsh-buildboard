export const BUILDBOARD_STYLES = `
.dsh-bb-root {
	display: flex;
	flex-direction: column;
	height: 100%;
	min-height: 0;
	background: var(--dsw-alias-bg-primary, #111);
	color: var(--dsw-alias-text-primary, #eee);
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
.dsh-bb-toolbar {
	display: flex;
	gap: 6px;
	padding: 6px 8px;
	border-bottom: 1px solid var(--dsw-alias-stroke-primary, #333);
	flex-wrap: wrap;
}
.dsh-bb-toolbar button {
	appearance: none;
	border: 1px solid var(--dsw-alias-stroke-primary, #444);
	background: var(--dsw-alias-bg-secondary, #1a1a1a);
	color: inherit;
	border-radius: 6px;
	padding: 4px 10px;
	cursor: pointer;
	font-size: 12px;
}
.dsh-bb-toolbar button:hover {
	border-color: var(--dsw-alias-state-info-primary, #3b82f6);
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
	background: var(--dsw-alias-state-info-primary, #3b82f6);
	color: #fff;
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
`;
