import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'

import type { Field, RecordData, SchemaDocument } from '../types'
import { FormRenderer } from './FormRenderer'
import { formatValue } from './format'
import { fieldRegistry } from './registry'

// Шаг 2 типов полей (06.11.2026): формула считается вживую при вводе,
// подстановка показывается из record.lookups; оба — только просмотр.

const f = (over: Partial<Field> & Pick<Field, 'id' | 'type'>): Field => ({
  key: over.id,
  label: over.id,
  section_id: 's1',
  span: 6,
  required: false,
  show_in_list: false,
  filterable: false,
  archived: false,
  ...over,
})
const doc = (fields: Field[]): SchemaDocument => ({
  schema_version: 1,
  title_field: fields[0]?.id ?? '',
  sections: [{ id: 's1', title: 'Основное', sort: 0 }],
  fields,
})

function Harness({ d, initial = {}, mode = 'edit' as const }: { d: SchemaDocument; initial?: RecordData; mode?: 'edit' | 'view' }) {
  const [v, setV] = useState<RecordData>(initial)
  return <FormRenderer doc={d} values={v} mode={mode} onChange={(id, val) => setV((p) => ({ ...p, [id]: val }))} />
}

const priceQty = [
  f({ id: 'price', type: 'number' }),
  f({ id: 'qty', type: 'number' }),
  f({ id: 'total', type: 'formula', label: 'Итого', config: { expr: '{price}*{qty}', result: 'money', currency: 'RUB' } }),
]

describe('формула в форме', () => {
  it('реестр знает оба типа', () => {
    expect(fieldRegistry.formula.View).toBeTypeOf('function')
    expect(fieldRegistry.lookup.Edit).toBeTypeOf('function')
  })

  it('считается вживую: смена количества меняет «Итого», поле без ввода', () => {
    render(<Harness d={doc(priceQty)} initial={{ price: 20, qty: 3 }} />)
    const total = screen.getByRole('status', { name: /Итого/ })
    expect(total.textContent).toMatch(/^60\s*₽$/)
    fireEvent.change(screen.getByLabelText('qty'), { target: { value: '4' } })
    expect(screen.getByRole('status', { name: /Итого/ }).textContent).toMatch(/^80\s*₽$/)
    expect(screen.queryByRole('textbox', { name: 'Итого' })).toBeNull()
    expect(screen.queryByRole('spinbutton', { name: 'Итого' })).toBeNull()
  })

  it('в просмотре — то же значение; пустые входы — прочерк', () => {
    render(<Harness d={doc(priceQty)} initial={{ price: 20, qty: 3, total: 999 }} mode="view" />)
    expect(screen.getByRole('status', { name: /Итого/ }).textContent).toMatch(/^60\s*₽$/)
  })

  it('ошибка вычисления — прочерк, не падение', () => {
    const d = doc([f({ id: 'a', type: 'text' }), f({ id: 'x', type: 'formula', label: 'X', config: { expr: '{a}*2', result: 'number' } })])
    render(<Harness d={d} initial={{ a: 'много' }} />)
    expect(screen.getByRole('status', { name: /X/ }).textContent).toBe('—')
  })

  it('formatValue форматирует формулу по результату', () => {
    expect(formatValue(priceQty[2]!, 60)).toMatch(/^60\s*₽$/)
    expect(formatValue(f({ id: 'd', type: 'formula', config: { expr: 'TODAY()', result: 'date' } }), '2026-11-06')).toBe('06.11.2026')
  })
})

describe('подстановка в форме', () => {
  const lk = f({ id: 'lk', type: 'lookup', label: 'Ставка', config: { source_field: 'ref', target_field: 'p', target_type: 'money', target_config: { currency: 'USD' } } })

  it('показывает значение из ctx.lookups по типу поля-источника', () => {
    render(<FormRenderer doc={doc([f({ id: 't', type: 'text' }), lk])} values={{ t: 'a' }} mode="view" ctx={{ lookups: { lk: 1500 } }} />)
    expect(screen.getByRole('status', { name: /Ставка/ }).textContent).toMatch(/^1\s*500\s*\$$/)
  })

  it('без значения — прочерк; в режиме правки ввода нет и есть подсказка', () => {
    render(<FormRenderer doc={doc([f({ id: 't', type: 'text' }), lk])} values={{ t: 'a' }} mode="edit" onChange={() => {}} />)
    expect(screen.getByRole('status', { name: /Ставка/ }).textContent).toBe('—')
    expect(screen.queryByRole('textbox', { name: 'Ставка' })).toBeNull()
    expect(screen.getByText(/после сохранения/)).toBeTruthy()
  })

  it('formatValue подстановки — по target_type/target_config', () => {
    expect(formatValue(lk, 1500, { lookups: { lk: 1500 } })).toMatch(/^1\s*500\s*\$$/)
  })
})
