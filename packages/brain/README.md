# @wowhaus-24/brain-react

Компоненты панели «Спросить ИИ» и экрана «Агенты» (WH24 Brain) для портала и
фронтов модулей: разметка ответа с цитатами, источники, сообщения, карточка
действия агента, композер, индикатор квоты; конструктор агента (профиль,
триггеры, инструменты, знания, память), журнал запусков, «Поля ИИ» (колонки
списков, которые заполняет модель), генераторы (итог недели, стендап, дайджест
проекта, сводка руководителя) и типизированный клиент `wh24-brain-api`.

Пакет **data-agnostic**: данные и действия приходят через пропсы и колбэки,
состояние разговора (тред, сообщения, выбранная модель) держит хост. Пакет
ничего не кеширует в `localStorage`.

## Правила доступа (требование владельца, 06.11.2026)

Права проверяет сервер. Всё, что пришло в `SearchHit[]` и `Run.citations`, уже
отфильтровано по правам пользователя — интерфейс показывает это как есть и
ничего не скрывает сам. `SourceList` показывается под каждым ответом всегда,
даже пустой («Ответ без ссылок на документы портала»), чтобы было видно, на что
опирался ответ.

## Что экспортируется

| Экспорт | Что делает |
|---|---|
| `createBrainApi({ base, fetch?, headers? })` | `search`, `ask` (202 `{run_id}`), `getRun`, `getAgentRun`, `waitForRun` (опрос 1 → 3 с, один запрос в полёте, пауза при скрытой вкладке, `signal`), `feedback`; агенты — см. раздел ниже; ошибки — `BrainApiError` (`quotaExceeded` = 429, `budgetExceeded` = 429 `budget`, `field` у 400, `code`) |
| Типы | `BrainContext`, `SearchHit`, `Run`, `Citation`, `RunStep`, `PendingAction`, `SuggestedAction`, `BrainSource` … |
| `Markdown` | ответ в markdown без сырого HTML; `[n]` → `CitationChip` (`onCitationClick`), внутренние ссылки → `onNavigate(path)`, внешние — `_blank noreferrer`; под таблицей «Скачать .xlsx», под кодом «Скачать .csv/.txt» |
| `SourceCard`, `SourceList` | иконка модуля, заголовок, сниппет как прислал сервер, «Открыть» через `onOpen(url)`; `activeN` подсвечивает и прокручивает к источнику |
| `AssistantMessage` | текст без пузыря; строка действий Копировать · Создать задачу · Повторить · 👍 👎 и чипы follow-up — каждая кнопка появляется только от своего колбэка |
| `UserMessage` | вопрос компактно справа, с вложениями |
| `AgentSteps`, `AiActionCard` | шаги агента; карточка действия (превью полей, предупреждения, «Подтвердить»/«Отмена», фокус после решения) |
| `BrainComposer` | автовысота, Enter/Shift+Enter, вложения (скрепка, Ctrl+V, перетаскивание), кнопки «+», «@», «/» от колбэков, `disabledReason` (квота) |
| `addBrainFiles` | проверка и чтение файлов в data-URL (лимиты как на сервере) |
| `UsageMeter`, `AiLabel`, `PrivacyNotice` | «Сегодня 12 % · Месяц 40 %» (с 90 % — предупреждение); «Ответ ИИ · по запросу …»; напоминание о приватности |
| `AgentProfile`, `TriggerEditor`, `ScheduleEditor`, `ToolPicker`, `KnowledgePicker`, `MemoryEditor` | форма профиля агента по секциям и её части — см. «Агенты» |
| `RunLogTable`, `RunDetail` | журнал запусков и детали запуска — см. «Агенты» |
| `AgentCard`, `AgentPresetCard`, `AgentBuilderChat`, `BrainSwitch` | карточка агента и пресета, диалог-конструктор, переключатель — см. «Агенты» |
| `useAiFieldColumns`, `AiFieldCell`, `AiFieldColumnMenu`, `AiFieldDialog` | колонки «Поле ИИ» для списков, ячейка, меню заголовка, создание/правка колонки — см. «Поля ИИ и генераторы» |
| `GeneratorDialog`, `BrainDialog`, `BrainConfirm` | окно генераторов; общее модальное окно и подтверждение пакета |
| `AskAiPanel` | контейнер `layout: "side" \| "page"`: шапка со слотами контекста и модели, «Новый чат», «⤢», «×», переключатель «Найти \| Спросить», пустое состояние с пресетами, лента, источники, композер, низ |

