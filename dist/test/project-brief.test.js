/**
 * The brief a "Start project" session receives.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildProjectBrief } from "../src/application/project-brief.js";
function element(id, kind, text, x, y) {
    return {
        id,
        kind,
        x,
        y,
        width: 200,
        height: 200,
        text,
        shapeType: "rect",
    };
}
describe("project-brief", () => {
    it("states the board, its statistics and the workspace path", () => {
        const brief = buildProjectBrief({
            elements: [
                element("a", "sticky", "launch checklist", 40, 80),
                element("b", "shape", "Storyboard", 400, 80),
            ],
            edges: [{ id: "e1", fromNode: "a", toNode: "b" }],
        }, "/work/film");
        assert.match(brief, /^Cult Canvas project brief/);
        assert.match(brief, /Board: \/work\/film/);
        assert.match(brief, /2 elements \(sticky=1, shape=1\); 1 edges/);
        assert.match(brief, /- sticky "launch checklist" @ \(40, 80\)/);
        assert.match(brief, /- shape "Storyboard" @ \(400, 80\)/);
        assert.match(brief, /canvas_get_state/);
        assert.match(brief, /cult-canvas\.canvas/);
    });
    it("names the shared board when the session has no workspace", () => {
        const brief = buildProjectBrief({ elements: [], edges: [] });
        assert.match(brief, /Board: shared board/);
        assert.match(brief, /0 elements \(empty\); 0 edges/);
    });
    it("counts pipeline nodes separately from whiteboard elements", () => {
        const brief = buildProjectBrief({
            elements: [
                {
                    id: "p1",
                    kind: "image",
                    x: 0,
                    y: 0,
                    width: 200,
                    height: 200,
                    label: "Hero shot",
                    status: "idle",
                    prompt: "a hero",
                    ratio: "16:9",
                    size: "1024x1024",
                },
            ],
            edges: [],
        });
        assert.match(brief, /pipeline image=1/);
        assert.match(brief, /- image "Hero shot"/);
    });
    it("lists at most twenty elements and says how many more there are", () => {
        const elements = Array.from({ length: 25 }, (_, index) => element(`e${index}`, "sticky", `note ${index}`, index * 10, 0));
        const brief = buildProjectBrief({ elements, edges: [] });
        const lines = brief
            .split("\n")
            .filter((line) => line.startsWith("- sticky"));
        assert.equal(lines.length, 20);
        assert.match(brief, /… 5 more/);
    });
    it("quotes bible entries without dumping nested structures", () => {
        const brief = buildProjectBrief({
            elements: [],
            edges: [],
            bible: {
                style: "ink and paper",
                characters: [{ name: "Ann", desc: "hero" }],
                scenes: [],
            },
        });
        assert.match(brief, /- style: ink and paper/);
        assert.match(brief, /- characters: 1 entries/);
        assert.doesNotMatch(brief, /- scenes:/);
    });
    it("shortens a very long element text", () => {
        const brief = buildProjectBrief({
            elements: [element("a", "sticky", "x".repeat(400), 0, 0)],
            edges: [],
        });
        const line = brief
            .split("\n")
            .find((entry) => entry.startsWith("- sticky"));
        assert.ok(line !== undefined);
        assert.ok(line.length < 140, `line too long: ${line.length}`);
        assert.match(line, /…/);
    });
});
