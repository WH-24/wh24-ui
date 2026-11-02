import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import type { ConditionGroup } from '../types'
import { visibility } from './visibility'

interface Fixture {
  name: string
  rules: Record<string, ConditionGroup | null>
  values: Record<string, unknown>
  visible: Record<string, boolean>
}

const dir = path.join(__dirname, 'fixtures', 'visibility')
const files = readdirSync(dir).filter((f) => f.endsWith('.json'))

describe('visibility — те же фикстуры, что у Go-теста', () => {
  it('фикстуры подхватились', () => {
    expect(files.length).toBeGreaterThan(3)
  })

  for (const f of files) {
    it(f, () => {
      const fx = JSON.parse(readFileSync(path.join(dir, f), 'utf8')) as Fixture
      expect(visibility(fx.rules, fx.values), fx.name).toEqual(fx.visible)
      // Порядок перечисления полей не влияет на результат.
      const reversed = Object.fromEntries(Object.entries(fx.rules).reverse())
      expect(visibility(reversed, fx.values), fx.name).toEqual(fx.visible)
    })
  }

  it('values не меняются', () => {
    const values = { a: 'y', b: 'kept' }
    visibility(
      {
        a: null,
        b: { all: [{ field: 'a', op: 'eq', value: 'x' }] },
        c: { all: [{ field: 'b', op: 'not_empty' }] },
      },
      values,
    )
    expect(values).toEqual({ a: 'y', b: 'kept' })
  })
})