## Подключение

```ts
// main.tsx — один раз, как у остальных пакетов
import '@wowhaus-24/ui-tokens/tokens.css'
import '@wowhaus-24/ui-tokens/base.css'
import '@wowhaus-24/ui-tokens/button.css'
```

```tsx
import { useRef, useState } from 'react'
import {
  AskAiPanel,
  AssistantMessage,
  BrainComposer,
  UsageMeter,
  UserMessage,
  createBrainApi,
  type Run,
} from '@wowhaus-24/brain-react'

const brain = createBrainApi({ base: '/brain/api/v1', fetch: whFetch })

type Msg = { id: string; role: 'user' | 'assistant'; text: string; run?: Run }

export function AskAiDrawer({ onClose, navigateTo }: { onClose: () => void; navigateTo: (p: string) => void }) {
  const [mode, setMode] = useState<'search' | 'ask'>('ask')
  const [draft, setDraft] = useState('')
  const [messages, setMessages] = useState<Msg[]>([])
  const [busy, setBusy] = useState(false)
  const [activeSource, setActiveSource] = useState<number>()
  const abort = useRef<AbortController>()

  const last = messages.at(-1)?.run

  async function send() {
    const q = draft.trim()
    if (!q) return
    setDraft('')
    setMessages((m) => [...m, { id: crypto.randomUUID(), role: 'user', text: q }])
    setBusy(true)
    abort.current = new AbortController()
    try {
      const { run_id } = await brain.ask({ q, thread_id: threadId })
      const id = crypto.randomUUID()
      setMessages((m) => [...m, { id, role: 'assistant', text: '' }])
      const run = await brain.waitForRun(run_id, {
        signal: abort.current.signal,
        onUpdate: (r) => setMessages((m) => m.map((x) => (x.id === id ? { ...x, text: r.answer_md, run: r } : x))),
      })
      if (run.status === 'failed') setError(run.error ?? 'Не удалось получить ответ')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AskAiPanel
      layout="side"
      mode={mode}
      onModeChange={setMode}
      onNewChat={() => setMessages([])}
      onClose={onClose}
      presets={[{ label: 'Кратко о записи' }, { label: 'Что я пропустил' }]}
      onPreset={(p) => setDraft(p.prompt ?? p.label)}
      sources={last?.citations}
      activeSource={activeSource}
      onOpenSource={(url) => navigateTo(url)}
      busy={busy}
      composer={
        <BrainComposer
          value={draft}
          onChange={setDraft}
          onSend={send}
          busy={busy}
          onStop={() => abort.current?.abort()}
          disabledReason={usage.month >= 100 ? 'Месячный лимит исчерпан' : null}
        />
      }
      footer={<UsageMeter today={usage.today} month={usage.month} />}
    >
      {messages.map((m) =>
        m.role === 'user' ? (
          <UserMessage key={m.id} text={m.text} />
        ) : (
          <AssistantMessage
            key={m.id}
            text={m.text}
            pending={busy && m.id === messages.at(-1)?.id}
            citations={m.run?.citations}
            steps={m.run?.steps}
            activeCitation={activeSource}
            onCitationClick={setActiveSource}
            onNavigate={navigateTo}
            onCopy={(t) => navigator.clipboard.writeText(t)}
            onFeedback={(vote) => m.run && brain.feedback({ run_id: m.run.id, vote })}
            followUps={m.run?.suggested_actions}
            onFollowUp={(s) => setDraft(s.prompt ?? s.label)}
          />
        ),
      )}
    </AskAiPanel>
  )
}
```

