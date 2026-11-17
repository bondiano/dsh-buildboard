/**
 * Generic Asynchronous Task Polling State Machine
 */
export class TaskPoller {
    intervalMs;
    maxIntervalMs;
    backoffFactor;
    timeoutMs;
    signal;
    constructor(options = {}) {
        this.intervalMs = Math.max(10, options.intervalMs ?? 500);
        this.maxIntervalMs = Math.max(this.intervalMs, options.maxIntervalMs ?? 5000);
        this.backoffFactor = Math.max(1.0, options.backoffFactor ?? 1.2);
        this.timeoutMs = Math.max(100, options.timeoutMs ?? 60000);
        this.signal = options.signal;
    }
    /**
     * Polls the given checkFn until completion, failure, timeout, or cancellation.
     */
    async poll(checkFn) {
        const startTime = Date.now();
        let currentInterval = this.intervalMs;
        while (true) {
            if (this.signal?.aborted) {
                throw new Error("Task polling aborted by signal");
            }
            if (Date.now() - startTime > this.timeoutMs) {
                return {
                    status: "failed",
                    error: `Task timed out after ${this.timeoutMs}ms`,
                };
            }
            const result = await checkFn();
            if (result.status === "completed" ||
                result.status === "failed" ||
                result.status === "cancelled") {
                return result;
            }
            // Delay with cooperative abort check
            await this.delay(currentInterval);
            currentInterval = Math.min(this.maxIntervalMs, Math.round(currentInterval * this.backoffFactor));
        }
    }
    delay(ms) {
        return new Promise((resolve, reject) => {
            if (this.signal?.aborted) {
                return reject(new Error("Task polling aborted by signal"));
            }
            const timer = setTimeout(() => {
                if (this.signal) {
                    this.signal.removeEventListener("abort", onAbort);
                }
                resolve();
            }, ms);
            const onAbort = () => {
                clearTimeout(timer);
                reject(new Error("Task polling aborted by signal"));
            };
            if (this.signal) {
                this.signal.addEventListener("abort", onAbort, { once: true });
            }
        });
    }
}
