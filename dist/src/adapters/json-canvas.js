import { isValidStroke, MARKER_COLORS, SHAPE_DEFINITIONS, STICKY_DEFAULT_BG, } from "../domain/geometry.js";
// ============================================================================
// JSON Canvas 1.0 Adapter (Bidirectional)
// ============================================================================
export function exportToJsonCanvas(elements, edges) {
    const nodes = [];
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
                const sa = {};
                if (el.zIndex !== undefined)
                    sa.zIndex = el.zIndex;
                if (el.pinned !== undefined)
                    sa.pinned = el.pinned;
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
                const sa = {};
                if (el.zIndex !== undefined)
                    sa.zIndex = el.zIndex;
                if (el.pinned !== undefined)
                    sa.pinned = el.pinned;
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
                const sa = {};
                if (el.zIndex !== undefined)
                    sa.zIndex = el.zIndex;
                if (el.pinned !== undefined)
                    sa.pinned = el.pinned;
                const node = {
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
                const sa = {};
                if (el.zIndex !== undefined)
                    sa.zIndex = el.zIndex;
                if (el.pinned !== undefined)
                    sa.pinned = el.pinned;
                const node = {
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
                const sa = { pipelineData };
                if (el.zIndex !== undefined)
                    sa.zIndex = el.zIndex;
                if (el.pinned !== undefined)
                    sa.pinned = el.pinned;
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
                }
                else {
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
                const sa = { pipelineData };
                if (el.zIndex !== undefined)
                    sa.zIndex = el.zIndex;
                if (el.pinned !== undefined)
                    sa.pinned = el.pinned;
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
                }
                else {
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
                const sa = { pipelineData };
                if (el.zIndex !== undefined)
                    sa.zIndex = el.zIndex;
                if (el.pinned !== undefined)
                    sa.pinned = el.pinned;
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
                }
                else {
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
                const sa = { pipelineData };
                if (el.zIndex !== undefined)
                    sa.zIndex = el.zIndex;
                if (el.pinned !== undefined)
                    sa.pinned = el.pinned;
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
                }
                else {
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
    const exportedEdges = Object.values(edges).map((e) => ({
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
export function importFromJsonCanvas(doc) {
    const elements = {};
    const edges = {};
    for (const node of doc?.nodes ?? []) {
        const sa = (node.styleAttributes ?? {});
        const pipelineData = sa.pipelineData;
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
                        label: pipelineData.label ?? "Script",
                        status: pipelineData.status ?? "idle",
                        text: node.text ?? "",
                        idea: pipelineData.idea,
                        model: pipelineData.model,
                        provider: pipelineData.provider,
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
                        label: pipelineData.label ?? "Storyboard",
                        status: pipelineData.status ?? "idle",
                        shots: pipelineData.shots ?? [],
                        targetDuration: pipelineData.targetDuration,
                        combatMode: pipelineData.combatMode,
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
                        label: pipelineData.label ?? "Image Node",
                        status: pipelineData.status ?? "idle",
                        prompt: pipelineData.prompt ??
                            node.text ??
                            "",
                        ratio: pipelineData.ratio ?? "16:9",
                        size: pipelineData.size ?? "1K",
                        assetId: pipelineData.assetId,
                        refOrder: pipelineData.refOrder,
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
                        label: pipelineData.label ?? "Video Node",
                        status: pipelineData.status ?? "idle",
                        prompt: pipelineData.prompt ??
                            node.text ??
                            "",
                        ratio: pipelineData.ratio ?? "16:9",
                        duration: pipelineData.duration ?? 5,
                        resolution: pipelineData.resolution ?? "720P",
                        frameMode: pipelineData.frameMode,
                        assetId: pipelineData.assetId,
                        lastAssetId: pipelineData.lastAssetId,
                        lastPickAssetId: pipelineData.lastPickAssetId,
                        seam: pipelineData.seam,
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
                        label: pipelineData.label ?? "Audio Node",
                        status: pipelineData.status ?? "idle",
                        prompt: pipelineData.prompt ??
                            node.text ??
                            "",
                        audioType: pipelineData.audioType,
                        duration: pipelineData.duration,
                        assetId: pipelineData.assetId,
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
                        label: pipelineData.label ?? "Final Cut",
                        status: pipelineData.status ?? "idle",
                        assetId: pipelineData.assetId,
                        totalDuration: pipelineData.totalDuration,
                        sequence: pipelineData.sequence,
                        zIndex: typeof sa.zIndex === "number" ? sa.zIndex : undefined,
                        pinned: typeof sa.pinned === "boolean" ? sa.pinned : undefined,
                    };
                    continue;
                }
            }
        }
        // 2. Stroke Node
        const textNode = node;
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
                shapeType: sa.shape,
                x: node.x,
                y: node.y,
                width: node.width,
                height: node.height,
                text: textNode.text ?? "",
                color: node.color,
                fontSize: sa.gbSize ?? "m",
                textAlign: sa.textAlign ?? "center",
                border: sa.border ?? "solid",
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
                fontSize: sa.gbSize ?? "m",
                textAlign: sa.textAlign ?? "left",
                zIndex: typeof sa.zIndex === "number" ? sa.zIndex : undefined,
                pinned: typeof sa.pinned === "boolean" ? sa.pinned : undefined,
            };
            continue;
        }
        // 6. File Node (Standard JSON Canvas 1.0)
        if (node.type === "file") {
            const fileNode = node;
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
            const linkNode = node;
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
            fontSize: sa.gbSize ?? "m",
            textAlign: sa.textAlign ?? "left",
            color: node.color,
            zIndex: typeof sa.zIndex === "number" ? sa.zIndex : undefined,
            pinned: typeof sa.pinned === "boolean" ? sa.pinned : undefined,
        };
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
            styleAttributes: edge.styleAttributes,
            fromPort: edge.fromPort,
            toPort: edge.toPort,
        };
    }
    return { elements, edges };
}
export const canvasToJsonCanvas = exportToJsonCanvas;
export const jsonCanvasToCanvas = importFromJsonCanvas;
