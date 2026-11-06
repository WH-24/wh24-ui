import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { useState } from 'react'

import type { Field, RecordData, SchemaDocument } from '../types'
import { FormRenderer } from './FormRenderer'
import { fieldRegistry } from './registry'

// Контролы типов шага 1 (06.11.2026): каждый рендерится в edit и view,
// оценка кликается, процент — progressbar, таблица с колонкой rating — звёзды.

const f = (over: Partial<Field> & Pick<Field, 'id' | 'type'>): Field => ({
  key: over.id,
  label: over.id,
  section_id: 's1',
  span: 12,
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
  return (
    <>
      <FormRenderer doc={d} values={v} mode={mode} onChange={(id, val) => setV((p) => ({ ...p, [id]: val }))} />
      <output data-testid="out">{JSON.stringify(v)}</output>
    </>
  )
}
const out = () => JSON.parse(screen.getByTestId('out').textContent || '{}') as RecordData

const sample: Array<[Field, unknown]> = [
  [f({ id: 'rating', type: 'rating', config: { max: 5 } }), 4],
  [f({ id: 'time', type: 'time' }), '09:30'],
  [f({ id: 'range', type: 'date_range' }), { start: '2026-02-01', end: '2026-02-05' }],
  [f({ id: 'dur', type: 'duration' }), 150],
  [f({ id: 'pct', type: 'percent' }), 45],
  [f({ id: 'tags', type: 'tags' }), ['срочно', 'клиент']],
  [f({ id: 'loc', type: 'location' }), { address: 'Москва, Тверская 1' }],
  [f({ id: 'color', type: 'color' }), 'teal'],
]

describe('контролы новых типов', () => {
  it('реестр знает все восемь типов', () => {
    for (const [fld] of sample) expect(fieldRegistry[fld.type]).toBeDefined()
  })
  it('рендерятся в edit и view без ошибок, view показывает значение', () => {
    const d = doc(sample.map(([fld]) => fld))
    const initial = Object.fromEntries(sample.map(([fld, v]) => [fld.id, v]))
    const { unmount } = render(<Harness d={d} initial={initial} />)
    unmount()
    render(<Harness d={d} initial={initial} mode="view" />)
    expect(screen.getByText('4 из 5')).toBeInTheDocument()
    expect(screen.getByText('09:30')).toBeInTheDocument()
    expect(screen.getByText('01.02.2026 – 05.02.2026')).toBeInTheDocument()
    expect(screen.getByText(/^2\s+ч\s+30\s+мин$/)).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '45')
    expect(screen.getByText('срочно')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /на карте/ })).toHaveAttribute(
      'href',
      'https://yandex.ru/maps/?text=' + encodeURIComponent('Москва, Тверская 1'),
    )
    expect(screen.getByText('Бирюзовый')).toBeInTheDocument()
  })
  it('оценка: клик по третьей звезде → 3, повторный клик по ней → пусто', async () => {
    const user = userEvent.setup()
    render(<Harness d={doc([f({ id: 'rating', type: 'rating' })])} />)
    const stars = screen.getAllByRole('radio')
    expect(stars).toHaveLength(5)
    await user.click(stars[2]!)
    expect(out().rating).toBe(3)
    await user.click(stars[2]!)
    expect(out().rating).toBeUndefined()
  })
  it('длительность: 2 ч и 30 мин → 150 минут', async () => {
    const user = userEvent.setup()
    render(<Harness d={doc([f({ id: 'dur', type: 'duration' })])} />)
    await user.type(screen.getByLabelText(/часы/i), '2')
    await user.type(screen.getByLabelText(/минуты/i), '30')
    expect(out().dur).toBe(150)
  })
  it('теги: Enter добавляет метку, подсказки из ctx.loadTags', async () => {
    const user = userEvent.setup()
    const loadTags = vi.fn(async () => ['срочно', 'склад'])
    function H() {
      const [v, setV] = useState<RecordData>({})
      return (
        <>
          <FormRenderer doc={doc([f({ id: 'tags', type: 'tags' })])} values={v} mode="edit" ctx={{ loadTags }} onChange={(id, val) => setV((p) => ({ ...p, [id]: val }))} />
          <output data-testid="out">{JSON.stringify(v)}</output>
        </>
      )
    }
    render(<H />)
    const input = screen.getByRole('combobox', { name: /tags/i })
    await user.type(input, 'кли{Enter}')
    expect(out().tags).toEqual(['кли'])
    await user.type(input, 'с')
    expect(loadTags).toHaveBeenCalled()
    await user.click(await screen.findByRole('option', { name: 'склад' }))
    expect(out().tags).toEqual(['кли', 'склад'])
  })
  it('цвет: нажатие на кружок выбирает цвет', async () => {
    const user = userEvent.setup()
    render(<Harness d={doc([f({ id: 'color', type: 'color' })])} />)
    await user.click(screen.getByRole('radio', { name: 'Бирюзовый' }))
    expect(out().color).toBe('teal')
  })
  it('таблица с колонкой «Оценка» рендерит звёзды в ячейке', () => {
    const tbl = f({ id: 'tbl', type: 'table', config: { columns: [{ id: 'c1', key: 'rate', label: 'Оценка', type: 'rating' }] } })
    render(<Harness d={doc([tbl])} initial={{ tbl: [{ c1: 2 }] }} />)
    const row = screen.getAllByRole('row')[1]!
    expect(within(row).getAllByRole('radio')).toHaveLength(5)
  })
  it('таблица в просмотре форматирует новые колонки: период и сотрудник по имени', () => {
    const tbl = f({
      id: 'tbl',
      type: 'table',
      config: {
        columns: [
          { id: 'c1', key: 'when', label: 'Период', type: 'date_range' },
          { id: 'c2', key: 'who', label: 'Кто', type: 'user' },
          { id: 'c3', key: 'dur', label: 'Длительность', type: 'duration' },
        ],
      },
    })
    const staff = [{ id: 'u1', label: 'Иван Петров' }]
    render(
      <FormRenderer
        doc={doc([tbl])}
        values={{ tbl: [{ c1: { start: '2026-02-01', end: '2026-02-05' }, c2: 'u1', c3: 150 }] }}
        mode="view"
        ctx={{ staff }}
        onChange={() => {}}
      />,
    )
    expect(screen.getByText('01.02.2026 – 05.02.2026')).toBeInTheDocument()
    expect(screen.getByText('Иван Петров')).toBeInTheDocument()
    expect(screen.getByText(/^2\s+ч\s+30\s+мин$/)).toBeInTheDocument()
    expect(screen.queryByText(/object Object/)).not.toBeInTheDocument()
  })
  it('длительность: неверный ввод не превращается в NaN и уходит валидатору строкой', async () => {
    const user = userEvent.setup()
    render(<Harness d={doc([f({ id: 'dur', type: 'duration' })])} />)
    const hours = screen.getByLabelText(/часы/i) as HTMLInputElement
    await user.type(hours, '1.5')
    expect(hours.value).toBe('1.5')
    expect((screen.getByLabelText(/минуты/i) as HTMLInputElement).value).toBe('')
    expect(typeof out().dur).toBe('string')
    await user.clear(hours)
    expect(out().dur).toBeUndefined()
    await user.type(hours, '2')
    expect(out().dur).toBe(120)
  })
})