Боковую панель (440 px справа, `position: fixed` поверх контента) позиционирует
хост; `AskAiPanel layout="side"` отвечает только за внутреннюю раскладку и
держит ленту у последнего сообщения.

## Агенты (0.2.0)

Компоненты экрана «Агенты»: конструктор, триггеры, журнал. Как и всё в пакете —
data-agnostic: данные и действия через пропсы и колбэки, состояние (черновик
профиля, сообщения конструктора, список запусков) держит хост, в `localStorage`
пакет ничего не пишет. Контракт — `wh24-brain-api/docs/API.md`, раздел «Агенты ИИ».

### Клиент

```ts
const brain = createBrainApi({ base: '/brain/api/v1', fetch: whFetch })

brain.agents.list({ scope: 'mine' | 'shared' })      // Agent[]
brain.agents.get(id)                                  // Agent
brain.agents.create({ name, instructions, … } | { preset_key: 'standup', name? })
brain.agents.update(id, patch)                        // частичная правка; triggers заменяет набор целиком
brain.agents.remove(id) · brain.agents.duplicate(id)
brain.agents.run(id, { input? })                      // { run_id } → brain.waitForRun(run_id)
brain.agents.runs(id, { status?, limit?, before? })   // журнал одного агента
brain.agents.memory(id) · brain.agents.deleteMemory(id, memoryId)
brain.agentRuns.list({ agent_id?, status?, limit?, before? })   // общий журнал
brain.agentPresets() · brain.agentTools()
brain.agentDraft({ message, history?, agent? })       // { reply, patch, notes? } — ничего не сохраняет
```

`before` — `queued_at` последнего запуска в списке. Ошибки — `BrainApiError`:
`e.field` (у 400: `name`, `triggers[0]`…) — для подсветки поля в `AgentProfile.errors`,
`e.forbidden` (403), `e.budgetExceeded` (429 `budget`: дневной бюджет агента),
`e.quotaExceeded` (429 вообще; у `agentDraft` — лимит ИИ).

### Компоненты

| Компонент | Главные пропсы |
|---|---|
| `AgentProfile` | `value: AgentDraft`, `onChange`, `readOnly`, `canManage`, `highlight: string[]` (поля, изменённые конструктором), `errors: Record<string,string>`; данные для выбора: `tools`, `eventKeyOptions`, `timezones`, `modelOptions`, `userOptions`, `moduleKeys`, `pinnedDocuments`, `onPickDocument`, `memory`, `onForgetMemory` |
| `TriggerEditor` | `value: Trigger[]`, `onChange`, `canManage`, `readOnly`, `eventKeyOptions: {key,label}[]`, `errors` |
| `ScheduleEditor` | `value: {cron, tz, ends_at}`, `onChange`, `timezones` — человеческий ввод ⇄ cron, «Следующий запуск …», раскрывающееся поле cron |
| `ToolPicker` | `tools: AgentToolInfo[]`, `value: string[]` (пусто = все доступные), `onChange`, `writePolicy` |
| `KnowledgePicker` | `modules`, `onModulesChange`, `pinned: PinnedDocument[]`, `onRemovePinned`, `onPickDocument` |
| `MemoryEditor` | `items: AgentMemoryItem[]`, `onForget` |
| `RunLogTable` | `runs: AgentRun[]`, `onOpen(run)`, `hasMore`, `onLoadMore`, `showAgent`, `emptyAction` |
| `RunDetail` | `run: AgentRun`, `onConfirmAction(action)`, `onCancelAction(action)`, `onRetry(run)`, `onNavigate`, `onOpenSource` |
| `AgentCard` | `agent: Agent`, `onOpen`, `onRun` (по `can.run`), `onDuplicate`, `onDelete` (по `can.delete`) |
| `AgentPresetCard` | `preset: AgentPreset`, `onCreate(preset)` |
| `AgentBuilderChat` | `messages: BuilderMessage[]`, `busy`, `onSend(text)`, `onUndo`, `tools` |
| `BrainSwitch` | `checked`, `onChange(checked)`, `children` — `role="switch"` для статуса агента и своих экранов |

