# dsh-buildboard Contributor Guide

Heptabase-style spatial whiteboard (`@local/dsh-buildboard`) for DeepSeek Harness: cards, documents, agent research, and implementation workflows on `tldraw` + `xstate`. See [../AGENTS.md](../AGENTS.md).

## Layout

- `index.ts`, `src/settings.ts`, `src/host/routes.ts`: Cordis host plugin, settings schema, and HTTP route registration.
- `src/domain/`: `board.ts`, `card.ts`, `ids.ts`, `route.ts`, `types.ts`, and XState v5 `machines/` (`board-sync.machine.ts`, `run.machine.ts`).
- `src/application/`: `board-document.ts`, `canvas-brief.ts`, `card-library.ts`, `paths.ts`, `run-service.ts`.
- `src/adapters/`: `legacy-json-canvas.ts`, `markdown.ts`, `tools/`.
- `src/infrastructure/`: `web-route-auth.ts` (fail-closed HTTP route admission).
- `src/client/`: React/tldraw UI (`app/`, `board/`, `cards/`, `runs/`, `settings/`), bundled via `tsdown` into `lib/client.js`.
- `dist/`, `lib/`: compiled server (`tsc`) and client (`tsdown`) outputs; `locale/`: `en.json`, `ru.json`, `zh.json`.
- `test/`: `unit/` (`node --test dist/test/unit/*.test.js`) and `e2e/` (`playwright test`).

## Invariants

- **Committed build outputs:** Commit both `dist/` and `lib/client.js` after changes; Nix (`packages/deepseek-harness.nix`) builds `dist/` via `importNpmLock`, while `repositories.json` tracks the full snapshot.
- **Fail-closed auth:** Keep private HTTP routes gated behind `src/infrastructure/web-route-auth.ts`.
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
