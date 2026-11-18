import assert from "node:assert/strict";
import { test } from "node:test";
import { CARD_CHROME, contrastRatioCss, meetsAa, parseCssColor, validateCardChromeContrast, validateTldrawNamedColor, } from "../../src/domain/contrast.js";
test("parseCssColor handles hex and rgba", () => {
    assert.deepEqual(parseCssColor("#1d1d1d"), {
        r: 29,
        g: 29,
        b: 29,
        a: 1,
    });
    assert.deepEqual(parseCssColor("rgba(15, 23, 42, 0.16)"), {
        r: 15,
        g: 23,
        b: 42,
        a: 0.16,
    });
});
test("black on white meets AA normal", () => {
    const ratio = contrastRatioCss("#000000", "#ffffff");
    assert.ok(ratio !== undefined && ratio >= 21);
    assert.equal(meetsAa(ratio, "normal"), true);
});
test("light gray on white fails AA normal", () => {
    const ratio = contrastRatioCss("#cccccc", "#ffffff");
    assert.ok(ratio !== undefined);
    assert.equal(meetsAa(ratio, "normal"), false);
});
test("card chrome fallbacks pass AA", () => {
    assert.equal(validateCardChromeContrast().length, 0);
    assert.ok((contrastRatioCss(CARD_CHROME.title, CARD_CHROME.background) ?? 0) >= 4.5);
});
test("known tldraw color pairings pass or report", () => {
    assert.equal(validateTldrawNamedColor("yellow").length, 0);
    assert.equal(validateTldrawNamedColor("blue").length, 0);
});
