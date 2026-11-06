import { describe, expect, it } from 'vitest'

import {
  agentPrivacyWarning,
  agentToDraft,
  applyAgentPatch,
  emptyAgentDraft,
  patchSummary,
  triggerSummary,
} from './draft'
import type { Agent, AgentToolInfo } from './types'

const tools: AgentToolInfo[] = [
  { name: 'search_workspace', title: 'Поиск по данным портала', description: '', write: false, source: 'builtin' },
  { name: 'oup_lead_create', title: 'Создать лид', description: '', write: true, source: 'oup' },
]

describe('patchSummary', () => {
  it('каждое поле правки — человеческая строка', () => {
    const lines = patchSummary(
      {
        name: 'Утренний стендап',
        description: 'Сводка',
        instructions: 'Каждое утро…',
        tools: ['search_workspace', 'oup_lead_create'],
        write_policy: 'deny',
        memory_enabled: false,
        knowledge: { modules: ['oup', 'wiki'] },
        triggers: [
          { kind: 'schedule', enabled: true, config: { cron: '30 9 * * 1-5', tz: 'Europe/Moscow' } },
          { kind: 'manual', enabled: true, config: {} },
        ],
      },
      { tools },
    )
    expect(lines).toEqual([
      'Название: «Утренний стендап»',
      'Описание обновлено',
      'Инструкции обновлены',
      'Инструменты: Поиск по данным портала, Создать лид',
      'Запись: только читать',
      'Память: выключена',
      'Знания: ОУП, Вики',
      'Триггеры: По будням в 09:30 (МСК); Вручную',
    ])
  })

  it('пустые списки — «все доступные» и «убраны»; пустая правка — ничего', () => {
    expect(patchSummary({ tools: [], knowledge: { modules: [] }, triggers: [] })).toEqual([
      'Инструменты: все доступные',
      'Знания: все доступные модули',
      'Триггеры: убраны',
    ])
    expect(patchSummary({})).toEqual([])
    expect(patchSummary(null)).toEqual([])
    expect(patchSummary(undefined)).toEqual([])
  })

  it('триггер по событию называет ключи; закреплённые документы считаются', () => {
    expect(
      patchSummary({
        triggers: [{ kind: 'event', enabled: true, config: { event_keys: ['oup.lead.stale', 'forms.*'] } }],
        knowledge: { modules: ['oup'], pinned_document_ids: ['d1', 'd2'] },
      }),
    ).toEqual(['Знания: ОУП; закреплено документов: 2', 'Триггеры: По событию: oup.lead.stale, forms.*'])
  })
})

describe('applyAgentPatch', () => {
  it('применяет только присланные поля и называет изменившиеся', () => {
    const d = { ...emptyAgentDraft(), name: 'Старое', instructions: 'Текст' }
    const { draft, changed } = applyAgentPatch(d, { name: 'Новое', instructions: 'Текст', memory_enabled: false })
    expect(draft.name).toBe('Новое')
    expect(draft.instructions).toBe('Текст')
    expect(draft.memory_enabled).toBe(false)
    expect(draft.write_policy).toBe('ask')
    // instructions совпали — не «изменено».
    expect(changed).toEqual(['name', 'memory_enabled'])
    expect(d.name).toBe('Старое')
  })

  it('знания: закреплённые документы сохраняются, если правка про модули', () => {
    const d = { ...emptyAgentDraft(), knowledge: { modules: [], pinned_document_ids: ['d1'] } }
    const { draft, changed } = applyAgentPatch(d, { knowledge: { modules: ['wiki'] } })
    expect(draft.knowledge).toEqual({ modules: ['wiki'], pinned_document_ids: ['d1'] })
    expect(changed).toEqual(['knowledge'])
  })
})

describe('agentToDraft', () => {
  it('заменяет null на пустые списки', () => {
    const a = {
      id: '1',
      name: 'A',
      tools: null,
      knowledge: {},
      triggers: null,
      can_trigger: undefined,
      can: { edit: true, run: true, delete: true, journal: true },
    } as unknown as Agent
    const d = agentToDraft(a)
    expect(d.tools).toEqual([])
    expect(d.knowledge).toEqual({ modules: [], pinned_document_ids: [] })
    expect(d.triggers).toEqual([])
    expect(d.can_trigger).toEqual({ mode: 'owner' })
  })
})

describe('agentPrivacyWarning', () => {
  const sched = { kind: 'schedule' as const, enabled: true, config: { cron: '0 9 * * *' } }
  const event = { kind: 'event' as const, enabled: true, config: { event_keys: ['a.b'] } }
  it('событие — всегда; расписание — только у общего агента; выключенное не считается', () => {
    expect(agentPrivacyWarning({ visibility: 'private', triggers: [event] })).toBe(true)
    expect(agentPrivacyWarning({ visibility: 'private', triggers: [sched] })).toBe(false)
    expect(agentPrivacyWarning({ visibility: 'public', triggers: [sched] })).toBe(true)
    expect(agentPrivacyWarning({ visibility: 'public', triggers: [{ ...sched, enabled: false }] })).toBe(false)
    expect(
      agentPrivacyWarning({ visibility: 'public', triggers: [{ kind: 'manual', enabled: true, config: {} }] }),
    ).toBe(false)
  })
})

describe('triggerSummary', () => {
  it('только включённые по запросу', () => {
    const t = [
      { kind: 'manual' as const, enabled: true, config: {} },
      { kind: 'schedule' as const, enabled: false, config: { cron: '0 9 * * *' } },
    ]
    expect(triggerSummary(t)).toEqual(['Вручную', 'Каждый день в 09:00 (МСК)'])
    expect(triggerSummary(t, true)).toEqual(['Вручную'])
    expect(triggerSummary(undefined)).toEqual([])
  })
})
