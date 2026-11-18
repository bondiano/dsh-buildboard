import * as React from "react";
import { useExternalSnapshot } from "../hooks/useActorStore.js";

export interface SettingsCardProps {
	getSnapshot?: () => { value?: Record<string, unknown> };
	subscribe?: (listener: () => void) => () => void;
	write?: (field: string, value: unknown) => Promise<boolean>;
	t?: (key: string) => string;
}

const FIELDS = [
	{ key: "maxCards", label: "settings.maxCards", type: "number" },
	{ key: "maxBoards", label: "settings.maxBoards", type: "number" },
	{ key: "pollIntervalMs", label: "settings.pollIntervalMs", type: "number" },
	{
		key: "tldrawLicenseKey",
		label: "settings.tldrawLicenseKey",
		type: "password",
	},
	{
		key: "openaiApiKey",
		label: "settings.openaiApiKey",
		type: "password",
	},
	{
		key: "openaiImageModel",
		label: "settings.openaiImageModel",
		type: "text",
	},
] as const;

const EMPTY_VALUE: Record<string, unknown> = {};

export function SettingsCard(props: SettingsCardProps): React.ReactElement {
	const remote = useExternalSnapshot(
		props.subscribe,
		() => props.getSnapshot?.().value ?? EMPTY_VALUE,
		EMPTY_VALUE,
	);
	const [local, setLocal] = React.useState<Record<string, unknown> | null>(
		null,
	);
	const value = local ?? remote;
	const [error, setError] = React.useState<string | null>(null);
	const t = (key: string) => (props.t ? props.t(key) : key);

	return (
		<form
			className="dsh-bb-settings"
			onSubmit={(event) => event.preventDefault()}
		>
			<strong>{t("settings.title")}</strong>
			<p className="dsh-bb-settings-help">{t("settings.openaiHelp")}</p>
			{FIELDS.map((field) => (
				<label key={field.key}>
					{t(field.label)}
					<input
						type={field.type}
						value={
							typeof value[field.key] === "string" ||
							typeof value[field.key] === "number"
								? String(value[field.key])
								: ""
						}
						onChange={(event) => {
							const next =
								field.type === "number"
									? Number(event.target.value)
									: event.target.value;
							setLocal((prev) => ({
								...(prev ?? remote),
								[field.key]: next,
							}));
							void props.write?.(field.key, next).then((ok) => {
								setError(ok ? null : t("settings.error"));
							});
						}}
					/>
				</label>
			))}
			{error ? <p role="status">{error}</p> : null}
		</form>
	);
}
