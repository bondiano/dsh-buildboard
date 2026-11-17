import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as React from "react";
const FIELDS = [
    { key: "maxCards", label: "settings.maxCards", type: "number" },
    { key: "maxBoards", label: "settings.maxBoards", type: "number" },
    { key: "pollIntervalMs", label: "settings.pollIntervalMs", type: "number" },
    {
        key: "tldrawLicenseKey",
        label: "settings.tldrawLicenseKey",
        type: "password",
    },
];
export function SettingsCard(props) {
    const [value, setValue] = React.useState(() => props.getSnapshot?.().value ?? {});
    const [error, setError] = React.useState(null);
    const t = (key) => (props.t ? props.t(key) : key);
    React.useEffect(() => props.subscribe?.(() => setValue(props.getSnapshot?.().value ?? {})), [props]);
    return (_jsxs("form", { className: "dsh-bb-settings", onSubmit: (event) => event.preventDefault(), children: [_jsx("strong", { children: t("settings.title") }), FIELDS.map((field) => (_jsxs("label", { children: [t(field.label), _jsx("input", { type: field.type, value: typeof value[field.key] === "string" ||
                            typeof value[field.key] === "number"
                            ? String(value[field.key])
                            : "", onChange: (event) => {
                            const next = field.type === "number"
                                ? Number(event.target.value)
                                : event.target.value;
                            setValue((prev) => ({ ...prev, [field.key]: next }));
                            void props.write?.(field.key, next).then((ok) => {
                                setError(ok ? null : t("settings.error"));
                            });
                        } })] }, field.key))), error ? _jsx("p", { role: "status", children: error }) : null] }));
}
