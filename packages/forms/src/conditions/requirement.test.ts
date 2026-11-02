import { describe, expect, it } from 'vitest'

import type { Field } from '../types'
import { fieldRequirement } from './visibility'

const fld = (id: string, over: Partial<Field> = {}) =>
  ({ id, key: id, label: id, type: 'text', required: false, ...over }) as Field

describe('fieldRequirement — «обязательно, если…»', () => {
  const kind = fld('kind')
  const no = fld('no', { required_if: { all: [{ field: 'kind', op: 'eq', value: 'договор' }] } })
  const always = fld('always', { required: true })

  it('условие выполнено — обязательно; нет — нет; required — всегда', () => {
    expect(fieldRequirement([kind, no, always], { kind: 'Договор' })).toEqual({
      kind: false,
      no: true,
      always: true,
    })
    expect(fieldRequirement([kind, no, always], { kind: 'счёт' }).no).toBe(false)
  })

  it('скрытое поле не обязательно; скрытый источник для условия пустой', () => {
    const hiddenNo = { ...no, visible_if: { all: [{ field: 'kind', op: 'eq', value: 'счёт' }] } } as Field
    expect(fieldRequirement([kind, hiddenNo], { kind: 'договор' }).no).toBe(false)

    const gate = fld('gate', { type: 'checkbox' })
    const gatedKind = { ...kind, visible_if: { all: [{ field: 'gate', op: 'eq', value: true }] } } as Field
    expect(fieldRequirement([gate, gatedKind, no], { gate: false, kind: 'договор' }).no).toBe(false)
  })
})
