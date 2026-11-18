import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { IMAGE_SETUP_HINT, buildImageShapeRecords, generateOpenAIImage, normalizeImageModel, resolveImageAuth, writeGeneratedAsset, } from "../../src/adapters/openai-images.js";
import { buildCanvasBrief } from "../../src/application/canvas-brief.js";
test("resolveImageAuth prefers env over settings", () => {
    const auth = resolveImageAuth({
        env: { OPENAI_API_KEY: "env-key" },
        settingsKey: "settings-key",
        settingsModel: "gpt-image-2.6-flare",
    });
    assert.equal(auth.source, "env");
    assert.equal(auth.apiKey, "env-key");
    assert.equal(auth.model, "gpt-image-2.6-flare");
});
test("resolveImageAuth falls back to settings then none", () => {
    const fromSettings = resolveImageAuth({
        env: {},
        settingsKey: "settings-key",
    });
    assert.equal(fromSettings.source, "settings");
    assert.equal(fromSettings.apiKey, "settings-key");
    assert.equal(fromSettings.model, "gpt-image-2.6-sunburst");
    const none = resolveImageAuth({ env: {}, settingsKey: "" });
    assert.equal(none.source, "none");
    assert.equal(none.apiKey, undefined);
    assert.match(IMAGE_SETUP_HINT, /OPENAI_API_KEY/);
});
test("normalizeImageModel defaults to sunburst", () => {
    assert.equal(normalizeImageModel(undefined), "gpt-image-2.6-sunburst");
    assert.equal(normalizeImageModel("gpt-image-2.6-flare"), "gpt-image-2.6-flare");
    assert.equal(normalizeImageModel("nope"), "gpt-image-2.6-sunburst");
});
test("generateOpenAIImage uses mocked fetch b64_json", async () => {
    const png = Buffer.from("png-bytes");
    const fetchImpl = async () => new Response(JSON.stringify({ data: [{ b64_json: png.toString("base64") }] }), { status: 200, headers: { "content-type": "application/json" } });
    const result = await generateOpenAIImage({
        prompt: "a circuit board diagram",
        apiKey: "test",
        fetchImpl,
    });
    assert.equal(result.mimeType, "image/png");
    assert.equal(result.model, "gpt-image-2.6-sunburst");
    assert.equal(result.bytes.equals(png), true);
});
test("writeGeneratedAsset and buildImageShapeRecords", async () => {
    const root = await mkdtemp(join(tmpdir(), "bb-img-"));
    try {
        const assetsDir = join(root, "assets");
        const written = await writeGeneratedAsset({
            bytes: Buffer.from("hello"),
            assetsDir,
            id: "img_test",
        });
        assert.equal(await readFile(written.absolutePath, "utf8"), "hello");
        assert.match(written.markdownUrl, /assets\/generated\/img_test\.png$/);
        const records = buildImageShapeRecords({
            assetId: written.id,
            shapeId: written.id,
            src: written.apiPath,
            w: 256,
            h: 256,
        });
        assert.equal(records[`asset:${written.id}`]?.type, "image");
        assert.equal(records[`shape:${written.id}`]?.type, "image");
    }
    finally {
        await rm(root, { recursive: true, force: true });
    }
});
test("canvas brief mentions images contrast and validate", () => {
    const brief = buildCanvasBrief({ request: "", boardSlug: "session-board" });
    assert.match(brief, /board_generate_image/);
    assert.match(brief, /WCAG AA|contrast/i);
    assert.match(brief, /board_connect/);
    assert.match(brief, /board_validate/);
    assert.match(brief, /openaiApiKey|OPENAI_API_KEY/);
});
