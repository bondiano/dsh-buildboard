/**
 * Alibaba DashScope Wanx Asynchronous Video Generation Provider
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
import { TaskPoller, type TaskPollResult } from "./task-poller.js";

export interface WanxProviderConfig {
	apiKey?: string;
	baseUrl?: string;
	fetch?: typeof fetch;
	pollIntervalMs?: number;
	timeoutMs?: number;
}

export class WanxProvider implements GenerationProvider {
	private readonly apiKey: string;
	private readonly baseUrl: string;
	private readonly fetchImpl: typeof fetch;
	private readonly pollIntervalMs: number;
	private readonly timeoutMs: number;

	constructor(config: WanxProviderConfig = {}) {
		this.apiKey =
			config.apiKey ||
			(typeof process !== "undefined"
				? process.env?.DASHSCOPE_API_KEY || ""
				: "");
		this.baseUrl = (
			config.baseUrl || "https://dashscope.aliyuncs.com/api/v1"
		).replace(/\/+$/, "");
		this.fetchImpl = config.fetch || globalThis.fetch;
		this.pollIntervalMs = config.pollIntervalMs ?? 1000;
		this.timeoutMs = config.timeoutMs ?? 120000;
	}

	async generateVideo(
		params: VideoGenerationParams,
		signal?: AbortSignal,
	): Promise<VideoGenerationResult> {
		if (signal?.aborted) {
			throw new Error("Wanx generateVideo aborted by signal");
		}

		// 1. Submit video synthesis task
		const submitUrl = `${this.baseUrl}/services/aigc/video-generation/video-synthesis`;
		const submitRes = await this.fetchImpl(submitUrl, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${this.apiKey}`,
				"X-DashScope-Async": "enable",
			},
			body: JSON.stringify({
				model: "wanx2.1-t2v-turbo",
				input: {
					prompt: params.prompt,
					img_url: params.keyframe,
				},
				parameters: {
					size: params.resolution ?? "1280*720",
					duration: params.duration ?? 5,
				},
			}),
			signal,
		});

		if (!submitRes.ok) {
			const errBody = await submitRes.text().catch(() => "");
			throw new Error(
				`Wanx task submission failed HTTP ${submitRes.status}: ${errBody}`,
			);
		}

		const submitData = (await submitRes.json()) as {
			output?: { task_id?: string; task_status?: string };
		};
		const taskId = submitData.output?.task_id;
		if (!taskId) {
			throw new Error("Wanx response missing output.task_id");
		}

		// 2. Poll task status until completion
		const poller = new TaskPoller<{ video_url?: string }>({
			intervalMs: this.pollIntervalMs,
			timeoutMs: this.timeoutMs,
			signal,
		});

		const pollRes = await poller.poll(
			async (): Promise<TaskPollResult<{ video_url?: string }>> => {
				const checkUrl = `${this.baseUrl}/tasks/${taskId}`;
				const checkRes = await this.fetchImpl(checkUrl, {
					headers: { Authorization: `Bearer ${this.apiKey}` },
					signal,
				});

				if (!checkRes.ok) {
					const text = await checkRes.text().catch(() => "");
					return {
						status: "failed",
						error: `Poll error HTTP ${checkRes.status}: ${text}`,
					};
				}

				const taskData = (await checkRes.json()) as {
					output?: {
						task_status?: string;
						video_url?: string;
						code?: string;
						message?: string;
					};
				};
				const st = (taskData.output?.task_status || "").toUpperCase();

				if (st === "SUCCEEDED") {
					return {
						status: "completed",
						data: { video_url: taskData.output?.video_url },
					};
				}
				if (st === "FAILED" || st === "CANCELED") {
					return {
						status: "failed",
						error: taskData.output?.message || `Task ended with status: ${st}`,
					};
				}

				return { status: "running" };
			},
		);

		if (pollRes.status !== "completed" || !pollRes.data?.video_url) {
			throw new Error(pollRes.error || "Wanx video generation failed");
		}

		const assetId = `wanx_vid_${taskId}`;
		return {
			assetId,
			url: pollRes.data.video_url,
			metadata: { taskId, prompt: params.prompt },
		};
	}

	async generateImage(
		_params: ImageGenerationParams,
		_signal?: AbortSignal,
	): Promise<ImageGenerationResult> {
		throw new Error("WanxProvider only supports video generation");
	}

	async generateAudio(
		_params: AudioGenerationParams,
		_signal?: AbortSignal,
	): Promise<AudioGenerationResult> {
		throw new Error("WanxProvider only supports video generation");
	}
}
