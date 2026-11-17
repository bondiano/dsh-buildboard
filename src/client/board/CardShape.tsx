import * as React from "react";
import {
	BaseBoxShapeUtil,
	HTMLContainer,
	Rectangle2d,
	T,
	type RecordProps,
	type TLBaseShape,
} from "tldraw";

export type CardShape = TLBaseShape<
	"card",
	{
		w: number;
		h: number;
		title: string;
		excerpt: string;
		kind: string;
		cardRef: string;
		runStatus: string;
	}
>;

/** Custom Heptabase-style card shape on the board. */
export class CardShapeUtil extends BaseBoxShapeUtil<CardShape> {
	static override type = "card" as const;
	static override props: RecordProps<CardShape> = {
		w: T.number,
		h: T.number,
		title: T.string,
		excerpt: T.string,
		kind: T.string,
		cardRef: T.string,
		runStatus: T.string,
	};

	override getDefaultProps(): CardShape["props"] {
		return {
			w: 260,
			h: 160,
			title: "Card",
			excerpt: "",
			kind: "note",
			cardRef: "",
			runStatus: "",
		};
	}

	override getGeometry(shape: CardShape): Rectangle2d {
		return new Rectangle2d({
			width: shape.props.w,
			height: shape.props.h,
			isFilled: true,
		});
	}

	override component(shape: CardShape): React.ReactElement {
		const agent =
			typeof shape.meta?.["updatedBy"] === "string" &&
			shape.meta["updatedBy"] === "agent";
		return (
			<HTMLContainer
				style={{
					width: shape.props.w,
					height: shape.props.h,
					background: "var(--dsw-alias-bg-secondary, #1e293b)",
					border: "1px solid var(--dsw-alias-stroke-primary, #334155)",
					borderRadius: 10,
					padding: 12,
					boxSizing: "border-box",
					overflow: "hidden",
					pointerEvents: "all",
					display: "flex",
					flexDirection: "column",
					gap: 6,
				}}
			>
				<div
					style={{
						display: "flex",
						alignItems: "center",
						justifyContent: "space-between",
						gap: 8,
					}}
				>
					<strong style={{ fontSize: 13 }}>{shape.props.title}</strong>
					{agent ? <span className="dsh-bb-agent-chip">agent</span> : null}
				</div>
				<div style={{ fontSize: 11, opacity: 0.7 }}>
					{shape.props.kind}
					{shape.props.runStatus ? ` · ${shape.props.runStatus}` : ""}
				</div>
				<div
					style={{
						fontSize: 12,
						opacity: 0.85,
						whiteSpace: "pre-wrap",
						overflow: "hidden",
					}}
				>
					{shape.props.excerpt}
				</div>
			</HTMLContainer>
		);
	}

	override indicator(shape: CardShape): React.ReactElement {
		return (
			<rect width={shape.props.w} height={shape.props.h} rx={10} ry={10} />
		);
	}
}