Помощники без React: `emptyAgentDraft()`, `agentToDraft(agent)`,
`applyAgentPatch(draft, patch)` → `{ draft, changed }` (`changed` — в `highlight`),
`patchSummary(patch)` (подписи «Что изменено в профиле»), `agentPrivacyWarning(draft)`,
`cronFromParts` / `partsFromCron` / `scheduleProblem` / `describeSchedule` /
`describeNextRun`, `skipReasonText(reason)`.

### Что важно знать при подключении

- 🔴 **Права проверяет сервер.** `canManage` и `agent.can.*` только решают, что показать:
  триггеры по событиям, общий агент, `can_trigger`, «от чьего имени» — при `canManage=false`
  скрыты или заблокированы с подсказкой «Триггеры по событиям настраивает управляющий
  модулем ИИ». Запуск агента идёт правами нажавшего (по расписанию — правами `run_as`),
  поэтому «знания» и «инструменты» права не расширяют.
- **Расписание.** `ScheduleEditor` собирает cron (`по будням в 09:30` → `30 9 * * 1-5`),
  конец расписания пишет как `ends_at` (конец дня в часовом поясе расписания, RFC 3339).
  «Следующий запуск» считается по cron, который сейчас в поле, а не берётся из сохранённого
  `next_run_at` (он устаревает при правке). Чаще раза в 5 минут — запрещено понятным текстом;
  проверка — `scheduleProblem(cron)`.
- **Запуски `restricted`.** Управляющий журналом видит запуск чужого агента без содержимого:
  `RunLogTable` помечает «Содержимое видно только участнику», `RunDetail` показывает только
  метаданные. Причины пропуска (`skip_reason`) показываются человеческим текстом.
- **Предупреждение о приватности.** `AgentProfile` показывает баннер, когда у агента включён
  триггер по событию или он общий с расписанием/событием (`agentPrivacyWarning`). Подтверждение
  перед включением (`ConfirmDialog` портала) — у хоста.
- **Конструктор.** `agentDraft` ничего не сохраняет: хост применяет `patch` сразу
  (`applyAgentPatch`), подсвечивает изменённые поля (`highlight`) и хранит историю для
  `onUndo`; «Сохранить» — отдельное действие человека.
- Удаление агента: `AgentCard.onDelete` только сообщает хосту — подтверждение показывает хост.

### Пример: редактор агента с конструктором и журналом

