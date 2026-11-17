import type {
	BoundingBox,
	MarkerStrokeData,
	Point,
	RectBounds,
	ShapeType,
	TextSize,
} from "./types.js";

// ============================================================================
// Constants & Color Definitions
// ============================================================================

export const STICKY_DEFAULT_BG = "#FFF59A";
export const STICKY_DEFAULT_INK = "#3a3500";
export const STICKY_DROP_SHADOW = "0 8px 18px rgba(0, 0, 0, 0.38)";

export const TEXT_SIZES: Record<TextSize, number> = {
	s: 14,
	m: 18,
	l: 26,
	xl: 38,
};

export const MARKER_COLORS = [
	"#FF5A3D", // Red
	"#EDEDED", // White / Ink
	"#FFD54A", // Yellow
	"#5DB2FF", // Blue
	"#7CE8A6", // Green
] as const;

export const MARKER_WIDTH = {
	min: 1,
	max: 30,
	def: 4,
} as const;

export const COLOR_PRESETS: Record<string, string> = {
	"1": "#FF5A3D", // Red
	"2": "#FFA500", // Orange
	"3": "#FFD54A", // Yellow
	"4": "#7CE8A6", // Green
	"5": "#5DB2FF", // Cyan/Blue
	"6": "#9B51E0", // Purple
};

export const CANVAS_COLORS = COLOR_PRESETS;

// ============================================================================
// Shape Geometry & Inset Text Padding Compensation
// ============================================================================

export interface ShapeGeometry {
	id: ShapeType;
	defaultWidth: number;
	defaultHeight: number;
	paddingInlinePercent: number;
	textOffsetY: number;
}

export const SHAPE_DEFINITIONS: Record<ShapeType, ShapeGeometry> = {
	rect: {
		id: "rect",
		defaultWidth: 260,
		defaultHeight: 120,
		paddingInlinePercent: 0,
		textOffsetY: 0,
	},
	pill: {
		id: "pill",
		defaultWidth: 260,
		defaultHeight: 100,
		paddingInlinePercent: 0,
		textOffsetY: 0,
	},
	diamond: {
		id: "diamond",
		defaultWidth: 220,
		defaultHeight: 220,
		paddingInlinePercent: 22,
		textOffsetY: 0,
	},
	circle: {
		id: "circle",
		defaultWidth: 200,
		defaultHeight: 200,
		paddingInlinePercent: 14,
		textOffsetY: 0,
	},
	parallelogram: {
		id: "parallelogram",
		defaultWidth: 260,
		defaultHeight: 120,
		paddingInlinePercent: 0,
		textOffsetY: 0,
	},
	document: {
		id: "document",
		defaultWidth: 240,
		defaultHeight: 150,
		paddingInlinePercent: 0,
		textOffsetY: 0,
	},
	database: {
		id: "database",
		defaultWidth: 220,
		defaultHeight: 170,
		paddingInlinePercent: 0,
		textOffsetY: 20,
	},
};

/**
 * Calculates the horizontal inset padding and vertical baseline shift
 * required to prevent centered text from overflowing non-rectangular shapes.
 */
export function getShapePaddingCompensation(shapeType: ShapeType): {
	paddingInlinePercent: number;
	textOffsetY: number;
} {
	const def = SHAPE_DEFINITIONS[shapeType];
	if (!def) {
		return { paddingInlinePercent: 0, textOffsetY: 0 };
	}
	return {
		paddingInlinePercent: def.paddingInlinePercent,
		textOffsetY: def.textOffsetY,
	};
}

// ============================================================================
// Color Parsing & Blending Math
// ============================================================================

export function parseHexColor(input: unknown): [number, number, number] | null {
	if (typeof input !== "string") return null;
	const hex = input.trim();
	if (!/^#([0-9a-f]{3}){1,2}$/i.test(hex)) {
		return null;
	}
	const clean = hex.slice(1);
	if (clean.length === 3) {
		const r = parseInt(clean[0]! + clean[0]!, 16);
		const g = parseInt(clean[1]! + clean[1]!, 16);
		const b = parseInt(clean[2]! + clean[2]!, 16);
		return [r, g, b];
	}
	const r = parseInt(clean.slice(0, 2), 16);
	const g = parseInt(clean.slice(2, 4), 16);
	const b = parseInt(clean.slice(4, 6), 16);
	return [r, g, b];
}

export function resolveColorToRgb(
	colorVal: string | undefined,
	fallback = STICKY_DEFAULT_BG,
): [number, number, number] {
	if (
		colorVal &&
		typeof colorVal === "string" &&
		Object.prototype.hasOwnProperty.call(COLOR_PRESETS, colorVal)
	) {
		const presetHex = COLOR_PRESETS[colorVal];
		if (presetHex) {
			const rgb = parseHexColor(presetHex);
			if (rgb) return rgb;
		}
	}
	const parsed = parseHexColor(colorVal ?? "");
	if (parsed) return parsed;
	return parseHexColor(fallback) ?? [255, 245, 154];
}

