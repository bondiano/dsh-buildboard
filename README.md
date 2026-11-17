# DSH Buildboard

Language: English | [Русский](README.ru.md)

Heptabase-style whiteboard for DeepSeek Harness: **cards** (project + global), **boards** on [tldraw](https://github.com/tldraw/tldraw), and **agent workflows** (research / implement / `/canvas`) driven by [xstate](https://github.com/statelyai/xstate). The agent edits the same board you see; edits are marked `agent` until you touch them.

## Screenshot

![Buildboard layout mock from the e2e harness (not the live UI)](docs/screenshots/board.png)

> The image above is a static test mock. The live board opens from the **Buildboard** tab in the right sidebar (or `/canvas` in chat).

## Features

- **Cards first.** Markdown documents in `<workspace>/.buildboard/cards/` and `$DSH_HOME/buildboard/cards/`. One card can sit on many boards; `[[wiki-links]]` get backlinks.
- **Boards on tldraw.** Infinite canvas with notes, frames, arrows and a custom `card` shape. Multiple boards per project.
- **Agent tools.** `board_*`, `card_*`, `run_report` — surgical edits, live sync.
- **`/canvas <request>`.** Builds a board about the current session (default: explain architecture) and wakes the agent with a structured brief.
- **Research / Implement.** Start a run from the toolbar; progress lives on the run ledger and optional card frontmatter.
- **Fullscreen.** Main-column Buildboard panel plus the right-sidebar tab.
- **Legacy import.** Existing `cult-canvas.canvas` is imported once into board `main`.

## Install

```sh
./scripts/install-dsh-macos.sh
```

Restart the DSH desktop app after installing. `dist/` and `lib/` are committed build output.

tldraw requires a [license key](https://tldraw.dev/community/license) for production. Set `tldrawLicenseKey` in Settings → Plugins → `@local/dsh-buildboard` (hobby/trial/commercial). Local `127.0.0.1` may run without a key in development.

## Usage

### Open (what to do)

1. Open any **session** (not the Plugins page).
2. In the **right sidebar**, open the **Buildboard** tab (next to Start / in the panel list).
3. Draw stickies, shapes, and arrows on the tldraw canvas.
4. **Research** / **Implement** starts an agent run with a board brief.
5. In chat: `/canvas` or `/canvas describe the auth flow` — the agent fills the board.

Fullscreen: sidebar panel list → Buildboard, or the Fullscreen control on the tab.

### `/canvas`

```text
/canvas
/canvas Show the auth flow in this session
```

Creates `session-<id>-…` board, opens it, and `followup`s the agent with the canvas brief.

### Storage

| Path                                          | Contents           |
| --------------------------------------------- | ------------------ |
| `<workspace>/.buildboard/boards/*.board.json` | tldraw record maps |
| `<workspace>/.buildboard/cards/*.md`          | project cards      |
| `$DSH_HOME/buildboard/cards/*.md`             | global cards       |

## Development

```sh
npm install
npm run check   # format, lint, typecheck, unit, build:client, e2e
DSH_ALLOW_BROWSER=1 npm run test:e2e -- -g screenshot   # refresh docs/screenshots/board.png
./scripts/publish-upstream.sh                           # push snapshot to GitHub (needs gh auth)
```

## Architecture

- `src/domain/` — card, board, run, xstate machines
- `src/application/` — card library, board registry, run service, briefs
- `src/adapters/` — tools, markdown, legacy JSON Canvas
- `src/host/` — Cordis apply, HTTP routes, `/canvas`
- `src/client/` — React tab, panel, tldraw board view, settings

## License

MIT (plugin). tldraw SDK is under the [tldraw license](https://tldraw.dev/community/license).
