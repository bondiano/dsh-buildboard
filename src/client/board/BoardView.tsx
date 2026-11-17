import * as React from "react";
import { BUILDBOARD_API_ROUTE } from "../../domain/route.js";

export interface BoardViewProps {
	sessionId?: string;
	board?: string;
	licenseKey?: string;
	pollIntervalMs?: number;
	visible?: boolean;
}

interface BoardSnapshot {
	id: string;
	slug: string;
	title: string;
	revision: number;
	records: Record<string, Record<string, unknown>>;
}

function syncUrl(sessionId: string | undefined, board: string): string {
	const params = new URLSearchParams();
	if (sessionId) params.set("session", sessionId);
	params.set("board", board);
	return `${BUILDBOARD_API_ROUTE}/state?${params.toString()}`;
}

/**
 * Board surface. Loads tldraw when available; otherwise shows a record list
 * so host/unit tests and offline installs still work.
 */
export function BoardView(props: BoardViewProps): React.ReactElement {
	const board = props.board ?? "main";
	const pollIntervalMs = props.pollIntervalMs ?? 2000;
	const [snapshot, setSnapshot] = React.useState<BoardSnapshot | null>(null);
	const [error, setError] = React.useState<string | null>(null);
	const [TldrawApp, setTldrawApp] = React.useState<React.ComponentType<{
		licenseKey?: string;
		snapshot?: unknown;
	}> | null>(null);
	const revisionRef = React.useRef(0);

	React.useEffect(() => {
		let cancelled = false;
		void import("tldraw")
			.then((mod) => {
				if (cancelled) return;
				setTldrawApp(() => {
					function Wrapped(inner: {
						licenseKey?: string;
						snapshot?: unknown;
					}): React.ReactElement {
						const { Tldraw } = mod;
						return (
							<Tldraw
								licenseKey={inner.licenseKey || undefined}
								// Persistence is owned by the host protocol; this mount is visual.
								onMount={(editor) => {
									const records = (inner.snapshot as BoardSnapshot | undefined)
										?.records;
									if (!records) return;
									try {
										editor.store.mergeRemoteChanges(() => {
											for (const record of Object.values(records)) {
												if (record && typeof record.id === "string") {
													editor.store.put([record as never]);
												}
											}
										});
									} catch {
										// Store schema mismatches fall back to the list view data.
									}
								}}
							/>
						);
					}
					return Wrapped;
				});
			})
			.catch((err: unknown) => {
				if (!cancelled) setError(`tldraw unavailable: ${String(err)}`);
			});
		return () => {
			cancelled = true;
		};
	}, []);

	React.useEffect(() => {
		if (props.visible === false) return;
		let cancelled = false;
		const url = syncUrl(props.sessionId, board);

		async function pull(): Promise<void> {
			try {
				const response = await fetch(`${url}&since=${revisionRef.current}`);
				if (!response.ok) throw new Error(`HTTP ${response.status}`);
				const body = (await response.json()) as
					| BoardSnapshot
					| { revision: number };
				if (cancelled) return;
				if ("records" in body) {
					revisionRef.current = body.revision;
					setSnapshot(body);
					setError(null);
				}
			} catch (err) {
				if (!cancelled) setError(String(err));
			}
		}

		void pull();
		const timer = setInterval(() => void pull(), pollIntervalMs);
		return () => {
			cancelled = true;
			clearInterval(timer);
		};
	}, [props.sessionId, board, pollIntervalMs, props.visible]);

	return (
		<div className="dsh-bb-board" data-buildboard-board={board}>
			{TldrawApp ? (
				<TldrawApp
					licenseKey={props.licenseKey}
					snapshot={snapshot ?? undefined}
				/>
			) : (
				<div className="dsh-bb-fallback">
					<strong>{snapshot?.title ?? board}</strong>
					{error ? <p role="status">{error}</p> : null}
					<ul>
						{Object.values(snapshot?.records ?? {})
							.filter((r) => r.typeName === "shape")
							.slice(0, 40)
							.map((record) => (
								<li key={String(record.id)}>
									{typeof record.type === "string" ? record.type : "shape"} ·{" "}
									{typeof record.id === "string" ? record.id : "?"}
									{(record.meta as { updatedBy?: string } | undefined)
										?.updatedBy === "agent" ? (
										<span className="dsh-bb-agent-chip">agent</span>
									) : null}
								</li>
							))}
					</ul>
				</div>
			)}
		</div>
	);
}
