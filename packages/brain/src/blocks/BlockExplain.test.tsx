import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { RunBlockExplain } from '../types'
import { BlockExplain, formatBlockFilter } from './BlockExplain'

const explain: RunBlockExplain = {
  dataset: 'hr_staff_months',
  dataset_title: 'Кадры по месяцам',
  metrics: [
    { key: 'turnover', title: 'Текучесть, %', formula: 'Уволено ÷ средняя численность × 100' },
    { key: 'hired', title: 'Принято' },
  ],
  period: { from: '2025-11-01', to: '2026-10-31' },
  period_defaulted: true,
  granularity: 'month',
  filters: [
    { column: 'Отдел', op: 'eq', value: 'АР' },
    { column: 'Статус', op: 'in', values: ['работает', 'в декрете'] },
  ],
  row_count: 20,
  source_rows: 500,
  truncated: true,
  computed_at: '2026-11-06T12:30:00Z',
}

/** Значение строки списка по её подписи. */
function dd(dt: string): HTMLElement {
  return screen.getByText(dt, { selector: 'dt' }).nextElementSibling as HTMLElement
}

describe('BlockExplain', () => {
  it('свёрнутый <details> «Что посчитано»: набор, показатели с формулой, период, разрез, фильтры, строки', () => {
    const { container } = render(<BlockExplain explain={explain} />)
    const details = container.querySelector('details')
    expect(details).not.toBeNull()
    expect(details).not.toHaveAttribute('open')
    expect(screen.getByText('Что посчитано').tagName).toBe('SUMMARY')

    expect(dd('Набор')).toHaveTextContent('Кадры по месяцам')
    expect(dd('Показатели')).toHaveTextContent('Текучесть, % = Уволено ÷ средняя численность × 100')
    expect(dd('Показатели')).toHaveTextContent('Принято')
    expect(dd('Период')).toHaveTextContent('с 01.11.2025 по 31.10.2026 · по умолчанию')
    expect(dd('Разрез времени')).toHaveTextContent('месяц')
    expect(dd('Фильтры')).toHaveTextContent('Отдел = АР; Статус — один из: работает, в декрете')
    expect(dd('Строк')).toHaveTextContent('20 из 500')
    expect(dd('Посчитано')).toHaveTextContent(new Date('2026-11-06T12:30:00Z').toLocaleString('ru-RU'))
    expect(container.querySelector('pre')).toBeNull()
  })

  it('SQL — в <pre>, только когда передан', () => {
    const { container } = render(<BlockExplain explain={{ dataset: 'hr', sql: 'select 1' }} />)
    expect(container.querySelector('pre')).toHaveTextContent('select 1')
  })

  it('один показатель, период без «по умолчанию», строки без обрезки, квартал, open', () => {
    const { container } = render(
      <BlockExplain
        open
        explain={{
          dataset: 'hr_vacations',
          metrics: [{ key: 'days', title: 'Дней' }],
          period: { from: '2026-01-01' },
          granularity: 'quarter',
          row_count: 7,
        }}
      />,
    )
    expect(container.querySelector('details')).toHaveAttribute('open')
    expect(dd('Набор')).toHaveTextContent('hr_vacations')
    expect(dd('Показатель')).toHaveTextContent('Дней')
    expect(dd('Показатель')).not.toHaveTextContent('=')
    expect(dd('Период')).toHaveTextContent('с 01.01.2026')
    expect(dd('Период')).not.toHaveTextContent('по умолчанию')
    expect(dd('Разрез времени')).toHaveTextContent('квартал')
    expect(dd('Строк')).toHaveTextContent('7')
    expect(screen.queryByText('Фильтры')).toBeNull()
    expect(screen.queryByText('Посчитано')).toBeNull()
  })

  it('пустое объяснение ничего не рисует', () => {
    const { container } = render(<BlockExplain explain={{}} />)
    expect(container.firstChild).toBeNull()
  })
})

describe('formatBlockFilter', () => {
  it.each([
    [{ column: 'Отдел', op: 'eq', value: 'АР' }, 'Отдел = АР'],
    [{ column: 'Отдел', op: 'ne', value: 'АР' }, 'Отдел ≠ АР'],
    [{ column: 'Стаж мес', op: 'gte', value: 12 }, 'Стаж мес ≥ 12'],
    [{ column: 'Стаж мес', op: 'between', values: [3, 12] }, 'Стаж мес от 3 до 12'],
    [{ column: 'Отдел', op: 'in', values: ['АР', 'КР'] }, 'Отдел — один из: АР, КР'],
    [{ column: 'Отдел', op: 'not_in', values: ['АР'] }, 'Отдел — не из: АР'],
    [{ column: 'Должность', op: 'contains', value: 'архитект' }, 'Должность содержит «архитект»'],
    [{ column: 'Работает', op: 'eq', value: true }, 'Работает = да'],
    [{ column: 'Дата приёма', op: 'lt', value: '2026-01-01' }, 'Дата приёма < 01.01.2026'],
    [{ column: 'Дата увольнения', op: 'is_null' }, 'Дата увольнения пусто'],
    [{ column: 'Руководитель', op: 'not_null' }, 'Руководитель заполнено'],
    [{ column: 'Офис', op: 'like', value: 'М%' }, 'Офис like М%'],
  ])('%j → %s', (f, want) => {
    expect(formatBlockFilter(f)).toBe(want)
  })
})
