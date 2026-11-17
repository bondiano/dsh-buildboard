# DSH Buildboard

Язык: [English](README.md) | Русский

Доска в духе Heptabase для DeepSeek Harness: **карточки** (проектные и глобальные), **доски** на [tldraw](https://github.com/tldraw/tldraw) и **агентные воркфлоу** (исследование / имплементация / `/canvas`) на [xstate](https://github.com/statelyai/xstate). Агент правит ту же доску, что и вы; правки помечены `agent`, пока вы сами не коснётесь элемента.

## Скриншот

![Buildboard](docs/screenshots/board.png)

## Возможности

- **Сначала карточки.** Markdown в `<workspace>/.buildboard/cards/` и `$DSH_HOME/buildboard/cards/`. Одна карточка может лежать на многих досках; `[[wiki-ссылки]]` дают backlinks.
- **Доски на tldraw.** Бесконечный холст: notes, frames, arrows и кастомный шейп `card`. Несколько досок на проект.
- **Инструменты агента.** `board_*`, `card_*`, `run_report` — точечные правки и живой sync.
- **`/canvas <запрос>`.** Строит доску о текущей сессии (по умолчанию — объяснить архитектуру) и будит агента структурированным брифом.
- **Research / Implement.** Запуск с тулбара; прогресс в журнале запусков и во frontmatter карточки.
- **Полный экран.** Панель в колонке `main` плюс вкладка правого сайдбара.
- **Legacy-импорт.** Существующий `cult-canvas.canvas` один раз импортируется в доску `main`.

## Установка

```sh
./scripts/install-dsh-macos.sh
```

После установки перезапустите DSH desktop. `dist/` и `lib/` — закоммиченный build output.

tldraw требует [лицензионный ключ](https://tldraw.dev/community/license) для production. Задайте `tldrawLicenseKey` в Settings → Plugins → `@local/dsh-buildboard`. На `127.0.0.1` в development ключ может не понадобиться.

## Использование

### Открыть

- Экран «Старт» / правый сайдбар: вкладка **Buildboard**
- Полный экран: список панелей сайдбара → Buildboard или кнопка Fullscreen на вкладке

### `/canvas`

```text
/canvas
/canvas Покажи auth-flow этой сессии
```

Создаёт доску `session-<id>-…`, открывает её и делает `followup` агенту с canvas-брифом.

### Хранение

| Путь                                          | Содержимое          |
| --------------------------------------------- | ------------------- |
| `<workspace>/.buildboard/boards/*.board.json` | записи tldraw       |
| `<workspace>/.buildboard/cards/*.md`          | проектные карточки  |
| `$DSH_HOME/buildboard/cards/*.md`             | глобальные карточки |

## Разработка

```sh
npm install
npm run check   # format, lint, typecheck, unit, build:client, e2e
```

## Архитектура

- `src/domain/` — card, board, run, xstate-машины
- `src/application/` — библиотека карточек, реестр досок, запуски, брифы
- `src/adapters/` — инструменты, markdown, legacy JSON Canvas
- `src/host/` — Cordis apply, HTTP-маршруты, `/canvas`
- `src/client/` — React-вкладка, панель, tldraw BoardView, настройки

## Лицензия

MIT (плагин). tldraw SDK — под [лицензией tldraw](https://tldraw.dev/community/license).
