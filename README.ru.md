# DSH Buildboard

Язык: [English](README.md) | Русский

Доска в духе Heptabase для DeepSeek Harness: **карточки** (проект + глобальные), **доски** на [tldraw](https://github.com/tldraw/tldraw) и **воркфлоу агента** (research / implement / `/canvas`) на [xstate](https://github.com/statelyai/xstate). Агент правит ту же доску, что видите вы; правки помечены `агент`, пока вы сами не тронете элемент.

## Скриншот

![Buildboard](docs/screenshots/board.png)

## Возможности

- **Сначала карточки.** Markdown в `<workspace>/.buildboard/cards/` и `$DSH_HOME/buildboard/cards/`. Одна карточка — на многих досках; `[[wiki-ссылки]]` дают backlinks.
- **Доски на tldraw.** Бесконечный холст, стикеры, фреймы, стрелки и шейп `card`. Несколько досок на проект.
- **Инструменты агента.** `board_*`, `card_*`, `run_report`.
- **`/canvas <запрос>`.** Доска о текущей сессии (по умолчанию — объяснить архитектуру).
- **Research / Implement.** Запуск с панели; статус в ledger и во frontmatter карточки.
- **Полный экран.** Панель в колонке `main` и вкладка справа.
- **Legacy.** `cult-canvas.canvas` один раз импортируется в доску `main`.

## Установка

```sh
./scripts/install-dsh-macos.sh
```

После установки перезапустите DSH. `dist/` и `lib/` — закоммиченный build output.

Для production у tldraw нужен [ключ лицензии](https://tldraw.dev/community/license): Settings → Plugins → `@local/dsh-buildboard` → `tldrawLicenseKey`.

## Команда `/canvas`

```text
/canvas
/canvas Покажи auth-flow этой сессии
```

## Разработка

```sh
npm install
npm run check
```

## Лицензия

MIT (плагин). SDK tldraw — под [лицензией tldraw](https://tldraw.dev/community/license).
