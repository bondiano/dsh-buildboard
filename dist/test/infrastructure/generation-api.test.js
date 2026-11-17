import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MockGenerationProvider, TaskPoller, OpenAIProvider, WanxProvider, } from "../../src/infrastructure/generation-api.js";
describe("Milestone 2: External Generation API & Provider Subsystem", () => {
    // =========================================================================
    // 1. MockGenerationProvider Suite
    // =========================================================================
    describe("1. MockGenerationProvider Suite", () => {
        it("generates deterministic synthetic image assets with data URLs", async () => {
            const provider = new MockGenerationProvider("unit_test");
            const res = await provider.generateImage({
                prompt: "A rainy neon street in Chang'an",
                ratio: "16:9",
            });
            assert.ok(res.assetId.startsWith("unit_test_img_"));
            assert.ok(res.url?.startsWith("asset://"));
            assert.ok(res.dataUrl?.startsWith("data:image/png;base64,"));
            assert.equal(res.metadata?.ratio, "16:9");
        });
        it("generates deterministic synthetic video assets with tail picks", async () => {
            const provider = new MockGenerationProvider("unit_test");
            const res = await provider.generateVideo({
                prompt: "Hero leaps across rooftops",
                duration: 8,
                resolution: "1080P",
            });
            assert.ok(res.assetId.startsWith("unit_test_vid_"));
            assert.ok(res.tailPickAssetId?.startsWith("unit_test_tail_"));
            assert.ok(res.url?.endsWith(".mp4"));
            assert.equal(res.metadata?.duration, 8);
            assert.equal(res.metadata?.resolution, "1080P");
        });
        it("generates deterministic synthetic audio assets", async () => {
            const provider = new MockGenerationProvider("unit_test");
            const res = await provider.generateAudio({
                prompt: "Thunder rolling in distance",
                kind: "sfx",
                duration: 3,
            });
            assert.ok(res.assetId.startsWith("unit_test_aud_"));
            assert.ok(res.url?.endsWith(".mp3"));
            assert.equal(res.metadata?.kind, "sfx");
        });
        it("simulates latency when latencyMs is configured", async () => {
            const provider = new MockGenerationProvider({ latencyMs: 20 });
            const start = Date.now();
            await provider.generateImage({ prompt: "Quick test" });
            const elapsed = Date.now() - start;
            assert.ok(elapsed >= 15, `Expected elapsed >= 15ms, got ${elapsed}ms`);
        });
        it("injects errors deterministically when failOnPrompt matches", async () => {
            const provider = new MockGenerationProvider({
                failOnPrompt: "TRIGGER_FAILURE",
            });
            await assert.rejects(async () => {
                await provider.generateImage({
                    prompt: "Normal text with TRIGGER_FAILURE marker",
                });
            }, /Injected error for prompt matching/);
        });
        it("halts immediately when AbortSignal is triggered", async () => {
            const provider = new MockGenerationProvider({ latencyMs: 200 });
            const controller = new AbortController();
            controller.abort();
            await assert.rejects(async () => {
                await provider.generateVideo({ prompt: "Aborted prompt" }, controller.signal);
            }, /aborted by signal/i);
        });
    });
    // =========================================================================
    // 2. TaskPoller State Machine Suite
    // =========================================================================
    describe("2. TaskPoller State Machine Suite", () => {
        it("polls through running states and completes cleanly", async () => {
            let attempts = 0;
            const poller = new TaskPoller({ intervalMs: 5 });
            const res = await poller.poll(async () => {
                attempts++;
                if (attempts < 3) {
                    return { status: "running" };
                }
                return { status: "completed", data: "final_result" };
            });
            assert.equal(res.status, "completed");
            assert.equal(res.data, "final_result");
            assert.equal(attempts, 3);
        });
        it("returns failed status when task fails on backend", async () => {
            const poller = new TaskPoller({ intervalMs: 5 });
            const res = await poller.poll(async () => {
                return { status: "failed", error: "GPU out of memory" };
            });
            assert.equal(res.status, "failed");
            assert.equal(res.error, "GPU out of memory");
        });
        it("times out when task takes longer than timeoutMs", async () => {
            const poller = new TaskPoller({
                intervalMs: 10,
                timeoutMs: 30,
            });
            const res = await poller.poll(async () => {
                return { status: "running" };
            });
            assert.equal(res.status, "failed");
            assert.ok(res.error?.includes("timed out"));
        });
        it("aborts polling when AbortSignal triggers", async () => {
            const controller = new AbortController();
            const poller = new TaskPoller({
                intervalMs: 10,
                signal: controller.signal,
            });
            setTimeout(() => controller.abort(), 15);
            await assert.rejects(async () => {
                await poller.poll(async () => {
                    return { status: "running" };
                });
            }, /aborted by signal/i);
        });
    });
    // =========================================================================
    // 3. OpenAIProvider Suite
    // =========================================================================
    describe("3. OpenAIProvider Suite", () => {
        it("dispatches image generation requests to OpenAI endpoint", async () => {
            const mockFetch = async (url, init) => {
                const urlStr = typeof url === "string" ? url : url.toString();
                assert.ok(urlStr.endsWith("/images/generations"));
                assert.equal(init?.method, "POST");
                const bodyStr = typeof init?.body === "string" ? init.body : "{}";
                const body = JSON.parse(bodyStr);
                assert.equal(body.prompt, "A stylized cat warrior");
                return new Response(JSON.stringify({
                    data: [{ url: "https://openai.test/img123.png" }],
                }), { status: 200, headers: { "Content-Type": "application/json" } });
            };
            const provider = new OpenAIProvider({
                apiKey: "test_key",
                baseUrl: "https://api.openai.test/v1",
                fetch: mockFetch,
            });
            const res = await provider.generateImage({
                prompt: "A stylized cat warrior",
            });
            assert.ok(res.assetId.startsWith("openai_img_"));
            assert.equal(res.url, "https://openai.test/img123.png");
        });
        it("dispatches audio speech synthesis requests to OpenAI TTS endpoint", async () => {
            const mockFetch = async (url, init) => {
                const urlStr = typeof url === "string" ? url : url.toString();
                assert.ok(urlStr.endsWith("/audio/speech"));
                assert.equal(init?.method, "POST");
                const bodyStr = typeof init?.body === "string" ? init.body : "{}";
                const body = JSON.parse(bodyStr);
                assert.equal(body.input, "Spoken narration");
                // Return dummy audio bytes
                return new Response(new Uint8Array([1, 2, 3, 4]), {
                    status: 200,
                    headers: { "Content-Type": "audio/mpeg" },
                });
            };
            const provider = new OpenAIProvider({
                apiKey: "test_key",
                baseUrl: "https://api.openai.test/v1",
                fetch: mockFetch,
            });
            const res = await provider.generateAudio({
                prompt: "Spoken narration",
            });
            assert.ok(res.assetId.startsWith("openai_aud_"));
            assert.ok(res.url?.startsWith("data:audio/mp3;base64,"));
        });
        it("handles HTTP error status codes with detailed messages", async () => {
            const mockFetch = async () => {
                return new Response("Invalid API Key provided", { status: 401 });
            };
            const provider = new OpenAIProvider({
                apiKey: "bad_key",
                baseUrl: "https://api.openai.test/v1",
                fetch: mockFetch,
            });
            await assert.rejects(async () => {
                await provider.generateImage({ prompt: "Test prompt" });
            }, /failed with HTTP 401/);
        });
    });
    // =========================================================================
    // 4. WanxProvider Suite
    // =========================================================================
    describe("4. WanxProvider Suite", () => {
        it("submits video task and polls DashScope Wanx endpoint until completion", async () => {
            let pollCount = 0;
            const mockFetch = async (url, init) => {
                const urlStr = typeof url === "string" ? url : url.toString();
                if (urlStr.endsWith("/video-synthesis")) {
                    assert.equal(init?.method, "POST");
                    const bodyStr = typeof init?.body === "string" ? init.body : "{}";
                    const body = JSON.parse(bodyStr);
                    assert.equal(body.input.prompt, "Epic dragon flight");
                    return new Response(JSON.stringify({ output: { task_id: "wanx_task_42" } }), { status: 200, headers: { "Content-Type": "application/json" } });
                }
                if (urlStr.includes("/tasks/wanx_task_42")) {
                    pollCount++;
                    if (pollCount === 1) {
                        return new Response(JSON.stringify({ output: { task_status: "RUNNING" } }), { status: 200, headers: { "Content-Type": "application/json" } });
                    }
                    return new Response(JSON.stringify({
                        output: {
                            task_status: "SUCCEEDED",
                            video_url: "https://dashscope.test/video42.mp4",
                        },
                    }), { status: 200, headers: { "Content-Type": "application/json" } });
                }
                return new Response("Not found", { status: 404 });
            };
            const provider = new WanxProvider({
                apiKey: "test_dashscope_key",
                baseUrl: "https://dashscope.test/api/v1",
                fetch: mockFetch,
                pollIntervalMs: 5,
            });
            const res = await provider.generateVideo({
                prompt: "Epic dragon flight",
            });
            assert.equal(res.assetId, "wanx_vid_wanx_task_42");
            assert.equal(res.url, "https://dashscope.test/video42.mp4");
            assert.equal(pollCount, 2);
        });
        it("handles Wanx task failure with descriptive error", async () => {
            const mockFetch = async (url) => {
                const urlStr = typeof url === "string" ? url : url.toString();
                if (urlStr.endsWith("/video-synthesis")) {
                    return new Response(JSON.stringify({ output: { task_id: "wanx_fail_task" } }), { status: 200, headers: { "Content-Type": "application/json" } });
                }
                if (urlStr.includes("/tasks/wanx_fail_task")) {
                    return new Response(JSON.stringify({
                        output: {
                            task_status: "FAILED",
                            message: "Content policy violation detected",
                        },
                    }), { status: 200, headers: { "Content-Type": "application/json" } });
                }
                return new Response("Not found", { status: 404 });
            };
            const provider = new WanxProvider({
                apiKey: "test_dashscope_key",
                baseUrl: "https://dashscope.test/api/v1",
                fetch: mockFetch,
                pollIntervalMs: 5,
            });
            await assert.rejects(async () => {
                await provider.generateVideo({ prompt: "Content violation" });
            }, /Content policy violation detected/);
        });
    });
});
