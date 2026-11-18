/**
 * WCAG 2.x relative luminance / contrast helpers for board validation.
 */

export const CONTRAST_AA_NORMAL = 4.5;
export const CONTRAST_AA_LARGE = 3;
export const CONTRAST_AA_UI = 3;

/** Card chrome fallbacks mirrored from CardShape.tsx (CSS var fallbacks). */
export const CARD_CHROME = {
	background: "#f1f2f3",
	border: "rgba(15, 23, 42, 0.16)",
	title: "#1d1d1d",
	kind: "#4b5563",
	excerpt: "#1d1d1d",
	agentChipBg: "#1d4ed8",
	agentChipFg: "#ffffff",
} as const;

/** Approximate tldraw sticky / geo named colors → fill hex. */
export const TLDRAW_COLOR_FILLS: Record<string, string> = {
	black: "#1d1d1d",
	grey: "#9ca3af",
	"light-violet": "#c4b5fd",
	violet: "#7c3aed",
	blue: "#3b82f6",
	"light-blue": "#93c5fd",
	yellow: "#facc15",
	orange: "#fb923c",
	green: "#22c55e",
	"light-green": "#86efac",
	"light-red": "#fca5a5",
	red: "#ef4444",
	white: "#ffffff",
};

/** Text on sticky / geo fills — prefer dark ink on light fills. */
export const TLDRAW_COLOR_INK: Record<string, string> = {
	black: "#ffffff",
	grey: "#111827",
	"light-violet": "#1d1d1d",
	violet: "#ffffff",
	blue: "#ffffff",
	"light-blue": "#1d1d1d",
	yellow: "#1d1d1d",
	orange: "#1d1d1d",
	green: "#1d1d1d",
	"light-green": "#1d1d1d",
	"light-red": "#1d1d1d",
	red: "#ffffff",
	white: "#1d1d1d",
};

export interface Rgb {
	r: number;
	g: number;
	b: number;
	a: number;
}

/** Parse #rgb / #rrggbb / rgb() / rgba() into channels (0–255). */
export function parseCssColor(raw: string): Rgb | undefined {
	const value = raw.trim().toLowerCase();
	if (!value) return undefined;
	const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value);
	if (hex) {
		const h = hex[1]!;
		if (h.length === 3) {
			return {
				r: Number.parseInt(h[0]! + h[0]!, 16),
				g: Number.parseInt(h[1]! + h[1]!, 16),
				b: Number.parseInt(h[2]! + h[2]!, 16),
				a: 1,
			};
		}
		return {
			r: Number.parseInt(h.slice(0, 2), 16),
			g: Number.parseInt(h.slice(2, 4), 16),
			b: Number.parseInt(h.slice(4, 6), 16),
			a: 1,
		};
	}
	const rgba =
		/^rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)(?:\s*,\s*([0-9.]+))?\s*\)$/.exec(
			value,
		);
	if (rgba) {
		return {
			r: Number(rgba[1]),
			g: Number(rgba[2]),
			b: Number(rgba[3]),
			a: rgba[4] === undefined ? 1 : Number(rgba[4]),
		};
	}
	return undefined;
}

function channelLuminance(channel: number): number {
	const c = channel / 255;
	return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** Relative luminance (0–1) per WCAG. */
export function relativeLuminance(rgb: Rgb): number {
	return (
		0.2126 * channelLuminance(rgb.r) +
		0.7152 * channelLuminance(rgb.g) +
		0.0722 * channelLuminance(rgb.b)
	);
}

/** Contrast ratio between two opaque colors (≥ 1). */
export function contrastRatio(foreground: Rgb, background: Rgb): number {
	const l1 = relativeLuminance(foreground);
	const l2 = relativeLuminance(background);
	const lighter = Math.max(l1, l2);
	const darker = Math.min(l1, l2);
	return (lighter + 0.05) / (darker + 0.05);
}

export function contrastRatioCss(
	foreground: string,
	background: string,
): number | undefined {
	const fg = parseCssColor(foreground);
	const bg = parseCssColor(background);
	if (!fg || !bg) return undefined;
	return contrastRatio(fg, bg);
}

export function meetsAa(
	ratio: number,
	kind: "normal" | "large" | "ui" = "normal",
): boolean {
	if (kind === "normal") return ratio >= CONTRAST_AA_NORMAL;
	return ratio >= CONTRAST_AA_LARGE;
}

export interface ContrastIssue {
	code: string;
	message: string;
	ratio?: number;
	required?: number;
}

/** Validate CardShape fallback chrome pairs. */
export function validateCardChromeContrast(): ContrastIssue[] {
	const issues: ContrastIssue[] = [];
	const pairs: Array<{
		fg: string;
		bg: string;
		kind: "normal" | "large" | "ui";
		label: string;
		code: string;
	}> = [
		{
			fg: CARD_CHROME.title,
			bg: CARD_CHROME.background,
			kind: "normal",
			label: "card title",
			code: "low_contrast_card_chrome",
		},
		{
			fg: CARD_CHROME.excerpt,
			bg: CARD_CHROME.background,
			kind: "normal",
			label: "card excerpt",
			code: "low_contrast_card_chrome",
		},
		{
			fg: CARD_CHROME.kind,
			bg: CARD_CHROME.background,
			kind: "normal",
			label: "card kind",
			code: "low_contrast_card_chrome",
		},
		{
			fg: CARD_CHROME.agentChipFg,
			bg: CARD_CHROME.agentChipBg,
			kind: "large",
			label: "agent chip",
			code: "low_contrast_card_chrome",
		},
	];
	for (const pair of pairs) {
		const ratio = contrastRatioCss(pair.fg, pair.bg);
		if (ratio === undefined) continue;
		const required =
			pair.kind === "normal" ? CONTRAST_AA_NORMAL : CONTRAST_AA_LARGE;
		if (!meetsAa(ratio, pair.kind)) {
			issues.push({
				code: pair.code,
				message: `${pair.label}: contrast ${ratio.toFixed(2)}:1 < ${required}:1 (${pair.fg} on ${pair.bg})`,
				ratio,
				required,
			});
		}
	}
	return issues;
}

/**
 * Check a named tldraw color against its fill/ink pairing.
 * Sticky/geo labels are treated as large UI text (AA large ≥ 3:1).
 */
export function validateTldrawNamedColor(colorName: string): ContrastIssue[] {
	const fill = TLDRAW_COLOR_FILLS[colorName];
	const ink = TLDRAW_COLOR_INK[colorName];
	if (!fill || !ink) return [];
	const ratio = contrastRatioCss(ink, fill);
	if (ratio === undefined) return [];
	if (meetsAa(ratio, "large")) return [];
	return [
		{
			code: "low_contrast_text",
			message: `tldraw color "${colorName}": ink/fill contrast ${ratio.toFixed(2)}:1 < ${CONTRAST_AA_LARGE}:1`,
			ratio,
			required: CONTRAST_AA_LARGE,
		},
	];
}
