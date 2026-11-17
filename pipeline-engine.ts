/**
 * Compatibility Facade for PipelineEngine
 *
 * Re-exports the media pipeline engine, shot planner, prompt resolver,
 * and generation models from src/application/pipeline-engine.js
 * and src/infrastructure/generation-api.js.
 *
 * @module @local/dsh-cult-canvas/pipeline-engine
 */

export * from "./src/application/pipeline-engine.js";
export * from "./src/infrastructure/generation-api.js";
