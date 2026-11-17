/**
 * CanvasMinimap Component for DSH Cult Canvas
 *
 * Implements bird's-eye canvas minimap:
 * - Scaled overview of all whiteboard and pipeline elements
 * - Viewport camera rectangle indicator
 * - Click-to-pan navigation
 *
 * @module @local/dsh-cult-canvas/presentation/components/CanvasMinimap
 */
import { unionBounds } from "../../domain/geometry.js";
import { h } from "./react-binding.js";
export const MINIMAP_WIDTH = 180;
export const MINIMAP_HEIGHT = 120;
export const MINIMAP_PADDING = 40;
export function CanvasMinimap({ elements, viewport, canvasWidth = 1200, canvasHeight = 800, onPanTo, className, }) {
    // 1. Calculate overall scene bounding box
    const elementBoxes = elements.map((el) => ({
        minX: el.x,
        minY: el.y,
        maxX: el.x + (el.width ?? 200),
        maxY: el.y + (el.height ?? 150),
    }));
    // Also include current viewport area
    const vpLeft = -viewport.x / viewport.zoom;
    const vpTop = -viewport.y / viewport.zoom;
    const vpWidth = canvasWidth / viewport.zoom;
    const vpHeight = canvasHeight / viewport.zoom;
    elementBoxes.push({
        minX: vpLeft,
        minY: vpTop,
        maxX: vpLeft + vpWidth,
        maxY: vpTop + vpHeight,
    });
    const overall = unionBounds(elementBoxes) ?? {
        minX: 0,
        minY: 0,
        maxX: 2000,
        maxY: 2000,
    };
    const sceneW = Math.max(100, overall.maxX - overall.minX + MINIMAP_PADDING * 2);
    const sceneH = Math.max(100, overall.maxY - overall.minY + MINIMAP_PADDING * 2);
    const scaleX = MINIMAP_WIDTH / sceneW;
    const scaleY = MINIMAP_HEIGHT / sceneH;
    const scale = Math.min(scaleX, scaleY);
    const originX = overall.minX - MINIMAP_PADDING;
    const originY = overall.minY - MINIMAP_PADDING;
    const worldToMini = (wx, wy) => ({
        x: (wx - originX) * scale,
        y: (wy - originY) * scale,
    });
    const miniToWorld = (mx, my) => ({
        x: mx / scale + originX,
        y: my / scale + originY,
    });
    // Viewport indicator coordinates
    const vpMini = worldToMini(vpLeft, vpTop);
    const vpMiniW = Math.max(4, vpWidth * scale);
    const vpMiniH = Math.max(4, vpHeight * scale);
    const handleClick = (e) => {
        if (!onPanTo)
            return;
        const ev = e;
        if (typeof ev.clientX !== "number" || typeof ev.clientY !== "number")
            return;
        const rect = ev.currentTarget?.getBoundingClientRect?.() ?? {
            left: 0,
            top: 0,
        };
        const clickMiniX = ev.clientX - rect.left;
        const clickMiniY = ev.clientY - rect.top;
        const targetWorld = miniToWorld(clickMiniX, clickMiniY);
        onPanTo(targetWorld.x, targetWorld.y);
    };
    const cls = ["dsh-cult-canvas-minimap", className ?? ""]
        .filter(Boolean)
        .join(" ");
    return h("div", {
        className: cls,
        style: {
            position: "absolute",
            bottom: "20px",
            right: "20px",
            width: `${MINIMAP_WIDTH}px`,
            height: `${MINIMAP_HEIGHT}px`,
            backgroundColor: "rgba(15, 23, 42, 0.85)",
            border: "1px solid rgba(255, 255, 255, 0.12)",
            borderRadius: "8px",
            overflow: "hidden",
            cursor: "crosshair",
            backdropFilter: "blur(6px)",
            boxShadow: "0 6px 16px rgba(0,0,0,0.4)",
            zIndex: 45,
        },
        onClick: handleClick,
    }, 
    // Mini elements
    ...elements.map((el) => {
        const m = worldToMini(el.x, el.y);
        const mw = Math.max(2, (el.width ?? 100) * scale);
        const mh = Math.max(2, (el.height ?? 100) * scale);
        let bg = "#64748b";
        if (el.kind === "sticky")
            bg = "#fef08a";
        else if (el.kind === "shape")
            bg = "#38bdf8";
        else if (el.kind === "stroke")
            bg = "#e2e8f0";
        else if (el.kind === "video" || el.kind === "image")
            bg = "#a855f7";
        return h("div", {
            key: el.id,
            className: "dsh-minimap-node",
            style: {
                position: "absolute",
                left: `${m.x}px`,
                top: `${m.y}px`,
                width: `${mw}px`,
                height: `${mh}px`,
                backgroundColor: bg,
                borderRadius: "1px",
                opacity: 0.7,
                pointerEvents: "none",
            },
        });
    }), 
    // Viewport camera indicator
    h("div", {
        className: "dsh-minimap-camera",
        style: {
            position: "absolute",
            left: `${vpMini.x}px`,
            top: `${vpMini.y}px`,
            width: `${vpMiniW}px`,
            height: `${vpMiniH}px`,
            border: "1.5px solid var(--dsh-accent, #38bdf8)",
            backgroundColor: "rgba(56, 189, 248, 0.15)",
            borderRadius: "2px",
            pointerEvents: "none",
        },
    }));
}
