/**
 * OpenAI-compatible Generation Provider
 */
export class OpenAIProvider {
    apiKey;
    baseUrl;
    fetchImpl;
    constructor(config = {}) {
        this.apiKey =
            config.apiKey ||
                (typeof process !== "undefined" ? process.env?.OPENAI_API_KEY || "" : "");
        this.baseUrl = (config.baseUrl || "https://api.openai.com/v1").replace(/\/+$/, "");
        this.fetchImpl = config.fetch || globalThis.fetch;
    }
    async generateImage(params, signal) {
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
            throw new Error(`OpenAI image generation failed with HTTP ${res.status}: ${errBody}`);
        }
        const data = (await res.json());
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
    async generateVideo(params, signal) {
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
            throw new Error(`OpenAI video generation failed with HTTP ${res.status}: ${errBody}`);
        }
        const data = (await res.json());
        const assetId = data.assetId || data.id || `openai_vid_${Date.now()}`;
        return {
            assetId,
            url: data.url,
            metadata: { prompt: params.prompt, raw: data },
        };
    }
    async generateAudio(params, signal) {
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
            throw new Error(`OpenAI speech synthesis failed with HTTP ${res.status}: ${errBody}`);
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
