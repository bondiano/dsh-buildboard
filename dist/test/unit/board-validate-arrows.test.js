import assert from "node:assert/strict";
import { test } from "node:test";
import { validateBoardRecords } from "../../src/domain/board-validate.js";
function page() {
    return {
        id: "page:page",
        typeName: "page",
        name: "Page 1",
        meta: {},
        index: "a1",
    };
}
function card(id, x, y) {
    return {
        id,
        typeName: "shape",
        type: "card",
        x,
        y,
        rotation: 0,
        opacity: 1,
        isLocked: false,
        props: {
            w: 200,
            h: 100,
            title: "A",
            excerpt: "",
            kind: "note",
            cardRef: "",
            runStatus: "",
        },
        parentId: "page:page",
        index: "a1",
        meta: {},
    };
}
test("unbound arrow ends are errors", () => {
    const records = {
        "page:page": page(),
        "shape:a": card("shape:a", 0, 0),
        "shape:arrow": {
            id: "shape:arrow",
            typeName: "shape",
            type: "arrow",
            x: 0,
            y: 0,
            rotation: 0,
            opacity: 1,
            isLocked: false,
            props: {
                start: { type: "point", x: 10, y: 10 },
                end: { type: "point", x: 40, y: 40 },
                text: "",
            },
            parentId: "page:page",
            index: "a2",
            meta: {},
        },
    };
    const result = validateBoardRecords(records);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.code === "unbound_arrow_start"));
    assert.ok(result.errors.some((e) => e.code === "unbound_arrow_end"));
});
test("orphan boundShapeId is an error", () => {
    const records = {
        "page:page": page(),
        "shape:a": card("shape:a", 0, 0),
        "shape:arrow": {
            id: "shape:arrow",
            typeName: "shape",
            type: "arrow",
            x: 0,
            y: 0,
            rotation: 0,
            opacity: 1,
            isLocked: false,
            props: {
                start: {
                    type: "binding",
                    boundShapeId: "shape:a",
                    normalizedAnchor: { x: 0.5, y: 0.5 },
                },
                end: {
                    type: "binding",
                    boundShapeId: "shape:missing",
                    normalizedAnchor: { x: 0.5, y: 0.5 },
                },
                text: "",
            },
            parentId: "page:page",
            index: "a2",
            meta: {},
        },
    };
    const result = validateBoardRecords(records);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.code === "orphan_arrow_end"));
});
test("wild normalizedAnchor fails touch check", () => {
    const records = {
        "page:page": page(),
        "shape:a": card("shape:a", 0, 0),
        "shape:b": card("shape:b", 300, 0),
        "shape:arrow": {
            id: "shape:arrow",
            typeName: "shape",
            type: "arrow",
            x: 0,
            y: 0,
            rotation: 0,
            opacity: 1,
            isLocked: false,
            props: {
                start: {
                    type: "binding",
                    boundShapeId: "shape:a",
                    normalizedAnchor: { x: 0.5, y: 0.5 },
                },
                end: {
                    type: "binding",
                    boundShapeId: "shape:b",
                    normalizedAnchor: { x: 5, y: 5 },
                },
                text: "",
            },
            parentId: "page:page",
            index: "a2",
            meta: {},
        },
    };
    const result = validateBoardRecords(records);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.code === "arrow_end_not_touching"));
});
test("proper bindings pass arrow checks", () => {
    const records = {
        "page:page": page(),
        "shape:a": card("shape:a", 0, 0),
        "shape:b": card("shape:b", 300, 0),
        "shape:arrow": {
            id: "shape:arrow",
            typeName: "shape",
            type: "arrow",
            x: 0,
            y: 0,
            rotation: 0,
            opacity: 1,
            isLocked: false,
            props: {
                start: {
                    type: "binding",
                    boundShapeId: "shape:a",
                    normalizedAnchor: { x: 1, y: 0.5 },
                },
                end: {
                    type: "binding",
                    boundShapeId: "shape:b",
                    normalizedAnchor: { x: 0, y: 0.5 },
                },
                text: "flow",
            },
            parentId: "page:page",
            index: "a2",
            meta: {},
        },
    };
    const result = validateBoardRecords(records, { contrast: false });
    assert.equal(result.errors.filter((e) => e.code.startsWith("unbound_") || e.code.includes("arrow")).length, 0);
});
