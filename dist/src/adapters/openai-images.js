/**
 * OpenAI Images API client for board / card illustrations.
 * Default model: gpt-image-2.6-sunburst (Images 2.6).
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createId } from "../domain/ids.js";
import { BUILDBOARD_API_ROUTE } from "../domain/route.js";
export const DEFAULT_IMAGE_MODEL = "gpt-image-2.6-sunburst";
export const IMAGE_MODELS = [
    "gpt-image-2.6-sunburst",
    "gpt-image-2.6-flare",
];
export const IMAGE_SETUP_HINT = "Set OPENAI_API_KEY in the environment, or paste an OpenAI API key in Buildboard settings (openaiApiKey). Optionally set openaiImageModel to gpt-image-2.6-sunburst or gpt-image-2.6-flare.";
export function resolveImageAuth(source = {}) {
    const env = source.env ?? process.env;
    const envKey = env.OPENAI_API_KEY?.trim() ?? "";
    const settingsKey = source.settingsKey?.trim() ?? "";
    const model = normalizeImageModel(source.settingsModel);
    if (envKey)
        return { apiKey: envKey, model, source: "env" };
    if (settingsKey)
        return { apiKey: settingsKey, model, source: "settings" };
    return { apiKey: undefined, model, source: "none" };
}
export function normalizeImageModel(raw) {
    if (raw === "gpt-image-2.6-flare")
        return "gpt-image-2.6-flare";
    return DEFAULT_IMAGE_MODEL;
}
/** Call OpenAI /v1/images/generations and return PNG bytes. */
export async function generateOpenAIImage(input) {
    const model = input.model ?? DEFAULT_IMAGE_MODEL;
    const fetchImpl = input.fetchImpl ?? fetch;
    const response = await fetchImpl("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${input.apiKey}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            model,
            prompt: input.prompt,
            n: 1,
            size: input.size ?? "1024x1024",
            quality: input.quality ?? "high",
            output_format: "png",
        }),
    });
    if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new Error(`OpenAI image generation failed (${response.status}): ${detail.slice(0, 400)}`);
    }
    const json = (await response.json());
    const first = json.data?.[0];
    if (first?.b64_json) {
        return {
            bytes: Buffer.from(first.b64_json, "base64"),
            model,
            mimeType: "image/png",
        };
    }
    if (first?.url) {
        const imageRes = await fetchImpl(first.url);
        if (!imageRes.ok) {
            throw new Error(`Failed to download generated image (${imageRes.status})`);
        }
        const ab = await imageRes.arrayBuffer();
        return { bytes: Buffer.from(ab), model, mimeType: "image/png" };
    }
    throw new Error("OpenAI image response missing b64_json and url");
}
/** Persist PNG under .buildboard/assets and return board + markdown URLs. */
export async function writeGeneratedAsset(input) {
    const id = input.id ?? createId("img");
    const relativePath = `${id}.png`;
    const absolutePath = join(input.assetsDir, relativePath);
    await mkdir(input.assetsDir, { recursive: true });
    await writeFile(absolutePath, input.bytes);
    const apiPath = `${BUILDBOARD_API_ROUTE}/assets/generated/${relativePath}`;
    return {
        id,
        absolutePath,
        relativePath,
        markdownUrl: apiPath,
        apiPath,
    };
}
/** Build tldraw asset + image shape records for a generated PNG. */
export function buildImageShapeRecords(input) {
    const assetId = input.assetId.startsWith("asset:")
        ? input.assetId
        : `asset:${input.assetId}`;
    const shapeId = input.shapeId.startsWith("shape:")
        ? input.shapeId
        : `shape:${input.shapeId}`;
    return {
        [assetId]: {
            id: assetId,
            typeName: "asset",
            type: "image",
            props: {
                name: input.name ?? "generated.png",
                src: input.src,
                w: input.w,
                h: input.h,
                mimeType: "image/png",
                isAnimated: false,
            },
            meta: { generatedBy: "openai" },
        },
        [shapeId]: {
            id: shapeId,
            typeName: "shape",
            type: "image",
            x: input.x ?? 0,
            y: input.y ?? 0,
            rotation: 0,
            opacity: 1,
            isLocked: false,
            props: {
                assetId,
                w: input.w,
                h: input.h,
                playing: true,
                url: "",
                crop: null,
            },
            parentId: input.parentId ?? "page:page",
            index: "a1",
            meta: { generatedBy: "openai" },
        },
    };
}
