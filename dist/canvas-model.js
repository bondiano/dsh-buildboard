/**
 * Compatibility Facade for Canvas Model & Store
 *
 * Re-exports domain models, geometric shapes, stroke geometry, element factories,
 * in-memory CanvasStore, and JSON Canvas converters from their modular implementations in src/.
 *
 * @module @local/dsh-cult-canvas/canvas-model
 */
export * from "./src/domain/index.js";
export * from "./src/application/canvas-store.js";
export * from "./src/adapters/json-canvas.js";
