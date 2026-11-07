import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import type { FormulaResult } from '../types'
import { evaluateFormula, FormulaParseError, formulaRefs, parseFormula } from './formula'

interface Fixture {
  name: string
  expr: string
  values?: Record<string, unknown>
  today?: string
  result?: FormulaResult
  want?: unknown
  parse_error?: boolean
}

const dir = path.join(__dirname, 'fixtures')
const files = readdirSync(dir).filter((f) => f.endsWith('.json'))

describe('formula — те же фикстуры, что у Go-теста (internal/formula/testdata)', () => {
  it('фикстуры подхватились', () => {
    expect(files.length).toBeGreaterThanOrEqual(30)
  })

  for (const f of files) {
    it(f, () => {
      const fx = JSON.parse(readFileSync(path.join(dir, f), 'utf8')) as Fixture
      if (fx.parse_error) {
        expect(() => parseFormula(fx.expr), fx.name).toThrow(FormulaParseError)
        return
      }
      const expr = parseFormula(fx.expr)
      const got = evaluateFormula(expr, fx.values ?? {}, fx.result ?? 'number', { today: fx.today })
      if (fx.want === null || fx.want === undefined) expect(got, fx.name).toBeNull()
      else if (typeof fx.want === 'number') expect(got, fx.name).toBeCloseTo(fx.want, 9)
      else expect(got, fx.name).toBe(fx.want)
    })
  }
})

describe('formula — разбор', () => {
  it('ссылки уникальны и в порядке появления', () => {
    expect(formulaRefs(parseFormula('{a}+SUM({t.c})*{a}'))).toEqual([{ key: 'a' }, { key: 't', col: 'c' }])
  })
  it('ошибки по-русски, с позицией', () => {
    const cases: [string, string][] = [
      ['FOO(1)', 'неизвестная функция'],
      ['SUM()', 'аргумент'],
      ['{t.c}+1', 'SUM, COUNT, MIN, MAX'],
      ['(1+2', 'скобк'],
      ['"abc', 'кавычк'],
      ['1 ? 2', 'символ'],
    ]
    for (const [src, want] of cases) {
      let err: unknown
      try {
        parseFormula(src)
      } catch (e) {
        err = e
      }
      expect(err, src).toBeInstanceOf(FormulaParseError)
      expect((err as FormulaParseError).message, src).toContain(want)
      expect(typeof (err as FormulaParseError).pos).toBe('number')
    }
  })
})
