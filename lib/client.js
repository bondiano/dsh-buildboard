window.__ModuleLoader__.load({id:"@local/dsh-cult-canvas",factory(require){const exports = {}; const module = { exports };
Object.defineProperties(exports, {
	__esModule: { value: true },
	[Symbol.toStringTag]: { value: "Module" }
});
// src/adapters/locales.ts
/**
* Multi-Language Locale Dictionaries for Cult Canvas
*/
const CANVAS_LOCALES = {
	en: {
		"tab.title": "Cult Canvas",
		"guide.description": "Interactive whiteboard the agent edits live",
		"badge.agent": "agent",
		"toolbar.startProject": "Start project",
		"settings.title": "Cult Canvas",
		"settings.defaultCanvasWidth": "Default board width",
		"settings.defaultCanvasHeight": "Default board height",
		"settings.maxElements": "Maximum elements",
		"settings.snapToGrid": "Snap to grid",
		"settings.gridSize": "Grid size",
		"settings.generationProvider": "Generation provider",
		"settings.generationApiKey": "Generation API key",
		"settings.generationBaseUrl": "Generation base URL",
		"settings.error": "The value was rejected",
		title: "Cult Canvas",
		description: "Interactive whiteboard canvas combining spatial drawing with media generation pipeline for DeepSeek Harness.",
		create: "Create Element",
		update: "Update Element",
		delete: "Delete",
		connect: "Connect Ports",
		layout: "Auto Layout",
		run: "Run Pipeline",
		importExport: "Import / Export",
		bible: "Series Bible"
	},
	ru: {
		"tab.title": "Cult Canvas",
		"guide.description": "Интерактивная доска, которую агент правит вживую",
		"badge.agent": "агент",
		"toolbar.startProject": "Стартовать проект",
		"settings.title": "Cult Canvas",
		"settings.defaultCanvasWidth": "Ширина доски по умолчанию",
		"settings.defaultCanvasHeight": "Высота доски по умолчанию",
		"settings.maxElements": "Максимум элементов",
		"settings.snapToGrid": "Привязка к сетке",
		"settings.gridSize": "Шаг сетки",
		"settings.generationProvider": "Провайдер генерации",
		"settings.generationApiKey": "API-ключ генерации",
		"settings.generationBaseUrl": "Базовый URL генерации",
		"settings.error": "Значение отклонено",
		title: "Культ Канвас",
		description: "Интерактивный холст, объединяющий пространственную доску с узловым пайплайном генерации медиа для DeepSeek Harness.",
		create: "Создать элемент",
		update: "Обновить элемент",
		delete: "Удалить",
		connect: "Соединить порты",
		layout: "Автораскладка",
		run: "Запустить пайплайн",
		importExport: "Импорт / Экспорт",
		bible: "Библия сериала"
	},
	zh: {
		"tab.title": "Cult Canvas",
		"guide.description": "代理可实时编辑的交互式白板",
		"badge.agent": "代理",
		"toolbar.startProject": "启动项目",
		"settings.title": "Cult Canvas",
		"settings.defaultCanvasWidth": "默认画布宽度",
		"settings.defaultCanvasHeight": "默认画布高度",
		"settings.maxElements": "元素上限",
		"settings.snapToGrid": "对齐网格",
		"settings.gridSize": "网格大小",
		"settings.generationProvider": "生成服务商",
		"settings.generationApiKey": "生成 API 密钥",
		"settings.generationBaseUrl": "生成基础 URL",
		"settings.error": "该值被拒绝",
		title: "无限画布",
		description: "结合了空间白板与节点式媒体生成管线的 DeepSeek Harness 交互式画布插件。",
		create: "创建元素",
		update: "更新元素",
		delete: "删除",
		connect: "连接端口",
		layout: "自动布局",
		run: "运行工作流",
		importExport: "导入/导出",
		bible: "世界观设定集"
	}
};
// src/presentation/components/react-binding.ts
/** Fallback minimal React implementation when host React is not yet injected. */
const fallbackReact = {
	Fragment: "dsh-fragment",
	createElement(type, props, ...children) {
		const flatChildren = children.flat();
		const p = { ...props };
		if (flatChildren.length > 0) p["children"] = flatChildren.length === 1 ? flatChildren[0] : flatChildren;
		return {
			type,
			props: p,
			key: props?.["key"] ?? null,
			children: flatChildren
		};
	},
	useState(initial) {
		return [typeof initial === "function" ? initial() : initial, () => {}];
	},
	useEffect(cb) {
		if (typeof cb === "function") try {
			if (typeof cb() === "function") {}
		} catch {}
	},
	useCallback(fn) {
		return fn;
	},
	useMemo(fn) {
		return fn();
	},
	useRef(initial) {
		return { current: initial };
	}
};
let activeReact = null;
function mergeWithFallback(partial) {
	if (!partial) return fallbackReact;
	return {
		createElement: typeof partial.createElement === "function" ? partial.createElement.bind(partial) : fallbackReact.createElement,
		Fragment: partial.Fragment ?? fallbackReact.Fragment,
		useState: typeof partial.useState === "function" ? partial.useState.bind(partial) : fallbackReact.useState,
		useEffect: typeof partial.useEffect === "function" ? partial.useEffect.bind(partial) : fallbackReact.useEffect,
		useCallback: typeof partial.useCallback === "function" ? partial.useCallback.bind(partial) : fallbackReact.useCallback,
		useMemo: typeof partial.useMemo === "function" ? partial.useMemo.bind(partial) : fallbackReact.useMemo,
		useRef: typeof partial.useRef === "function" ? partial.useRef.bind(partial) : fallbackReact.useRef
	};
}
function setReact(reactInstance) {
	if (reactInstance) activeReact = mergeWithFallback(reactInstance);
}
function getReact() {
	if (activeReact) return activeReact;
	if (typeof window !== "undefined") {
		const win = window;
		if (win.React && typeof win.React.createElement === "function") {
			activeReact = mergeWithFallback(win.React);
			return activeReact;
		}
	}
	if (typeof globalThis !== "undefined") {
		const glob = globalThis;
		if (glob.React && typeof glob.React.createElement === "function") {
			activeReact = mergeWithFallback(glob.React);
			return activeReact;
		}
	}
	return fallbackReact;
}
/**
* Convenience createElement helper `h`.
*/
function h(type, props, ...children) {
	const createFn = getReact().createElement;
	return createFn(type, props, ...children);
}
function useState(initial) {
	return getReact().useState(initial);
}
function useEffect(effect, deps) {
	getReact().useEffect(effect, deps);
}
function useCallback(fn, deps) {
	const cbFn = getReact().useCallback;
	return cbFn(fn, deps);
}
function useRef(initial) {
	return getReact().useRef(initial);
}
// src/presentation/components/CanvasIcon.ts
/**
* Cult Canvas glyph for the guide card and the tab chip.
*
* The paths are the plugin's own `icon.svg`, drawn inline so the card needs no
* asset fetch and inherits the shell's colour scheme.
*
* @module @local/dsh-cult-canvas/presentation/components/CanvasIcon
*/
function CanvasIcon({ size = 20, className }) {
	return h("svg", {
		width: size,
		height: size,
		viewBox: "0 0 64 64",
		className,
		role: "img",
		"aria-label": "Cult Canvas",
		xmlns: "http://www.w3.org/2000/svg"
	}, h("rect", {
		x: 3,
		y: 3,
		width: 58,
		height: 58,
		rx: 14,
		fill: "currentColor",
		opacity: .08
	}), h("path", {
		d: "M16 22 C26 22, 26 42, 36 42",
		stroke: "currentColor",
		strokeWidth: 2.5,
		strokeLinecap: "round",
		fill: "none"
	}), h("rect", {
		x: 10,
		y: 14,
		width: 16,
		height: 16,
		rx: 3,
		fill: "#fff59a",
		stroke: "#3a3500",
		strokeWidth: 1.2
	}), h("rect", {
		x: 36,
		y: 34,
		width: 18,
		height: 16,
		rx: 4,
		fill: "none",
		stroke: "currentColor",
		strokeWidth: 1.8
	}), h("circle", {
		cx: 48,
		cy: 20,
		r: 7,
		fill: "#ff5a3d"
	}));
}
// src/presentation/components/CanvasSettingsCard.ts
/** Fields in the order the Host schema declares them. */
const SETTINGS_FIELDS = [
	{
		key: "defaultCanvasWidth",
		label: "settings.defaultCanvasWidth",
		kind: "number"
	},
	{
		key: "defaultCanvasHeight",
		label: "settings.defaultCanvasHeight",
		kind: "number"
	},
	{
		key: "maxElements",
		label: "settings.maxElements",
		kind: "number"
	},
	{
		key: "snapToGrid",
		label: "settings.snapToGrid",
		kind: "switch"
	},
	{
		key: "gridSize",
		label: "settings.gridSize",
		kind: "number"
	},
	{
		key: "generationProvider",
		label: "settings.generationProvider",
		kind: "provider"
	},
	{
		key: "generationApiKey",
		label: "settings.generationApiKey",
		kind: "password"
	},
	{
		key: "generationBaseUrl",
		label: "settings.generationBaseUrl",
		kind: "text"
	}
];
/** Media generation backends the select offers. */
const PROVIDER_OPTIONS = [
	"mock",
	"openai",
	"wanx"
];
const ROW_STYLE = {
	display: "flex",
	alignItems: "center",
	gap: 12,
	padding: "8px 0",
	borderBottom: "0.5px solid var(--dsw-alias-border-l2)"
};
const LABEL_STYLE = {
	fontSize: 13,
	fontWeight: 500,
	lineHeight: 1.5,
	color: "var(--dsw-alias-label-primary)"
};
const INPUT_STYLE = {
	minWidth: 180,
	padding: "4px 8px",
	fontSize: 13,
	borderRadius: 6,
	border: "0.5px solid var(--dsw-alias-border-l2)",
	background: "var(--dsw-alias-bg-primary)",
	color: "var(--dsw-alias-label-primary)"
};
function CanvasSettingsCard({ getSnapshot, subscribe, write, t }) {
	const label = (key) => t ? t(key) : key.split(".").pop() ?? key;
	const [snapshot, setSnapshot] = useState(() => getSnapshot());
	const [failed, setFailed] = useState(null);
	useEffect(() => subscribe(() => setSnapshot(getSnapshot())), []);
	const value = snapshot.value ?? {};
	const disabled = !snapshot.writable || snapshot.status !== "ready";
	const commit = (field, next) => {
		setFailed(null);
		write(field, next).then((ok) => {
			if (!ok) setFailed(field);
		});
	};
	const control = (field) => {
		const current = value[field.key];
		if (field.kind === "switch") return h("input", {
			type: "checkbox",
			checked: current === true,
			disabled,
			"aria-label": label(field.label),
			onChange: (event) => commit(field.key, event.target?.checked === true)
		});
		if (field.kind === "provider") return h("select", {
			value: typeof current === "string" ? current : "mock",
			disabled,
			"aria-label": label(field.label),
			style: INPUT_STYLE,
			onChange: (event) => commit(field.key, event.target?.value ?? "mock")
		}, ...PROVIDER_OPTIONS.map((option) => h("option", { value: option }, option)));
		const text = typeof current === "string" || typeof current === "number" ? String(current) : "";
		return h("input", {
			type: field.kind === "number" ? "number" : field.kind === "password" ? "password" : "text",
			value: text,
			disabled,
			"aria-label": label(field.label),
			style: INPUT_STYLE,
			onChange: (event) => {
				const raw = event.target?.value ?? "";
				commit(field.key, field.kind === "number" ? Number(raw) : raw);
			}
		});
	};
	return h("div", {
		"data-cult-canvas-settings": "",
		style: {
			display: "flex",
			flexDirection: "column"
		}
	}, h("div", { style: { padding: "0 0 4px" } }, label("settings.title")), ...SETTINGS_FIELDS.map((field) => h("div", {
		key: field.key,
		style: ROW_STYLE
	}, h("span", { style: LABEL_STYLE }, label(field.label)), control(field))), failed === null ? null : h("p", {
		role: "status",
		style: {
			margin: "12px 0 0",
			fontSize: 12,
			lineHeight: 1.5,
			color: "var(--dsw-alias-state-error-primary)"
		}
	}, label("settings.error")));
}
// src/presentation/components/CanvasToolView.ts
/**
* CanvasToolView Component for DSH Cult Canvas
*
* Implements toolview cards registered in Cordis slot `tool.call.toolview`:
* - Displays agent tool execution details, input parameters, and results
* - Expandable disclosure view for JSON payloads
* - Status pills and action badges
*
* @module @local/dsh-cult-canvas/presentation/components/CanvasToolView
*/
function CanvasToolView({ toolName, callId, payload, expanded = false, onToggleExpand, className }) {
	const [localExpanded, setLocalExpanded] = useState(expanded);
	const isExpanded = onToggleExpand ? expanded : localExpanded;
	const toggle = onToggleExpand ?? (() => setLocalExpanded(!localExpanded));
	const status = payload?.status ?? "completed";
	const statusColor = status === "completed" ? "#22c55e" : status === "running" ? "#38bdf8" : "#ef4444";
	return h("div", {
		className: [
			"dsh-cult-canvas-toolview",
			`tool-${toolName}`,
			className ?? ""
		].filter(Boolean).join(" "),
		style: {
			backgroundColor: "rgba(15, 23, 42, 0.85)",
			border: "1px solid rgba(255, 255, 255, 0.1)",
			borderRadius: "8px",
			padding: "10px 14px",
			margin: "4px 0",
			fontSize: "12px",
			color: "#e2e8f0",
			fontFamily: "monospace"
		}
	}, h("div", {
		className: "dsh-toolview-header",
		style: {
			display: "flex",
			alignItems: "center",
			justifyContent: "space-between",
			cursor: "pointer",
			userSelect: "none"
		},
		onClick: toggle
	}, h("div", { style: {
		display: "flex",
		alignItems: "center",
		gap: "8px"
	} }, h("span", { style: {
		width: "8px",
		height: "8px",
		borderRadius: "50%",
		backgroundColor: statusColor,
		display: "inline-block"
	} }), h("strong", { style: { color: "#38bdf8" } }, toolName), callId ? h("span", { style: {
		color: "#64748b",
		fontSize: "11px"
	} }, `#${callId.slice(0, 8)}`) : null), h("span", { style: {
		transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
		transition: "transform 0.15s ease",
		display: "inline-block",
		color: "#94a3b8"
	} }, "▸")), isExpanded ? h("div", {
		className: "dsh-toolview-body",
		style: {
			marginTop: "8px",
			paddingTop: "8px",
			borderTop: "1px solid rgba(255, 255, 255, 0.08)",
			maxHeight: "260px",
			overflow: "auto"
		}
	}, payload?.args ? h("div", { style: { marginBottom: "6px" } }, h("div", { style: {
		color: "#94a3b8",
		fontSize: "11px"
	} }, "Parameters:"), h("pre", { style: {
		margin: "2px 0",
		padding: "6px",
		backgroundColor: "rgba(0, 0, 0, 0.3)",
		borderRadius: "4px",
		fontSize: "11px"
	} }, JSON.stringify(payload.args, null, 2))) : null, payload?.result !== void 0 ? h("div", null, h("div", { style: {
		color: "#94a3b8",
		fontSize: "11px"
	} }, "Result:"), h("pre", { style: {
		margin: "2px 0",
		padding: "6px",
		backgroundColor: "rgba(0, 0, 0, 0.3)",
		borderRadius: "4px",
		fontSize: "11px"
	} }, JSON.stringify(payload.result, null, 2))) : null, payload?.error ? h("div", { style: {
		color: "#f87171",
		marginTop: "4px",
		padding: "4px 8px",
		backgroundColor: "rgba(239, 68, 68, 0.1)",
		borderRadius: "4px"
	} }, `Error: ${payload.error}`) : null) : null);
}
// src/application/project-brief.ts
/** Longest brief accepted by the session draft. */
const MAX_BRIEF_LENGTH = 4e3;
/** Longest quoted element text. */
const MAX_TEXT_LENGTH = 80;
/** Most element lines the brief lists. */
const MAX_ELEMENT_LINES = 20;
/** Most series-bible entries the brief quotes. */
const MAX_BIBLE_LINES = 10;
/** Media pipeline node kinds, which the statistics call out separately. */
const PIPELINE_KIND = {
	script: true,
	storyboard: true,
	image: true,
	video: true,
	audio: true,
	finalcut: true
};
/** One line per element kind present, in first-seen order. */
function kindSummary(elements) {
	const counts = /* @__PURE__ */ new Map();
	for (const element of elements) {
		const kind = typeof element.kind === "string" ? element.kind : "element";
		counts.set(kind, (counts.get(kind) ?? 0) + 1);
	}
	const parts = [];
	for (const [kind, count] of counts) parts.push(PIPELINE_KIND[kind] ? `pipeline ${kind}=${count}` : `${kind}=${count}`);
	return parts.join(", ") || "empty";
}
/** Quote element text on one line, shortened to keep the brief readable. */
function quote(element) {
	const flat = (element.text ?? element.label ?? "").replace(/\s+/g, " ").trim();
	if (flat.length === 0) return "";
	return flat.length > MAX_TEXT_LENGTH ? `"${flat.slice(0, MAX_TEXT_LENGTH)}…"` : `"${flat}"`;
}
/** `key: value` lines for the series bible, one level deep. */
function bibleLines(bible) {
	if (bible === void 0) return [];
	const lines = [];
	for (const [key, value] of Object.entries(bible)) {
		if (lines.length >= MAX_BIBLE_LINES) break;
		if (value === void 0 || value === null) continue;
		if (Array.isArray(value)) {
			if (value.length === 0) continue;
			lines.push(`- ${key}: ${value.length} entries`);
			continue;
		}
		if (typeof value === "object") continue;
		if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") continue;
		lines.push(`- ${key}: ${String(value)}`);
	}
	return lines;
}
/**
* Build the prompt a "Start project" session receives.
*
* @param snapshot - the board as the user sees it.
* @param workspace - absolute project directory, when the board has one.
* @returns the brief, at most 4000 characters.
*/
function buildProjectBrief(snapshot, workspace) {
	const elements = snapshot.elements;
	const edges = snapshot.edges;
	const lines = [
		"Cult Canvas project brief",
		`Board: ${workspace ?? "shared board"}`,
		`Contents: ${elements.length} elements (${kindSummary(elements)}); ${edges.length} edges`
	];
	const bible = bibleLines(snapshot.bible);
	if (bible.length > 0) lines.push("", "Series bible:", ...bible);
	if (elements.length > 0) {
		lines.push("", "Elements:");
		for (const element of elements.slice(0, MAX_ELEMENT_LINES)) {
			const kind = typeof element.kind === "string" ? element.kind : "element";
			const text = quote(element);
			const position = `@ (${Math.round(element.x)}, ${Math.round(element.y)})`;
			lines.push(`- ${kind}${text === "" ? "" : ` ${text}`} ${position}`);
		}
		if (elements.length > MAX_ELEMENT_LINES) lines.push(`- … ${elements.length - MAX_ELEMENT_LINES} more`);
	}
	lines.push("", "Work with this board through the cult-canvas tools: canvas_get_state first, then canvas_create_element, canvas_update_element, canvas_delete_element and canvas_connect for targeted changes.", "Your edits show up live in the user's open board and are marked as agent edits.", `The board is stored at <workspace>/cult-canvas.canvas and is saved automatically.`);
	const brief = lines.join("\n");
	return brief.length > MAX_BRIEF_LENGTH ? `${brief.slice(0, 3999)}…` : brief;
}
// src/domain/route.ts
/**
* Shared API route identity.
*
* The Host registers the prefix route and the Client polls it, so the string
* lives where both halves can import it without touching the other's entry.
*
* @module @local/dsh-cult-canvas/domain/route
*/
/** Canonical web route prefix for canvas API endpoints. */
const CANVAS_API_ROUTE = "/plugin-api/cult-canvas";
// src/domain/geometry.ts
const STICKY_DEFAULT_BG = "#FFF59A";
const STICKY_DEFAULT_INK = "#3a3500";
const STICKY_DROP_SHADOW = "0 8px 18px rgba(0, 0, 0, 0.38)";
const TEXT_SIZES = {
	s: 14,
	m: 18,
	l: 26,
	xl: 38
};
const MARKER_COLORS = [
	"#FF5A3D",
	"#EDEDED",
	"#FFD54A",
	"#5DB2FF",
	"#7CE8A6"
];
const MARKER_WIDTH = {
	min: 1,
	max: 30,
	def: 4
};
const SHAPE_DEFINITIONS = {
	rect: {
		id: "rect",
		defaultWidth: 260,
		defaultHeight: 120,
		paddingInlinePercent: 0,
		textOffsetY: 0
	},
	pill: {
		id: "pill",
		defaultWidth: 260,
		defaultHeight: 100,
		paddingInlinePercent: 0,
		textOffsetY: 0
	},
	diamond: {
		id: "diamond",
		defaultWidth: 220,
		defaultHeight: 220,
		paddingInlinePercent: 22,
		textOffsetY: 0
	},
	circle: {
		id: "circle",
		defaultWidth: 200,
		defaultHeight: 200,
		paddingInlinePercent: 14,
		textOffsetY: 0
	},
	parallelogram: {
		id: "parallelogram",
		defaultWidth: 260,
		defaultHeight: 120,
		paddingInlinePercent: 0,
		textOffsetY: 0
	},
	document: {
		id: "document",
		defaultWidth: 240,
		defaultHeight: 150,
		paddingInlinePercent: 0,
		textOffsetY: 0
	},
	database: {
		id: "database",
		defaultWidth: 220,
		defaultHeight: 170,
		paddingInlinePercent: 0,
		textOffsetY: 20
	}
};
/**
* Calculates the horizontal inset padding and vertical baseline shift
* required to prevent centered text from overflowing non-rectangular shapes.
*/
function getShapePaddingCompensation(shapeType) {
	const def = SHAPE_DEFINITIONS[shapeType];
	if (!def) return {
		paddingInlinePercent: 0,
		textOffsetY: 0
	};
	return {
		paddingInlinePercent: def.paddingInlinePercent,
		textOffsetY: def.textOffsetY
	};
}
function round1(v) {
	return Math.round(v * 10) / 10;
}
function clampMarkerWidth(v) {
	const n = Math.round(Number(v));
	return Number.isFinite(n) ? Math.min(MARKER_WIDTH.max, Math.max(MARKER_WIDTH.min, n)) : MARKER_WIDTH.def;
}
function dedupePoints(points, minDist = .75) {
	const out = [];
	for (const p of points) {
		const last = out[out.length - 1];
		if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) >= minDist) out.push([p[0], p[1]]);
	}
	return out;
}
function buildStrokeNode(points, size) {
	const clampedSize = clampMarkerWidth(size);
	let pts = dedupePoints(points);
	if (pts.length === 0) throw new Error("Cult Canvas: empty stroke");
	if (pts.length === 1) {
		const p0 = pts[0];
		pts = [p0, [p0[0] + .5, p0[1] + .5]];
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
			points: pts.map(([px, py]) => [round1(px - x), round1(py - y)])
		}
	};
}
function distToSegment(px, py, ax, ay, bx, by) {
	const dx = bx - ax;
	const dy = by - ay;
	const len2 = dx * dx + dy * dy;
	let t = len2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
	t = Math.max(0, Math.min(1, t));
	return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
function strokeDistance(box, s, pos) {
	const sx = box.width / s.w;
	const sy = box.height / s.h;
	const pts = s.points;
	const px = (i) => box.x + (pts[i]?.[0] ?? 0) * sx;
	const py = (i) => box.y + (pts[i]?.[1] ?? 0) * sy;
	if (pts.length <= 1) return Math.hypot(pos.x - px(0), pos.y - py(0));
	let best = Number.POSITIVE_INFINITY;
	for (let i = 1; i < pts.length; i++) {
		const d = distToSegment(pos.x, pos.y, px(i - 1), py(i - 1), px(i), py(i));
		if (d < best) best = d;
	}
	return best;
}
function strokeHit(box, s, pos, tolerance = 2) {
	if (pos.x < box.x - tolerance || pos.y < box.y - tolerance || pos.x > box.x + box.width + tolerance || pos.y > box.y + box.height + tolerance) return false;
	const half = s.size / 2 * ((box.width / s.w + box.height / s.h) / 2);
	return strokeDistance(box, s, pos) <= half + tolerance;
}
function samplePath(a, b, step = 10) {
	const d = Math.hypot(b.x - a.x, b.y - a.y);
	const n = Math.max(1, Math.ceil(d / Math.max(step, .001)));
	const out = [];
	for (let i = 0; i <= n; i++) out.push({
		x: a.x + (b.x - a.x) * i / n,
		y: a.y + (b.y - a.y) * i / n
	});
	return out;
}
function eraserSweep(strokes, dragStart, dragEnd, eraserRadius = 13, step = 10) {
	const samples = samplePath(dragStart, dragEnd, step);
	const hitIds = /* @__PURE__ */ new Set();
	for (const strokeItem of strokes) for (const pt of samples) if (strokeHit(strokeItem.box, strokeItem.stroke, pt, eraserRadius)) {
		hitIds.add(strokeItem.id);
		break;
	}
	return Array.from(hitIds);
}
function strokeOutlinePoints(points, size) {
	if (points.length === 0 || size <= 0) return [];
	const pts = dedupePoints(points);
	if (pts.length === 1) {
		const [cx, cy] = pts[0];
		const r = size / 2;
		const circlePts = [];
		const steps = 16;
		for (let i = 0; i < steps; i++) {
			const angle = i / steps * Math.PI * 2;
			circlePts.push([cx + Math.cos(angle) * r, cy + Math.sin(angle) * r]);
		}
		return circlePts;
	}
	const leftSide = [];
	const rightSide = [];
	const radius = size / 2;
	for (let i = 0; i < pts.length; i++) {
		const curr = pts[i];
		let nx = 0;
		let ny = 0;
		if (i === 0) {
			const next = pts[i + 1];
			const dx = next[0] - curr[0];
			const dy = next[1] - curr[1];
			const len = Math.hypot(dx, dy) || 1;
			nx = -dy / len;
			ny = dx / len;
		} else if (i === pts.length - 1) {
			const prev = pts[i - 1];
			const dx = curr[0] - prev[0];
			const dy = curr[1] - prev[1];
			const len = Math.hypot(dx, dy) || 1;
			nx = -dy / len;
			ny = dx / len;
		} else {
			const prev = pts[i - 1];
			const next = pts[i + 1];
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
	const lastPt = pts[pts.length - 1];
	const prevPt = pts[pts.length - 2];
	const endAngle = Math.atan2(lastPt[1] - prevPt[1], lastPt[0] - prevPt[0]);
	const endCap = [];
	for (let a = -Math.PI / 2; a <= Math.PI / 2; a += Math.PI / 8) endCap.push([lastPt[0] + Math.cos(endAngle + a) * radius, lastPt[1] + Math.sin(endAngle + a) * radius]);
	const firstPt = pts[0];
	const nextPt = pts[1];
	const startAngle = Math.atan2(firstPt[1] - nextPt[1], firstPt[0] - nextPt[0]);
	const startCap = [];
	for (let a = -Math.PI / 2; a <= Math.PI / 2; a += Math.PI / 8) startCap.push([firstPt[0] + Math.cos(startAngle + a) * radius, firstPt[1] + Math.sin(startAngle + a) * radius]);
	return [
		...leftSide,
		...endCap,
		...rightSide.reverse(),
		...startCap
	];
}
const average = (a, b) => (a + b) / 2;
function getSvgPathFromStroke(points, closed = true) {
	const len = points.length;
	if (len < 4) return "";
	let a = points[0];
	let b = points[1];
	const c = points[2];
	let result = `M${a[0].toFixed(2)},${a[1].toFixed(2)} Q${b[0].toFixed(2)},${b[1].toFixed(2)} ${average(b[0], c[0]).toFixed(2)},${average(b[1], c[1]).toFixed(2)} T`;
	for (let i = 2, max = len - 1; i < max; i++) {
		a = points[i];
		b = points[i + 1];
		result += `${average(a[0], b[0]).toFixed(2)},${average(a[1], b[1]).toFixed(2)} `;
	}
	if (closed) result += "Z";
	return result;
}
function strokeOutlinePath(points, size) {
	return getSvgPathFromStroke(strokeOutlinePoints(points, size));
}
function centerlinePath(points) {
	if (points.length === 0) return "";
	const [first, ...rest] = points;
	if (!first) return "";
	const tail = rest.length ? rest : [[first[0] + .01, first[1] + .01]];
	return `M${first[0]},${first[1]} ` + tail.map((p) => `L${p[0]},${p[1]}`).join(" ");
}
function dragRect(a, b, minW = 0, minH = 0) {
	const x = Math.min(a.x, b.x);
	const y = Math.min(a.y, b.y);
	return {
		x: Math.round(x),
		y: Math.round(y),
		width: Math.round(Math.max(minW, Math.abs(b.x - a.x))),
		height: Math.round(Math.max(minH, Math.abs(b.y - a.y)))
	};
}
function unionBounds(boxes) {
	let out = null;
	for (const b of boxes) {
		if (!b) continue;
		if (!out) out = {
			minX: b.minX,
			minY: b.minY,
			maxX: b.maxX,
			maxY: b.maxY
		};
		else {
			out.minX = Math.min(out.minX, b.minX);
			out.minY = Math.min(out.minY, b.minY);
			out.maxX = Math.max(out.maxX, b.maxX);
			out.maxY = Math.max(out.maxY, b.maxY);
		}
	}
	return out;
}
function layerOrder(order, selected, action, overlaps = () => true) {
	const sel = (id) => selected.has(id);
	const arr = order.slice();
	if (action === "front") return arr.filter((id) => !sel(id)).concat(arr.filter(sel));
	if (action === "back") return arr.filter(sel).concat(arr.filter((id) => !sel(id)));
	if (action === "forward") for (let i = arr.length - 1; i >= 0; i--) {
		const id = arr[i];
		if (!sel(id)) continue;
		let j = i + 1;
		while (j < arr.length && (sel(arr[j]) || !overlaps(id, arr[j]))) j++;
		if (j >= arr.length) continue;
		arr.splice(i, 1);
		arr.splice(j, 0, id);
	}
	else if (action === "backward") for (let i = 0; i < arr.length; i++) {
		const id = arr[i];
		if (!sel(id)) continue;
		let j = i - 1;
		while (j >= 0 && (sel(arr[j]) || !overlaps(id, arr[j]))) j--;
		if (j < 0) continue;
		arr.splice(i, 1);
		arr.splice(j, 0, id);
	}
	return arr;
}
// src/domain/elements.ts
function createStickyNote(id, x, y, text, options = {}) {
	return {
		id,
		kind: "sticky",
		x,
		y,
		width: options.width ?? 220,
		height: options.height ?? 220,
		text,
		color: options.color ?? "#FFF59A",
		fontSize: options.fontSize ?? "m",
		textAlign: options.textAlign ?? "left",
		zIndex: options.zIndex,
		pinned: options.pinned
	};
}
function createWhiteboardShape(id, shapeType, x, y, text, options = {}) {
	const shapeDef = SHAPE_DEFINITIONS[shapeType];
	return {
		id,
		kind: "shape",
		shapeType,
		x,
		y,
		width: options.width ?? shapeDef?.defaultWidth ?? 220,
		height: options.height ?? shapeDef?.defaultHeight ?? 220,
		text,
		color: options.color,
		fontSize: options.fontSize ?? "m",
		textAlign: options.textAlign ?? "center",
		border: options.border ?? "solid",
		zIndex: options.zIndex,
		pinned: options.pinned
	};
}
function createTextCard(id, x, y, text, options = {}) {
	return {
		id,
		kind: "text",
		x,
		y,
		width: options.width ?? 260,
		height: options.height ?? 100,
		text,
		fontSize: options.fontSize ?? "m",
		textAlign: options.textAlign ?? "left",
		color: options.color,
		zIndex: options.zIndex,
		pinned: options.pinned
	};
}
function createMarkerStroke(id, points, size = 4, color = MARKER_COLORS[0], options = {}) {
	const clampedSize = clampMarkerWidth(size);
	const strokeBox = buildStrokeNode(points, clampedSize);
	return {
		id,
		kind: "stroke",
		x: strokeBox.x,
		y: strokeBox.y,
		width: strokeBox.width,
		height: strokeBox.height,
		color,
		strokeWidth: clampedSize,
		points: strokeBox.gbStroke.points,
		origWidth: strokeBox.gbStroke.w,
		origHeight: strokeBox.gbStroke.h,
		zIndex: options.zIndex,
		pinned: options.pinned
	};
}
// src/application/board-sync.ts
/** Millisecond stamp of one element, `0` when it carries none. */
function stampOf(element) {
	return typeof element.updatedAt === "number" ? element.updatedAt : 0;
}
/**
* Fold a server snapshot into the local board.
*
* The server is authoritative, except for local elements stamped after the last
* successful sync: those survive and the caller re-posts them. Ids the server no
* longer has and the user did not just create are dropped.
*
* @param local - board state in the browser.
* @param server - board state from `GET /state`.
* @param lastSyncedAt - client clock of the last accepted sync.
* @returns the reconciled board and the ids still owed to the server.
*/
function reconcileFromServer(local, server, lastSyncedAt) {
	const serverById = new Map(server.elements.map((el) => [el.id, el]));
	const pendingIds = [];
	const merged = [];
	for (const [id, element] of serverById) {
		const mine = local.elements.find((el) => el.id === id);
		if (mine !== void 0 && stampOf(mine) > lastSyncedAt) {
			merged.push(mine);
			pendingIds.push(id);
			continue;
		}
		merged.push(element);
	}
	for (const element of local.elements) {
		if (serverById.has(element.id)) continue;
		if (stampOf(element) > lastSyncedAt) {
			merged.push(element);
			pendingIds.push(element.id);
		}
	}
	return {
		elements: merged,
		edges: server.edges,
		pendingIds
	};
}
function CanvasMinimap({ elements, viewport, canvasWidth = 1200, canvasHeight = 800, onPanTo, className }) {
	const elementBoxes = elements.map((el) => ({
		minX: el.x,
		minY: el.y,
		maxX: el.x + (el.width ?? 200),
		maxY: el.y + (el.height ?? 150)
	}));
	const vpLeft = -viewport.x / viewport.zoom;
	const vpTop = -viewport.y / viewport.zoom;
	const vpWidth = canvasWidth / viewport.zoom;
	const vpHeight = canvasHeight / viewport.zoom;
	elementBoxes.push({
		minX: vpLeft,
		minY: vpTop,
		maxX: vpLeft + vpWidth,
		maxY: vpTop + vpHeight
	});
	const overall = unionBounds(elementBoxes) ?? {
		minX: 0,
		minY: 0,
		maxX: 2e3,
		maxY: 2e3
	};
	const sceneW = Math.max(100, overall.maxX - overall.minX + 80);
	const sceneH = Math.max(100, overall.maxY - overall.minY + 80);
	const scaleX = 180 / sceneW;
	const scaleY = 120 / sceneH;
	const scale = Math.min(scaleX, scaleY);
	const originX = overall.minX - 40;
	const originY = overall.minY - 40;
	const worldToMini = (wx, wy) => ({
		x: (wx - originX) * scale,
		y: (wy - originY) * scale
	});
	const miniToWorld = (mx, my) => ({
		x: mx / scale + originX,
		y: my / scale + originY
	});
	const vpMini = worldToMini(vpLeft, vpTop);
	const vpMiniW = Math.max(4, vpWidth * scale);
	const vpMiniH = Math.max(4, vpHeight * scale);
	const handleClick = (e) => {
		if (!onPanTo) return;
		const ev = e;
		if (typeof ev.clientX !== "number" || typeof ev.clientY !== "number") return;
		const rect = ev.currentTarget?.getBoundingClientRect?.() ?? {
			left: 0,
			top: 0
		};
		const clickMiniX = ev.clientX - rect.left;
		const clickMiniY = ev.clientY - rect.top;
		const targetWorld = miniToWorld(clickMiniX, clickMiniY);
		onPanTo(targetWorld.x, targetWorld.y);
	};
	return h("div", {
		className: ["dsh-cult-canvas-minimap", className ?? ""].filter(Boolean).join(" "),
		style: {
			position: "absolute",
			bottom: "20px",
			right: "20px",
			width: `180px`,
			height: `120px`,
			backgroundColor: "rgba(15, 23, 42, 0.85)",
			border: "1px solid rgba(255, 255, 255, 0.12)",
			borderRadius: "8px",
			overflow: "hidden",
			cursor: "crosshair",
			backdropFilter: "blur(6px)",
			boxShadow: "0 6px 16px rgba(0,0,0,0.4)",
			zIndex: 45
		},
		onClick: handleClick
	}, ...elements.map((el) => {
		const m = worldToMini(el.x, el.y);
		const mw = Math.max(2, (el.width ?? 100) * scale);
		const mh = Math.max(2, (el.height ?? 100) * scale);
		let bg = "#64748b";
		if (el.kind === "sticky") bg = "#fef08a";
		else if (el.kind === "shape") bg = "#38bdf8";
		else if (el.kind === "stroke") bg = "#e2e8f0";
		else if (el.kind === "video" || el.kind === "image") bg = "#a855f7";
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
				opacity: .7,
				pointerEvents: "none"
			}
		});
	}), h("div", {
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
			pointerEvents: "none"
		}
	}));
}
// src/presentation/components/MarkerStroke.ts
/**
* MarkerStroke Component for DSH Cult Canvas
*
* Implements freehand marker strokes ported from cult-canvas:
* - Outline and centerline SVG paths using domain geometry algorithms
* - 5 palette colors (#1E1E1E, #E03E3E, #2F9E44, #1971C2, #F08C00)
* - Stroke widths 2-24px with clamp protection
* - Hit testing and selection highlight
*
* @module @local/dsh-cult-canvas/presentation/components/MarkerStroke
*/
/** 5 standard whiteboard marker palette colors. */
const MARKER_PALETTE_COLORS = [
	"#1E1E1E",
	"#E03E3E",
	"#2F9E44",
	"#1971C2",
	"#F08C00"
];
/** Preset marker stroke widths in pixels (2px to 24px). */
const MARKER_PRESET_WIDTHS = [
	2,
	4,
	8,
	16,
	24
];
const DEFAULT_MARKER_COLOR = MARKER_PALETTE_COLORS[0];
/** Clamps marker width into the valid 2-24px range. */
function clampMarkerStrokeWidth(width) {
	const n = Math.round(Number(width));
	if (!Number.isFinite(n)) return 4;
	return Math.min(24, Math.max(2, n));
}
/** Generates closed SVG polygon path for the smooth outline of a stroke. */
function generateMarkerOutlinePath(points, size = 4) {
	return strokeOutlinePath(points, clampMarkerStrokeWidth(size));
}
/** Generates centerline SVG path for hit testing or lightweight wireframe rendering. */
function generateMarkerCenterlinePath(points) {
	return centerlinePath(points);
}
/**
* Freehand Marker Stroke SVG Component.
*/
function MarkerStroke({ id, points, width = 4, color = DEFAULT_MARKER_COLOR, opacity = 1, isSelected = false, className, onSelect, onPointerDown, onClick }) {
	if (!points || points.length === 0) return null;
	const clampedWidth = clampMarkerStrokeWidth(width);
	const outlineD = generateMarkerOutlinePath(points, clampedWidth);
	const centerlineD = generateMarkerCenterlinePath(points);
	const hitWidth = Math.max(14, clampedWidth + 10);
	const cls = [
		"dsh-cult-canvas-marker-stroke",
		isSelected ? "selected" : "",
		className ?? ""
	].filter(Boolean).join(" ");
	const handleClick = (e) => {
		if (onClick) onClick(e);
		if (onSelect) onSelect(id);
	};
	const handlePointerDown = (e) => {
		if (e && typeof e.stopPropagation === "function") e.stopPropagation();
		if (onPointerDown) onPointerDown(id, e);
	};
	return h("g", {
		id: id ? `stroke-${id}` : void 0,
		className: cls,
		onClick: handleClick,
		onPointerDown: handlePointerDown,
		style: { cursor: "pointer" }
	}, h("path", {
		className: "dsh-marker-hit-area",
		d: centerlineD,
		stroke: "transparent",
		strokeWidth: hitWidth,
		strokeLinecap: "round",
		strokeLinejoin: "round",
		fill: "none",
		pointerEvents: "stroke"
	}), h("path", {
		className: "dsh-marker-fill",
		d: outlineD,
		fill: color,
		fillOpacity: opacity,
		pointerEvents: "none"
	}), isSelected ? h("path", {
		className: "dsh-marker-selection-halo",
		d: centerlineD,
		stroke: "var(--dsh-accent, #38bdf8)",
		strokeWidth: clampedWidth + 6,
		strokeLinecap: "round",
		strokeLinejoin: "round",
		strokeDasharray: "4 4",
		fill: "none",
		pointerEvents: "none",
		opacity: .85
	}) : null);
}
// src/presentation/components/ShapeElement.ts
/**
* ShapeElement Component for DSH Cult Canvas
*
* Implements 7 geometric whiteboard shapes ported from cult-canvas:
* - rect, pill, diamond, circle, parallelogram, document, database
* - Inset text padding compensation (diamond 22%, circle 14%, database translateY 20px)
* - Editable text, configurable borders (solid, dashed, dotted), and fill colors
*
* @module @local/dsh-cult-canvas/presentation/components/ShapeElement
*/
const SUPPORTED_SHAPES = [
	"rect",
	"pill",
	"diamond",
	"circle",
	"parallelogram",
	"document",
	"database"
];
/**
* Returns SVG path or polygon definition for non-rectangular shape backgrounds.
*/
function getShapeSvgPath(shapeType, w, hVal) {
	switch (shapeType) {
		case "diamond": return `M ${w / 2} 0 L ${w} ${hVal / 2} L ${w / 2} ${hVal} L 0 ${hVal / 2} Z`;
		case "parallelogram": {
			const skew = w * .15;
			return `M ${skew} 0 L ${w} 0 L ${w - skew} ${hVal} L 0 ${hVal} Z`;
		}
		case "document": {
			const fold = Math.min(24, Math.min(w, hVal) * .2);
			return `M 0 0 L ${w} 0 L ${w} ${hVal - fold} L ${w - fold} ${hVal} L 0 ${hVal} Z`;
		}
		case "database": {
			const ry = Math.min(24, hVal * .15);
			return `M 0 ${ry} A ${w / 2} ${ry} 0 0 1 ${w} ${ry} L ${w} ${hVal - ry} A ${w / 2} ${ry} 0 0 1 0 ${hVal - ry} Z`;
		}
		case "rect":
		case "pill":
		case "circle": return "";
	}
}
function ShapeElement({ id, shapeType, x = 0, y = 0, width, height, text, color = "#1e293b", borderColor = "#475569", border = "solid", fontSize = "m", textAlign = "center", isSelected = false, isEditing = false, onSelect, onPointerDown, onChangeText, className }) {
	const [localEditing, setLocalEditing] = useState(isEditing);
	const [editText, setEditText] = useState(text);
	const shapeDef = SHAPE_DEFINITIONS[shapeType] ?? SHAPE_DEFINITIONS["rect"];
	const w = width ?? shapeDef.defaultWidth;
	const hVal = height ?? shapeDef.defaultHeight;
	const { paddingInlinePercent, textOffsetY } = getShapePaddingCompensation(shapeType);
	const pxSize = TEXT_SIZES[fontSize] ?? 18;
	const handleDoubleClick = (e) => {
		if (e && typeof e.stopPropagation === "function") e.stopPropagation();
		setLocalEditing(true);
	};
	const handleBlur = () => {
		setLocalEditing(false);
		if (onChangeText && editText !== text) onChangeText(id, editText);
	};
	const handleTextChange = (e) => {
		const target = e?.target;
		if (target && typeof target.value === "string") setEditText(target.value);
	};
	const handleClick = (e) => {
		const shiftKey = Boolean(e?.shiftKey);
		if (onSelect) onSelect(id, shiftKey);
	};
	const handlePointerDown = (e) => {
		if (localEditing) return;
		if (e && typeof e.stopPropagation === "function") e.stopPropagation();
		if (onPointerDown) onPointerDown(id, e);
	};
	const containerStyle = {
		position: "absolute",
		left: `${x}px`,
		top: `${y}px`,
		width: `${w}px`,
		height: `${hVal}px`,
		boxSizing: "border-box"
	};
	let shapeBorderRadius = "8px";
	let isCustomSvg = false;
	if (shapeType === "pill") shapeBorderRadius = "9999px";
	else if (shapeType === "circle") shapeBorderRadius = "50%";
	else if (shapeType === "diamond" || shapeType === "parallelogram" || shapeType === "document" || shapeType === "database") isCustomSvg = true;
	const textContainerStyle = {
		position: "absolute",
		inset: "0",
		display: "flex",
		alignItems: "center",
		justifyContent: textAlign === "center" ? "center" : textAlign === "right" ? "flex-end" : "flex-start",
		paddingLeft: `${Math.max(12, w * paddingInlinePercent / 100)}px`,
		paddingRight: `${Math.max(12, w * paddingInlinePercent / 100)}px`,
		transform: textOffsetY ? `translateY(${textOffsetY}px)` : void 0,
		boxSizing: "border-box",
		fontSize: `${pxSize}px`,
		textAlign,
		color: "var(--dsh-canvas-fg, #e2e8f0)",
		pointerEvents: localEditing ? "auto" : "none"
	};
	const cls = [
		"dsh-cult-canvas-element",
		`dsh-cult-canvas-shape`,
		`shape-${shapeType}`,
		isSelected ? "selected" : "",
		className ?? ""
	].filter(Boolean).join(" ");
	const strokeDash = border === "dashed" ? "6 6" : border === "dotted" ? "2 4" : void 0;
	return h("div", {
		id: `shape-${id}`,
		className: cls,
		style: containerStyle,
		onClick: handleClick,
		onPointerDown: handlePointerDown,
		onDoubleClick: handleDoubleClick,
		"data-element-id": id,
		"data-element-kind": "shape",
		"data-shape-type": shapeType
	}, isCustomSvg ? h("svg", {
		className: "dsh-shape-svg-bg",
		width: w,
		height: hVal,
		style: {
			position: "absolute",
			inset: "0",
			pointerEvents: "none"
		}
	}, h("path", {
		d: getShapeSvgPath(shapeType, w, hVal),
		fill: color,
		stroke: borderColor,
		strokeWidth: 2,
		strokeDasharray: strokeDash
	}), shapeType === "database" ? h("ellipse", {
		cx: w / 2,
		cy: Math.min(24, hVal * .15),
		rx: w / 2 - 1,
		ry: Math.min(24, hVal * .15) - 1,
		fill: "none",
		stroke: borderColor,
		strokeWidth: 1.5,
		strokeDasharray: strokeDash
	}) : null) : h("div", {
		className: "dsh-shape-css-bg",
		style: {
			position: "absolute",
			inset: "0",
			backgroundColor: color,
			borderRadius: shapeBorderRadius,
			border: `2px ${border} ${borderColor}`,
			boxSizing: "border-box",
			pointerEvents: "none"
		}
	}), h("div", {
		className: "dsh-shape-text-wrapper",
		style: textContainerStyle
	}, localEditing ? h("textarea", {
		className: "dsh-shape-textarea",
		value: editText,
		autoFocus: true,
		onChange: handleTextChange,
		onBlur: handleBlur,
		style: {
			width: "100%",
			maxHeight: "100%",
			background: "transparent",
			border: "none",
			outline: "none",
			resize: "none",
			fontFamily: "inherit",
			fontSize: "inherit",
			textAlign: "inherit",
			color: "inherit",
			padding: "0",
			margin: "0"
		}
	}) : h("span", {
		className: "dsh-shape-text",
		style: {
			whiteSpace: "pre-wrap",
			wordBreak: "break-word",
			lineHeight: 1.3
		}
	}, editText || text)));
}
// src/presentation/components/StickyNote.ts
/**
* StickyNote Component for DSH Cult Canvas
*
* Implements sticky note whiteboard elements ported from cult-canvas:
* - 220x220 px default size
* - #FFF59A background with drop shadow
* - Color selection (#FFF59A, #E3F2FD, #E8F5E9, #FFEBEE, #F3E5F5)
* - Handwritten font styling with editable text area
*
* @module @local/dsh-cult-canvas/presentation/components/StickyNote
*/
/** 5 standard sticky note paper colors. */
const STICKY_PALETTE_COLORS = [
	"#FFF59A",
	"#E3F2FD",
	"#E8F5E9",
	"#FFEBEE",
	"#F3E5F5"
];
function StickyNote({ id, x = 0, y = 0, width = 220, height = 220, text, color = STICKY_DEFAULT_BG, fontSize = "m", textAlign = "left", isSelected = false, isEditing = false, onSelect, onPointerDown, onChangeText, onChangeColor, className }) {
	const [localEditing, setLocalEditing] = useState(isEditing);
	const [editText, setEditText] = useState(text);
	const pxSize = TEXT_SIZES[fontSize] ?? 18;
	const handleDoubleClick = (e) => {
		if (e && typeof e.stopPropagation === "function") e.stopPropagation();
		setLocalEditing(true);
	};
	const handleBlur = () => {
		setLocalEditing(false);
		if (onChangeText && editText !== text) onChangeText(id, editText);
	};
	const handleTextChange = (e) => {
		const target = e?.target;
		if (target && typeof target.value === "string") setEditText(target.value);
	};
	const handleClick = (e) => {
		const shiftKey = Boolean(e?.shiftKey);
		if (onSelect) onSelect(id, shiftKey);
	};
	const handlePointerDown = (e) => {
		if (localEditing) return;
		if (e && typeof e.stopPropagation === "function") e.stopPropagation();
		if (onPointerDown) onPointerDown(id, e);
	};
	const style = {
		position: "absolute",
		left: `${x}px`,
		top: `${y}px`,
		width: `${width}px`,
		height: `${height}px`,
		backgroundColor: color,
		color: STICKY_DEFAULT_INK,
		boxShadow: STICKY_DROP_SHADOW,
		fontSize: `${pxSize}px`,
		textAlign,
		boxSizing: "border-box"
	};
	const cls = [
		"dsh-cult-canvas-element",
		"dsh-cult-canvas-sticky",
		isSelected ? "selected" : "",
		localEditing ? "editing" : "",
		className ?? ""
	].filter(Boolean).join(" ");
	return h("div", {
		id: `sticky-${id}`,
		className: cls,
		style,
		onClick: handleClick,
		onPointerDown: handlePointerDown,
		onDoubleClick: handleDoubleClick,
		"data-element-id": id,
		"data-element-kind": "sticky"
	}, localEditing ? h("textarea", {
		className: "dsh-sticky-textarea",
		value: editText,
		autoFocus: true,
		onChange: handleTextChange,
		onBlur: handleBlur,
		style: {
			width: "100%",
			height: "100%",
			background: "transparent",
			border: "none",
			outline: "none",
			resize: "none",
			fontFamily: "inherit",
			fontSize: "inherit",
			textAlign: "inherit",
			color: "inherit",
			padding: "0",
			margin: "0"
		}
	}) : h("div", {
		className: "dsh-sticky-content",
		style: {
			width: "100%",
			height: "100%",
			whiteSpace: "pre-wrap",
			wordBreak: "break-word",
			overflow: "hidden"
		}
	}, editText || text), isSelected && onChangeColor ? h("div", {
		className: "dsh-sticky-color-palette",
		style: {
			position: "absolute",
			bottom: "-32px",
			left: "0",
			display: "flex",
			gap: "6px",
			background: "rgba(15, 23, 42, 0.85)",
			padding: "4px 8px",
			borderRadius: "16px",
			backdropFilter: "blur(4px)"
		}
	}, ...STICKY_PALETTE_COLORS.map((c) => h("button", {
		key: c,
		className: `dsh-color-dot ${c === color ? "active" : ""}`,
		style: {
			width: "16px",
			height: "16px",
			borderRadius: "50%",
			backgroundColor: c,
			border: c === color ? "2px solid #38bdf8" : "1px solid rgba(255,255,255,0.4)",
			cursor: "pointer",
			padding: "0"
		},
		onClick: (e) => {
			if (e && typeof e.stopPropagation === "function") e.stopPropagation();
			onChangeColor(id, c);
		}
	}))) : null);
}
// src/presentation/components/CanvasToolbar.ts
const WHITEBOARD_TOOLS = [
	{
		id: "select",
		label: "Select",
		shortcut: "V",
		icon: "↖"
	},
	{
		id: "hand",
		label: "Hand / Pan",
		shortcut: "H",
		icon: "✋"
	},
	{
		id: "sticky",
		label: "Sticky Note",
		shortcut: "S",
		icon: "📝"
	},
	{
		id: "text",
		label: "Text",
		shortcut: "T",
		icon: "T"
	},
	{
		id: "shape",
		label: "Shape",
		shortcut: "R",
		icon: "◇"
	},
	{
		id: "marker",
		label: "Marker",
		shortcut: "P",
		icon: "✎"
	},
	{
		id: "eraser",
		label: "Eraser",
		shortcut: "E",
		icon: "⌫"
	},
	{
		id: "frame",
		label: "Frame",
		shortcut: "F",
		icon: "▢"
	}
];
function CanvasToolbar({ activeTool, onSelectTool, markerColor = MARKER_PALETTE_COLORS[0], onSelectMarkerColor, markerWidth = 4, onSelectMarkerWidth, selectedShape = "rect", onSelectShape, stickyColor = STICKY_PALETTE_COLORS[0], onSelectStickyColor, canStartProject = false, onStartProject, startProjectLabel = "Start project", className }) {
	const [activeFlyout, setActiveFlyout] = useState(null);
	const handleToolClick = (tool) => {
		onSelectTool(tool);
		if (tool === "marker") setActiveFlyout(activeFlyout === "marker" ? null : "marker");
		else if (tool === "shape") setActiveFlyout(activeFlyout === "shape" ? null : "shape");
		else if (tool === "sticky") setActiveFlyout(activeFlyout === "sticky" ? null : "sticky");
		else setActiveFlyout(null);
	};
	const cls = ["dsh-cult-canvas-toolbar", className ?? ""].filter(Boolean).join(" ");
	const startProjectButton = canStartProject && typeof onStartProject === "function" ? h("button", {
		type: "button",
		className: "dsh-cc-start-project",
		title: startProjectLabel,
		style: {
			marginTop: "4px",
			padding: "6px 8px",
			fontSize: "11px",
			fontWeight: 600,
			borderRadius: "8px",
			border: "1px solid rgba(255,255,255,0.2)",
			backgroundColor: "var(--dsh-accent, #38bdf8)",
			color: "#0b1220",
			cursor: "pointer"
		},
		onClick: () => onStartProject()
	}, startProjectLabel) : null;
	return h("aside", {
		className: cls,
		style: {
			position: "absolute",
			top: "20px",
			left: "20px",
			display: "flex",
			flexDirection: "column",
			gap: "6px",
			backgroundColor: "rgba(15, 23, 42, 0.9)",
			backdropFilter: "blur(8px)",
			padding: "8px",
			borderRadius: "12px",
			boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.4)",
			border: "1px solid rgba(255, 255, 255, 0.1)",
			zIndex: 50
		}
	}, ...WHITEBOARD_TOOLS.map((tool) => {
		const isCurrent = activeTool === tool.id;
		return h("button", {
			key: tool.id,
			className: `dsh-toolbar-btn tool-${tool.id} ${isCurrent ? "active" : ""}`,
			title: `${tool.label} (${tool.shortcut})`,
			style: {
				width: "38px",
				height: "38px",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				backgroundColor: isCurrent ? "var(--dsh-accent, #38bdf8)" : "transparent",
				color: isCurrent ? "#0f172a" : "#cbd5e1",
				border: "none",
				borderRadius: "8px",
				cursor: "pointer",
				fontSize: "16px",
				fontWeight: "bold",
				transition: "all 0.15s ease"
			},
			onClick: () => handleToolClick(tool.id)
		}, tool.icon);
	}), startProjectButton, activeFlyout === "marker" && onSelectMarkerColor && onSelectMarkerWidth ? h("div", {
		className: "dsh-toolbar-flyout flyout-marker",
		style: {
			position: "absolute",
			left: "54px",
			top: "140px",
			backgroundColor: "rgba(15, 23, 42, 0.95)",
			backdropFilter: "blur(8px)",
			padding: "10px",
			borderRadius: "10px",
			border: "1px solid rgba(255, 255, 255, 0.15)",
			boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
			display: "flex",
			flexDirection: "column",
			gap: "10px",
			zIndex: 60,
			minWidth: "140px"
		}
	}, h("div", { style: {
		display: "flex",
		gap: "6px"
	} }, ...MARKER_PALETTE_COLORS.map((c) => h("button", {
		key: c,
		className: `dsh-color-swatch ${c === markerColor ? "active" : ""}`,
		style: {
			width: "20px",
			height: "20px",
			borderRadius: "50%",
			backgroundColor: c,
			border: c === markerColor ? "2px solid #38bdf8" : "1px solid rgba(255,255,255,0.3)",
			cursor: "pointer",
			padding: 0
		},
		onClick: () => onSelectMarkerColor(c)
	}))), h("div", { style: {
		display: "flex",
		gap: "6px",
		alignItems: "center"
	} }, ...MARKER_PRESET_WIDTHS.map((w) => h("button", {
		key: w,
		className: `dsh-width-btn ${w === markerWidth ? "active" : ""}`,
		style: {
			flex: 1,
			height: "24px",
			backgroundColor: w === markerWidth ? "rgba(56, 189, 248, 0.3)" : "rgba(255,255,255,0.08)",
			border: w === markerWidth ? "1px solid #38bdf8" : "1px solid rgba(255,255,255,0.15)",
			borderRadius: "4px",
			color: "#e2e8f0",
			fontSize: "11px",
			cursor: "pointer",
			padding: 0
		},
		onClick: () => onSelectMarkerWidth(w)
	}, `${w}p`)))) : null, activeFlyout === "shape" && onSelectShape ? h("div", {
		className: "dsh-toolbar-flyout flyout-shapes",
		style: {
			position: "absolute",
			left: "54px",
			top: "120px",
			backgroundColor: "rgba(15, 23, 42, 0.95)",
			backdropFilter: "blur(8px)",
			padding: "10px",
			borderRadius: "10px",
			border: "1px solid rgba(255, 255, 255, 0.15)",
			boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
			display: "grid",
			gridTemplateColumns: "repeat(2, 1fr)",
			gap: "6px",
			zIndex: 60,
			minWidth: "160px"
		}
	}, ...SUPPORTED_SHAPES.map((sh) => h("button", {
		key: sh,
		className: `dsh-shape-opt ${sh === selectedShape ? "active" : ""}`,
		style: {
			padding: "6px 8px",
			backgroundColor: sh === selectedShape ? "rgba(56, 189, 248, 0.3)" : "rgba(255,255,255,0.08)",
			border: sh === selectedShape ? "1px solid #38bdf8" : "1px solid rgba(255,255,255,0.15)",
			borderRadius: "4px",
			color: "#e2e8f0",
			fontSize: "12px",
			textTransform: "capitalize",
			cursor: "pointer"
		},
		onClick: () => onSelectShape(sh)
	}, sh))) : null, activeFlyout === "sticky" && onSelectStickyColor ? h("div", {
		className: "dsh-toolbar-flyout flyout-sticky",
		style: {
			position: "absolute",
			left: "54px",
			top: "80px",
			backgroundColor: "rgba(15, 23, 42, 0.95)",
			backdropFilter: "blur(8px)",
			padding: "10px",
			borderRadius: "10px",
			border: "1px solid rgba(255, 255, 255, 0.15)",
			boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
			display: "flex",
			gap: "6px",
			zIndex: 60
		}
	}, ...STICKY_PALETTE_COLORS.map((c) => h("button", {
		key: c,
		className: `dsh-sticky-dot ${c === stickyColor ? "active" : ""}`,
		style: {
			width: "22px",
			height: "22px",
			borderRadius: "4px",
			backgroundColor: c,
			border: c === stickyColor ? "2px solid #38bdf8" : "1px solid rgba(0,0,0,0.3)",
			cursor: "pointer",
			padding: 0
		},
		onClick: () => onSelectStickyColor(c)
	}))) : null);
}
// src/presentation/components/CanvasViewport.ts
const DEFAULT_VIEWPORT = {
	x: 0,
	y: 0,
	zoom: 1
};
const MIN_ZOOM = .1;
/** Converts screen (container-relative) coordinates to canvas world coordinates. */
function screenToWorld(screenX, screenY, viewport) {
	return {
		x: (screenX - viewport.x) / viewport.zoom,
		y: (screenY - viewport.y) / viewport.zoom
	};
}
function CanvasViewport({ viewport, onViewportChange, svgContent, domContent, previewContent, marqueeBounds, gridSize: gridStep = 20, cursor = "default", onPointerDown, onPointerMove, onPointerUp, className }) {
	const containerRef = useRef(null);
	const handleWheel = (e) => {
		const ev = e;
		if (!onViewportChange) return;
		if (ev.preventDefault) ev.preventDefault();
		const rect = ev.currentTarget?.getBoundingClientRect?.() ?? {
			left: 0,
			top: 0
		};
		const mouseX = (ev.clientX ?? 0) - rect.left;
		const mouseY = (ev.clientY ?? 0) - rect.top;
		if (ev.ctrlKey || ev.metaKey) {
			const factor = Math.exp(-(ev.deltaY ?? 0) * .005);
			const newZoom = Math.min(5, Math.max(MIN_ZOOM, viewport.zoom * factor));
			const zoomRatio = newZoom / viewport.zoom;
			const newX = mouseX - (mouseX - viewport.x) * zoomRatio;
			const newY = mouseY - (mouseY - viewport.y) * zoomRatio;
			onViewportChange({
				x: Math.round(newX),
				y: Math.round(newY),
				zoom: newZoom
			});
		} else onViewportChange({
			x: viewport.x - (ev.deltaX ?? 0),
			y: viewport.y - (ev.deltaY ?? 0),
			zoom: viewport.zoom
		});
	};
	const gridSize = gridStep * viewport.zoom;
	const gridOffsetX = (viewport.x % gridSize + gridSize) % gridSize;
	const gridOffsetY = (viewport.y % gridSize + gridSize) % gridSize;
	const rootCls = ["dsh-cult-canvas-root", className ?? ""].filter(Boolean).join(" ");
	const worldTransform = `matrix(${viewport.zoom}, 0, 0, ${viewport.zoom}, ${viewport.x}, ${viewport.y})`;
	return h("div", {
		ref: containerRef,
		className: rootCls,
		style: {
			position: "relative",
			width: "100%",
			height: "100%",
			overflow: "hidden",
			backgroundColor: "var(--dsh-canvas-bg, #0f141c)",
			backgroundImage: `radial-gradient(var(--dsh-canvas-dot, rgba(255, 255, 255, 0.12)) 1px, transparent 1px)`,
			backgroundSize: `${gridSize}px ${gridSize}px`,
			backgroundPosition: `${gridOffsetX}px ${gridOffsetY}px`,
			cursor,
			touchAction: "none",
			userSelect: "none"
		},
		onWheel: handleWheel,
		onPointerDown,
		onPointerMove,
		onPointerUp,
		onPointerLeave: onPointerUp
	}, h("div", {
		className: "dsh-cult-canvas-viewport",
		style: {
			position: "absolute",
			top: 0,
			left: 0,
			width: "100%",
			height: "100%",
			transform: worldTransform,
			transformOrigin: "0 0",
			pointerEvents: "none"
		}
	}, h("svg", {
		className: "dsh-cult-canvas-svg-layer",
		style: {
			position: "absolute",
			top: 0,
			left: 0,
			width: "100%",
			height: "100%",
			overflow: "visible",
			pointerEvents: "none"
		}
	}, svgContent), h("div", {
		className: "dsh-cult-canvas-dom-layer",
		style: {
			position: "absolute",
			top: 0,
			left: 0,
			width: 0,
			height: 0,
			overflow: "visible",
			pointerEvents: "auto"
		}
	}, domContent), h("div", {
		className: "dsh-cult-canvas-preview-layer",
		style: {
			position: "absolute",
			top: 0,
			left: 0,
			width: 0,
			height: 0,
			overflow: "visible",
			pointerEvents: "none"
		}
	}, previewContent)), marqueeBounds ? h("div", {
		className: "dsh-selection-marquee",
		style: {
			position: "absolute",
			left: `${marqueeBounds.x}px`,
			top: `${marqueeBounds.y}px`,
			width: `${marqueeBounds.width}px`,
			height: `${marqueeBounds.height}px`,
			border: "1px solid var(--dsh-accent, #38bdf8)",
			backgroundColor: "rgba(56, 189, 248, 0.15)",
			pointerEvents: "none",
			zIndex: 40
		}
	}) : null);
}
const RESIZE_HANDLES = [
	"nw",
	"n",
	"ne",
	"e",
	"se",
	"s",
	"sw",
	"w"
];
/** Snaps a coordinate value to the nearest grid step. */
function snapToGrid(value, gridSize = 20) {
	return Math.round(value / gridSize) * gridSize;
}
/** Computes the combined RectBounds enclosing all given element bounds. */
function computeSelectionBounds(elements) {
	if (elements.length === 0) return null;
	const union = unionBounds(elements.map((el) => ({
		minX: el.x,
		minY: el.y,
		maxX: el.x + el.width,
		maxY: el.y + el.height
	})));
	if (!union) return null;
	return {
		x: union.minX,
		y: union.minY,
		width: union.maxX - union.minX,
		height: union.maxY - union.minY
	};
}
/**
* Handles keyboard events for whiteboard element manipulation:
* - Delete / Backspace: deletes selected elements
* - ]: Bring to front
* - [: Send to back
* - Ctrl+] / Cmd+]: Step forward
* - Ctrl+[ / Cmd+[: Step backward
* - Ctrl+D / Cmd+D: Duplicate selected
*/
function handleManipulationKeyDown(event, options) {
	const { selectedIds, order, onDelete, onDuplicate, onReorder, overlapsFn } = options;
	if (selectedIds.length === 0) return false;
	const isCtrl = Boolean(event.ctrlKey || event.metaKey);
	const selSet = new Set(selectedIds);
	if (event.key === "Delete" || event.key === "Backspace") {
		if (event.preventDefault) event.preventDefault();
		if (onDelete) onDelete(selectedIds);
		return true;
	}
	if (isCtrl && (event.key === "d" || event.key === "D")) {
		if (event.preventDefault) event.preventDefault();
		if (onDuplicate) onDuplicate(selectedIds);
		return true;
	}
	if (isCtrl && event.key === "]") {
		if (event.preventDefault) event.preventDefault();
		if (onReorder) onReorder(layerOrder(order, selSet, "forward", overlapsFn));
		return true;
	}
	if (isCtrl && event.key === "[") {
		if (event.preventDefault) event.preventDefault();
		if (onReorder) onReorder(layerOrder(order, selSet, "backward", overlapsFn));
		return true;
	}
	if (event.key === "]") {
		if (event.preventDefault) event.preventDefault();
		if (onReorder) onReorder(layerOrder(order, selSet, "front", overlapsFn));
		return true;
	}
	if (event.key === "[") {
		if (event.preventDefault) event.preventDefault();
		if (onReorder) onReorder(layerOrder(order, selSet, "back", overlapsFn));
		return true;
	}
	return false;
}
/**
* Selection bounds overlay rendering the dashed selection box and 8 resize handles.
*/
function SelectionOverlay({ bounds, zoom = 1, onResizeStart, onDragStart }) {
	const handleSize = 8 / zoom;
	const half = handleSize / 2;
	const handlePositions = {
		nw: {
			left: -half,
			top: -half,
			cursor: "nwse-resize"
		},
		n: {
			left: bounds.width / 2 - half,
			top: -half,
			cursor: "ns-resize"
		},
		ne: {
			left: bounds.width - half,
			top: -half,
			cursor: "nesw-resize"
		},
		e: {
			left: bounds.width - half,
			top: bounds.height / 2 - half,
			cursor: "ew-resize"
		},
		se: {
			left: bounds.width - half,
			top: bounds.height - half,
			cursor: "nwse-resize"
		},
		s: {
			left: bounds.width / 2 - half,
			top: bounds.height - half,
			cursor: "ns-resize"
		},
		sw: {
			left: -half,
			top: bounds.height - half,
			cursor: "nesw-resize"
		},
		w: {
			left: -half,
			top: bounds.height / 2 - half,
			cursor: "ew-resize"
		}
	};
	return h("div", {
		className: "dsh-cult-canvas-selection-box",
		style: {
			position: "absolute",
			left: `${bounds.x}px`,
			top: `${bounds.y}px`,
			width: `${bounds.width}px`,
			height: `${bounds.height}px`,
			border: "1.5px dashed var(--dsh-accent, #38bdf8)",
			boxSizing: "border-box",
			pointerEvents: "none"
		},
		onPointerDown: onDragStart
	}, ...RESIZE_HANDLES.map((handle) => {
		const pos = handlePositions[handle];
		return h("div", {
			key: handle,
			className: `dsh-resize-handle handle-${handle}`,
			"data-handle": handle,
			style: {
				position: "absolute",
				left: `${pos.left}px`,
				top: `${pos.top}px`,
				width: `${handleSize}px`,
				height: `${handleSize}px`,
				backgroundColor: "#ffffff",
				border: "1.5px solid var(--dsh-accent, #38bdf8)",
				borderRadius: "2px",
				cursor: pos.cursor,
				pointerEvents: "auto",
				boxSizing: "border-box"
			},
			onPointerDown: (e) => {
				if (e && typeof e.stopPropagation === "function") e.stopPropagation();
				if (onResizeStart) onResizeStart(handle, e);
			}
		});
	}));
}
/**
* Eraser sweep calculation utility.
*/
function sweepAndCollectHitStrokes(strokes, start, end, radius = 14, step = 10) {
	return eraserSweep(strokes, start, end, radius, step);
}
/**
* Eraser interaction overlay tracking pointer sweeps and erasing strokes.
*/
function EraserSweep({ strokes, radius = 14, step = 10, onDeleteStrokes, isActive, children }) {
	const lastPosRef = useRef(null);
	const isDraggingRef = useRef(false);
	const [cursorPos, setCursorPos] = useState(null);
	if (!isActive) return h("div", { className: "dsh-eraser-wrapper" }, children);
	const handlePointerDown = (e) => {
		const ev = e;
		if (typeof ev.clientX !== "number" || typeof ev.clientY !== "number") return;
		const rect = ev.currentTarget?.getBoundingClientRect?.() ?? {
			left: 0,
			top: 0
		};
		const pt = {
			x: ev.clientX - rect.left,
			y: ev.clientY - rect.top
		};
		isDraggingRef.current = true;
		lastPosRef.current = pt;
		setCursorPos(pt);
	};
	const handlePointerMove = (e) => {
		const ev = e;
		if (typeof ev.clientX !== "number" || typeof ev.clientY !== "number") return;
		const rect = ev.currentTarget?.getBoundingClientRect?.() ?? {
			left: 0,
			top: 0
		};
		const currentPt = {
			x: ev.clientX - rect.left,
			y: ev.clientY - rect.top
		};
		setCursorPos(currentPt);
		if (!isDraggingRef.current || !lastPosRef.current) return;
		const hits = sweepAndCollectHitStrokes(strokes, lastPosRef.current, currentPt, radius, step);
		if (hits.length > 0) onDeleteStrokes(hits);
		lastPosRef.current = currentPt;
	};
	const handlePointerUp = () => {
		isDraggingRef.current = false;
		lastPosRef.current = null;
	};
	return h("div", {
		className: "dsh-cult-canvas-eraser-overlay",
		style: {
			position: "absolute",
			inset: 0,
			cursor: "crosshair",
			touchAction: "none"
		},
		onPointerDown: handlePointerDown,
		onPointerMove: handlePointerMove,
		onPointerUp: handlePointerUp,
		onPointerLeave: handlePointerUp
	}, children, cursorPos ? h("div", {
		className: "dsh-eraser-cursor-indicator",
		style: {
			position: "absolute",
			left: `${cursorPos.x - radius}px`,
			top: `${cursorPos.y - radius}px`,
			width: `${radius * 2}px`,
			height: `${radius * 2}px`,
			borderRadius: "50%",
			border: "1.5px solid rgba(239, 68, 68, 0.8)",
			backgroundColor: "rgba(239, 68, 68, 0.15)",
			pointerEvents: "none",
			transform: "translate3d(0, 0, 0)"
		}
	}) : null);
}
// src/presentation/components/CultCanvasBoard.ts
/**
* CultCanvasBoard Master Whiteboard Component for DSH Cult Canvas
*
* Combines:
* - CanvasViewport with pan/zoom and infinite dot grid
* - CanvasToolbar with 8 tools and flyout palettes
* - CanvasMinimap with camera indicator
* - Freehand marker drawing with real-time SVG preview
* - Sticky note and 7 geometric shape placement
* - Selection bounds, marquee dragging, Alt+drag duplicate, snap-to-grid (20px)
* - Eraser sweep tool deleting intersecting strokes
* - Layer ordering (], [, Ctrl+], Ctrl+[) and hotkeys
*
* @module @local/dsh-cult-canvas/presentation/components/CultCanvasBoard
*/
function CultCanvasBoard({ initialElements = [], initialEdges = [], syncUrl, onStateChange, onStartProject, canStartProject = false, visible = true, snapEnabled = true, gridSize = 20, startProjectLabel, agentBadgeLabel, className }) {
	const [elements, setElements] = useState(initialElements);
	const [edges, setEdges] = useState(initialEdges);
	const [layerOrderList, setLayerOrderList] = useState(initialElements.map((e) => e.id));
	const [viewport, setViewport] = useState(DEFAULT_VIEWPORT);
	const [activeTool, setActiveTool] = useState("select");
	const [markerColor, setMarkerColor] = useState(DEFAULT_MARKER_COLOR);
	const [markerWidth, setMarkerWidth] = useState(4);
	const [selectedShape, setSelectedShape] = useState("rect");
	const [stickyColor, setStickyColor] = useState("#FFF59A");
	const [selectedIds, setSelectedIds] = useState([]);
	const [drawingPoints, setDrawingPoints] = useState([]);
	const [marqueeRect, setMarqueeRect] = useState(null);
	const isInteractingRef = useRef(false);
	const isDraggingElementsRef = useRef(false);
	const isResizingRef = useRef(false);
	const resizeHandleRef = useRef(null);
	const resizeStartBoundsRef = useRef(null);
	const dragStartPointRef = useRef(null);
	const dragStartWorldRef = useRef(null);
	const lastWorldPointRef = useRef(null);
	const isAltDragRef = useRef(false);
	const didDuplicateRef = useRef(false);
	const dragStartElementsRef = useRef(/* @__PURE__ */ new Map());
	const elementsRef = useRef(elements);
	elementsRef.current = elements;
	const edgesRef = useRef(edges);
	edgesRef.current = edges;
	const selectedIdsRef = useRef(selectedIds);
	selectedIdsRef.current = selectedIds;
	const snap = useCallback((value) => snapEnabled ? snapToGrid(value, gridSize) : Math.round(value), [snapEnabled, gridSize]);
	const updateElements = useCallback((next) => {
		setElements((prev) => {
			const resolved = typeof next === "function" ? next(prev) : next;
			const before = new Map(prev.map((el) => [el.id, el]));
			const stamped = resolved.map((el) => {
				const prior = before.get(el.id);
				if (prior !== void 0 && prior.text === el.text && prior.color === el.color && prior.x === el.x && prior.y === el.y && prior.width === el.width && prior.height === el.height && prior.updatedBy === el.updatedBy) return el;
				return {
					...el,
					updatedBy: "user",
					updatedAt: Date.now()
				};
			});
			elementsRef.current = stamped;
			if (onStateChange) onStateChange(stamped, edges);
			return stamped;
		});
	}, [edges, onStateChange]);
	const revisionRef = useRef(0);
	const lastSyncedAtRef = useRef(0);
	const lastPollSignatureRef = useRef("");
	const removedIdsRef = useRef([]);
	const bibleRef = useRef(void 0);
	useEffect(() => {
		if (!syncUrl || typeof fetch === "undefined" || !visible) return () => {};
		let isMounted = true;
		const pollState = async () => {
			const separator = syncUrl.includes("?") ? "&" : "?";
			try {
				const res = await fetch(`${syncUrl}${separator}since=${revisionRef.current}`);
				if (!res.ok) return;
				const data = await res.json();
				if (!isMounted) return;
				if (typeof data.revision === "number") revisionRef.current = data.revision;
				bibleRef.current = data.bible;
				if (!Array.isArray(data.elements)) return;
				const merged = reconcileFromServer({
					elements: elementsRef.current,
					edges: edgesRef.current
				}, {
					elements: data.elements,
					edges: data.edges ?? []
				}, lastSyncedAtRef.current);
				const signature = merged.elements.map((el) => `${el.id}:${el.updatedAt ?? 0}`).join("|");
				if (signature === lastPollSignatureRef.current) return;
				lastPollSignatureRef.current = signature;
				elementsRef.current = merged.elements;
				setElements(merged.elements);
				setEdges(merged.edges);
			} catch {}
		};
		pollState();
		const interval = setInterval(() => void pollState(), 2e3);
		return () => {
			isMounted = false;
			clearInterval(interval);
		};
	}, [syncUrl, visible]);
	useEffect(() => {
		if (!syncUrl || typeof fetch === "undefined") return () => {};
		const changed = elements.filter((el) => (el.updatedAt ?? 0) > lastSyncedAtRef.current);
		const removed = removedIdsRef.current;
		if (changed.length === 0 && removed.length === 0) return () => {};
		const clientTime = Date.now();
		const timer = setTimeout(() => {
			fetch(syncUrl, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					clientTime,
					elements: changed,
					removeIds: removed
				})
			}).then((res) => {
				if (!res.ok) return;
				lastSyncedAtRef.current = clientTime;
				removedIdsRef.current = [];
			}).catch(() => {});
		}, 600);
		return () => clearTimeout(timer);
	}, [elements, syncUrl]);
	const startProject = useCallback(async () => {
		const clientTime = Date.now();
		const changed = elementsRef.current.filter((el) => (el.updatedAt ?? 0) > lastSyncedAtRef.current);
		const removed = removedIdsRef.current;
		if (syncUrl && typeof fetch === "function" && (changed.length > 0 || removed.length > 0)) try {
			if ((await fetch(syncUrl, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					clientTime,
					elements: changed,
					removeIds: removed
				})
			})).ok) {
				lastSyncedAtRef.current = clientTime;
				removedIdsRef.current = [];
			}
		} catch {}
		await onStartProject?.({
			elements: elementsRef.current,
			edges: edgesRef.current,
			bible: bibleRef.current
		});
	}, [syncUrl, onStartProject]);
	const selectionBounds = computeSelectionBounds(elements.filter((e) => selectedIds.includes(e.id)));
	useEffect(() => {
		if (typeof window === "undefined" || typeof window.addEventListener !== "function") return () => {};
		const onKeyDown = (e) => {
			handleManipulationKeyDown(e, {
				selectedIds,
				order: elements.map((e) => e.id),
				onDelete: (ids) => {
					removedIdsRef.current.push(...ids);
					setLayerOrderList((prev) => prev.filter((id) => !ids.includes(id)));
					updateElements((prev) => prev.filter((el) => !ids.includes(el.id)));
					setEdges((prev) => prev.filter((edge) => !ids.includes(edge.fromNode) && !ids.includes(edge.toNode)));
					setSelectedIds([]);
				},
				onDuplicate: (ids) => {
					const newElements = elements.filter((el) => ids.includes(el.id)).map((el) => ({
						...el,
						id: `copy_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
						x: snap(el.x + 40),
						y: snap(el.y + 40)
					}));
					setLayerOrderList((prev) => [...prev, ...newElements.map((e) => e.id)]);
					updateElements((prev) => [...prev, ...newElements]);
					setSelectedIds(newElements.map((e) => e.id));
				},
				onReorder: (newOrder) => {
					setLayerOrderList(newOrder);
					const orderMap = new Map(newOrder.map((id, idx) => [id, idx]));
					updateElements((prev) => [...prev].sort((a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0)));
				}
			});
		};
		window.addEventListener("keydown", onKeyDown);
		return () => {
			if (typeof window !== "undefined" && typeof window.removeEventListener === "function") window.removeEventListener("keydown", onKeyDown);
		};
	}, [
		selectedIds,
		layerOrderList,
		elements,
		updateElements,
		snap
	]);
	const getPointerScreenPoint = (ev) => {
		const target = ev.currentTarget;
		let rect;
		const vpEl = target?.closest?.(".dsh-cult-canvas-viewport-container");
		if (vpEl && typeof vpEl.getBoundingClientRect === "function") rect = vpEl.getBoundingClientRect();
		else if (target && typeof target.getBoundingClientRect === "function") {
			const className = target.className;
			if (typeof className === "string" && className.includes("dsh-cult-canvas-viewport-container")) rect = target.getBoundingClientRect();
		}
		const left = rect?.left ?? 0;
		const top = rect?.top ?? 0;
		return {
			x: (ev.clientX ?? 0) - left,
			y: (ev.clientY ?? 0) - top
		};
	};
	const handleElementPointerDown = (id, e) => {
		if (e && typeof e.stopPropagation === "function") e.stopPropagation();
		const ev = e;
		if (activeTool !== "select") {
			handlePointerDown(e);
			return;
		}
		let nextSelected;
		if (ev.shiftKey) nextSelected = selectedIdsRef.current.includes(id) ? selectedIdsRef.current.filter((x) => x !== id) : [...selectedIdsRef.current, id];
		else nextSelected = selectedIdsRef.current.includes(id) ? selectedIdsRef.current : [id];
		setSelectedIds(nextSelected);
		selectedIdsRef.current = nextSelected;
		const screenPt = getPointerScreenPoint(ev);
		const worldPt = screenToWorld(screenPt.x, screenPt.y, viewport);
		isInteractingRef.current = true;
		isDraggingElementsRef.current = true;
		isResizingRef.current = false;
		resizeHandleRef.current = null;
		resizeStartBoundsRef.current = null;
		dragStartPointRef.current = screenPt;
		dragStartWorldRef.current = worldPt;
		lastWorldPointRef.current = worldPt;
		isAltDragRef.current = Boolean(ev.altKey);
		didDuplicateRef.current = false;
		const snapMap = /* @__PURE__ */ new Map();
		for (const el of elementsRef.current) snapMap.set(el.id, {
			x: el.x,
			y: el.y,
			width: el.width ?? 100,
			height: el.height ?? 100
		});
		dragStartElementsRef.current = snapMap;
	};
	const handleResizeStart = (handle, e) => {
		if (e && typeof e.stopPropagation === "function") e.stopPropagation();
		const ev = e;
		const currentBounds = computeSelectionBounds(elementsRef.current.filter((el) => selectedIdsRef.current.includes(el.id))) ?? selectionBounds;
		if (!currentBounds) return;
		const screenPt = getPointerScreenPoint(ev);
		const worldPt = screenToWorld(screenPt.x, screenPt.y, viewport);
		isInteractingRef.current = true;
		isResizingRef.current = true;
		isDraggingElementsRef.current = false;
		resizeHandleRef.current = handle;
		resizeStartBoundsRef.current = currentBounds;
		dragStartPointRef.current = screenPt;
		dragStartWorldRef.current = worldPt;
		lastWorldPointRef.current = worldPt;
		const snapMap = /* @__PURE__ */ new Map();
		for (const el of elementsRef.current) snapMap.set(el.id, {
			x: el.x,
			y: el.y,
			width: el.width ?? 100,
			height: el.height ?? 100
		});
		dragStartElementsRef.current = snapMap;
	};
	const handlePointerDown = (e) => {
		const ev = e;
		if (typeof ev.clientX !== "number" || typeof ev.clientY !== "number") return;
		const screenPt = getPointerScreenPoint(ev);
		const worldPt = screenToWorld(screenPt.x, screenPt.y, viewport);
		isInteractingRef.current = true;
		isDraggingElementsRef.current = false;
		isResizingRef.current = false;
		resizeHandleRef.current = null;
		resizeStartBoundsRef.current = null;
		dragStartPointRef.current = screenPt;
		dragStartWorldRef.current = worldPt;
		lastWorldPointRef.current = worldPt;
		isAltDragRef.current = Boolean(ev.altKey);
		didDuplicateRef.current = false;
		if (activeTool === "marker") setDrawingPoints([[worldPt.x, worldPt.y]]);
		else if (activeTool === "sticky") {
			const id = `sticky_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
			const newSticky = createStickyNote(id, snap(worldPt.x - 110), snap(worldPt.y - 110), "New Note", { color: stickyColor });
			updateElements((prev) => [...prev, newSticky]);
			setSelectedIds([id]);
			selectedIdsRef.current = [id];
			setActiveTool("select");
		} else if (activeTool === "shape") {
			const id = `shape_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
			const newShape = createWhiteboardShape(id, selectedShape, snap(worldPt.x - 100), snap(worldPt.y - 60), selectedShape.toUpperCase());
			updateElements((prev) => [...prev, newShape]);
			setSelectedIds([id]);
			selectedIdsRef.current = [id];
			setActiveTool("select");
		} else if (activeTool === "text") {
			const id = `text_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
			const newText = createTextCard(id, snap(worldPt.x - 80), snap(worldPt.y - 20), "Text");
			updateElements((prev) => [...prev, newText]);
			setSelectedIds([id]);
			selectedIdsRef.current = [id];
			setActiveTool("select");
		} else if (activeTool === "select") {
			if (!ev.shiftKey) {
				setSelectedIds([]);
				selectedIdsRef.current = [];
			}
			dragStartElementsRef.current.clear();
		}
	};
	const handlePointerMove = (e) => {
		if (!isInteractingRef.current || !dragStartPointRef.current) return;
		const ev = e;
		if (typeof ev.clientX !== "number" || typeof ev.clientY !== "number") return;
		const currentScreen = getPointerScreenPoint(ev);
		const currentWorld = screenToWorld(currentScreen.x, currentScreen.y, viewport);
		if (isResizingRef.current && resizeHandleRef.current && dragStartWorldRef.current && resizeStartBoundsRef.current) {
			const totalDx = currentWorld.x - dragStartWorldRef.current.x;
			const totalDy = currentWorld.y - dragStartWorldRef.current.y;
			const handle = resizeHandleRef.current;
			const startBounds = resizeStartBoundsRef.current;
			const MIN_SIZE = 20;
			let newX = startBounds.x;
			let newY = startBounds.y;
			let newWidth = startBounds.width;
			let newHeight = startBounds.height;
			if (handle === "e" || handle === "ne" || handle === "se") newWidth = Math.max(MIN_SIZE, snap(startBounds.width + totalDx));
			else if (handle === "w" || handle === "nw" || handle === "sw") {
				const rawWidth = startBounds.width - totalDx;
				newWidth = Math.max(MIN_SIZE, snap(rawWidth));
				const actualDx = startBounds.width - newWidth;
				newX = snap(startBounds.x + actualDx);
			}
			if (handle === "s" || handle === "se" || handle === "sw") newHeight = Math.max(MIN_SIZE, snap(startBounds.height + totalDy));
			else if (handle === "n" || handle === "ne" || handle === "nw") {
				const rawHeight = startBounds.height - totalDy;
				newHeight = Math.max(MIN_SIZE, snap(rawHeight));
				const actualDy = startBounds.height - newHeight;
				newY = snap(startBounds.y + actualDy);
			}
			if (selectedIdsRef.current.length === 1) {
				const targetId = selectedIdsRef.current[0];
				updateElements((prev) => prev.map((el) => el.id === targetId ? {
					...el,
					x: newX,
					y: newY,
					width: newWidth,
					height: newHeight
				} : el));
			} else {
				const scaleX = startBounds.width > 0 ? newWidth / startBounds.width : 1;
				const scaleY = startBounds.height > 0 ? newHeight / startBounds.height : 1;
				updateElements((prev) => prev.map((el) => {
					if (!selectedIdsRef.current.includes(el.id)) return el;
					const start = dragStartElementsRef.current.get(el.id);
					if (!start) return el;
					const relX = start.x - startBounds.x;
					const relY = start.y - startBounds.y;
					return {
						...el,
						x: snap(newX + relX * scaleX),
						y: snap(newY + relY * scaleY),
						width: Math.max(MIN_SIZE, snap(start.width * scaleX)),
						height: Math.max(MIN_SIZE, snap(start.height * scaleY))
					};
				}));
			}
			lastWorldPointRef.current = currentWorld;
			return;
		}
		if (activeTool === "hand") {
			const dx = currentScreen.x - dragStartPointRef.current.x;
			const dy = currentScreen.y - dragStartPointRef.current.y;
			setViewport((v) => ({
				...v,
				x: v.x + dx,
				y: v.y + dy
			}));
			dragStartPointRef.current = currentScreen;
		} else if (activeTool === "marker") setDrawingPoints((pts) => [...pts, [currentWorld.x, currentWorld.y]]);
		else if (activeTool === "eraser") {
			if (lastWorldPointRef.current) {
				const hits = sweepAndCollectHitStrokes(elements.filter((el) => el.kind === "stroke").map((el) => ({
					id: el.id,
					box: {
						x: el.x,
						y: el.y,
						width: el.width,
						height: el.height
					},
					stroke: {
						v: 1,
						size: el.strokeWidth ?? 4,
						w: el.origWidth ?? el.width,
						h: el.origHeight ?? el.height,
						points: el.points ?? []
					}
				})), lastWorldPointRef.current, currentWorld);
				if (hits.length > 0) updateElements((prev) => prev.filter((el) => !hits.includes(el.id)));
			}
		} else if (activeTool === "select") {
			if (isDraggingElementsRef.current && selectedIdsRef.current.length > 0 && dragStartWorldRef.current) {
				const totalDx = currentWorld.x - dragStartWorldRef.current.x;
				const totalDy = currentWorld.y - dragStartWorldRef.current.y;
				if (isAltDragRef.current && !didDuplicateRef.current) {
					didDuplicateRef.current = true;
					const cloned = elementsRef.current.filter((el) => selectedIdsRef.current.includes(el.id)).map((el) => ({
						...el,
						id: `copy_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
					}));
					for (const c of cloned) dragStartElementsRef.current.set(c.id, {
						x: c.x,
						y: c.y,
						width: c.width ?? 100,
						height: c.height ?? 100
					});
					updateElements((prev) => [...prev, ...cloned]);
					const newIds = cloned.map((c) => c.id);
					setSelectedIds(newIds);
					selectedIdsRef.current = newIds;
				}
				updateElements((prev) => prev.map((el) => {
					if (!selectedIdsRef.current.includes(el.id)) return el;
					const start = dragStartElementsRef.current.get(el.id);
					if (!start) return el;
					return {
						...el,
						x: snap(start.x + totalDx),
						y: snap(start.y + totalDy)
					};
				}));
			} else if (!isDraggingElementsRef.current) {
				const box = dragRect(dragStartPointRef.current, currentScreen);
				setMarqueeRect(box);
			}
		}
		lastWorldPointRef.current = currentWorld;
	};
	const handlePointerUp = () => {
		if (!isInteractingRef.current) return;
		isInteractingRef.current = false;
		isDraggingElementsRef.current = false;
		isResizingRef.current = false;
		resizeHandleRef.current = null;
		resizeStartBoundsRef.current = null;
		dragStartWorldRef.current = null;
		dragStartElementsRef.current.clear();
		if (activeTool === "marker" && drawingPoints.length > 1) {
			const newStroke = createMarkerStroke(`stroke_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, drawingPoints, markerWidth, markerColor);
			updateElements((prev) => [...prev, newStroke]);
			setDrawingPoints([]);
		}
		if (activeTool === "select" && marqueeRect) {
			const worldBox = dragRect(screenToWorld(marqueeRect.x, marqueeRect.y, viewport), screenToWorld(marqueeRect.x + marqueeRect.width, marqueeRect.y + marqueeRect.height, viewport));
			const caught = elements.filter((el) => el.x >= worldBox.x && el.y >= worldBox.y && el.x + (el.width ?? 100) <= worldBox.x + worldBox.width && el.y + (el.height ?? 100) <= worldBox.y + worldBox.height).map((e) => e.id);
			setSelectedIds(caught);
			setMarqueeRect(null);
		}
		dragStartPointRef.current = null;
		lastWorldPointRef.current = null;
		isAltDragRef.current = false;
	};
	const cursor = activeTool === "hand" ? "grab" : activeTool === "marker" ? "crosshair" : activeTool === "eraser" ? "cell" : "default";
	const svgContent = h("g", { className: "dsh-svg-elements-group" }, ...elements.filter((el) => el.kind === "stroke").map((s) => h(MarkerStroke, {
		key: s.id,
		id: s.id,
		points: (s.points ?? []).map(([px, py]) => [px + s.x, py + s.y]),
		width: s.strokeWidth ?? 4,
		color: s.color ?? DEFAULT_MARKER_COLOR,
		isSelected: selectedIds.includes(s.id),
		onSelect: (id) => {
			if (id) setSelectedIds([id]);
		},
		onPointerDown: (strokeId, e) => {
			if (strokeId) handleElementPointerDown(strokeId, e);
		}
	})), drawingPoints.length > 1 ? h("path", {
		className: "dsh-marker-preview",
		d: generateMarkerOutlinePath(drawingPoints, markerWidth),
		fill: markerColor,
		opacity: .85
	}) : null);
	const domContent = h("div", { className: "dsh-dom-elements-group" }, ...elements.filter((el) => el.kind !== "stroke").map((el) => {
		const isSelected = selectedIds.includes(el.id);
		if (el.kind === "sticky") return h(StickyNote, {
			key: el.id,
			id: el.id,
			x: el.x,
			y: el.y,
			width: el.width,
			height: el.height,
			text: el.text ?? "",
			color: el.color,
			isSelected,
			onSelect: (id, shift) => {
				setSelectedIds((prev) => shift ? prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id] : [id]);
			},
			onPointerDown: handleElementPointerDown,
			onChangeText: (id, text) => {
				updateElements((prev) => prev.map((e) => e.id === id ? {
					...e,
					text
				} : e));
			},
			onChangeColor: (id, color) => {
				updateElements((prev) => prev.map((e) => e.id === id ? {
					...e,
					color
				} : e));
			}
		});
		if (el.kind === "shape") return h(ShapeElement, {
			key: el.id,
			id: el.id,
			shapeType: el.shapeType ?? "rect",
			x: el.x,
			y: el.y,
			width: el.width,
			height: el.height,
			text: el.text ?? "",
			color: el.color,
			isSelected,
			onSelect: (id, shift) => {
				setSelectedIds((prev) => shift ? prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id] : [id]);
			},
			onPointerDown: handleElementPointerDown,
			onChangeText: (id, text) => {
				updateElements((prev) => prev.map((e) => e.id === id ? {
					...e,
					text
				} : e));
			}
		});
		return null;
	}), ...elements.filter((el) => el.kind !== "stroke" && el.updatedBy === "agent").map((el) => h("div", {
		key: `agent-${el.id}`,
		className: "dsh-cc-agent",
		style: {
			position: "absolute",
			left: `${el.x}px`,
			top: `${el.y}px`,
			width: `${el.width}px`,
			height: `${el.height}px`,
			border: "2px solid var(--dsh-accent, #38bdf8)",
			borderRadius: "10px",
			boxSizing: "border-box",
			pointerEvents: "none"
		}
	}, h("span", { className: "dsh-cc-agent-chip" }, agentBadgeLabel ?? "agent"))), selectionBounds && selectedIds.length > 0 ? h(SelectionOverlay, {
		bounds: selectionBounds,
		zoom: viewport.zoom,
		onResizeStart: handleResizeStart
	}) : null);
	return h("div", {
		className: `dsh-cult-canvas-board ${className ?? ""}`,
		style: {
			position: "relative",
			width: "100%",
			height: "100%",
			minHeight: "560px",
			overflow: "hidden"
		}
	}, h(CanvasToolbar, {
		activeTool,
		onSelectTool: setActiveTool,
		canStartProject,
		onStartProject: startProject,
		startProjectLabel,
		markerColor,
		onSelectMarkerColor: setMarkerColor,
		markerWidth,
		onSelectMarkerWidth: setMarkerWidth,
		selectedShape,
		onSelectShape: setSelectedShape,
		stickyColor,
		onSelectStickyColor: setStickyColor
	}), h(CanvasViewport, {
		viewport,
		gridSize,
		onViewportChange: setViewport,
		svgContent,
		domContent,
		marqueeBounds: marqueeRect,
		cursor,
		onPointerDown: handlePointerDown,
		onPointerMove: handlePointerMove,
		onPointerUp: handlePointerUp
	}), h(CanvasMinimap, {
		elements,
		viewport,
		onPanTo: (wx, wy) => {
			setViewport((v) => ({
				...v,
				x: -wx * v.zoom + 600,
				y: -wy * v.zoom + 400
			}));
		}
	}), activeTool === "eraser" ? h(EraserSweep, {
		strokes: elements.filter((el) => el.kind === "stroke").map((el) => ({
			id: el.id,
			box: {
				x: el.x,
				y: el.y,
				width: el.width,
				height: el.height
			},
			stroke: {
				v: 1,
				size: el.strokeWidth ?? 4,
				w: el.origWidth ?? el.width,
				h: el.origHeight ?? el.height,
				points: el.points ?? []
			}
		})),
		isActive: true,
		onDeleteStrokes: (hits) => {
			removedIdsRef.current.push(...hits);
			updateElements((prev) => prev.filter((e) => !hits.includes(e.id)));
		}
	}) : null);
}
// src/presentation/components/CultCanvasTab.ts
/**
* The Cult Canvas tab body in the right sidebar.
*
* Owns the contract between the panel and the DSH shell: which session's board
* to show, the live sync endpoint, the plugin settings the board obeys, and what
* "Start project" does. The board itself stays presentation-only.
*
* @module @local/dsh-cult-canvas/presentation/components/CultCanvasTab
*/
/** Settings namespace owned by the Host half (cordis.patch.yml entry id). */
const SETTINGS_NAMESPACE$1 = "cult-canvas";
/** Live sync endpoint of one session's board. */
function canvasSyncUrl(sessionId) {
	return sessionId === void 0 ? `${CANVAS_API_ROUTE}/state` : `${CANVAS_API_ROUTE}/state?session=${encodeURIComponent(sessionId)}`;
}
function CultCanvasTab(props) {
	const { sessionId, useTabInfo, t, settings, uiWorkspace, workspaces } = props;
	const visible = (useTabInfo?.())?.tab?.visible !== false;
	const [snapshot, setSnapshot] = useState(() => settings?.getSnapshot());
	const [error, setError] = useState(null);
	useEffect(() => settings?.subscribe(() => setSnapshot(settings.getSnapshot())), []);
	const label = (key) => t ? t(key) : key;
	const syncUrl = canvasSyncUrl(sessionId);
	const snapEnabled = snapshot?.value?.["snapToGrid"] !== false;
	const gridSize = typeof snapshot?.value?.["gridSize"] === "number" ? snapshot.value["gridSize"] : 20;
	const startProject = async (board) => {
		if (!uiWorkspace || typeof uiWorkspace.startSession !== "function") return;
		setError(null);
		let workspace;
		try {
			const response = await fetch(`${CANVAS_API_ROUTE}/flush${sessionId === void 0 ? "" : `?session=${encodeURIComponent(sessionId)}`}`, { method: "POST" });
			if (response.ok) {
				const body = await response.json();
				workspace = typeof body.workspace === "string" ? body.workspace : void 0;
			}
		} catch {}
		const options = {
			prompt: buildProjectBrief(board, workspace),
			whenDraftExists: "append"
		};
		let workspaceId;
		if (workspace !== void 0 && typeof workspaces?.create === "function") try {
			workspaceId = (await workspaces.create({ path: workspace }))?.id;
		} catch {}
		try {
			uiWorkspace.startSession(workspaceId, options);
		} catch (failure) {
			setError(String(failure));
		}
	};
	return h("div", {
		"data-cult-canvas-tab": "",
		style: {
			display: "flex",
			flexDirection: "column",
			height: "100%",
			minHeight: 0
		}
	}, h(CultCanvasBoard, {
		syncUrl,
		visible,
		snapEnabled,
		gridSize,
		canStartProject: typeof uiWorkspace?.startSession === "function",
		onStartProject: startProject,
		startProjectLabel: label("toolbar.startProject"),
		agentBadgeLabel: label("badge.agent")
	}), error === null ? null : h("p", {
		role: "status",
		style: {
			margin: 0,
			padding: "4px 8px",
			fontSize: 12,
			color: "var(--dsw-alias-state-error-primary)"
		}
	}, error));
}
/** Build the injection closure one tab registration uses. */
function canvasTabInject(ctx) {
	const form = ctx.configForms?.get(SETTINGS_NAMESPACE$1);
	const workspaces = ctx.workspaces ?? ctx.get?.("workspaces");
	return (sessionId) => ({
		sessionId: sessionId ?? ctx.uiWorkspace?.getActiveSession?.()?.id,
		settings: form === void 0 ? void 0 : {
			getSnapshot: () => form.getSnapshot(),
			subscribe: (listener) => form.subscribe(listener)
		},
		uiWorkspace: ctx.uiWorkspace,
		workspaces
	});
}
// src/presentation/styles.ts
/**
* Comprehensive Client Stylesheet for DSH Cult Canvas
*
* Provides styling for:
* - Canvas root, viewport, infinite dot grid
* - Left toolbar and flyout palettes
* - Freehand marker strokes and selection halos
* - Sticky notes with drop shadow and typography
* - Geometric shapes with SVG and CSS backgrounds
* - Selection bounds and 8 resize handles
* - Eraser cursor indicator and interaction overlay
* - Minimap with camera viewport
* - Agent toolview cards for slot tool.call.toolview
* - Pipeline nodes, ports, and status badges
*
* @module @local/dsh-cult-canvas/presentation/styles
*/
const CANVAS_CLIENT_STYLES = `
/* ==========================================================================
   DSH Cult Canvas Root & Infinite Workspace
   ========================================================================== */

:root {
	--dsh-canvas-bg: #0f141c;
	--dsh-canvas-fg: #e2e8f0;
	--dsh-canvas-dot: rgba(255, 255, 255, 0.08);
	--dsh-accent: #38bdf8;
	--dsh-accent-hover: #0ea5e9;
	--dsh-border-color: rgba(255, 255, 255, 0.12);
	--dsh-card-bg: #1e293b;
	--dsh-font-handwriting: "Cult Canvas Shantell", "Caveat", "Comic Sans MS", cursive, sans-serif;
	--dsh-font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.dsh-cult-canvas-board {
	position: relative;
	width: 100%;
	height: 100%;
	min-height: 560px;
	overflow: hidden;
	background-color: var(--dsh-canvas-bg);
	color: var(--dsh-canvas-fg);
	font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
	user-select: none;
}

.dsh-cult-canvas-root {
	position: relative;
	width: 100%;
	height: 100%;
	min-height: 480px;
	overflow: hidden;
	background-color: var(--dsh-canvas-bg);
	user-select: none;
}

.dsh-cult-canvas-viewport {
	position: absolute;
	inset: 0;
	transform-origin: 0 0;
	will-change: transform;
}

.dsh-cult-canvas-svg-layer {
	position: absolute;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	pointer-events: none;
	overflow: visible;
}

.dsh-cult-canvas-dom-layer {
	position: absolute;
	top: 0;
	left: 0;
	width: 0;
	height: 0;
	overflow: visible;
	pointer-events: auto;
}

.dsh-cult-canvas-preview-layer {
	position: absolute;
	top: 0;
	left: 0;
	width: 0;
	height: 0;
	overflow: visible;
	pointer-events: none;
}

/* ==========================================================================
   Left Toolbar & Flyout Panels
   ========================================================================== */

.dsh-cult-canvas-toolbar {
	position: absolute;
	top: 20px;
	left: 20px;
	display: flex;
	flex-direction: column;
	gap: 6px;
	background-color: rgba(15, 23, 42, 0.92);
	backdrop-filter: blur(10px);
	padding: 8px;
	border-radius: 12px;
	box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
	border: 1px solid var(--dsh-border-color);
	z-index: 50;
}

.dsh-toolbar-btn {
	width: 38px;
	height: 38px;
	display: flex;
	align-items: center;
	justify-content: center;
	background-color: transparent;
	color: #94a3b8;
	border: none;
	border-radius: 8px;
	cursor: pointer;
	font-size: 16px;
	font-weight: 600;
	transition: all 0.15s ease;
}

.dsh-toolbar-btn:hover {
	background-color: rgba(255, 255, 255, 0.1);
	color: #f1f5f9;
}

.dsh-toolbar-btn.active {
	background-color: var(--dsh-accent);
	color: #0f172a;
	box-shadow: 0 0 12px rgba(56, 189, 248, 0.4);
}

.dsh-toolbar-flyout {
	position: absolute;
	background-color: rgba(15, 23, 42, 0.96);
	backdrop-filter: blur(12px);
	padding: 10px;
	border-radius: 10px;
	border: 1px solid var(--dsh-border-color);
	box-shadow: 0 12px 30px rgba(0, 0, 0, 0.6);
	z-index: 60;
}

/* ==========================================================================
   Freehand Marker Strokes
   ========================================================================== */

.dsh-cult-canvas-marker-stroke {
	cursor: pointer;
}

.dsh-marker-hit-area {
	pointer-events: stroke;
}

.dsh-marker-fill {
	transition: fill 0.15s ease;
}

.dsh-marker-selection-halo {
	animation: stroke-pulse 2s ease-in-out infinite alternate;
}

@keyframes stroke-pulse {
	0% { opacity: 0.6; }
	100% { opacity: 1; }
}

/* ==========================================================================
   Sticky Notes
   ========================================================================== */

.dsh-cult-canvas-element {
	position: absolute;
	box-sizing: border-box;
	border-radius: 6px;
	cursor: move;
	transition: box-shadow 0.15s ease;
}

.dsh-cult-canvas-sticky {
	background-color: #FFF59A;
	color: #3a3500;
	padding: 14px;
	border-radius: 4px;
	box-shadow: 0 8px 18px rgba(0, 0, 0, 0.38);
	font-family: var(--dsh-font-handwriting);
	line-height: 1.4;
	white-space: pre-wrap;
	word-break: break-word;
}

.dsh-cult-canvas-sticky.selected {
	outline: 2px solid var(--dsh-accent);
	outline-offset: 2px;
}

.dsh-sticky-textarea {
	width: 100%;
	height: 100%;
	background: transparent;
	border: none;
	outline: none;
	resize: none;
	font-family: inherit;
	font-size: inherit;
	color: inherit;
}

/* ==========================================================================
   Geometric Shapes
   ========================================================================== */

.dsh-cult-canvas-shape {
	position: absolute;
	box-sizing: border-box;
}

.dsh-cult-canvas-shape.selected {
	outline: 2px solid var(--dsh-accent);
	outline-offset: 2px;
}

.dsh-shape-text-wrapper {
	position: absolute;
	inset: 0;
	display: flex;
	align-items: center;
	box-sizing: border-box;
}

/* ==========================================================================
   Selection Marquee & Resize Handles
   ========================================================================== */

.dsh-cult-canvas-selection-box {
	position: absolute;
	border: 1.5px dashed var(--dsh-accent);
	box-sizing: border-box;
	pointer-events: none;
}

.dsh-resize-handle {
	position: absolute;
	background-color: #ffffff;
	border: 1.5px solid var(--dsh-accent);
	border-radius: 2px;
	box-sizing: border-box;
	pointer-events: auto;
	box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.dsh-selection-marquee {
	position: absolute;
	border: 1px solid var(--dsh-accent);
	background-color: rgba(56, 189, 248, 0.15);
	pointer-events: none;
	z-index: 40;
}

/* ==========================================================================
   Minimap
   ========================================================================== */

.dsh-cult-canvas-minimap {
	position: absolute;
	bottom: 20px;
	right: 20px;
	width: 180px;
	height: 120px;
	background-color: rgba(15, 23, 42, 0.88);
	border: 1px solid var(--dsh-border-color);
	border-radius: 8px;
	overflow: hidden;
	cursor: crosshair;
	backdrop-filter: blur(8px);
	box-shadow: 0 8px 20px rgba(0, 0, 0, 0.5);
	z-index: 45;
}

.dsh-minimap-camera {
	position: absolute;
	border: 1.5px solid var(--dsh-accent);
	background-color: rgba(56, 189, 248, 0.18);
	border-radius: 2px;
	pointer-events: none;
}

/* ==========================================================================
   Eraser Sweep
   ========================================================================== */

.dsh-cult-canvas-eraser-overlay {
	position: absolute;
	inset: 0;
	cursor: crosshair;
	touch-action: none;
	z-index: 42;
}

.dsh-eraser-cursor-indicator {
	border-radius: 50%;
	border: 1.5px solid rgba(239, 68, 68, 0.85);
	background-color: rgba(239, 68, 68, 0.18);
	pointer-events: none;
	transform: translate3d(0, 0, 0);
}

/* ==========================================================================
   Toolview Cards (slot tool.call.toolview)
   ========================================================================== */

.dsh-cult-canvas-toolview {
	background-color: rgba(15, 23, 42, 0.9);
	border: 1px solid var(--dsh-border-color);
	border-radius: 8px;
	padding: 10px 14px;
	margin: 6px 0;
	font-size: 12px;
	color: #e2e8f0;
	font-family: var(--dsh-font-mono);
}

.dsh-toolview-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	cursor: pointer;
	user-select: none;
}

.dsh-toolview-body {
	margin-top: 8px;
	padding-top: 8px;
	border-top: 1px solid rgba(255, 255, 255, 0.08);
	max-height: 260px;
	overflow: auto;
}

/* ==========================================================================
   Edges, Pipeline Nodes & Ports
   ========================================================================== */

.dsh-cult-canvas-edge {
	fill: none;
	stroke: var(--dsh-edge-color, #64748b);
	stroke-width: 2px;
	transition: stroke 0.15s ease, stroke-width 0.15s ease;
}

.dsh-cult-canvas-edge:hover,
.dsh-cult-canvas-edge.selected {
	stroke: var(--dsh-accent);
	stroke-width: 3px;
}

.dsh-cult-canvas-node {
	background: var(--dsh-node-bg, #1e293b);
	border: 1px solid var(--dsh-node-border, #334155);
	border-radius: 8px;
	box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3);
	display: flex;
	flex-direction: column;
	overflow: hidden;
}

.dsh-cult-canvas-node-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 8px 12px;
	background: #0f172a;
	border-bottom: 1px solid #334155;
	font-size: 12px;
	font-weight: 600;
	letter-spacing: 0.05em;
	text-transform: uppercase;
}

.dsh-cult-canvas-node-body {
	padding: 12px;
	font-size: 13px;
	flex: 1;
	overflow: auto;
}

.dsh-cult-canvas-port {
	width: 10px;
	height: 10px;
	border-radius: 50%;
	background: #94a3b8;
	border: 2px solid #1e293b;
	cursor: crosshair;
	position: absolute;
	transition: transform 0.15s ease, background-color 0.15s ease;
}

.dsh-cult-canvas-port:hover {
	transform: scale(1.3);
	background: var(--dsh-accent);
}

.dsh-cult-canvas-port.input { left: -6px; }
.dsh-cult-canvas-port.output { right: -6px; }

.dsh-cult-canvas-status-badge {
	font-size: 10px;
	padding: 2px 6px;
	border-radius: 9999px;
	font-weight: 500;
}

.dsh-cult-canvas-status-idle { background: #334155; color: #94a3b8; }
.dsh-cult-canvas-status-queued { background: #854d0e; color: #fef08a; }
.dsh-cult-canvas-status-running { background: #1e40af; color: #93c5fd; animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
.dsh-cult-canvas-status-completed { background: #166534; color: #86efac; }
.dsh-cult-canvas-status-failed { background: #991b1b; color: #fca5a5; }

.dsh-cc-agent {
	box-shadow: 0 0 0 1px var(--dsh-accent, #38bdf8) inset;
}

.dsh-cc-agent-chip {
	position: absolute;
	top: -10px;
	left: -2px;
	padding: 1px 6px;
	border-radius: 9999px;
	font-size: 10px;
	font-weight: 600;
	line-height: 1.4;
	letter-spacing: 0.02em;
	text-transform: lowercase;
	background: var(--dsh-accent, #38bdf8);
	color: #0b1220;
	white-space: nowrap;
}

@keyframes pulse {
	0%, 100% { opacity: 1; }
	50% { opacity: 0.5; }
}
`;
// src/presentation/client.ts
/**
* Frontend Whiteboard Client Shell for DSH Cult Canvas
*
* Implements:
* - Cordis frontend module lifecycle (classic-script bundle, module-table require)
* - A right-sidebar tab type with a guide card on the Start screen
* - A keyed settings card on the plugin's page in Settings → Plugins
* - Toolview card slots for every canvas agent tool
* - Multi-language locale dictionary registration
* - Dynamic style injection with clean disposer teardown
*
* @module @local/dsh-cult-canvas/presentation/client
*/
/** Canonical client plugin namespace. */
const CLIENT_NAMESPACE = "cult-canvas";
/** Settings namespace; the Host entry id in cordis.patch.yml. */
const SETTINGS_NAMESPACE = "cult-canvas";
/** Bundle package name: the key the Plugins page dispatches the card by. */
const BUNDLE_PACKAGE = "@local/dsh-cult-canvas";
/** Tab type identity; the key its body registers under. */
const CANVAS_TAB_ID = "@local/dsh-cult-canvas/canvas";
/** Tab kind users open from the guide card. */
const CANVAS_TAB_KIND = "cult-canvas";
/** Plugin style attribute marker for deduplication. */
const CLIENT_STYLE_ATTR = "data-dsh-plugin";
/** Tool names handled by custom toolview card slots. */
const CANVAS_TOOL_NAMES = [
	"canvas_get_state",
	"canvas_create_element",
	"canvas_update_element",
	"canvas_delete_element",
	"canvas_connect",
	"canvas_layout_elements",
	"canvas_run_pipeline",
	"canvas_node_status",
	"canvas_import_export",
	"canvas_get_bible",
	"canvas_update_bible",
	"canvas_query_elements"
];
/** Injected services required by the client plugin. */
const inject = [
	"slots",
	"locale",
	"sidebarRightTabs",
	"configForms",
	"uiWorkspace"
];
/**
* Apply function for Cordis client lifecycle.
*/
function apply(ctx) {
	const t = ctx.locale.bind(CLIENT_NAMESPACE);
	ctx.effect(() => ctx.locale.register(CLIENT_NAMESPACE, CANVAS_LOCALES), "cult-canvas: locales");
	ctx.effect(() => {
		if (typeof document === "undefined") return () => {};
		for (const prev of document.querySelectorAll(`style[${CLIENT_STYLE_ATTR}="${CLIENT_NAMESPACE}"]`)) if (typeof prev.remove === "function") prev.remove();
		const style = document.createElement("style");
		if (typeof style.setAttribute === "function") style.setAttribute(CLIENT_STYLE_ATTR, CLIENT_NAMESPACE);
		if (style.dataset) style.dataset["dshPlugin"] = CLIENT_NAMESPACE;
		style[CLIENT_STYLE_ATTR] = CLIENT_NAMESPACE;
		style.textContent = CANVAS_CLIENT_STYLES;
		if (document.head && typeof document.head.append === "function") document.head.append(style);
		else if (document.head && typeof document.head.appendChild === "function") document.head.appendChild(style);
		return () => {
			if (typeof style.remove === "function") style.remove();
		};
	}, "cult-canvas: styles");
	ctx.inject?.(["sidebarRightTabs"], (tabsCtx) => {
		const tabs = tabsCtx.sidebarRightTabs;
		if (!tabs) return;
		tabsCtx.effect(() => tabs.register({
			id: CANVAS_TAB_ID,
			kind: CANVAS_TAB_KIND,
			title: () => t("tab.title"),
			guide: [{
				id: "board",
				order: 25,
				title: () => t("tab.title"),
				description: () => t("guide.description"),
				icon: CanvasIcon
			}]
		}), "cult-canvas: sidebar tab type");
	});
	const injectTab = canvasTabInject(ctx);
	ctx.slots.inject("sidebar.right.pane.tab", function* () {
		yield ctx.slots.register({
			name: "sidebar.right.pane.tab",
			key: CANVAS_TAB_ID,
			locale: CLIENT_NAMESPACE,
			inject: injectTab
		}, CultCanvasTab);
	});
	const form = ctx.configForms?.get(SETTINGS_NAMESPACE);
	const offSettings = ctx.configForms?.whileServed([SETTINGS_NAMESPACE], () => {
		ctx.slots.inject("plugins.bundle.config", function* () {
			yield ctx.slots.register({
				name: "plugins.bundle.config",
				key: BUNDLE_PACKAGE,
				locale: CLIENT_NAMESPACE,
				inject: () => ({
					getSnapshot: () => form?.getSnapshot(),
					subscribe: (listener) => form?.subscribe(listener) ?? (() => {}),
					write: (field, value) => form?.set(field, value) ?? Promise.resolve(false)
				})
			}, CanvasSettingsCard);
		});
		return () => {};
	});
	if (offSettings) ctx.effect(() => () => offSettings(), "cult-canvas: settings card");
	ctx.slots.inject("tool.call.toolview", function* () {
		for (const toolName of CANVAS_TOOL_NAMES) yield ctx.slots.register({
			name: "tool.call.toolview",
			key: toolName,
			locale: CLIENT_NAMESPACE
		}, CanvasToolView);
	});
}
/** Factory function creating client plugin instance with optional React binding. */
function clientPluginFactory(requireFn) {
	if (typeof requireFn === "function") try {
		const reactInstance = requireFn("react");
		if (reactInstance) setReact(reactInstance);
	} catch {}
	return {
		id: BUNDLE_PACKAGE,
		inject,
		apply
	};
}
/** Client plugin module descriptor. */
const clientPlugin = {
	id: BUNDLE_PACKAGE,
	inject,
	apply
};
exports.BUNDLE_PACKAGE = BUNDLE_PACKAGE;
exports.CANVAS_TAB_ID = CANVAS_TAB_ID;
exports.CANVAS_TAB_KIND = CANVAS_TAB_KIND;
exports.CANVAS_TOOL_NAMES = CANVAS_TOOL_NAMES;
exports.CLIENT_NAMESPACE = CLIENT_NAMESPACE;
exports.CLIENT_STYLE_ATTR = CLIENT_STYLE_ATTR;
exports.SETTINGS_NAMESPACE = SETTINGS_NAMESPACE;
exports.apply = apply;
exports.clientPlugin = clientPlugin;
exports.default = clientPlugin;
exports.clientPluginFactory = clientPluginFactory;
exports.inject = inject;

return module.exports.clientPluginFactory ? module.exports.clientPluginFactory(require) : module.exports; }});