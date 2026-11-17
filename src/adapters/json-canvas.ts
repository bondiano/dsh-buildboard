import type {
	CanvasEdge,
	CanvasElement,
	JSONCanvasDocument,
	JSONCanvasEdge,
	JSONCanvasFileNode,
	JSONCanvasLinkNode,
	JSONCanvasNode,
	JSONCanvasTextNode,
	ShapeType,
	Shot,
	TextSize,
} from "../domain/types.js";
import {
	isValidStroke,
	MARKER_COLORS,
	SHAPE_DEFINITIONS,
	STICKY_DEFAULT_BG,
} from "../domain/geometry.js";

// ============================================================================
// JSON Canvas 1.0 Adapter (Bidirectional)
// ============================================================================

export function exportToJsonCanvas(
	elements: Record<string, CanvasElement>,
	edges: Record<string, CanvasEdge>,
): JSONCanvasDocument & {
	nodes: JSONCanvasNode[];
	edges: JSONCanvasEdge[];
} {
	const nodes: JSONCanvasNode[] = [];

	for (const el of Object.values(elements)) {
		switch (el.kind) {
			case "sticky": {
				nodes.push({
					id: el.id,
					type: "text",
					x: el.x,
					y: el.y,
					width: el.width,
					height: el.height,
					text: el.text,
					color: el.color,
					styleAttributes: {
						gbKind: "sticky",
						gbSize: el.fontSize ?? "m",
						textAlign: el.textAlign ?? "left",
						...(el.zIndex !== undefined ? { zIndex: el.zIndex } : {}),
						...(el.pinned !== undefined ? { pinned: el.pinned } : {}),
					},
				});
				break;
			}
			case "shape": {
				nodes.push({
					id: el.id,
					type: "text",
					x: el.x,
					y: el.y,
					width: el.width,
					height: el.height,
					text: el.text,
					color: el.color,
					styleAttributes: {
						shape: el.shapeType,
						gbSize: el.fontSize ?? "m",
						textAlign: el.textAlign ?? "center",
						border: el.border ?? "solid",
						...(el.zIndex !== undefined ? { zIndex: el.zIndex } : {}),
						...(el.pinned !== undefined ? { pinned: el.pinned } : {}),
					},
				});
				break;
			}
			case "text": {
				nodes.push({
					id: el.id,
					type: "text",
					x: el.x,
					y: el.y,
					width: el.width,
					height: el.height,
					text: el.text,
					color: el.color,
					styleAttributes: {
						gbKind: "text",
						gbSize: el.fontSize ?? "m",
						textAlign: el.textAlign ?? "left",
						...(el.zIndex !== undefined ? { zIndex: el.zIndex } : {}),
						...(el.pinned !== undefined ? { pinned: el.pinned } : {}),
					},
				});
				break;
			}
			case "stroke": {
				const sa: Record<string, unknown> = {};
				if (el.zIndex !== undefined) sa.zIndex = el.zIndex;
				if (el.pinned !== undefined) sa.pinned = el.pinned;
				nodes.push({
					id: el.id,
					type: "text",
					x: el.x,
					y: el.y,
					width: el.width,
					height: el.height,
					text: "",
					color: el.color,
					gbStroke: {
						v: 1,
						size: el.strokeWidth,
						w: el.origWidth,
						h: el.origHeight,
						points: el.points,
					},
					...(Object.keys(sa).length > 0 ? { styleAttributes: sa } : {}),
				});
				break;
			}
			case "group": {
				const sa: Record<string, unknown> = {};
				if (el.zIndex !== undefined) sa.zIndex = el.zIndex;
				if (el.pinned !== undefined) sa.pinned = el.pinned;
				nodes.push({
					id: el.id,
					type: "group",
					x: el.x,
					y: el.y,
					width: el.width,
					height: el.height,
					label: el.label,
					color: el.color,
					background: el.background,
					backgroundStyle: el.backgroundStyle,
					...(Object.keys(sa).length > 0 ? { styleAttributes: sa } : {}),
				});
				break;
			}
			case "file": {
				const sa: Record<string, unknown> = {};
				if (el.zIndex !== undefined) sa.zIndex = el.zIndex;
				if (el.pinned !== undefined) sa.pinned = el.pinned;
				const node: JSONCanvasFileNode = {
					id: el.id,
					type: "file",
					file: el.file,
					x: el.x,
					y: el.y,
					width: el.width,
					height: el.height,
					color: el.color,
					...(el.subpath ? { subpath: el.subpath } : {}),
					...(Object.keys(sa).length > 0 ? { styleAttributes: sa } : {}),
				};
				nodes.push(node);
				break;
			}
			case "link": {
				const sa: Record<string, unknown> = {};
				if (el.zIndex !== undefined) sa.zIndex = el.zIndex;
				if (el.pinned !== undefined) sa.pinned = el.pinned;
				const node: JSONCanvasLinkNode = {
					id: el.id,
					type: "link",
					url: el.url,
					x: el.x,
					y: el.y,
					width: el.width,
					height: el.height,
					color: el.color,
					...(Object.keys(sa).length > 0 ? { styleAttributes: sa } : {}),
				};
				nodes.push(node);
				break;
			}
			case "script": {
				nodes.push({
					id: el.id,
					type: "text",
					x: el.x,
					y: el.y,
					width: el.width,
					height: el.height,
					text: el.text,
					styleAttributes: {
						pipelineData: {
							mediaKind: "script",
							label: el.label,
							status: el.status,
							idea: el.idea,
							model: el.model,
							provider: el.provider,
						},
						...(el.zIndex !== undefined ? { zIndex: el.zIndex } : {}),
						...(el.pinned !== undefined ? { pinned: el.pinned } : {}),
					},
				});
				break;
			}
			case "storyboard": {
				nodes.push({
					id: el.id,
					type: "text",
					x: el.x,
					y: el.y,
					width: el.width,
					height: el.height,
					text: JSON.stringify(el.shots, null, 2),
					styleAttributes: {
						pipelineData: {
							mediaKind: "storyboard",
							label: el.label,
							status: el.status,
							shots: el.shots,
							targetDuration: el.targetDuration,
							combatMode: el.combatMode,
						},
						...(el.zIndex !== undefined ? { zIndex: el.zIndex } : {}),
						...(el.pinned !== undefined ? { pinned: el.pinned } : {}),
					},
				});
				break;
			}
			case "image": {
				const pipelineData = {
					mediaKind: "image",
					label: el.label,
					status: el.status,
					prompt: el.prompt,
					ratio: el.ratio,
					size: el.size,
					assetId: el.assetId,
					refOrder: el.refOrder,
				};
				const sa: Record<string, unknown> = { pipelineData };
				if (el.zIndex !== undefined) sa.zIndex = el.zIndex;
				if (el.pinned !== undefined) sa.pinned = el.pinned;
				if (el.assetId) {
					nodes.push({
						id: el.id,
						type: "file",
						x: el.x,
						y: el.y,
						width: el.width,
						height: el.height,
						file: `assets/${el.assetId}.png`,
						styleAttributes: sa,
					});
				} else {
					nodes.push({
						id: el.id,
						type: "text",
						x: el.x,
						y: el.y,
						width: el.width,
						height: el.height,
						text: el.prompt,
						styleAttributes: sa,
					});
				}
				break;
			}
			case "video": {
				const pipelineData = {
					mediaKind: "video",
					label: el.label,
					status: el.status,
					prompt: el.prompt,
					ratio: el.ratio,
					duration: el.duration,
					resolution: el.resolution,
					frameMode: el.frameMode,
					assetId: el.assetId,
					lastAssetId: el.lastAssetId,
					lastPickAssetId: el.lastPickAssetId,
					seam: el.seam,
				};
				const sa: Record<string, unknown> = { pipelineData };
				if (el.zIndex !== undefined) sa.zIndex = el.zIndex;
				if (el.pinned !== undefined) sa.pinned = el.pinned;
				if (el.assetId) {
					nodes.push({
						id: el.id,
						type: "file",
						x: el.x,
						y: el.y,
						width: el.width,
						height: el.height,
						file: `assets/${el.assetId}.mp4`,
						styleAttributes: sa,
					});
				} else {
					nodes.push({
						id: el.id,
						type: "text",
						x: el.x,
						y: el.y,
						width: el.width,
						height: el.height,
						text: el.prompt,
						styleAttributes: sa,
					});
				}
				break;
			}
			case "audio": {
				const pipelineData = {
					mediaKind: "audio",
					label: el.label,
					status: el.status,
					prompt: el.prompt,
					audioType: el.audioType,
					duration: el.duration,
					assetId: el.assetId,
				};
				const sa: Record<string, unknown> = { pipelineData };
				if (el.zIndex !== undefined) sa.zIndex = el.zIndex;
				if (el.pinned !== undefined) sa.pinned = el.pinned;
				if (el.assetId) {
					nodes.push({
						id: el.id,
						type: "file",
						x: el.x,
						y: el.y,
						width: el.width,
						height: el.height,
						file: `assets/${el.assetId}.mp3`,
						styleAttributes: sa,
					});
				} else {
					nodes.push({
						id: el.id,
						type: "text",
						x: el.x,
						y: el.y,
						width: el.width,
						height: el.height,
						text: el.prompt,
						styleAttributes: sa,
					});
				}
				break;
			}
			case "finalcut": {
				const pipelineData = {
					mediaKind: "finalcut",
					label: el.label,
					status: el.status,
					assetId: el.assetId,
					totalDuration: el.totalDuration,
					sequence: el.sequence,
				};
				const sa: Record<string, unknown> = { pipelineData };
				if (el.zIndex !== undefined) sa.zIndex = el.zIndex;
				if (el.pinned !== undefined) sa.pinned = el.pinned;
				if (el.assetId) {
					nodes.push({
						id: el.id,
						type: "file",
						x: el.x,
						y: el.y,
						width: el.width,
						height: el.height,
						file: `assets/${el.assetId}.mp4`,
						styleAttributes: sa,
					});
				} else {
					nodes.push({
						id: el.id,
						type: "text",
						x: el.x,
						y: el.y,
						width: el.width,
						height: el.height,
						text: "Final Cut Timeline",
						styleAttributes: sa,
					});
				}
				break;
			}
		}
	}

	// Actor stamps ride in styleAttributes: JSON Canvas 1.0 has no top-level slot
	// for them, and the last-writer-wins merge needs the writer after a reload.
	for (const node of nodes) {
		const el = elements[node.id];
		if (el === undefined) continue;
		if (el.updatedBy === undefined && el.updatedAt === undefined) continue;
		const sa =
			(node as { styleAttributes?: Record<string, unknown> }).styleAttributes ??
			{};
		(node as { styleAttributes?: Record<string, unknown> }).styleAttributes = {
			...sa,
			...(el.updatedBy !== undefined ? { gbUpdatedBy: el.updatedBy } : {}),
			...(el.updatedAt !== undefined ? { gbUpdatedAt: el.updatedAt } : {}),
		};
	}

	const exportedEdges: JSONCanvasEdge[] = Object.values(edges).map((e) => ({
		id: e.id,
		fromNode: e.fromNode,
		fromSide: e.fromSide,
		fromEnd: e.fromEnd,
		toNode: e.toNode,
		toSide: e.toSide,
		toEnd: e.toEnd,
		color: e.color,
		label: e.label,
		styleAttributes: e.styleAttributes,
		fromPort: e.fromPort,
		toPort: e.toPort,
	}));

	return { nodes, edges: exportedEdges };
}

