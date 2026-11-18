import { checkArrowEnd } from "./arrow-geometry.js";
import { normalizeShapeRecord } from "./board.js";
import { validateCardChromeContrast, validateTldrawNamedColor, } from "./contrast.js";
function isShape(record) {
    return record.typeName === "shape";
}
function shapeType(record) {
    return typeof record["type"] === "string" ? record["type"] : "";
}
function propsOf(record) {
    const props = record["props"];
    return typeof props === "object" && props !== null && !Array.isArray(props)
        ? props
        : {};
}
function requireNumber(record, key, id, errors) {
    if (typeof record[key] !== "number") {
        errors.push({
            code: `missing_${key}`,
            severity: "error",
            id,
            message: `shape ${id}: ${key} must be a number`,
        });
    }
}
function requireBoolean(record, key, id, errors) {
    if (typeof record[key] !== "boolean") {
        errors.push({
            code: `missing_${key}`,
            severity: "error",
            id,
            message: `shape ${id}: ${key} must be a boolean`,
        });
    }
}
/**
 * Fast structural validation for tldraw board records.
 * Catches the ValidationError class of bugs before the client store.put.
 */
export function validateBoardRecords(records, options = {}) {
    const errors = [];
    const warnings = [];
    const repaired = [];
    const recipe = options.recipe ?? "none";
    const checkContrast = options.contrast === true ||
        (options.contrast !== false && recipe === "architecture");
    let shapes = 0;
    let cards = 0;
    let frames = 0;
    let arrows = 0;
    let pages = 0;
    const entries = Object.entries(records);
    for (const [mapKey, record] of entries) {
        const id = typeof record.id === "string" ? record.id : undefined;
        if (!id) {
            errors.push({
                code: "missing_id",
                severity: "error",
                message: `record at key ${mapKey} without string id`,
            });
            continue;
        }
        if (mapKey !== id) {
            warnings.push({
                code: "id_key_mismatch",
                severity: "warning",
                id,
                message: `record id ${id} differs from map key ${mapKey}`,
            });
        }
        if (record.typeName === "page") {
            pages += 1;
            continue;
        }
        if (!isShape(record))
            continue;
        shapes += 1;
        const type = shapeType(record);
        if (type === "card")
            cards += 1;
        if (type === "frame")
            frames += 1;
        if (type === "arrow")
            arrows += 1;
        requireNumber(record, "x", id, errors);
        requireNumber(record, "y", id, errors);
        requireNumber(record, "rotation", id, errors);
        requireNumber(record, "opacity", id, errors);
        requireBoolean(record, "isLocked", id, errors);
        if (typeof record["parentId"] !== "string") {
            errors.push({
                code: "missing_parentId",
                severity: "error",
                id,
                message: `shape ${id}: parentId must be a string`,
            });
        }
        if (typeof record["index"] !== "string") {
            errors.push({
                code: "missing_index",
                severity: "error",
                id,
                message: `shape ${id}: index must be a string`,
            });
        }
        const props = propsOf(record);
        if (type === "card") {
            for (const key of [
                "title",
                "excerpt",
                "kind",
                "cardRef",
                "runStatus",
            ]) {
                if (typeof props[key] !== "string") {
                    errors.push({
                        code: `card_props_${key}`,
                        severity: "error",
                        id,
                        message: `card ${id}: props.${key} must be a string`,
                    });
                }
            }
            for (const key of ["w", "h"]) {
                if (typeof props[key] !== "number") {
                    errors.push({
                        code: `card_props_${key}`,
                        severity: "error",
                        id,
                        message: `card ${id}: props.${key} must be a number`,
                    });
                }
            }
        }
        if (type === "arrow") {
            for (const side of ["start", "end"]) {
                const result = checkArrowEnd(side, props[side], records, id);
                if (!result.ok && result.code && result.message) {
                    errors.push({
                        code: result.code,
                        severity: "error",
                        id,
                        message: result.message,
                    });
                }
            }
        }
        if (checkContrast && typeof props["color"] === "string") {
            for (const issue of validateTldrawNamedColor(props["color"])) {
                errors.push({
                    code: issue.code,
                    severity: "error",
                    id,
                    message: `shape ${id}: ${issue.message}`,
                });
            }
        }
        if (options.repair) {
            const fixed = normalizeShapeRecord(record);
            const before = JSON.stringify(record);
            const after = JSON.stringify(fixed);
            if (before !== after)
                repaired.push(fixed);
        }
    }
    if (pages === 0) {
        errors.push({
            code: "missing_page",
            severity: "error",
            message: "board has no page record",
        });
    }
    if (checkContrast) {
        for (const issue of validateCardChromeContrast()) {
            errors.push({
                code: issue.code,
                severity: "error",
                message: issue.message,
            });
        }
    }
    if (recipe === "architecture") {
        if (shapes === 0) {
            errors.push({
                code: "empty_board",
                severity: "error",
                message: "architecture board has no shapes",
            });
        }
        if (frames === 0) {
            warnings.push({
                code: "recipe_no_frames",
                severity: "warning",
                message: "architecture recipe expects at least one frame",
            });
        }
        if (cards === 0) {
            warnings.push({
                code: "recipe_no_cards",
                severity: "warning",
                message: "architecture recipe expects component cards",
            });
        }
        const hasDelta = entries.some(([, record]) => {
            if (!isShape(record) || shapeType(record) !== "card")
                return false;
            const title = propsOf(record)["title"];
            return (typeof title === "string" &&
                title.toLowerCase().includes("what changed"));
        });
        if (!hasDelta) {
            warnings.push({
                code: "recipe_no_session_delta",
                severity: "warning",
                message: 'missing card titled like "What changed in this session"',
            });
        }
    }
    return {
        ok: errors.length === 0,
        counts: {
            records: entries.length,
            shapes,
            cards,
            frames,
            arrows,
            pages,
        },
        errors,
        warnings,
        repaired: options.repair ? repaired : undefined,
    };
}
