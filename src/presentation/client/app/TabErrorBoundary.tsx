import * as React from "react";

interface TabErrorBoundaryProps {
	children: React.ReactNode;
	t?: (key: string) => string;
}

interface TabErrorBoundaryState {
	error: string | null;
}

/** Keep the Buildboard pane visible when a child render throws. */
export class TabErrorBoundary extends React.Component<
	TabErrorBoundaryProps,
	TabErrorBoundaryState
> {
	state: TabErrorBoundaryState = { error: null };

	static getDerivedStateFromError(error: unknown): TabErrorBoundaryState {
		return {
			error: error instanceof Error ? error.message : String(error),
		};
	}

	override render(): React.ReactNode {
		if (this.state.error !== null) {
			const label = this.props.t
				? this.props.t("empty.renderError")
				: "Buildboard failed to render";
			return (
				<div
					data-buildboard-error=""
					style={{
						display: "flex",
						flexDirection: "column",
						gap: 12,
						padding: 16,
						minHeight: 240,
						height: "100%",
						boxSizing: "border-box",
						background: "#111",
						color: "#eee",
					}}
				>
					<strong>{label}</strong>
					<pre
						style={{
							margin: 0,
							whiteSpace: "pre-wrap",
							fontSize: 12,
							opacity: 0.85,
						}}
					>
						{this.state.error}
					</pre>
					<button
						type="button"
						style={{
							alignSelf: "flex-start",
							padding: "8px 14px",
							borderRadius: 8,
							border: "1px solid #444",
							background: "#3b82f6",
							color: "#fff",
							cursor: "pointer",
						}}
						onClick={() => {
							this.setState({ error: null });
						}}
					>
						Retry
					</button>
				</div>
			);
		}
		return this.props.children;
	}
}
