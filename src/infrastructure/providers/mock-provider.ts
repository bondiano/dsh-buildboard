/**
 * Deterministic Mock Media Generation Provider
 *
 * Provides reproducible, 100% offline generation for CI and unit tests,
 * including simulated latency, synthetic image data URLs, error injection,
 * and cooperative AbortSignal cancellation.
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

export interface MockGenerationProviderOptions {
	prefix?: string;
	latencyMs?: number;
	failureRate?: number;
	failOnPrompt?: string;
}

export class MockGenerationProvider implements GenerationProvider {
	private readonly prefix: string;
	private readonly latencyMs: number;
	private readonly failureRate: number;
	private readonly failOnPrompt?: string;

	constructor(
		optionsOrPrefix?: string | MockGenerationProviderOptions,
		latencyMs?: number,
	) {
		if (typeof optionsOrPrefix === "string") {
			this.prefix = optionsOrPrefix;
			this.latencyMs = latencyMs ?? 0;
			this.failureRate = 0;
		} else {
			const opts = optionsOrPrefix || {};
			this.prefix = opts.prefix ?? "mock_asset";
			this.latencyMs = opts.latencyMs ?? 0;
			this.failureRate = opts.failureRate ?? 0;
			this.failOnPrompt = opts.failOnPrompt;
		}
	}

	private async simulateWork(
		prompt: string,
		signal?: AbortSignal,
	): Promise<void> {
		if (signal?.aborted) {
			throw new Error("Generation aborted by signal");
		}

		if (this.failOnPrompt && prompt.includes(this.failOnPrompt)) {
			throw new Error(
				`Injected error for prompt matching: ${this.failOnPrompt}`,
			);
		}

		if (this.failureRate > 0 && Math.random() < this.failureRate) {
			throw new Error("Injected random generation failure");
		}

		if (this.latencyMs > 0) {
			await new Promise<void>((resolve, reject) => {
				if (signal?.aborted) {
					return reject(new Error("Generation aborted by signal"));
				}
				const timer = setTimeout(() => {
					if (signal) signal.removeEventListener("abort", onAbort);
					resolve();
				}, this.latencyMs);

				const onAbort = () => {
					clearTimeout(timer);
					reject(new Error("Generation aborted by signal"));
				};

				if (signal) {
					signal.addEventListener("abort", onAbort, { once: true });
				}
			});
		}
	}

	async generateImage(
		params: ImageGenerationParams,
		signal?: AbortSignal,
	): Promise<ImageGenerationResult> {
		await this.simulateWork(params.prompt, signal);

		const hash = Math.abs(this.hashCode(params.prompt));
		const assetId = `${this.prefix}_img_${hash}`;
		// Synthetic 1x1 transparent PNG data URL
		const dataUrl =
			"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

		return {
			assetId,
			url: `asset://${assetId}.png`,
			dataUrl,
			metadata: {
				prompt: params.prompt,
				ratio: params.ratio ?? "16:9",
				size: params.size ?? "1024x1024",
				references: params.references ?? [],
			},
		};
	}

	async generateVideo(
		params: VideoGenerationParams,
		signal?: AbortSignal,
	): Promise<VideoGenerationResult> {
		await this.simulateWork(params.prompt, signal);

		const hash = Math.abs(this.hashCode(params.prompt));
		const assetId = `${this.prefix}_vid_${hash}`;
		const tailPickAssetId = `${this.prefix}_tail_${hash}`;

		return {
			assetId,
			url: `asset://${assetId}.mp4`,
			tailPickAssetId,
			metadata: {
				prompt: params.prompt,
				duration: params.duration ?? 5,
				resolution: params.resolution ?? "720P",
				ratio: params.ratio ?? "16:9",
				keyframe: params.keyframe,
			},
		};
	}

	async generateAudio(
		params: AudioGenerationParams,
		signal?: AbortSignal,
	): Promise<AudioGenerationResult> {
		await this.simulateWork(params.prompt, signal);

		const hash = Math.abs(this.hashCode(params.prompt));
		const assetId = `${this.prefix}_aud_${hash}`;

		return {
			assetId,
			url: `asset://${assetId}.mp3`,
			metadata: {
				prompt: params.prompt,
				kind: params.kind ?? "speech",
				duration: params.duration ?? 5,
				voice: params.voice,
			},
		};
	}

	private hashCode(str: string): number {
		let hash = 0;
		for (let i = 0; i < str.length; i++) {
			hash = (hash << 5) - hash + str.charCodeAt(i);
			hash |= 0;
		}
		return hash;
	}
}

export const MockMediaGenerator = MockGenerationProvider;
