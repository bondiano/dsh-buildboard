/**
 * DSH Cult Canvas Plugin Entrypoint Facade
 *
 * Re-exports the Cordis plugin entrypoint, configuration schemas,
 * and lifecycle hooks from src/presentation/index.js.
 *
 * @module @local/dsh-cult-canvas
 */
/* No `export { default }`: cordis unwrapExports picks `default` and drops the
 * namespace, which loses the `inject` service list and aborts activation. */
export * from "./src/presentation/index.js";
