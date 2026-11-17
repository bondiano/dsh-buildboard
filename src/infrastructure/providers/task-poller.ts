/**
 * Generic Asynchronous Task Polling State Machine
 */

export type NormalizedTaskStatus =
	| "waiting"
	| "running"
	| "completed"
	| "failed"
	| "cancelled";

export interface TaskPollResult<T> {
	status: NormalizedTaskStatus;
	data?: T;
	error?: string;
	progress?: number;
}

export interface TaskPollerOptions {
	intervalMs?: number;
	maxIntervalMs?: number;
	backoffFactor?: number;
	timeoutMs?: number;
	signal?: AbortSignal;
}

export class TaskPoller<T> {
	private readonly intervalMs: number;
	private readonly maxIntervalMs: number;
	private readonly backoffFactor: number;
	private readonly timeoutMs: number;
	private readonly signal?: AbortSignal;

	constructor(options: TaskPollerOptions = {}) {
		this.intervalMs = Math.max(10, options.intervalMs ?? 500);
		this.maxIntervalMs = Math.max(
			this.intervalMs,
			options.maxIntervalMs ?? 5000,
		);
		this.backoffFactor = Math.max(1.0, options.backoffFactor ?? 1.2);
		this.timeoutMs = Math.max(100, options.timeoutMs ?? 60000);
		this.signal = options.signal;
	}

	/**
	 * Polls the given checkFn until completion, failure, timeout, or cancellation.
	 */
	async poll(
		checkFn: () => Promise<TaskPollResult<T>>,
	): Promise<TaskPollResult<T>> {
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

			if (
				result.status === "completed" ||
				result.status === "failed" ||
				result.status === "cancelled"
			) {
				return result;
			}

			// Delay with cooperative abort check
			await this.delay(currentInterval);
			currentInterval = Math.min(
				this.maxIntervalMs,
				Math.round(currentInterval * this.backoffFactor),
			);
		}
	}

	private delay(ms: number): Promise<void> {
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
