import * as React from "react";

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
] as const;

export function SettingsCard(props: SettingsCardProps): React.ReactElement {
	const [value, setValue] = React.useState<Record<string, unknown>>(
		() => props.getSnapshot?.().value ?? {},
	);
	const [error, setError] = React.useState<string | null>(null);
	const t = (key: string) => (props.t ? props.t(key) : key);

	React.useEffect(
		() => props.subscribe?.(() => setValue(props.getSnapshot?.().value ?? {})),
		[props],
	);

	return (
		<form
			className="dsh-bb-settings"
			onSubmit={(event) => event.preventDefault()}
		>
			<strong>{t("settings.title")}</strong>
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
							setValue((prev) => ({ ...prev, [field.key]: next }));
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
