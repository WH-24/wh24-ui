import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import type { ConditionGroup } from '../types'
import { evaluate, UnknownOpError } from './conditions'

interface Fixture {
  name: string
  group: ConditionGroup | null
  values: Record<string, unknown>
  expect: boolean
}

const dir = path.join(__dirname, 'fixtures')
const files = readdirSync(dir).filter((f) => f.endsWith('.json'))

describe('conditions — те же фикстуры, что у Go-теста', () => {
  it('фикстуры подхватились', () => {
    expect(files.length).toBeGreaterThan(15)
  })

  for (const f of files) {
    it(f, () => {
      const fx = JSON.parse(readFileSync(path.join(dir, f), 'utf8')) as Fixture
      expect(evaluate(fx.group, fx.values), fx.name).toBe(fx.expect)
    })
  }
})

describe('conditions — краевые случаи вне фикстур', () => {
  it('неизвестный оператор — ошибка конфигурации, а не «ложно»', () => {
    const g = { all: [{ field: 'x', op: 'regex_match' as never }] }
    expect(() => evaluate(g, { x: 'y' })).toThrow(UnknownOpError)
  })

  it('пустой any (не задан) не накладывает OR-ограничение', () => {
    expect(evaluate({ all: [{ field: 'x', op: 'eq', value: 'y' }] }, { x: 'y' })).toBe(true)
  })

  it('eq: число из JSON и числовая строка условия — сравнение как строк, не чисел', () => {
    // Go: числовое сравнение только когда ОБА не строки.
    expect(evaluate({ all: [{ field: 'n', op: 'eq', value: '05' }] }, { n: 5 })).toBe(false)
    expect(evaluate({ all: [{ field: 'n', op: 'eq', value: 5 }] }, { n: 5 })).toBe(true)
    expect(evaluate({ all: [{ field: 'b', op: 'eq', value: true }] }, { b: true })).toBe(true)
  })

  it('contains на multiselect — членство, на строке — подстрока', () => {
    expect(evaluate({ all: [{ field: 'm', op: 'contains', value: 'b' }] }, { m: ['a', 'b'] })).toBe(
      true,
    )
    expect(evaluate({ all: [{ field: 's', op: 'contains', value: 'ab' }] }, { s: 'xabx' })).toBe(
      true,
    )
    expect(evaluate({ all: [{ field: 's', op: 'contains', value: 'zz' }] }, { s: 'xabx' })).toBe(
      false,
    )
  })

  it('ne без значения — false, а не true', () => {
    expect(evaluate({ all: [{ field: 'x', op: 'ne', value: 'a' }] }, {})).toBe(false)
  })
})