export function mixColor(
	color1: string,
	ratio1: number,
	color2: string,
): string {
	const rgb1 = resolveColorToRgb(color1);
	const rgb2 = resolveColorToRgb(color2);
	const w1 = Math.max(0, Math.min(100, ratio1)) / 100;
	const w2 = 1 - w1;
	const r = Math.round(rgb1[0] * w1 + rgb2[0] * w2);
	const g = Math.round(rgb1[1] * w1 + rgb2[1] * w2);
	const b = Math.round(rgb1[2] * w1 + rgb2[2] * w2);
	const toHex = (n: number) =>
		Math.max(0, Math.min(255, n)).toString(16).padStart(2, "0");
	return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// ============================================================================
// Freehand Marker Stroke Algorithms & Geometry Math
// ============================================================================

export function round1(v: number): number {
	return Math.round(v * 10) / 10;
}

export function clampMarkerWidth(v: unknown): number {
	const n = Math.round(Number(v));
	return Number.isFinite(n)
		? Math.min(MARKER_WIDTH.max, Math.max(MARKER_WIDTH.min, n))
		: MARKER_WIDTH.def;
}

export function dedupePoints(
	points: Array<[number, number]>,
	minDist = 0.75,
): Array<[number, number]> {
	const out: Array<[number, number]> = [];
	for (const p of points) {
		const last = out[out.length - 1];
		if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) >= minDist) {
			out.push([p[0], p[1]]);
		}
	}
	return out;
}

export function buildStrokeNode(
	points: Array<[number, number]>,
	size: number,
): {
	x: number;
	y: number;
	width: number;
	height: number;
	gbStroke: MarkerStrokeData;
} {
	const clampedSize = clampMarkerWidth(size);
	let pts = dedupePoints(points);
	if (pts.length === 0) {
		throw new Error("Cult Canvas: empty stroke");
	}
	if (pts.length === 1) {
		const p0 = pts[0]!;
		pts = [p0, [p0[0] + 0.5, p0[1] + 0.5]];
	}
	const pad = Math.ceil(clampedSize);
	let minX = Number.POSITIVE_INFINITY;
	let minY = Number.POSITIVE_INFINITY;
	let maxX = Number.NEGATIVE_INFINITY;
	let maxY = Number.NEGATIVE_INFINITY;

	for (const [px, py] of pts) {
		if (px < minX) minX = px;
		if (py < minY) minY = py;
		if (px > maxX) maxX = px;
		if (py > maxY) maxY = py;
	}

	const x = Math.floor(minX - pad);
	const y = Math.floor(minY - pad);
	const width = Math.ceil(maxX + pad) - x;
	const height = Math.ceil(maxY + pad) - y;

	return {
		x,
		y,
		width,
		height,
		gbStroke: {
			v: 1,
			size: clampedSize,
			w: width,
			h: height,
			points: pts.map(([px, py]) => [round1(px - x), round1(py - y)]),
		},
	};
}

export function isValidStroke(s: unknown): s is MarkerStrokeData {
	if (!s || typeof s !== "object") return false;
	const candidate = s as Partial<MarkerStrokeData>;
	return (
		Array.isArray(candidate.points) &&
		candidate.points.length > 0 &&
		candidate.points.every(
			(p) =>
				Array.isArray(p) &&
				p.length >= 2 &&
				Number.isFinite(p[0]) &&
				Number.isFinite(p[1]),
		) &&
		Number.isFinite(candidate.size) &&
		(candidate.size ?? 0) > 0 &&
		Number.isFinite(candidate.w) &&
		(candidate.w ?? 0) > 0 &&
		Number.isFinite(candidate.h) &&
		(candidate.h ?? 0) > 0
	);
}

