/**
 * Settings card for DSH Cult Canvas.
 *
 * The Host declares the namespace `cult-canvas` (the cordis.patch.yml entry id);
 * this card is keyed by the bundle's package name, which is what the Plugins
 * page dispatches. Writes go through the same `configForms` transport the
 * generated pages use, so a stored value reaches the board without a reload.
 *
 * @module @local/dsh-cult-canvas/presentation/components/CanvasSettingsCard
 */
import { h, useEffect, useState } from "./react-binding.js";
/** Fields in the order the Host schema declares them. */
const SETTINGS_FIELDS = [
    {
        key: "defaultCanvasWidth",
        label: "settings.defaultCanvasWidth",
        kind: "number",
    },
    {
        key: "defaultCanvasHeight",
        label: "settings.defaultCanvasHeight",
        kind: "number",
    },
    { key: "maxElements", label: "settings.maxElements", kind: "number" },
    { key: "snapToGrid", label: "settings.snapToGrid", kind: "switch" },
    { key: "gridSize", label: "settings.gridSize", kind: "number" },
    {
        key: "generationProvider",
        label: "settings.generationProvider",
        kind: "provider",
    },
    {
        key: "generationApiKey",
        label: "settings.generationApiKey",
        kind: "password",
    },
    {
        key: "generationBaseUrl",
        label: "settings.generationBaseUrl",
        kind: "text",
    },
];
/** Media generation backends the select offers. */
const PROVIDER_OPTIONS = ["mock", "openai", "wanx"];
const ROW_STYLE = {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "8px 0",
    borderBottom: "0.5px solid var(--dsw-alias-border-l2)",
};
const LABEL_STYLE = {
    fontSize: 13,
    fontWeight: 500,
    lineHeight: 1.5,
    color: "var(--dsw-alias-label-primary)",
};
const INPUT_STYLE = {
    minWidth: 180,
    padding: "4px 8px",
    fontSize: 13,
    borderRadius: 6,
    border: "0.5px solid var(--dsw-alias-border-l2)",
    background: "var(--dsw-alias-bg-primary)",
    color: "var(--dsw-alias-label-primary)",
};
export function CanvasSettingsCard({ getSnapshot, subscribe, write, t, }) {
    const label = (key) => t ? t(key) : (key.split(".").pop() ?? key);
    const [snapshot, setSnapshot] = useState(() => getSnapshot());
    const [failed, setFailed] = useState(null);
    // The transport owns the subscription; its owner is the plugin, so the
    // listener lives exactly as long as this card is mounted.
    useEffect(() => subscribe(() => setSnapshot(getSnapshot())), []);
    const value = snapshot.value ?? {};
    const disabled = !snapshot.writable || snapshot.status !== "ready";
    const commit = (field, next) => {
        setFailed(null);
        void write(field, next).then((ok) => {
            if (!ok)
                setFailed(field);
        });
    };
    const control = (field) => {
        const current = value[field.key];
        if (field.kind === "switch") {
            return h("input", {
                type: "checkbox",
                checked: current === true,
                disabled,
                "aria-label": label(field.label),
                onChange: (event) => commit(field.key, event.target?.checked === true),
            });
        }
        if (field.kind === "provider") {
            return h("select", {
                value: typeof current === "string" ? current : "mock",
                disabled,
                "aria-label": label(field.label),
                style: INPUT_STYLE,
                onChange: (event) => commit(field.key, event.target?.value ?? "mock"),
            }, ...PROVIDER_OPTIONS.map((option) => h("option", { value: option }, option)));
        }
        const text = typeof current === "string" || typeof current === "number"
            ? String(current)
            : "";
        return h("input", {
            type: field.kind === "number"
                ? "number"
                : field.kind === "password"
                    ? "password"
                    : "text",
            value: text,
            disabled,
            "aria-label": label(field.label),
            style: INPUT_STYLE,
            onChange: (event) => {
                const raw = event.target?.value ?? "";
                commit(field.key, field.kind === "number" ? Number(raw) : raw);
            },
        });
    };
    return h("div", {
        "data-cult-canvas-settings": "",
        style: { display: "flex", flexDirection: "column" },
    }, h("div", { style: { padding: "0 0 4px" } }, label("settings.title")), ...SETTINGS_FIELDS.map((field) => h("div", { key: field.key, style: ROW_STYLE }, h("span", { style: LABEL_STYLE }, label(field.label)), control(field))), failed === null
        ? null
        : h("p", {
            role: "status",
            style: {
                margin: "12px 0 0",
                fontSize: 12,
                lineHeight: 1.5,
                color: "var(--dsw-alias-state-error-primary)",
            },
        }, label("settings.error")));
}