```tsx
import { useEffect, useState } from 'react'
import {
  AgentBuilderChat, AgentProfile, BrainApiError, RunDetail, RunLogTable,
  agentToDraft, applyAgentPatch, createBrainApi, emptyAgentDraft,
  type AgentDraft, type AgentRun, type AgentToolInfo, type BuilderMessage,
} from '@wowhaus-24/brain-react'

const brain = createBrainApi({ base: '/brain/api/v1', fetch: whFetch })

export function AgentEditor({ agentId, canManage }: { agentId?: string; canManage: boolean }) {
  const [draft, setDraft] = useState<AgentDraft>(emptyAgentDraft())
  const [tools, setTools] = useState<AgentToolInfo[]>([])
  const [highlight, setHighlight] = useState<string[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [messages, setMessages] = useState<BuilderMessage[]>([])
  const [history, setHistory] = useState<AgentDraft[]>([]) // для «Отменить правку»
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void brain.agentTools().then(setTools)
    if (agentId) void brain.agents.get(agentId).then((a) => setDraft(agentToDraft(a)))
  }, [agentId])

  async function send(text: string) {
    setMessages((m) => [...m, { id: crypto.randomUUID(), role: 'user', text }])
    setBusy(true)
    try {
      const res = await brain.agentDraft({
        message: text,
        history: messages.map((m) => ({ role: m.role, content: m.text })),
        agent: draft,
      })
      const { draft: next, changed } = applyAgentPatch(draft, res.patch)
      setHistory((h) => [...h, draft])
      setDraft(next)
      setHighlight(changed)
      setMessages((m) => [...m, { id: crypto.randomUUID(), role: 'assistant', text: res.reply, patch: res.patch, notes: res.notes }])
    } catch (e) {
      const error = e instanceof BrainApiError ? e.message : 'Не удалось связаться с конструктором'
      setMessages((m) => [...m, { id: crypto.randomUUID(), role: 'assistant', text: '', error }])
    } finally {
      setBusy(false)
    }
  }

  function undo() {
    const prev = history.at(-1)
    if (!prev) return
    setDraft(prev)
    setHistory((h) => h.slice(0, -1))
    setHighlight([])
    setMessages((m) => {
      const last = [...m].reverse().find((x) => x.patch && !x.undone)
      return m.map((x) => (x === last ? { ...x, undone: true } : x))
    })
  }

  async function save() {
    try {
      const saved = draft.id ? await brain.agents.update(draft.id, draft) : await brain.agents.create(draft)
      setDraft(agentToDraft(saved))
      setErrors({})
    } catch (e) {
      if (e instanceof BrainApiError && e.field) setErrors({ [e.field]: e.message })
    }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 16 }}>
      <div>
        <AgentProfile
          value={draft}
          onChange={(d) => { setDraft(d); setHighlight([]) }}
          canManage={canManage}
          highlight={highlight}
          errors={errors}
          tools={tools}
        />
        <button type="button" className="btn btn-primary" onClick={() => void save()}>Сохранить</button>
      </div>
      <AgentBuilderChat messages={messages} busy={busy} onSend={(t) => void send(t)} onUndo={undo} tools={tools} />
    </div>
  )
}

// Журнал: общий список с догрузкой, детали — рядом.
export function AgentJournal() {
  const [runs, setRuns] = useState<AgentRun[]>([])
  const [open, setOpen] = useState<AgentRun | null>(null)
  const [more, setMore] = useState(false)

  async function load(before?: string) {
    const page = await brain.agentRuns.list({ limit: 30, before })
    setRuns((r) => (before ? [...r, ...page] : page))
    setMore(page.length === 30)
  }
  useEffect(() => { void load() }, [])

  return (
    <>
      <RunLogTable runs={runs} onOpen={setOpen} selectedId={open?.id} hasMore={more}
        onLoadMore={() => void load(runs.at(-1)?.queued_at)} />
      {open && <RunDetail run={open} onRetry={(r) => r.agent_id && void brain.agents.run(r.agent_id)} />}
    </>
  )
}
```

## Поля ИИ и генераторы (0.3.0)

🔴 **Права — на сервере.** Значение ячейки хранится рядом с записью индекса и
читается по правам на запись: общая колонка видна всем, а ячейка — только тому,
кто видит запись. Чужие записи в ответ `fields.values` не попадают, ячейка
остаётся «—». Пакет ничего не кеширует в `localStorage`.

### Клиент

| Метод | Что делает |
|---|---|
| `api.fields.list(module, entityType, scope?)` | `{fields, daily_limit, supported}` — свои и общие колонки списка; `supported:false` — для списка поля ИИ не поддерживаются. `scope` — id формы: колонки записей **формы** принадлежат ей (без `scope` у форм — `supported:false`) |
| `api.fields.create(draft)` / `update(id, patch)` / `remove(id)` | колонка (вид, модуль и тип записи не меняются); `update` отдаёт `{field, values_reset}` — сменился смысл ячейки, значения стёрты |
| `api.fields.values(module, entityType, ids, scope?)` | `{<field_id>: {<entity_id>: {status, text, error?, error_code?}}}`; длинный список клиент делит по 100 id |
| `api.fields.fill(id, {entity_ids, force?})` | поставить записи в очередь: `{queued, requested, no_access, skipped_limit, up_to_date, limit_left}`; делит по 500 |
| `api.fields.preview(draft + entity_ids)` / `getPreview(id)` | «Попробовать на 3 строках» — проба несохранённой колонки |
| `api.generate(kind, body)` | `week_summary \| standup \| project_update \| exec_summary` → `{run_id}`; результат — `waitForRun` |

Статусы ячейки: `fresh`, `stale` (запись изменилась после расчёта), `queued`,
`computing`, `failed`. `brainErrorText(e)` превращает `BrainApiError` в фразу для
человека («HTTP 403» наружу не выходит).

