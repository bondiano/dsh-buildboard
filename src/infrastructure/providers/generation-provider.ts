/**
 * Core Media Generation Provider Interface & Common Parameter Types
 */

export interface ImageGenerationParams {
	prompt: string;
	ratio?: string;
	size?: string;
	references?: string[];
	negativePrompt?: string;
	n?: number;
}

export interface ImageGenerationResult {
	assetId: string;
	url?: string;
	dataUrl?: string;
	metadata?: Record<string, unknown>;
}

export interface VideoGenerationParams {
	prompt: string;
	ratio?: string;
	duration?: number;
	resolution?: string;
	keyframe?: string;
	references?: string[];
	negativePrompt?: string;
}

export interface VideoGenerationResult {
	assetId: string;
	url?: string;
	tailPickAssetId?: string;
	metadata?: Record<string, unknown>;
}

export interface AudioGenerationParams {
	prompt: string;
	kind?: "speech" | "sfx" | "music";
	duration?: number;
	voice?: string;
	speed?: number;
}

export interface AudioGenerationResult {
	assetId: string;
	url?: string;
	metadata?: Record<string, unknown>;
}

/**
 * Standard interface for external media generation providers.
 */
export interface GenerationProvider {
	generateImage(
		params: ImageGenerationParams,
		signal?: AbortSignal,
	): Promise<ImageGenerationResult>;
	generateVideo(
		params: VideoGenerationParams,
		signal?: AbortSignal,
	): Promise<VideoGenerationResult>;
	generateAudio(
		params: AudioGenerationParams,
		signal?: AbortSignal,
	): Promise<AudioGenerationResult>;
}

/**
 * Backward compatibility alias for GenerationProvider.
 */
export type MediaGenerationClient = GenerationProvider;
