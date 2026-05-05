# Changelog

Все заметные изменения в wh-ui фиксируются здесь. Формат — [Keep a Changelog](https://keepachangelog.com/),
версионирование — [SemVer](https://semver.org/).

Каждый пакет (`@wowhaus/ui-tokens`, `@wowhaus/ui-react`) бампается
независимо. В разделе версии указывается какие пакеты затронуты.

## [Unreleased]

### Added — `@wowhaus/ui-tokens@0.1.0`, `@wowhaus/ui-react@0.1.0`
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
- Миграция примитивов из `wiki-web/src/shared/ui/` в `@wowhaus/ui-react`.
- SVG icon library в `icons/`.
- Headless обёртки на Radix.
- Публикация в private npm registry.
