import * as React from "react";
import type { BoardSummary } from "../../../domain/board.js";

export interface BuildboardPageMenuProps {
	boards: BoardSummary[];
	currentSlug: string;
	onSelectBoard: (slug: string) => void;
	onCreateBoard?: () => void;
	boardsLabel?: string;
	newBoardLabel?: string;
}

/**
 * Replaces tldraw's PageMenu: Buildboard stores one page per document, so the
 * native "Page 1" switcher is useless. List workspace boards here instead.
 */
export function BuildboardPageMenu(
	props: BuildboardPageMenuProps,
): React.ReactElement {
	const [open, setOpen] = React.useState(false);
	const current =
		props.boards.find((board) => board.slug === props.currentSlug) ??
		props.boards[0];
	const title = current?.title || props.currentSlug || "Board";
	const sorted = [...props.boards].sort((a, b) => b.updatedAt - a.updatedAt);

	return (
		<div
			className="dsh-bb-page-menu"
			onBlur={(event) => {
				const next = event.relatedTarget;
				if (next instanceof Node && event.currentTarget.contains(next)) {
					return;
				}
				setOpen(false);
			}}
		>
			<button
				type="button"
				className="dsh-bb-page-menu-trigger"
				aria-expanded={open}
				aria-haspopup="listbox"
				title={props.boardsLabel ?? "Boards"}
				onClick={() => setOpen((value) => !value)}
			>
				<span className="dsh-bb-page-menu-title">{title}</span>
				<span className="dsh-bb-page-menu-count" aria-hidden>
					{sorted.length}
				</span>
			</button>
			{open ? (
				<div
					className="dsh-bb-page-menu-popover"
					role="listbox"
					aria-label={props.boardsLabel ?? "Boards"}
				>
					{sorted.length === 0 ? (
						<div className="dsh-bb-page-menu-empty">No boards yet</div>
					) : (
						sorted.map((board) => {
							const active = board.slug === props.currentSlug;
							return (
								<button
									key={board.id}
									type="button"
									role="option"
									aria-selected={active}
									className={`dsh-bb-page-menu-item${active ? " is-active" : ""}`}
									onClick={() => {
										props.onSelectBoard(board.slug);
										setOpen(false);
									}}
								>
									<span className="dsh-bb-page-menu-item-title">
										{board.title}
									</span>
									<span className="dsh-bb-page-menu-item-slug">
										{board.slug}
									</span>
								</button>
							);
						})
					)}
					{props.onCreateBoard ? (
						<button
							type="button"
							className="dsh-bb-page-menu-item dsh-bb-page-menu-create"
							onClick={() => {
								props.onCreateBoard?.();
								setOpen(false);
							}}
						>
							{props.newBoardLabel ?? "New board"}
						</button>
					) : null}
				</div>
			) : null}
		</div>
	);
}
