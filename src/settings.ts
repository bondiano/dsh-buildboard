/**
 * Host-half plugin settings for DSH Cult Canvas.
 *
 * Every field is `.volatile()`: it lives in the user's settings document and is
 * projected to the browser, but never joins the profile composition layer. The
 * automatic settings page stays disabled in `apply` via
 * `settings.configure({ auto: false })` — the Client half draws the card in
 * `plugins.bundle.config`, and a second page would duplicate it.
 *
 * @module @local/dsh-cult-canvas/src/settings
 */

import type { Volatile } from "@deepseek-ai/cordis";
import z from "@deepseek-ai/schemastery";

/** Settings namespace; equals the entry id in cordis.patch.yml. */
export const SETTINGS_NAMESPACE = "cult-canvas";

/** Media generation backends the pipeline can drive. */
export const GENERATION_PROVIDERS = ["mock", "openai", "wanx"] as const;

/** Selected media generation backend. */
export type GenerationProviderName = (typeof GENERATION_PROVIDERS)[number];

/**
 * Live configuration of the plugin.
 *
 * Volatile fields are browser preferences, not profile fields: the Host accepts
 * them through the settings form and keeps them out of cordis.patch.yml.
 */
export interface Config {
	/** Default canvas width used when a document does not carry one. */
	defaultCanvasWidth: Volatile<number>;
	/** Default canvas height used when a document does not carry one. */
	defaultCanvasHeight: Volatile<number>;
	/** Hard cap on elements in one board. */
	maxElements: Volatile<number>;
	/** Whether drags and resizes snap to `gridSize`. */
	snapToGrid: Volatile<boolean>;
	/** Grid step in world units. */
	gridSize: Volatile<number>;
	/** Media generation backend. */
	generationProvider: Volatile<GenerationProviderName>;
	/** API key for the selected backend. */
	generationApiKey: Volatile<string>;
	/** Base URL override for the selected backend. */
	generationBaseUrl: Volatile<string>;
}

/**
 * Schemastery schema of the plugin configuration.
 *
 * The schema type is inferred rather than annotated `z<Config>`: Cordis resolves
 * `volatile()` to `Volatile<T>` on the Host side, while the Client form receives
 * the already-resolved JSON value over the wire.
 */
export const Config = z.object({
	defaultCanvasWidth: z
		.natural()
		.min(100)
		.max(100_000)
		.default(8192)
		.volatile(),
	defaultCanvasHeight: z
		.natural()
		.min(100)
		.max(100_000)
		.default(8192)
		.volatile(),
	maxElements: z.natural().min(1).max(50_000).default(5000).volatile(),
	snapToGrid: z.boolean().default(true).volatile(),
	gridSize: z.natural().min(1).max(500).default(20).volatile(),
	generationProvider: z
		.union([...GENERATION_PROVIDERS])
		.default("mock")
		.volatile(),
	generationApiKey: z.string().default("").volatile(),
	generationBaseUrl: z.string().default("").volatile(),
});

/** Value the Client form reads over the wire from the namespace. */
export interface CanvasSettings {
	/** Resolved default canvas width. */
	defaultCanvasWidth: number;
	/** Resolved default canvas height. */
	defaultCanvasHeight: number;
	/** Resolved element cap. */
	maxElements: number;
	/** Resolved snap preference. */
	snapToGrid: boolean;
	/** Resolved grid step. */
	gridSize: number;
	/** Resolved generation backend. */
	generationProvider: GenerationProviderName;
	/** Resolved generation API key. */
	generationApiKey: string;
	/** Resolved generation base URL. */
	generationBaseUrl: string;
}
