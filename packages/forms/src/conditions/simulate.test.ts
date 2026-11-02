import { describe, expect, it } from 'vitest'

import type { Field, SchemaDocument } from '../types'
import { ruleScenarios, ruleStatuses, runScenario } from './simulate'

const field = (id: string, type: Field['type'], extra: Partial<Field> = {}): Field => ({
  id,
  key: id,
  label: id,
  type,
  section_id: 's',
  span: 12,
  required: false,
  show_in_list: false,
  filterable: false,
  archived: false,
  ...extra,
})

/**
 * Цепочка «как у владельца»: Ответственный = Т → Наблюдатель = А; Наблюдатель
 * = А → видна «Причина», и её требует второе правило; бюджет > 1 млн делает
 * обязательным «Договор».
 */
const doc: SchemaDocument = {
  schema_version: 1,
  title_field: 'title',
  sections: [{ id: 's', title: 'Основное', sort: 0 }],
  fields: [
    field('title', 'text'),
    field('resp', 'user'),
    field('obs', 'user'),
    field('reason', 'text', { visible_if: { all: [{ field: 'obs', op: 'eq', value: 'A' }] } }),
    field('budget', 'number'),
    field('contract', 'text', { required_if: { all: [{ field: 'budget', op: 'gt', value: 1_000_000 }] } }),
  ],
  rules: [
    {
      id: 'r1',
      name: 'Наблюдатель у лидов Т',
      when: { all: [{ field: 'resp', op: 'eq', value: 'T' }] },
      then: { all: [{ field: 'obs', op: 'eq', value: 'A' }] },
      fill: true,
    },
    {
      id: 'r2',
      name: 'Причина для наблюдателя А',
      when: { all: [{ field: 'obs', op: 'eq', value: 'A' }] },
      then: { all: [{ field: 'reason', op: 'not_empty' }] },
    },
  ],
}

const sample = (f: Field) => (f.type === 'user' ? ['T', 'A', 'B'] : [])

describe('ruleScenarios / runScenario', () => {
  const scenarios = ruleScenarios(doc, { sample })

  it('по каждому правилу — свои сценарии', () => {
    expect(scenarios.map((s) => s.id)).toEqual([
      'r1:fill',
      'r1:wrong',
      'r1:right',
      'r1:off',
      'r2:wrong',
      'r2:right',
      'r2:off',
      'reason:shown',
      'reason:hidden',
      'contract:required',
      'contract:optional',
    ])
  })

  it('все сценарии цепочки проходят; побочное — заметки о соседнем правиле', () => {
    const results = scenarios.map((s) => runScenario(doc, s))
    for (const r of results) expect(r.problems, r.scenario.id).toEqual([])
    const fill = results.find((r) => r.scenario.id === 'r1:fill')!
    expect(fill.values.obs).toBe('A')
    // Подставили А — включилось второе правило: «Причина» пустая.
    expect(fill.notes).toEqual(['Дальше по цепочке: не выполнено правило «Причина для наблюдателя А»'])
  })

  it('противоречие находится: третье правило требует наблюдателя Б при том же Т', () => {
    const conflicting: SchemaDocument = {
      ...doc,
      rules: [
        ...doc.rules!,
        {
          id: 'r3',
          name: 'Наблюдатель Б',
          when: { all: [{ field: 'resp', op: 'eq', value: 'T' }] },
          then: { all: [{ field: 'obs', op: 'eq', value: 'B' }] },
        },
      ],
    }
    const pair = ruleScenarios(conflicting, { sample }).find((s) => s.id === 'r1+r3')!
    const r = runScenario(conflicting, pair)
    expect(r.ok).toBe(false)
    expect(r.problems).toEqual([
      'Правила противоречат друг другу: при этих значениях не выполнить «Наблюдатель Б» — поправьте условия или значения',
    ])
    // В исходной цепочке противоречий нет — пар с общим «То» тоже.
    expect(ruleScenarios(doc, { sample }).some((s) => s.id.includes('+'))).toBe(false)
  })

  it('условие по скрытому полю — сценарий объясняет, почему не подобрать', () => {
    const hiddenSource: SchemaDocument = {
      ...doc,
      fields: doc.fields.map((f) =>
        f.id === 'resp' ? { ...f, visible_if: { all: [{ field: 'budget', op: 'gt', value: 5 }] } } : f,
      ),
      rules: [doc.rules![0]!],
    }
    const s = ruleScenarios(hiddenSource, { sample }).find((x) => x.id === 'r1:fill')!
    const r = runScenario(hiddenSource, s)
    expect(r.ok).toBe(false)
    expect(r.problems[0]).toBe(
      'Не удалось подобрать значения («Если» выполнено): поле «resp» скрыто условием показа',
    )
  })
})

describe('ruleStatuses', () => {
  it('состояние каждого правила при значениях', () => {
    const states = ruleStatuses(doc, { resp: 'T', obs: 'A', budget: 2_000_000 })
    expect(states.map((s) => `${s.rule.id}:${s.state}`)).toEqual([
      'r1:ok',
      'r2:violated',
      'reason:shown',
      'contract:required',
    ])
    expect(ruleStatuses(doc, {}).map((s) => s.state)).toEqual(['off', 'off', 'hidden', 'optional'])
  })
})
