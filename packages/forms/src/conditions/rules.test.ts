import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import type { ConditionGroup, FormRule } from '../types'
import { applyFills, applyFillsOnChange, checkRules } from './rules'

interface Fixture {
  name: string
  visible_if: Record<string, ConditionGroup | null>
  rules: FormRule[]
  values: Record<string, unknown>
  filled: Record<string, unknown>
  violations: string[]
}

const dir = path.join(__dirname, 'fixtures', 'rules')
const files = readdirSync(dir).filter((f) => f.endsWith('.json'))

describe('правила формы — те же фикстуры, что у Go-теста', () => {
  it('фикстуры подхватились', () => {
    expect(files.length).toBeGreaterThan(10)
  })

  for (const f of files) {
    it(f, () => {
      const fx = JSON.parse(readFileSync(path.join(dir, f), 'utf8')) as Fixture
      const { values } = applyFills(fx.rules, fx.visible_if, fx.values)
      expect(values, fx.name).toEqual(fx.filled)
      expect(
        checkRules(fx.rules, fx.visible_if, values).map((v) => v.ruleId),
        fx.name,
      ).toEqual(fx.violations)
    })
  }
})

const owner: FormRule = {
  id: 'r1',
  name: 'Наблюдатель у лидов Т',
  when: { all: [{ field: 'resp', op: 'eq', value: 'T' }] },
  then: { all: [{ field: 'obs', op: 'eq', value: 'A' }] },
  fill: true,
}

describe('applyFillsOnChange — подстановка при вводе', () => {
  it('выбрали Т — наблюдатель становится А и поверх прежнего', () => {
    const prev = { resp: 'X', obs: 'B' }
    const { values, filled } = applyFillsOnChange([owner], {}, prev, { ...prev, resp: 'T' })
    expect(values).toEqual({ resp: 'T', obs: 'A' })
    expect(filled).toEqual(['obs'])
  })

  it('правило уже действовало — выбор наблюдателя не перебивается', () => {
    const prev = { resp: 'T', obs: 'A' }
    const { values, filled } = applyFillsOnChange([owner], {}, prev, { ...prev, obs: 'B' })
    expect(values).toEqual({ resp: 'T', obs: 'B' })
    expect(filled).toEqual([])
  })

  it('без правил значения те же', () => {
    const next = { a: 1 }
    expect(applyFillsOnChange(undefined, {}, {}, next).values).toBe(next)
  })
})
