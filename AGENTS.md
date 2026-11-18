# dsh-buildboard Contributor Guide

Heptabase-style spatial whiteboard (`@local/dsh-buildboard`) for DeepSeek Harness: cards, documents, agent research, and implementation workflows on `tldraw` + `xstate`. See [../AGENTS.md](../AGENTS.md).

## Layout

- `index.ts`, `client.ts`, `src/settings.ts`: root facades for Cordis host/client entrypoints and settings schema.
- `src/domain/`: board/card types, route constants, and XState v5 `machines/` (`run`, `board-sync`, `app-shell`, `board-session`, `card-editor`).
- `src/application/`: host services (`board-document`, `card-library`, `run-service`) and client actor stores (`app-shell-store`, `board-session-store`, `card-editor-store`).
- `src/adapters/`: `legacy-json-canvas.ts`, `markdown.ts`, `openai-images.ts`, `tools/`.
- `src/domain/`: includes `board-validate.ts`, `contrast.ts`, `arrow-geometry.ts` for `/canvas` quality gates.
- `src/infrastructure/`: `web-route-auth.ts` (fail-closed HTTP route admission).
- `src/presentation/`: Cordis host `apply` + HTTP routes; `client/` React/tldraw UI bundled via `tsdown` into `lib/client.js`.
- `dist/`, `lib/`: compiled server (`tsc`) and client (`tsdown`) outputs; `locale/`: `en.json`, `ru.json`, `zh.json`.
- `test/`: `unit/` (`node --test dist/test/unit/*.test.js`) and `e2e/` (`playwright test`).

## Invariants

- **Committed build outputs:** Commit both `dist/` and `lib/client.js` after changes; Nix (`packages/deepseek-harness.nix`) builds `dist/` via `importNpmLock`, while `repositories.json` tracks the full snapshot.
- **Fail-closed auth:** Keep private HTTP routes gated behind `src/infrastructure/web-route-auth.ts`.
- **No React.useEffect:** Client lifecycle belongs in XState machines + `useSyncExternalStore` actor stores. Enforced by `test/unit/no-use-effect.test.ts`.
- **`/canvas` quality gates:** Arrows must bind both ends and touch target AABBs; colors (including card chrome fallbacks in `CARD_CHROME`) must meet WCAG AA; `board_validate` with recipe `architecture` enforces this. Illustrations go through `board_generate_image` (OpenAI Images 2.6: default `gpt-image-2.6-sunburst`). Key resolution: `OPENAI_API_KEY` env, else settings `openaiApiKey`; never invent keys.
- **Prettify layout:** Burger menu → Prettify (and `board_layout` mode `prettify`) runs a Sugiyama-style flow layout (`src/domain/board-prettify.ts`) for tangled arrows — selection (≥2 shapes) or whole page. Inspired by [comfyui-prettifier](https://github.com/Teknix420/comfyui-prettifier) (MIT).
- **Quality gates:** Zero warnings under `oxlint --deny-warnings .`, `oxfmt --check .`, `tsc --noEmit`, unit tests, and `tsdown` client build.

## Verification

```sh
npm ci
npm run check     # format:check, lint, typecheck, test, build:client
npm run test:e2e  # playwright test
npm run format
npm run lint:fix
```

Sync `../machines` if XState machines change, and update `../repositories.json` snapshot metadata when files here change.
