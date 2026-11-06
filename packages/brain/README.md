# @wowhaus-24/brain-react

Компоненты панели «Спросить ИИ» (WH24 Brain) для портала и фронтов модулей:
разметка ответа с цитатами, источники, сообщения, карточка действия агента,
композер, индикатор квоты и типизированный клиент `wh24-brain-api`.

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
| `createBrainApi({ base, fetch?, headers? })` | `search`, `ask` (202 `{run_id}`), `getRun`, `waitForRun` (опрос 1 → 3 с, один запрос в полёте, пауза при скрытой вкладке, `signal`), `feedback`; ошибки — `BrainApiError` (`quotaExceeded` = 429) |
| Типы | `BrainContext`, `SearchHit`, `Run`, `Citation`, `RunStep`, `PendingAction`, `SuggestedAction`, `BrainSource` … |
| `Markdown` | ответ в markdown без сырого HTML; `[n]` → `CitationChip` (`onCitationClick`), внутренние ссылки → `onNavigate(path)`, внешние — `_blank noreferrer`; под таблицей «Скачать .xlsx», под кодом «Скачать .csv/.txt» |
| `SourceCard`, `SourceList` | иконка модуля, заголовок, сниппет как прислал сервер, «Открыть» через `onOpen(url)`; `activeN` подсвечивает и прокручивает к источнику |
| `AssistantMessage` | текст без пузыря; строка действий Копировать · Создать задачу · Повторить · 👍 👎 и чипы follow-up — каждая кнопка появляется только от своего колбэка |
| `UserMessage` | вопрос компактно справа, с вложениями |
| `AgentSteps`, `AiActionCard` | шаги агента; карточка действия (превью полей, предупреждения, «Подтвердить»/«Отмена», фокус после решения) |
| `BrainComposer` | автовысота, Enter/Shift+Enter, вложения (скрепка, Ctrl+V, перетаскивание), кнопки «+», «@», «/» от колбэков, `disabledReason` (квота) |
| `addBrainFiles` | проверка и чтение файлов в data-URL (лимиты как на сервере) |
| `UsageMeter`, `AiLabel`, `PrivacyNotice` | «Сегодня 12 % · Месяц 40 %» (с 90 % — предупреждение); «Ответ ИИ · по запросу …»; напоминание о приватности |
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

## Разработка

```bash
npm run build -w @wowhaus-24/brain-react   # tsc + copy-css.mjs (CSS-модули в dist/)
npm test -w @wowhaus-24/brain-react        # vitest + happy-dom
```

Тесты идут по исходникам `ui-react` (alias в `vitest.config.ts`), потому что
корневой `tsc -b` не копирует CSS-модули в `dist/`.
