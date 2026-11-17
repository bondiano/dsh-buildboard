/**
 * Compatibility Facade for Canvas Tools
 *
 * Re-exports agent tools and sanitization utilities from src/adapters/tools.js
 * and src/infrastructure/utils/.
 *
 * @module @local/dsh-cult-canvas/tools
 */
export * from "./src/adapters/tools.js";
export { stripUndefined } from "./src/infrastructure/utils/strip-undefined.js";
export { deepMerge } from "./src/infrastructure/utils/deep-merge.js";
