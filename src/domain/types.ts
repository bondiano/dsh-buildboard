/** Minimal host / client context shapes used by the plugin. */

export interface ToolDefinition {
	name: string;
	description: string;
	parameters: Record<string, unknown>;
	output: {
		schema: Record<string, unknown>;
		render(
			args: unknown,
			value: unknown,
		): Array<{ type: "text"; text: string }>;
	};
	timeoutMs?: number;
	execute(args: unknown, exec?: ToolExec): Promise<unknown>;
}

export interface ToolExec {
	agent?: { session?: { id: string }; followup?(message: unknown): unknown };
	signal?: AbortSignal;
}

export interface HostContext {
	tools: { register(tool: ToolDefinition): () => void };
	systemPrompt: {
		section(input: { name: string; order: number; text: string }): () => void;
		getSectionOrder?(name: string): number | undefined;
	};
	commands?: {
		register(def: {
			name: string;
			description: string;
			input?: { hint?: string };
			handler: (
				invocation: CommandInvocation,
			) => Promise<CommandResult> | CommandResult;
		}): () => void;
	};
	settings?: {
		configure(options: { auto: boolean }, fiber?: unknown): () => void;
	};
	webServer?: import("../infrastructure/web-route-auth.js").WebServer;
	logger?: { warn?(message: string): void; info?(message: string): void };
	get?(name: string): unknown;
	inject?(deps: string[], callback: (ctx: HostContext) => void): void;
	effect(disposer: () => void | (() => void), label?: string): void;
	on?(event: string, listener: (payload: unknown) => void): (() => void) | void;
	fiber?: unknown;
}

export interface CommandInvocation {
	commandId: string;
	agent: {
		session?: { id: string };
		followup(message: unknown): unknown;
		steer?(message: unknown): unknown;
	};
	rawInput: string;
	signal?: AbortSignal;
}

export interface CommandResult {
	kind: "success" | "error";
	text?: string;
}

export interface ClientContext {
	locale: {
		register(
			namespace: string,
			dict: Record<string, Record<string, string>>,
		): () => void;
		bind(namespace: string): (key: string) => string;
	};
	slots: {
		inject(name: string, factory: () => Generator | void): void;
		register(options: Record<string, unknown>, component: unknown): () => void;
	};
	sidebarRightTabs?: {
		register(def: Record<string, unknown>): () => void;
	};
	configForms?: {
		get(namespace: string): {
			getSnapshot(): { value?: Record<string, unknown> };
			subscribe(listener: () => void): () => void;
			set(field: string, value: unknown): Promise<boolean>;
		};
		whileServed(namespaces: string[], run: () => () => void): () => void;
	};
	uiWorkspace?: {
		startSession?(
			workspaceId?: string,
			options?: { prompt?: string; whenDraftExists?: string },
		): void;
		getActiveSession?(): { id: string } | undefined;
	};
	layout?: { selectPanel(id: string | null): void };
	inject?(deps: string[], callback: (ctx: ClientContext) => void): void;
	effect(disposer: () => void | (() => void), label?: string): void;
	get?(name: string): unknown;
}