export function importFromJsonCanvas(doc: JSONCanvasDocument): {
	elements: Record<string, CanvasElement>;
	edges: Record<string, CanvasEdge>;
} {
	const elements: Record<string, CanvasElement> = {};
	const edges: Record<string, CanvasEdge> = {};

	for (const node of doc?.nodes ?? []) {
		const sa = (node.styleAttributes ?? {}) as Record<string, unknown>;
		const pipelineData = sa.pipelineData as Record<string, unknown> | undefined;

		// 1. Check for pipeline node restoration
		if (pipelineData && typeof pipelineData.mediaKind === "string") {
			const kind = pipelineData.mediaKind;
			switch (kind) {
				case "script": {
					elements[node.id] = {
						id: node.id,
						kind: "script",
						x: node.x,
						y: node.y,
						width: node.width,
						height: node.height,
						label: (pipelineData.label as string) ?? "Script",
						status: (pipelineData.status as any) ?? "idle",
						text: (node as JSONCanvasTextNode).text ?? "",
						idea: pipelineData.idea as string | undefined,
						model: pipelineData.model as string | undefined,
						provider: pipelineData.provider as string | undefined,
						zIndex: typeof sa.zIndex === "number" ? sa.zIndex : undefined,
						pinned: typeof sa.pinned === "boolean" ? sa.pinned : undefined,
					};
					continue;
				}
				case "storyboard": {
					elements[node.id] = {
						id: node.id,
						kind: "storyboard",
						x: node.x,
						y: node.y,
						width: node.width,
						height: node.height,
						label: (pipelineData.label as string) ?? "Storyboard",
						status: (pipelineData.status as any) ?? "idle",
						shots: (pipelineData.shots as Shot[]) ?? [],
						targetDuration: pipelineData.targetDuration as number | undefined,
						combatMode: pipelineData.combatMode as any,
						zIndex: typeof sa.zIndex === "number" ? sa.zIndex : undefined,
						pinned: typeof sa.pinned === "boolean" ? sa.pinned : undefined,
					};
					continue;
				}
				case "image": {
					elements[node.id] = {
						id: node.id,
						kind: "image",
						x: node.x,
						y: node.y,
						width: node.width,
						height: node.height,
						label: (pipelineData.label as string) ?? "Image Node",
						status: (pipelineData.status as any) ?? "idle",
						prompt:
							(pipelineData.prompt as string) ??
							(node as JSONCanvasTextNode).text ??
							"",
						ratio: (pipelineData.ratio as string) ?? "16:9",
						size: (pipelineData.size as string) ?? "1K",
						assetId: pipelineData.assetId as string | null | undefined,
						refOrder: pipelineData.refOrder as string[] | undefined,
						zIndex: typeof sa.zIndex === "number" ? sa.zIndex : undefined,
						pinned: typeof sa.pinned === "boolean" ? sa.pinned : undefined,
					};
					continue;
				}
				case "video": {
					elements[node.id] = {
						id: node.id,
						kind: "video",
						x: node.x,
						y: node.y,
						width: node.width,
						height: node.height,
						label: (pipelineData.label as string) ?? "Video Node",
						status: (pipelineData.status as any) ?? "idle",
						prompt:
							(pipelineData.prompt as string) ??
							(node as JSONCanvasTextNode).text ??
							"",
						ratio: (pipelineData.ratio as string) ?? "16:9",
						duration: (pipelineData.duration as number) ?? 5,
						resolution: (pipelineData.resolution as string) ?? "720P",
						frameMode: pipelineData.frameMode as any,
						assetId: pipelineData.assetId as string | null | undefined,
						lastAssetId: pipelineData.lastAssetId as string | null | undefined,
						lastPickAssetId: pipelineData.lastPickAssetId as
							| string
							| null
							| undefined,
						seam: pipelineData.seam as any,
						zIndex: typeof sa.zIndex === "number" ? sa.zIndex : undefined,
						pinned: typeof sa.pinned === "boolean" ? sa.pinned : undefined,
					};
					continue;
				}
				case "audio": {
					elements[node.id] = {
						id: node.id,
						kind: "audio",
						x: node.x,
						y: node.y,
						width: node.width,
						height: node.height,
						label: (pipelineData.label as string) ?? "Audio Node",
						status: (pipelineData.status as any) ?? "idle",
						prompt:
							(pipelineData.prompt as string) ??
							(node as JSONCanvasTextNode).text ??
							"",
						audioType: pipelineData.audioType as any,
						duration: pipelineData.duration as number | undefined,
						assetId: pipelineData.assetId as string | null | undefined,
						zIndex: typeof sa.zIndex === "number" ? sa.zIndex : undefined,
						pinned: typeof sa.pinned === "boolean" ? sa.pinned : undefined,
					};
					continue;
				}
				case "finalcut": {
					elements[node.id] = {
						id: node.id,
						kind: "finalcut",
						x: node.x,
						y: node.y,
						width: node.width,
						height: node.height,
						label: (pipelineData.label as string) ?? "Final Cut",
						status: (pipelineData.status as any) ?? "idle",
						assetId: pipelineData.assetId as string | null | undefined,
						totalDuration: pipelineData.totalDuration as number | undefined,
						sequence: pipelineData.sequence as string[] | undefined,
						zIndex: typeof sa.zIndex === "number" ? sa.zIndex : undefined,
						pinned: typeof sa.pinned === "boolean" ? sa.pinned : undefined,
					};
					continue;
				}
			}
		}

		// 2. Stroke Node
		const textNode = node as JSONCanvasTextNode;
		if (textNode.gbStroke && isValidStroke(textNode.gbStroke)) {
			elements[node.id] = {
				id: node.id,
				kind: "stroke",
				x: node.x,
				y: node.y,
				width: node.width,
				height: node.height,
				color: node.color ?? MARKER_COLORS[0],
				strokeWidth: textNode.gbStroke.size,
				points: textNode.gbStroke.points,
				origWidth: textNode.gbStroke.w,
				origHeight: textNode.gbStroke.h,
				zIndex: typeof sa.zIndex === "number" ? sa.zIndex : undefined,
				pinned: typeof sa.pinned === "boolean" ? sa.pinned : undefined,
			};
			continue;
		}

		// 3. Group Node
		if (node.type === "group") {
			elements[node.id] = {
				id: node.id,
				kind: "group",
				x: node.x,
				y: node.y,
				width: node.width,
				height: node.height,
				label: node.label,
				color: node.color,
				background: node.background,
				backgroundStyle: node.backgroundStyle,
				zIndex: typeof sa.zIndex === "number" ? sa.zIndex : undefined,
				pinned: typeof sa.pinned === "boolean" ? sa.pinned : undefined,
			};
			continue;
		}

		// 4. Whiteboard Shapes
		if (typeof sa.shape === "string" && sa.shape in SHAPE_DEFINITIONS) {
			elements[node.id] = {
				id: node.id,
				kind: "shape",
				shapeType: sa.shape as ShapeType,
				x: node.x,
				y: node.y,
				width: node.width,
				height: node.height,
				text: textNode.text ?? "",
				color: node.color,
				fontSize: (sa.gbSize as TextSize) ?? "m",
				textAlign: (sa.textAlign as any) ?? "center",
				border: (sa.border as any) ?? "solid",
				zIndex: typeof sa.zIndex === "number" ? sa.zIndex : undefined,
				pinned: typeof sa.pinned === "boolean" ? sa.pinned : undefined,
			};
			continue;
		}

		// 5. Sticky Note
		if (sa.gbKind === "sticky") {
			elements[node.id] = {
				id: node.id,
				kind: "sticky",
				x: node.x,
				y: node.y,
				width: node.width,
				height: node.height,
				text: textNode.text ?? "",
				color: node.color ?? STICKY_DEFAULT_BG,
				fontSize: (sa.gbSize as TextSize) ?? "m",
				textAlign: (sa.textAlign as any) ?? "left",
				zIndex: typeof sa.zIndex === "number" ? sa.zIndex : undefined,
				pinned: typeof sa.pinned === "boolean" ? sa.pinned : undefined,
			};
			continue;
		}

		// 6. File Node (Standard JSON Canvas 1.0)
		if (node.type === "file") {
			const fileNode = node as JSONCanvasFileNode;
			elements[node.id] = {
				id: node.id,
				kind: "file",
				file: fileNode.file,
				subpath: fileNode.subpath,
				x: node.x,
				y: node.y,
				width: node.width,
				height: node.height,
				color: node.color,
				zIndex: typeof sa.zIndex === "number" ? sa.zIndex : undefined,
				pinned: typeof sa.pinned === "boolean" ? sa.pinned : undefined,
			};
			continue;
		}

		// 7. Link Node (Standard JSON Canvas 1.0)
		if (node.type === "link") {
			const linkNode = node as JSONCanvasLinkNode;
			elements[node.id] = {
				id: node.id,
				kind: "link",
				url: linkNode.url,
				x: node.x,
				y: node.y,
				width: node.width,
				height: node.height,
				color: node.color,
				zIndex: typeof sa.zIndex === "number" ? sa.zIndex : undefined,
				pinned: typeof sa.pinned === "boolean" ? sa.pinned : undefined,
			};
			continue;
		}

		// 8. Text Card (or default text node fallback)
		elements[node.id] = {
			id: node.id,
			kind: "text",
			x: node.x,
			y: node.y,
			width: node.width,
			height: node.height,
			text: textNode.text ?? "",
			fontSize: (sa.gbSize as TextSize) ?? "m",
			textAlign: (sa.textAlign as any) ?? "left",
			color: node.color,
			zIndex: typeof sa.zIndex === "number" ? sa.zIndex : undefined,
			pinned: typeof sa.pinned === "boolean" ? sa.pinned : undefined,
		};
	}

	for (const node of doc?.nodes ?? []) {
		const el = elements[node.id];
		if (el === undefined) continue;
		const sa = (node.styleAttributes ?? {}) as Record<string, unknown>;
		if (sa.gbUpdatedBy === "user" || sa.gbUpdatedBy === "agent") {
			el.updatedBy = sa.gbUpdatedBy;
		}
		if (typeof sa.gbUpdatedAt === "number") el.updatedAt = sa.gbUpdatedAt;
	}

	for (const edge of doc?.edges ?? []) {
		edges[edge.id] = {
			id: edge.id,
			fromNode: edge.fromNode,
			fromSide: edge.fromSide,
			fromEnd: edge.fromEnd,
			toNode: edge.toNode,
			toSide: edge.toSide,
			toEnd: edge.toEnd,
			color: edge.color,
			label: edge.label,
			styleAttributes: edge.styleAttributes as any,
			fromPort: edge.fromPort,
			toPort: edge.toPort,
		};
	}

	return { elements, edges };
}

export const canvasToJsonCanvas = exportToJsonCanvas;
export const jsonCanvasToCanvas = importFromJsonCanvas;