export function distToSegment(
	px: number,
	py: number,
	ax: number,
	ay: number,
	bx: number,
	by: number,
): number {
	const dx = bx - ax;
	const dy = by - ay;
	const len2 = dx * dx + dy * dy;
	let t = len2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
	t = Math.max(0, Math.min(1, t));
	return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

export function strokeDistance(
	box: RectBounds,
	s: MarkerStrokeData,
	pos: Point,
): number {
	const sx = box.width / s.w;
	const sy = box.height / s.h;
	const pts = s.points;
	const px = (i: number) => box.x + (pts[i]?.[0] ?? 0) * sx;
	const py = (i: number) => box.y + (pts[i]?.[1] ?? 0) * sy;

	if (pts.length <= 1) {
		return Math.hypot(pos.x - px(0), pos.y - py(0));
	}

	let best = Number.POSITIVE_INFINITY;
	for (let i = 1; i < pts.length; i++) {
		const d = distToSegment(pos.x, pos.y, px(i - 1), py(i - 1), px(i), py(i));
		if (d < best) best = d;
	}
	return best;
}

export function strokeHit(
	box: RectBounds,
	s: MarkerStrokeData,
	pos: Point,
	tolerance = 2,
): boolean {
	if (
		pos.x < box.x - tolerance ||
		pos.y < box.y - tolerance ||
		pos.x > box.x + box.width + tolerance ||
		pos.y > box.y + box.height + tolerance
	) {
		return false;
	}
	const half = (s.size / 2) * ((box.width / s.w + box.height / s.h) / 2);
	return strokeDistance(box, s, pos) <= half + tolerance;
}

export function samplePath(a: Point, b: Point, step = 10): Point[] {
	const d = Math.hypot(b.x - a.x, b.y - a.y);
	const n = Math.max(1, Math.ceil(d / Math.max(step, 0.001)));
	const out: Point[] = [];
	for (let i = 0; i <= n; i++) {
		out.push({
			x: a.x + ((b.x - a.x) * i) / n,
			y: a.y + ((b.y - a.y) * i) / n,
		});
	}
	return out;
}

export function eraserSweep(
	strokes: Array<{ id: string; box: RectBounds; stroke: MarkerStrokeData }>,
	dragStart: Point,
	dragEnd: Point,
	eraserRadius = 13,
	step = 10,
): string[] {
	const samples = samplePath(dragStart, dragEnd, step);
	const hitIds = new Set<string>();

	for (const strokeItem of strokes) {
		for (const pt of samples) {
			if (strokeHit(strokeItem.box, strokeItem.stroke, pt, eraserRadius)) {
				hitIds.add(strokeItem.id);
				break;
			}
		}
	}

	return Array.from(hitIds);
}

export function strokeOutlinePoints(
	points: Array<[number, number]>,
	size: number,
): Array<[number, number]> {
	if (points.length === 0 || size <= 0) return [];
	const pts = dedupePoints(points);
	if (pts.length === 1) {
		const [cx, cy] = pts[0]!;
		const r = size / 2;
		const circlePts: Array<[number, number]> = [];
		const steps = 16;
		for (let i = 0; i < steps; i++) {
			const angle = (i / steps) * Math.PI * 2;
			circlePts.push([cx + Math.cos(angle) * r, cy + Math.sin(angle) * r]);
		}
		return circlePts;
	}

	const leftSide: Array<[number, number]> = [];
	const rightSide: Array<[number, number]> = [];
	const radius = size / 2;

	for (let i = 0; i < pts.length; i++) {
		const curr = pts[i]!;
		let nx = 0;
		let ny = 0;

		if (i === 0) {
			const next = pts[i + 1]!;
			const dx = next[0] - curr[0];
			const dy = next[1] - curr[1];
			const len = Math.hypot(dx, dy) || 1;
			nx = -dy / len;
			ny = dx / len;
		} else if (i === pts.length - 1) {
			const prev = pts[i - 1]!;
			const dx = curr[0] - prev[0];
			const dy = curr[1] - prev[1];
			const len = Math.hypot(dx, dy) || 1;
			nx = -dy / len;
			ny = dx / len;
		} else {
			const prev = pts[i - 1]!;
			const next = pts[i + 1]!;
			const dx1 = curr[0] - prev[0];
			const dy1 = curr[1] - prev[1];
			const len1 = Math.hypot(dx1, dy1) || 1;
			const dx2 = next[0] - curr[0];
			const dy2 = next[1] - curr[1];
			const len2 = Math.hypot(dx2, dy2) || 1;

			const mx = -dy1 / len1 - dy2 / len2;
			const my = dx1 / len1 + dx2 / len2;
			const mlen = Math.hypot(mx, my) || 1;
			nx = mx / mlen;
			ny = my / mlen;
		}

		leftSide.push([curr[0] + nx * radius, curr[1] + ny * radius]);
		rightSide.push([curr[0] - nx * radius, curr[1] - ny * radius]);
	}

	// Add rounded cap at end
	const lastPt = pts[pts.length - 1]!;
	const prevPt = pts[pts.length - 2]!;
	const endAngle = Math.atan2(lastPt[1] - prevPt[1], lastPt[0] - prevPt[0]);
	const endCap: Array<[number, number]> = [];
	for (let a = -Math.PI / 2; a <= Math.PI / 2; a += Math.PI / 8) {
		endCap.push([
			lastPt[0] + Math.cos(endAngle + a) * radius,
			lastPt[1] + Math.sin(endAngle + a) * radius,
		]);
	}

	// Add rounded cap at start
	const firstPt = pts[0]!;
	const nextPt = pts[1]!;
	const startAngle = Math.atan2(firstPt[1] - nextPt[1], firstPt[0] - nextPt[0]);
	const startCap: Array<[number, number]> = [];
	for (let a = -Math.PI / 2; a <= Math.PI / 2; a += Math.PI / 8) {
		startCap.push([
			firstPt[0] + Math.cos(startAngle + a) * radius,
			firstPt[1] + Math.sin(startAngle + a) * radius,
		]);
	}

	return [...leftSide, ...endCap, ...rightSide.reverse(), ...startCap];
}

const average = (a: number, b: number) => (a + b) / 2;

export function getSvgPathFromStroke(
	points: Array<[number, number]>,
	closed = true,
): string {
	const len = points.length;
	if (len < 4) return "";
	let a = points[0]!;
	let b = points[1]!;
	const c = points[2]!;
	let result = `M${a[0].toFixed(2)},${a[1].toFixed(2)} Q${b[0].toFixed(2)},${b[1].toFixed(2)} ${average(b[0], c[0]).toFixed(2)},${average(b[1], c[1]).toFixed(2)} T`;
	for (let i = 2, max = len - 1; i < max; i++) {
		a = points[i]!;
		b = points[i + 1]!;
		result += `${average(a[0], b[0]).toFixed(2)},${average(a[1], b[1]).toFixed(2)} `;
	}
	if (closed) result += "Z";
	return result;
}

export function strokeOutlinePath(
	points: Array<[number, number]>,
	size: number,
): string {
	return getSvgPathFromStroke(strokeOutlinePoints(points, size));
}

export function centerlinePath(points: Array<[number, number]>): string {
	if (points.length === 0) return "";
	const [first, ...rest] = points;
	if (!first) return "";
	const tail = rest.length ? rest : [[first[0] + 0.01, first[1] + 0.01]];
	return (
		`M${first[0]},${first[1]} ` + tail.map((p) => `L${p[0]},${p[1]}`).join(" ")
	);
}

export function dragRect(a: Point, b: Point, minW = 0, minH = 0): RectBounds {
	const x = Math.min(a.x, b.x);
	const y = Math.min(a.y, b.y);
	return {
		x: Math.round(x),
		y: Math.round(y),
		width: Math.round(Math.max(minW, Math.abs(b.x - a.x))),
		height: Math.round(Math.max(minH, Math.abs(b.y - a.y))),
	};
}

export function centeredRect(pos: Point, w: number, h: number): RectBounds {
	return {
		x: Math.round(pos.x - w / 2),
		y: Math.round(pos.y - h / 2),
		width: w,
		height: h,
	};
}

export function boxesOverlap(a: BoundingBox, b: BoundingBox): boolean {
	return (
		a.minX < b.maxX && b.minX < a.maxX && a.minY < b.maxY && b.minY < a.maxY
	);
}

export function unionBounds(
	boxes: Array<BoundingBox | null | undefined>,
): BoundingBox | null {
	let out: BoundingBox | null = null;
	for (const b of boxes) {
		if (!b) continue;
		if (!out) {
			out = { minX: b.minX, minY: b.minY, maxX: b.maxX, maxY: b.maxY };
		} else {
			out.minX = Math.min(out.minX, b.minX);
			out.minY = Math.min(out.minY, b.minY);
			out.maxX = Math.max(out.maxX, b.maxX);
			out.maxY = Math.max(out.maxY, b.maxY);
		}
	}
	return out;
}

export function layerOrder(
	order: string[],
	selected: Set<string>,
	action: "front" | "back" | "forward" | "backward",
	overlaps: (idA: string, idB: string) => boolean = () => true,
): string[] {
	const sel = (id: string) => selected.has(id);
	const arr = order.slice();

	if (action === "front") {
		return arr.filter((id) => !sel(id)).concat(arr.filter(sel));
	}
	if (action === "back") {
		return arr.filter(sel).concat(arr.filter((id) => !sel(id)));
	}
	if (action === "forward") {
		for (let i = arr.length - 1; i >= 0; i--) {
			const id = arr[i]!;
			if (!sel(id)) continue;
			let j = i + 1;
			while (j < arr.length && (sel(arr[j]!) || !overlaps(id, arr[j]!))) {
				j++;
			}
			if (j >= arr.length) continue;
			arr.splice(i, 1);
			arr.splice(j, 0, id);
		}
	} else if (action === "backward") {
		for (let i = 0; i < arr.length; i++) {
			const id = arr[i]!;
			if (!sel(id)) continue;
			let j = i - 1;
			while (j >= 0 && (sel(arr[j]!) || !overlaps(id, arr[j]!))) {
				j--;
			}
			if (j < 0) continue;
			arr.splice(i, 1);
			arr.splice(j, 0, id);
		}
	}
	return arr;
}
