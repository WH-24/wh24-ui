# Changelog

Все заметные изменения в wh-ui фиксируются здесь. Формат — [Keep a Changelog](https://keepachangelog.com/),
версионирование — [SemVer](https://semver.org/).

Каждый пакет (`@wowhaus-24/ui-tokens`, `@wowhaus-24/ui-react`) бампается
независимо. В разделе версии указывается какие пакеты затронуты.

## [Unreleased]

### Added — `@wowhaus-24/ui-react`
- `ListPage`: настройка колонок — шестерёнка в конце шапки таблицы открывает
  список колонок с галочками (показать/скрыть). Выбор запоминается для
  пользователя (localStorage, по `scope` фильтра). Последнюю видимую колонку
  скрыть нельзя; служебные колонки без заголовка (например аватар) всегда видимы.

### Changed — `@wowhaus-24/ui-react`
- `ListPage`: в режиме карточек постраничная навигация заменена на подгрузку по
  скроллу — карточки догружаются порциями по мере прокрутки, без ограничения
  «страницей». Таблица листается кнопками «Назад/Далее», как раньше.
- `FilterBar`: фильтр, отмеченный булавкой «по умолчанию», показывается первым в
  списке фильтров — раньше он стоял на своём месте в общем порядке, и его
  приходилось искать глазами. Порядок остальных не меняется.
- `FilterBar`: применённые условия фильтра (без сохранённого пресета) теперь
  показываются чипами прямо в строке поиска («Поле: значение»), у каждого свой
  крестик для сброса. Раньше в строке отображалось только название пресета, и
  ad-hoc фильтры были не видны при закрытой панели.

### Added — `@wowhaus-24/ui-tokens@0.1.0`, `@wowhaus-24/ui-react@0.1.0`
- Первичный scaffold монорепо.
- `tokens.css` с полной палитрой Wowhaus (terra, ink, surf, type colors,
  status tones), радиусы, шрифты.
- Тёмная тема через `html[data-theme="dark"]`.
- `base.css` — минимальный reset.
- `tokens.ts` — типизированный экспорт CSS-переменных + типы
  `ArticleType`, `StatusTone` со словарями цветов.
- `theme.ts` — vanilla API: `initTheme`, `setMode`, `setTheme`,
  `toggleTheme`, `getTheme`, `getMode`, `subscribe`. Поддержка
  `'light' | 'dark' | 'system'`, persistence в localStorage,
  cross-tab синхронизация, реакция на `prefers-color-scheme`.
- `ThemeProvider` + `useTheme` для React.
- Мокапы (8 экранов) перенесены из `~/Desktop/WH_PRESENTATION/Mocups/`.
- Styleguide перенесён.
- CI workflow (typecheck + build на push/PR в main).

### Pending
- Миграция примитивов из `wiki-web/src/shared/ui/` в `@wowhaus-24/ui-react`.
- SVG icon library в `icons/`.
- Headless обёртки на Radix.
- Публикация в private npm registry.
