/**
 * OpenAI-compatible Generation Provider
 */

import type {
	GenerationProvider,
	ImageGenerationParams,
	ImageGenerationResult,
	VideoGenerationParams,
	VideoGenerationResult,
	AudioGenerationParams,
	AudioGenerationResult,
} from "./generation-provider.js";

export interface OpenAIProviderConfig {
	apiKey?: string;
	baseUrl?: string;
	fetch?: typeof fetch;
}

export class OpenAIProvider implements GenerationProvider {
	private readonly apiKey: string;
	private readonly baseUrl: string;
	private readonly fetchImpl: typeof fetch;

	constructor(config: OpenAIProviderConfig = {}) {
		this.apiKey =
			config.apiKey ||
			(typeof process !== "undefined" ? process.env?.OPENAI_API_KEY || "" : "");
		this.baseUrl = (config.baseUrl || "https://api.openai.com/v1").replace(
			/\/+$/,
			"",
		);
		this.fetchImpl = config.fetch || globalThis.fetch;
	}

	async generateImage(
		params: ImageGenerationParams,
		signal?: AbortSignal,
	): Promise<ImageGenerationResult> {
		if (signal?.aborted) {
			throw new Error("generateImage aborted by signal");
		}

		const endpoint = `${this.baseUrl}/images/generations`;
		const res = await this.fetchImpl(endpoint, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${this.apiKey}`,
			},
			body: JSON.stringify({
				prompt: params.prompt,
				n: params.n ?? 1,
				size: params.size ?? "1024x1024",
			}),
			signal,
		});

		if (!res.ok) {
			const errBody = await res.text().catch(() => "");
			throw new Error(
				`OpenAI image generation failed with HTTP ${res.status}: ${errBody}`,
			);
		}

		const data = (await res.json()) as {
			data?: Array<{ url?: string; b64_json?: string }>;
		};
		const item = data.data?.[0];
		const url = item?.url;
		const dataUrl = item?.b64_json
			? `data:image/png;base64,${item.b64_json}`
			: undefined;
		const assetId = `openai_img_${Date.now()}`;

		return {
			assetId,
			url,
			dataUrl,
			metadata: { prompt: params.prompt, raw: item },
		};
	}

	async generateVideo(
		params: VideoGenerationParams,
		signal?: AbortSignal,
	): Promise<VideoGenerationResult> {
		if (signal?.aborted) {
			throw new Error("generateVideo aborted by signal");
		}

		// OpenAI-compatible video generation endpoint
		const endpoint = `${this.baseUrl}/videos/generations`;
		const res = await this.fetchImpl(endpoint, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${this.apiKey}`,
			},
			body: JSON.stringify({
				prompt: params.prompt,
				duration: params.duration ?? 5,
				ratio: params.ratio ?? "16:9",
			}),
			signal,
		});

		if (!res.ok) {
			const errBody = await res.text().catch(() => "");
			throw new Error(
				`OpenAI video generation failed with HTTP ${res.status}: ${errBody}`,
			);
		}

		const data = (await res.json()) as {
			id?: string;
			url?: string;
			assetId?: string;
		};
		const assetId = data.assetId || data.id || `openai_vid_${Date.now()}`;

		return {
			assetId,
			url: data.url,
			metadata: { prompt: params.prompt, raw: data },
		};
	}

	async generateAudio(
		params: AudioGenerationParams,
		signal?: AbortSignal,
	): Promise<AudioGenerationResult> {
		if (signal?.aborted) {
			throw new Error("generateAudio aborted by signal");
		}

		const endpoint = `${this.baseUrl}/audio/speech`;
		const res = await this.fetchImpl(endpoint, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${this.apiKey}`,
			},
			body: JSON.stringify({
				model: "tts-1",
				input: params.prompt,
				voice: params.voice ?? "alloy",
			}),
			signal,
		});

		if (!res.ok) {
			const errBody = await res.text().catch(() => "");
			throw new Error(
				`OpenAI speech synthesis failed with HTTP ${res.status}: ${errBody}`,
			);
		}

		const assetId = `openai_aud_${Date.now()}`;
		const arrayBuf = await res.arrayBuffer();
		const base64 = Buffer.from(arrayBuf).toString("base64");

		return {
			assetId,
			url: `data:audio/mp3;base64,${base64}`,
			metadata: { prompt: params.prompt, voice: params.voice ?? "alloy" },
		};
	}
}
