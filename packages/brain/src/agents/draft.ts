/**
 * Черновик профиля агента: заготовки, применение правки конструктора, подписи
 * «что изменено», предупреждение о приватности. Чистые функции — состояние у хоста.
 */
import { moduleMeta, type ModuleMetaMap } from '../sources/modules.js'
import { WRITE_POLICY_LABEL, TRIGGER_KIND_LABEL } from './labels.js'
import { describeSchedule } from './schedule.js'
import type { Agent, AgentDraft, AgentPatch, AgentToolInfo, Trigger } from './types.js'

export function emptyAgentDraft(): AgentDraft {
  return {
    name: '',
    description: '',
    instructions: '',
    model: '',
    tools: [],
    knowledge: { modules: [], pinned_document_ids: [] },
    memory_enabled: true,
    write_policy: 'ask',
    visibility: 'private',
    can_trigger: { mode: 'owner' },
    daily_budget_usd: 5,
    triggers: [{ kind: 'manual', enabled: true, config: {} }],
  }
}

/** Агент с сервера → черновик для формы (пустые списки вместо `null`). */
export function agentToDraft(a: Agent | AgentDraft): AgentDraft {
  return {
    ...a,
    tools: a.tools ?? [],
    knowledge: {
      modules: a.knowledge?.modules ?? [],
      pinned_document_ids: a.knowledge?.pinned_document_ids ?? [],
    },
    can_trigger: a.can_trigger ?? { mode: 'owner' },
    triggers: (a.triggers ?? []).map((t) => ({ ...t, config: { ...(t.config ?? {}) } })),
  }
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/**
 * Применить правку конструктора к черновику. Возвращает новый черновик и список
 * полей, которые действительно изменились — его хост отдаёт в `highlight`
 * профиля. Поля, которых в правке нет, не трогаются.
 */
export function applyAgentPatch(draft: AgentDraft, patch: AgentPatch): { draft: AgentDraft; changed: string[] } {
  const next: AgentDraft = { ...draft }
  const changed: string[] = []
  const set = <K extends keyof AgentPatch>(key: K, value: AgentPatch[K]) => {
    if (value === undefined) return
    if (!same(draft[key], value)) changed.push(key)
    ;(next as unknown as Record<string, unknown>)[key] = value
  }
  set('name', patch.name)
  set('description', patch.description)
  set('instructions', patch.instructions)
  set('tools', patch.tools)
  set('write_policy', patch.write_policy)
  set('memory_enabled', patch.memory_enabled)
  if (patch.knowledge !== undefined) {
    const k = {
      modules: patch.knowledge.modules ?? [],
      pinned_document_ids: patch.knowledge.pinned_document_ids ?? draft.knowledge.pinned_document_ids ?? [],
    }
    set('knowledge', k)
  }
  set('triggers', patch.triggers)
  return { draft: next, changed }
}

/**
 * Нужно ли предупреждение о приватности: у агента включён триггер по событию
 * либо он общий и у него включено расписание/событие. Правило сервера, но
 * считаем по ЖИВОМУ черновику — чтобы баннер появлялся до сохранения.
 */
export function agentPrivacyWarning(d: Pick<AgentDraft, 'visibility' | 'triggers'>): boolean {
  const on = (d.triggers ?? []).filter((t) => t.enabled)
  const hasEvent = on.some((t) => t.kind === 'event')
  const unattended = on.some((t) => t.kind === 'schedule' || t.kind === 'event')
  return hasEvent || (d.visibility === 'public' && unattended)
}

function triggerText(t: Trigger): string {
  if (t.kind === 'schedule') return describeSchedule(t.config.cron, t.config.tz)
  if (t.kind === 'event') {
    const keys = t.config.event_keys ?? []
    return keys.length ? `${TRIGGER_KIND_LABEL.event}: ${keys.join(', ')}` : TRIGGER_KIND_LABEL.event
  }
  return TRIGGER_KIND_LABEL.manual
}

/** Триггеры одной строкой каждый — для карточки агента и «что изменено». */
export function triggerSummary(triggers: Trigger[] | undefined, onlyEnabled = false): string[] {
  return (triggers ?? []).filter((t) => !onlyEnabled || t.enabled).map(triggerText)
}

export interface PatchSummaryOptions {
  /** Названия инструментов вместо технических имён. */
  tools?: AgentToolInfo[]
  modules?: ModuleMetaMap
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

/**
 * «Что изменено в профиле» человеческими подписями — по одной строке на поле
 * правки конструктора. Пустая правка — пустой список.
 */
export function patchSummary(patch: AgentPatch | null | undefined, opts: PatchSummaryOptions = {}): string[] {
  if (!patch) return []
  const out: string[] = []
  if (patch.name !== undefined) out.push(`Название: «${clip(patch.name, 60)}»`)
  if (patch.description !== undefined) out.push('Описание обновлено')
  if (patch.instructions !== undefined) out.push('Инструкции обновлены')
  if (patch.tools !== undefined) {
    if (patch.tools.length === 0) out.push('Инструменты: все доступные')
    else {
      const title = (n: string) => opts.tools?.find((t) => t.name === n)?.title || n
      out.push(`Инструменты: ${patch.tools.map(title).join(', ')}`)
    }
  }
  if (patch.write_policy !== undefined) {
    out.push(`Запись: ${WRITE_POLICY_LABEL[patch.write_policy]?.title.toLowerCase() ?? patch.write_policy}`)
  }
  if (patch.memory_enabled !== undefined) out.push(`Память: ${patch.memory_enabled ? 'включена' : 'выключена'}`)
  if (patch.knowledge !== undefined) {
    const mods = patch.knowledge.modules ?? []
    const pinned = patch.knowledge.pinned_document_ids ?? []
    const head = mods.length
      ? `Знания: ${mods.map((m) => moduleMeta(m, opts.modules).label || m).join(', ')}`
      : 'Знания: все доступные модули'
    out.push(pinned.length ? `${head}; закреплено документов: ${pinned.length}` : head)
  }
  if (patch.triggers !== undefined) {
    const lines = triggerSummary(patch.triggers)
    out.push(lines.length ? `Триггеры: ${lines.join('; ')}` : 'Триггеры: убраны')
  }
  return out
}
