# Wowhaus — глобальные правила по стилям

Обязательны для **всех** модулей и сервисов (WH_Portale: hr/projects/tasks/
reporting/presentations, wh24-wiki-web, wh24-aho-web, Auth-SPA и все будущие).
Источник истины по визуалу — этот репозиторий (`wh24-ui`).

## 1. Токены, не значения

- Цвета, радиусы, отступы, типографика берутся **только** из
  [`packages/tokens/src/tokens.css`](packages/tokens/src/tokens.css).
- Хардкод hex/px, для которых существует токен, — запрещён. Нет подходящего
  токена → добавь новый токен в `tokens.css`, не магическое число в модуль.
- Бренд: терракот `--terra: #dd6731`, тёмный вариант `--terra-d: #b8501f`.
  В тёмной теме бренд **не меняется**.
- Тёмная тема — только через `html[data-theme="dark"]`
  (`@wowhaus-24/ui-tokens/theme` / `ThemeProvider` из `ui-react`).
  Модуль не изобретает собственный механизм тем.

## 2. Кнопки — один глобальный набор

Канон: [`packages/tokens/src/button.css`](packages/tokens/src/button.css).

| Класс | Назначение |
|---|---|
| `.btn` | база (всегда вместе с вариантом) |
| `.btn-primary` | главное действие экрана — терракот `--terra`, hover `--terra-d`; одно на экран |
| `.btn-secondary` | обычное действие (поверхность + рамка) |
| `.btn-ghost` | тихое/третичное действие |
| `.btn-danger` | разрушающее действие (`--bad`) |
| `.btn-sm` | компактный размер |
| `.split-btn` + `.split-btn-main`/`.split-btn-toggle` | кнопка с выпадающим меню |

Правила:

- Подключение: `import "@wowhaus-24/ui-tokens/button.css"` после `tokens.css`.
- Модули **не определяют** свои `.btn-*` классы и не перекрашивают primary.
- Именование — один дефис (`.btn-primary`). BEM-вариант `.btn--primary`
  (наследие `@company/design-system`) — deprecated-алиас, в новом коде не
  используется.
- Иконка-кнопка 32×32 — `IconButton` из `@wowhaus-24/ui-react`.

## 3. Подключение модуля (чек-лист)

```ts
// main.tsx
import "@wowhaus-24/ui-tokens/tokens.css";
import "@wowhaus-24/ui-tokens/base.css";
import "@wowhaus-24/ui-tokens/button.css";
import { ThemeProvider } from "@wowhaus-24/ui-react";
```

- Легаси-модуль с собственными именами переменных → тонкий bridge-слой,
  где каждая старая переменная — алиас токена wh24-ui (эталон:
  `WH_Portale/apps/hr/styles.css`, блок «Design tokens»). Bridge не вводит
  новых значений — только алиасы.
- React-компоненты, нужные более чем одному модулю, добавляются в
  `@wowhaus-24/ui-react` (headless, без бизнес-сущностей), а не копируются.

## 4. Статусные цвета

`--good/--warn/--bad/--info` (+ `-bg`/`-bd` тинты) — для бейджей, тостов,
валидации. Не подменять самодельными зелёными/красными.

## 5. Известные исключения (легаси, мигрировать по мере работы)

| Где | Что | План |
|---|---|---|
| `WH_Portale/packages/design-system` | автономная копия токенов (`--primary` и др.) | значения выровнены на терракот; при работе над projects/tasks/reporting переводить на прямое потребление wh24-ui |
| `WH_Portale/apps/hr/.../marketing/portfolio.css` | scoped-стили `.pg-root .btn-dark/.btn-outline` генератора портфолио | отдельный продуктовый стиль модуля; primary-действия при редизайне перевести на `.btn-primary` |

Новые исключения не создаются. Если кажется, что модулю нужен «свой» стиль
кнопки — это вопрос к дизайн-системе (новый вариант в `button.css`), а не
локальный CSS.
