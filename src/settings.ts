/**
 * Host-half plugin settings for Buildboard.
 * Volatile fields live in the user settings document, not the profile.
 * Browser client must not import this module — use domain/settings-ns.js.
 */
import type { Volatile } from "@deepseek-ai/cordis";
import z from "@deepseek-ai/schemastery";

export { SETTINGS_NAMESPACE } from "./domain/settings-ns.js";


export interface Config {
	maxCards: Volatile<number>;
	maxBoards: Volatile<number>;
	pollIntervalMs: Volatile<number>;
	tldrawLicenseKey: Volatile<string>;
}

export const Config = z.object({
	maxCards: z.natural().min(1).max(100_000).default(10_000).volatile(),
	maxBoards: z.natural().min(1).max(5_000).default(200).volatile(),
	pollIntervalMs: z.natural().min(250).max(30_000).default(2_000).volatile(),
	tldrawLicenseKey: z.string().default("").volatile(),
});

export interface BuildboardSettings {
	maxCards: number;
	maxBoards: number;
	pollIntervalMs: number;
	tldrawLicenseKey: string;
}

export const DEFAULT_SETTINGS: Readonly<BuildboardSettings> = Object.freeze({
	maxCards: 10_000,
	maxBoards: 200,
	pollIntervalMs: 2_000,
	tldrawLicenseKey: "",
});

export function resolveSettings(raw: unknown): BuildboardSettings {
	const input =
		typeof raw === "object" && raw !== null && !Array.isArray(raw)
			? (raw as Record<string, unknown>)
			: {};
	return {
		maxCards: clampInt(
			input["maxCards"],
			1,
			100_000,
			DEFAULT_SETTINGS.maxCards,
		),
		maxBoards: clampInt(
			input["maxBoards"],
			1,
			5_000,
			DEFAULT_SETTINGS.maxBoards,
		),
		pollIntervalMs: clampInt(
			input["pollIntervalMs"],
			250,
			30_000,
			DEFAULT_SETTINGS.pollIntervalMs,
		),
		tldrawLicenseKey:
			typeof input["tldrawLicenseKey"] === "string"
				? input["tldrawLicenseKey"].slice(0, 512)
				: "",
	};
}

function clampInt(
	value: unknown,
	min: number,
	max: number,
	fallback: number,
): number {
	const parsed =
		typeof value === "string" && value.trim() !== "" ? Number(value) : value;
	if (typeof parsed !== "number" || !Number.isInteger(parsed)) return fallback;
	return Math.min(max, Math.max(min, parsed));
}
