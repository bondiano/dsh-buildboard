export * from "./src/presentation/index.js";
// Cordis reads inject/Config from the module namespace — do not default-export apply
// as a bare function, or inject is invisible and tools/systemPrompt fail at apply.
