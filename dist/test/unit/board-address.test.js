import assert from "node:assert/strict";
import { test } from "node:test";
import { boardMarkdownPath, boardSlugFromAddress, isBuildboardBoardAddress, } from "../../src/domain/board-address.js";
test("boardSlugFromAddress reads relative workspace paths", () => {
    assert.equal(boardSlugFromAddress(".buildboard/boards/session-abc.board.json"), "session-abc");
    assert.equal(boardMarkdownPath("session-abc"), ".buildboard/boards/session-abc.board.json");
});
test("boardSlugFromAddress reads dsh-resource session addresses", () => {
    const address = "dsh-resource://file/session/sess1/.buildboard/boards/session-session-mpu9.board.json";
    assert.equal(isBuildboardBoardAddress(address), true);
    assert.equal(boardSlugFromAddress(address), "session-session-mpu9");
});
test("boardSlugFromAddress rejects non-board files", () => {
    assert.equal(isBuildboardBoardAddress(".buildboard/cards/note.md"), false);
    assert.equal(boardSlugFromAddress("README.md"), undefined);
    assert.equal(boardSlugFromAddress("dsh-resource://file/session/s/src/app.ts"), undefined);
});
