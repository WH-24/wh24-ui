# ТЗ — правки мокапов под product-spec v4

**Дата:** 6 мая 2026
**Контекст:** [`wiki-docs/docs/product-spec-v4.md`](https://github.com/Lenivedz/wiki-docs/blob/main/docs/product-spec-v4.md) §§ 4.1, 5.4, 10, 12, 13.
**Кому:** Claude Code сессия в `wh-ui/`.

После переработки product-spec в v4.3 накопились расхождения между
мокапами и каноном. Этот файл — список правок, которые нужно внести.

**Стиль работы:** один мокап = один PR. **Нельзя сваливать всё в один**.
Это позволит откатывать точечно если что-то пойдёт не так.

**Принципы (см. `HANDOFF.md` и `TZ.md`):**

- Standalone HTML, всё inline (CSS+JS внутри `<style>`/`<script>`)
- Только Manrope из Google Fonts CDN
- JS — минимум: toggle классов, никаких реальных запросов
- Использовать существующие токены из `:root` — новых не вводить
- Hairline `0.5px solid var(--bd)` вместо 1px
- `font-variant-numeric: tabular-nums` для всех чисел в таблицах
- Сохранять existing connections между мокапами (href cross-refs)

---

## M1 + M2 · admin-mockup: убрать API health (один PR)

**Файл:** `admin-mockup.html`
**Зачем:** API health surface удалён из админки решением v4.3 (§ 6.3).
Метрики API живут в Grafana кластера, в админке их нет.

### M1 — sidebar и pane

В sidebar (`<aside class="sidebar">`) удалить строку:
```html
<a class="sb-link" data-admin data-pane="api-health"><span class="sb-link-i">●</span><span>API health</span></a>
```

В контенте (`<main class="content">`) удалить весь блок:
```html
<section class="pane" data-pane="api-health">
  ... всё содержимое (3 sys-stat карточки + таблица из 9 endpoint'ов)
</section>
```

### M2 — health row на дашборде

В pane `data-pane="dashboard"` удалить блок:
```html
<div class="dash-row" data-admin>
<header class="dash-row-head"><span class="dash-row-t">Здоровье системы</span><a class="dash-row-link" data-go="api-health">Подробнее →</a></header>
<div class="health-grid">
  ... три cell: API, База данных, Backup
</div>
</div>
```

### Acceptance

- [ ] В sidebar секция «Система» содержит только Логи + Backup (2 пункта)
- [ ] При role-toggle М↔А — обе оставшиеся ссылки видны только админу
- [ ] Дашборд админа: stat-cards остаются, активность остаётся, health-row нет
- [ ] CSS-классы `.health-grid`, `.health-cell`, `.health-l`, `.health-v`,
  `.health-d`, `.health-dot` — можно удалить из `<style>` (больше не используются)
- [ ] Файл уменьшается на ~3-5 КБ

PR title: `mockup(admin): remove API health surface and dashboard health row`

---

## M3 · hub-mockup: добавить «Нужно прочитать»

**Файл:** `hub-mockup.html`
**Зачем:** Compliance-pending видимость — § 10 спека. Сейчас на хабе
блока нет, что нарушает workflow (пользователь не видит назначенные ему
must-read'ы).

### Размещение

Внутри `<main class="page">`, в `<div class="cols">` левая колонка
`<div class="col-stack">` — добавить **первой** карточкой (выше
«Продолжить чтение»). Структурно:

```
.col-stack
  ├── card "Нужно прочитать"  ← НОВАЯ
  ├── card "Продолжить чтение"
  └── card "Закладки"
```

### Контент

```html
<section class="card must-read" aria-label="Нужно прочитать">
  <header class="card-h">
    <div class="card-h-l">
      <span class="card-h-t">Нужно прочитать</span>
      <span class="card-h-c">3</span>
    </div>
    <div class="card-h-r">
      <button class="chev" aria-label="Свернуть">▾</button>
    </div>
  </header>
  <a class="mr-item overdue" href="article-std-mockup.html">
    <span class="tm-dot" style="background: var(--tp-std)"></span>
    <span class="mr-title">Корпоративная этика и режим</span>
    <span class="mr-deadline overdue">просрочено 3 дня</span>
  </a>
  <a class="mr-item" href="article-std-mockup.html">
    <span class="tm-dot" style="background: var(--tp-std)"></span>
    <span class="mr-title">Стандарт пожарной безопасности v3</span>
    <span class="mr-deadline">срок 15 мая · 11 дней</span>
  </a>
  <a class="mr-item" href="article-std-mockup.html">
    <span class="tm-dot" style="background: var(--tp-std)"></span>
    <span class="mr-title">Стандарт BIM-моделирования v2.1</span>
    <span class="mr-deadline">срок 22 мая · 18 дней</span>
  </a>
</section>
```

### Стили (использовать существующие токены)

```css
.card.must-read {
  /* акцентная обводка только если есть просроченные */
}
.card.must-read:has(.mr-item.overdue) {
  border-color: var(--bad-bd);
  background: linear-gradient(180deg, var(--bad-bg) 0%, var(--surf) 90%);
}
.mr-item {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 10px 0;
  border-top: 0.5px solid var(--bd-soft);
  cursor: pointer;
  transition: color 0.15s;
}
.mr-item:first-of-type { border-top: none; padding-top: 2px; }
.mr-item:hover .mr-title { color: var(--terra-d); }
.mr-title {
  font-size: 13px;
  color: var(--ink);
  font-weight: 500;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mr-deadline {
  font-size: 11px;
  color: var(--ink-3);
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
}
.mr-deadline.overdue {
  color: var(--bad);
  font-weight: 500;
}
```

### Поведение (минимальное JS — не обязательно)

- chev `▾` на клик сворачивает карточку (toggle класса `.collapsed`)
- Просроченные элементы (`.overdue`) — сверху, акцент `var(--bad)`

### Не делаем

- Реальный fetch / state — данные хардкодом в HTML
- Notification dot на topbar — отдельная задача, не сейчас
- Если список пуст — секция не показывается. В мокапе показываем 3 элемента (one overdue, two upcoming)

### Acceptance

- [ ] Блок «Нужно прочитать» появляется первым в левой колонке
- [ ] Один элемент `overdue` с красным дедлайном, два — с обычным
- [ ] Тёмная тема не ломает читаемость (`var(--bad-bg)` на `:root[data-theme=dark]`
  тоже работает — токен переопределён в base)
- [ ] Без новых цветов в `:root`
- [ ] Hover на строку — title уходит в `var(--terra-d)`

PR title: `mockup(hub): add must-read panel above continue-reading`

---

## M5 · NEW share-link-modal.html

**Файл:** новый `share-link-modal.html`
**Зачем:** Anonymous guest flow — spec v4 § 4 + § 7.1 W3. Manager
создаёт публичную ссылку для внешнего гостя на конкретный проект.

### Решённые параметры (от владельца, май 2026)

- **TTL фиксированный — 24 часа.** Не выбор пользователя, единый
  стандарт. После 24 часов токен автоматически удаляется
- Создание — **только из админ-панели** (entry point — admin-mockup,
  не на странице проекта)
- Manager может отозвать раньше через revoke-кнопку
- Получатель видит **только проект и связанные изображения**, без
  необходимости логина в WH ID

### Поведение

Модалка открывается из admin-mockup кнопкой «+ Создать ссылку» в
новом sub-pane или прямо в существующем. Содержит:

- Заголовок «Публичная ссылка на проект»
- Описание: «Получатель видит только выбранный проект и связанные с
  ним изображения. Срок действия — 24 часа. После — автоматически
  удалится.»
- Выбор материала (select — список проектов)
- Превью URL: `https://wiki.wowhaus.ru/share/abc123def456`
- Метка «Истекает: завтра, 14:32»
- Кнопки: «Создать и скопировать» (primary), «Закрыть» (ghost)
- Список активных share-links под формой (5–7 примеров): material name,
  истекает через ___ часов, кто создал, кнопка ⊠ revoke

### Структура (минимум)

```html
<body>
  <!-- Background page (admin) -->
  <div class="behind">
    ...
  </div>

  <!-- Backdrop + modal -->
  <div class="share-bd" id="shareBd">
    <div class="share-modal" role="dialog">
      <header class="share-h">
        <h2>Публичная ссылка на проект</h2>
        <button class="share-close">×</button>
      </header>
      <div class="share-body">
        <p class="share-desc">
          Получатель видит только выбранный проект и связанные с ним
          изображения. Срок действия — <b>24 часа</b>. После
          автоматически удалится.
        </p>

        <div class="share-field">
          <label>Проект</label>
          <select>
            <option>ЖК Северный свет — концепция фасада</option>
            <option>Парк Мещерский — этап 2</option>
            <option>Реновация Нагатино</option>
            <option>Тушинский берег — набережная</option>
          </select>
        </div>

        <!-- Static label, не selector -->
        <div class="share-field">
          <span class="share-ttl-label">Срок действия</span>
          <span class="share-ttl-value">24 часа · истекает завтра, 14:32</span>
        </div>

        <div class="share-actions">
          <button class="ghost">Закрыть</button>
          <button class="primary">Создать и скопировать ссылку</button>
        </div>
      </div>

      <div class="share-divider">Активные ссылки <span class="share-cnt">3</span></div>
      <div class="share-list">
        <div class="share-row">
          <span class="share-row-t">ЖК Северный свет — концепция фасада</span>
          <span class="share-row-when">истекает через 18 ч</span>
          <span class="share-row-author">создал АК</span>
          <button class="share-revoke" title="Отозвать">⊠</button>
        </div>
        <div class="share-row">
          <span class="share-row-t">Парк Мещерский — этап 2</span>
          <span class="share-row-when">истекает через 4 ч</span>
          <span class="share-row-author">создала ЛР</span>
          <button class="share-revoke" title="Отозвать">⊠</button>
        </div>
        <div class="share-row expired">
          <span class="share-row-t">Реновация Нагатино</span>
          <span class="share-row-when">просрочено · удаляется</span>
          <span class="share-row-author">создал АК</span>
          <span class="share-row-expired">○</span>
        </div>
      </div>
    </div>
  </div>
</body>
```

### Цвета и токены

Использовать `var(--terra)`, `var(--ink)`, `var(--surf)`, `var(--bd-strong)`.
Backdrop — `rgba(26,26,26,0.5) + blur(4px)` как в cmdk.

`.share-row.expired` — opacity 0.4, текст серый
`.share-row-when` — `var(--ink-3)`, `font-variant-numeric: tabular-nums`
«через 4 ч» с таким стилем

### Связи

- Из `admin-mockup.html` нужна точка входа в эту модалку. **Куда
  именно**: в существующих pane нет очевидного места. Предлагаю:
    - (a) Новый sub-pane «Публичные ссылки» в sidebar секции «Контент»
    - (b) Action «Поделиться публично» в `cover-actions`
      `article-mockup.html` (для menager'а — уже есть кнопка `⤴`,
      она должна вести в этот модал)
- **Рекомендация:** (a) и (b) одновременно. Sub-pane показывает
  обзор+revoke, action из проекта = быстрый создать.
- В `cmdk-mockup.html` секции «Команды» добавить «Создать публичную
  ссылку» (admin-only, через `data-admin`)

### Acceptance

- [ ] Модалка центрирована, ширина 560px, max-height 90vh
- [ ] **Нет** UI выбора TTL — фиксированная метка «24 часа»
- [ ] Список активных ссылок с возможностью revoke
- [ ] Просроченная ссылка визуально отличается (.expired)
- [ ] Backdrop click + Esc + Close — все ведут на ту страницу откуда пришли
- [ ] Размер файла ~18-25 KB inline
- [ ] В admin-mockup есть entry point (минимум кнопка где-то)

PR title: `mockup(share): NEW share-link-modal — 24h fixed TTL`

---

## M6 · article-edit-mockup: crew-блок без WH ID

**Файл:** `article-edit-mockup.html`
**Зачем:** В spec v4.3 § 12 команда — это просто текстовый блок. Никаких
ссылок на WH ID. Старая версия мокапа подсказывает «Добавить из WH_ID» и
указывает источник `corp.wowhaus/wh_id` — это нужно убрать.

### Текущее состояние (~lines 916–933)

```html
<div class="crew open">
  <div class="crew-h">
    <span class="crew-h-i">👥</span>
    <span class="crew-h-t">Команда проекта</span>
    <span class="crew-h-cnt">4 · WH_ID</span>      <!-- ❌ убрать "WH_ID" -->
    <span class="crew-h-x">▾</span>
  </div>
  <div class="crew-body">
    <div class="crew-list">
      <div class="crew-row">...</div>
      ...
    </div>
    <div class="crew-add">Добавить из WH_ID</div>   <!-- ❌ убрать "из WH_ID" -->
    <div class="crew-source">из corp.wowhaus/wh_id</div>  <!-- ❌ удалить целиком -->
  </div>
</div>
```

### Что должно быть

```html
<div class="crew open">
  <div class="crew-h">
    <span class="crew-h-i">👥</span>
    <span class="crew-h-t">Команда проекта</span>
    <span class="crew-h-cnt">4 человека</span>
    <span class="crew-h-x">▾</span>
  </div>
  <div class="crew-body">
    <div class="crew-list">
      <div class="crew-row">
        <span class="crew-name" contenteditable>Антон Краснов</span>
        <span class="crew-dash">—</span>
        <span class="crew-role" contenteditable>главный архитектор</span>
        <span class="crew-x">×</span>
      </div>
      <div class="crew-row">
        <span class="crew-name" contenteditable>Маша Воронцова</span>
        <span class="crew-dash">—</span>
        <span class="crew-role" contenteditable>фасадный консультант</span>
        <span class="crew-x">×</span>
      </div>
      <div class="crew-row">
        <span class="crew-name" contenteditable>Игорь Серов</span>
        <span class="crew-dash">—</span>
        <span class="crew-role" contenteditable>инженер · узлы</span>
        <span class="crew-x">×</span>
      </div>
      <div class="crew-row">
        <span class="crew-name" contenteditable>Лена Романова</span>
        <span class="crew-dash">—</span>
        <span class="crew-role" contenteditable>BIM-координатор</span>
        <span class="crew-x">×</span>
      </div>
    </div>
    <button class="crew-add-btn">+ Добавить строку</button>
  </div>
</div>
```

### Изменения

- `crew-h-cnt` показывает количество в человеческом виде («4 человека»),
  не «4 · WH_ID»
- `crew-row` — это пара contenteditable полей с разделителем `—`,
  больше не аватар + цвет
- Аватары `crew-av` (с цветными вариантами `.b/.c/.d`) — **убрать**.
  CSS-классы можно оставить если используются ещё где-то, но в этом
  блоке они не применяются.
- Удалить `crew-source` div полностью
- «Добавить из WH_ID» → кнопка «+ Добавить строку» (стиль такой же как
  insert-zone-plus)

### Стили (удалить или поправить)

```css
/* Удалить */
.crew-av { ... }
.crew-source { ... }

/* Изменить */
.crew-row {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 6px 0;
  border-top: 0.5px solid var(--bd-soft);
}
.crew-row:first-child { border-top: none; padding-top: 0; }
.crew-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--ink);
  /* contenteditable стилизация */
  outline: none;
  padding: 1px 3px;
  border-radius: 2px;
}
.crew-name:focus { background: var(--terra-bg); }
.crew-dash {
  color: var(--ink-3);
  font-size: 12px;
}
.crew-role {
  font-size: 12px;
  color: var(--ink-2);
  flex: 1;
  outline: none;
  padding: 1px 3px;
  border-radius: 2px;
}
.crew-role:focus { background: var(--terra-bg); }
.crew-x {
  color: var(--ink-4);
  font-size: 14px;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s;
}
.crew-row:hover .crew-x { opacity: 0.7; }
.crew-x:hover { opacity: 1; color: var(--bad); }

.crew-add-btn {
  width: 100%;
  padding: 8px;
  background: var(--surf-2);
  border: 0.5px dashed var(--bd-strong);
  color: var(--ink-3);
  font-size: 12px;
  border-radius: var(--r-sm);
  cursor: pointer;
  margin-top: 6px;
}
.crew-add-btn:hover {
  border-color: var(--terra-bd);
  color: var(--terra-d);
}
```

### Поведение

- Click на name/role → стандартный contenteditable
- Click на `×` → удаление row (toggle display:none, подсчёт `crew-h-cnt`)
- Click на «+ Добавить строку» → новый пустой row с placeholder text
  «Имя» / «Роль»
- Никаких автоподсказок, никаких dropdown с предложением имён,
  никакого взаимодействия с WH ID

### Acceptance

- [ ] В мокапе нет ни одного упоминания «WH_ID», «WH ID», «wh_id»,
  «corp.wowhaus», «из ID» в видимом тексте
- [ ] Crew-row выглядит как структурированная пара "Имя — Роль"
- [ ] Иконка 👥 в заголовке остаётся
- [ ] При hover на row появляется крестик удаления
- [ ] Кнопка «+ Добавить строку» открывает новую пустую строку

PR title: `mockup(article-edit): replace WH_ID-coupled crew with plain text rows`

---

## M7 · browser/search: проверить guest-видимость решений

**Файлы:** `browser-mockup.html`, `search-mockup.html`
**Зачем:** Spec v4.3 § 4.1: Решения видят все сотрудники, гостей нет.
Сейчас в мокапах нет UI guest-state, поэтому проверка возможно вырождена,
но нужно убедиться что когда guest-state добавится — решения не показываются.

### Что проверить и изменить

**В `browser-mockup.html`:**

1. type-bar (вкладки типов) — найти секцию
   ```html
   <button class="tb-btn" data-type="sol">...
   ```
   В type-bar **нет ничего лишнего сейчас**, изменения не нужны для
   default user.

2. Если planируется guest-state (например через `body.role-guest`):
   - Скрывать `tb-btn[data-type="sol"]` через
     `body.role-guest .tb-btn[data-type="sol"] { display: none }`
   - Скрывать карточки `.card[data-type="sol"]` — аналогично
   - Type-bar при guest показывает только: «Все», «Проект»

3. Сейчас можно либо:
   - (a) **Ничего не менять**, добавим когда будет реализован role-toggle
     для guest
   - (b) Добавить body-class `role-default` по умолчанию + готовый CSS
     для `body.role-guest` (без UI toggle)

**Рекомендация: вариант (a)** — не делаем preemptively, ждём задачу
на guest-flow. Текущая правка — просто пометить в коммите что это
проверено и решений-видимости-у-гостя в мокапе пока не учитываем.

**В `search-mockup.html`:**

1. type-pills (Все / Статьи / Блоки / Изображения) — гостю показывать
   только «Изображения» (от проектов) и упоминания проектов в общем
   списке. Это сложная логика — **отложить** до реализации guest-state.

### Acceptance

- [ ] В browser/search type-bar и фильтры остаются как есть
- [ ] В коммите упомянуть: «проверено, расхождений с § 4.1 в текущем
  состоянии мокапа нет; guest-видимость будет реализована вместе
  с share-link-modal в M5»

PR title: `mockup(browser): document guest visibility for solutions (no changes)`

Это самый «лёгкий» PR — практически документационный коммит.

---

## Порядок работы

Рекомендую делать в этой последовательности:

1. **M1 + M2 (один PR)** — admin без API health. Малый объём, чистка.
2. **M6** — crew-блок в edit-mockup. Точечная правка, важная для спеки.
3. **M3** — must-read блок на хабе. Новая фича, среднего объёма.
4. **M5** — новый share-link-modal. Самостоятельный мокап, не зависит
   от других.
5. **M7** — browser/search документационный коммит, можно делать
   параллельно или в самом конце.

Каждый PR — отдельная ветка, отдельный merge. Не сваливать M1+M3+M6
в один.

---

## M8 · admin-mockup: pane «Публичные ссылки»

**Файл:** `admin-mockup.html`
**Зачем:** Точка входа для M5 (share-link-modal). Manager должен иметь
пункт меню для управления share-links.

### Изменения

В sidebar секция «Контент» (после Корзина / Фасеты / Теги) добавить:
```html
<a class="sb-link" data-pane="share-links"><span class="sb-link-i">⤴</span><span>Публичные ссылки</span><span class="sb-link-cnt">3</span></a>
```

Новый pane:
```html
<section class="pane" data-pane="share-links">
  <div class="ph">
    <div class="ph-l">
      <h1 class="ph-h">Публичные ссылки</h1>
      <span class="ph-meta">Внешние ссылки на проекты. Срок действия — 24 часа.</span>
    </div>
    <button class="ph-btn primary" onclick="window.location.href='share-link-modal.html'">+ Создать ссылку</button>
  </div>

  <div class="row-card">
    <div class="row-h">
      <span></span>
      <span>Проект</span>
      <span>Создатель</span>
      <span>Истекает через</span>
      <span>Использований</span>
      <span style="text-align:right">Действие</span>
    </div>
    <!-- 5-7 строк -->
    <div class="share-link-row">
      <span class="rr-icon proj">▤</span>
      <div>
        <div class="rr-title">ЖК Северный свет — концепция фасада</div>
        <div class="rr-tag">https://wiki.wowhaus.ru/share/abc123...</div>
      </div>
      <div class="rr-author"><span class="rr-av">АК</span><span>Антон К.</span></div>
      <span class="rr-when">18 часов</span>
      <span class="rr-uses">7 переходов</span>
      <div class="rr-actions">
        <button class="rr-btn ghost">Скопировать</button>
        <button class="rr-btn warn">Отозвать</button>
      </div>
    </div>
    ...
  </div>
</section>
```

### Acceptance

- [ ] В sidebar добавлен новый пункт «Публичные ссылки»
- [ ] При клике открывается pane со списком и кнопкой «Создать ссылку»
- [ ] Кнопка «Создать ссылку» ведёт на `share-link-modal.html`
- [ ] Видимо для manager и admin (без `data-admin`)

PR title: `mockup(admin): add share-links pane`

Делать **в одном PR с M5** или сразу после.

---

## Что не делаем в этом наборе

Эти вопросы открыты в spec v4 (§ 7), но мокапы их пока не отражают —
не пытаться их закрыть в этом наборе:

- W4 (переименование должностей) — это backend-логика, мокапа нет
- § 11.4 reading benchmark — попадает в первый релиз через статью
  «Добро пожаловать в вики», но сам мокап welcome-статьи отдельной
  правкой когда дойдёт до контента (не сейчас)

---

## Связанные документы

- [`HANDOFF.md`](HANDOFF.md) — общие принципы кода в мокапах, дизайн-система
- [`TZ.md`](TZ.md) — оригинальное ТЗ на мокапы (Tier 1-3)
- [`REPORT.md`](REPORT.md) — авторская сводка по концепции
- [`wiki-docs/docs/product-spec-v4.md`](https://github.com/Lenivedz/wiki-docs/blob/main/docs/product-spec-v4.md) — полный спек продукта (когда смержится)