### Колонки в списке портала

`useAiFieldColumns` ведёт всё сам: грузит колонки списка, запрашивает значения
для строк на экране, раз в 2–3 с переспрашивает только ячейки в работе (пауза при
скрытой вкладке) и отдаёт готовые `columns`, кнопку «Поле ИИ» и диалоги.

```tsx
const ai = useAiFieldColumns<Lead>({
  api, // createBrainApi(...)
  module: 'oup',
  entityType: 'lead',
  rows: leads, // строки списка на экране
  getId: (l) => l.id, // = entity_id в индексе
  canCreate: role !== 'view', // «Поле ИИ» — роль edit
  canManage: role === 'manage', // «Видна всем» — manage
  enabled: hasBrainAccess,
  confirm: (req) => confirm(req), // необязательно: своё подтверждение
  notify: (text, tone) => toast(text, tone), // необязательно: свои тосты
})

<ListPage columns={[...baseColumns, ...ai.columns]} toolbarEnd={() => ai.addButton} … />
{ai.dialogs}
```

Записи формы: `useAiFieldColumns({ module: 'forms', entityType: 'form_record',
scope: form.id, … })` — колонка принадлежит конкретной форме и в других формах не
видна (`AiField.scope`; у лидов, проектов и задач он пустой).

Колонка получает `headerActions` (✨ с меню «Заполнить пустые», «Обновить все»,
«Настроить…», «Удалить…») — это поле `ListColumn.headerActions` из `ui-react`.
В «Формах» (`FormRecordsPage` из `forms-react`) колонки передаются в
`extraColumns`, строки страницы приходят из `onRowsChange`, а `addButton` идёт в
`actions`.

### Генераторы

```tsx
<GeneratorDialog
  api={api}
  open={open}
  onClose={() => setOpen(false)}
  kind="week_summary" // или kinds={['standup', 'project_update']} — сегмент
  autoRun // «Итог недели» одним нажатием
  defaults={{ selfName: me.name }}
  onNavigate={(url) => navigateTo(url)}
/>
```

Период по умолчанию тот же, что подставит сервер (итог недели — пн–вс текущей
недели, остальное — последние 7 дней). Результат — `Markdown` с цитатами `[n]` и
`SourceList`; ошибки, квота и бюджет — понятным текстом.

### Что важно знать при подключении

- Модальные окна пакета (`BrainDialog`) держат фокус внутри, возвращают его на
  кнопку-открывашку, закрываются по Esc (Esc, закрывающий список общего
  `Combobox`, окно не закрывает; наружу, на хост, Esc не уходит) и на телефоне
  становятся «шторкой» на всю ширину. Их `z-index` — 85 (`--brain-dialog-z`), ниже
  выпадающих списков общих `Combobox` (90).
- Меню колонки рисуется порталом в `<body>` с `position: fixed` — таблицу с
  горизонтальной прокруткой оно не обрежет.
- Пока колонок нет и заводить их нельзя (`canCreate=false`), значения не
  запрашиваются; ошибка загрузки колонок (нет доступа к модулю ИИ) просто прячет
  колонки — страница работает как раньше.
- Устаревшую ячейку (`stale`) пакет не пересчитывает сам: это решает колонка
  «Обновлять при изменении записи» на сервере или кнопка «Заполнить пустые»
  (пустые, неудавшиеся и устаревшие).

## Разработка

```bash
npm run build -w @wowhaus-24/brain-react   # tsc + copy-css.mjs (CSS-модули в dist/)
npm test -w @wowhaus-24/brain-react        # vitest + happy-dom
```

Тесты идут по исходникам `ui-react` (alias в `vitest.config.ts`), потому что
корневой `tsc -b` не копирует CSS-модули в `dist/`.

Выбор из списков в пакете — только общий `Combobox`/`MultiCombobox` из `ui-react`
(никаких нативных `<select>`/`<datalist>`); переключатель в `ui-react` отсутствует —
пакет держит свой `BrainSwitch`.
