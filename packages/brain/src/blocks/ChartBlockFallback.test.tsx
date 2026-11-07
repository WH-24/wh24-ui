import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { RunBlock } from '../types'
import { blockToRows, ChartBlockFallback, formatBlockValue } from './ChartBlockFallback'

function makeBlock(n: number, over: Partial<RunBlock> = {}): RunBlock {
  return {
    id: 'blk_1',
    type: 'chart',
    title: 'Текучесть по отделам: 2026?',
    dataset: 'hr_staff_months',
    query: { dataset: 'hr_staff_months' },
    columns: [
      { key: 'dept', title: 'Отдел', type: 'string' },
      { key: 'month', title: 'Месяц', type: 'date' },
      { key: 'turnover', title: 'Текучесть, %', type: 'float' },
      { key: 'headcount', title: 'Численность', type: 'integer' },
      { key: 'active', title: 'Работает', type: 'boolean' },
    ],
    rows: Array.from({ length: n }, (_, i) => [`Отдел ${i + 1}`, '2026-01-01', 33.333, 2026, i % 2 === 0]),
    view: { plugin: 'Y Bar' },
    explain: { dataset_title: 'Кадры по месяцам', row_count: n },
    source: 'bi_query',
    ...over,
  }
}

describe('ChartBlockFallback', () => {
  const origCreate = URL.createObjectURL
  const origRevoke = URL.revokeObjectURL
  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => 'blob:x')
    URL.revokeObjectURL = vi.fn()
  })
  afterEach(() => {
    URL.createObjectURL = origCreate
    URL.revokeObjectURL = origRevoke
  })

  it('заголовок, первые 20 строк из 25, значения по-русски, «Что посчитано»', () => {
    render(<ChartBlockFallback block={makeBlock(25)} />)
    expect(screen.getByRole('heading', { name: 'Текучесть по отделам: 2026?' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Текучесть, %' })).toHaveAttribute('data-num')
    expect(screen.getByRole('columnheader', { name: 'Отдел' })).not.toHaveAttribute('data-num')
    expect(screen.getAllByRole('row')).toHaveLength(21) // шапка + 20
    expect(screen.getByText('Отдел 20')).toBeInTheDocument()
    expect(screen.queryByText('Отдел 21')).toBeNull()
    expect(screen.getByText('Показаны первые 20 строк из 25')).toBeInTheDocument()
    const first = screen.getAllByRole('row')[1]!
    expect(Array.from(first.querySelectorAll('td'), (c) => c.textContent)).toEqual([
      'Отдел 1',
      '01.01.2026',
      '33,33',
      '2026',
      'да',
    ])
    expect(screen.getByText('Что посчитано')).toBeInTheDocument()
    expect(screen.getByText('Кадры по месяцам')).toBeInTheDocument()
  })

  it('«Скачать .xlsx» собирает книгу из всех строк, имя файла — из заголовка без запрещённых символов', () => {
    const clicks: string[] = []
    const spy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clicks.push(this.download)
    })
    render(<ChartBlockFallback block={makeBlock(25)} />)
    fireEvent.click(screen.getByRole('button', { name: /Скачать \.xlsx/ }))
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1)
    expect(clicks[0]).toBe('Текучесть по отделам 2026.xlsx')
    spy.mockRestore()
  })

  it('без строк — «Нет данных», без кнопки, объяснение остаётся', () => {
    render(<ChartBlockFallback block={makeBlock(0)} />)
    expect(screen.getByText('Нет данных')).toBeInTheDocument()
    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByText('Что посчитано')).toBeInTheDocument()
  })

  it('пустая ячейка — тире, maxRows ограничивает таблицу', () => {
    render(<ChartBlockFallback block={makeBlock(3, { rows: [['АР', null, null, 5, false]] })} maxRows={1} />)
    const cells = screen.getAllByRole('cell')
    expect(cells.map((c) => c.textContent)).toEqual(['АР', '—', '—', '5', 'нет'])
    expect(cells[1]).toHaveAttribute('data-empty')
  })
})

describe('formatBlockValue / blockToRows', () => {
  it('числа: целые без группировки, дробные с двумя знаками; даты дд.мм.гггг; да/нет', () => {
    expect(formatBlockValue(2026, { key: 'y', title: 'Год', type: 'integer' })).toBe('2026')
    expect(formatBlockValue(33.333, { key: 't', title: 'Т', type: 'float' })).toBe('33,33')
    expect(formatBlockValue(12, { key: 't', title: 'Т', type: 'float' })).toBe('12')
    expect(formatBlockValue(7, { key: 'x', title: 'X', type: 'string' })).toBe('7')
    expect(formatBlockValue('2026-03-01', { key: 'd', title: 'Д', type: 'date' })).toBe('01.03.2026')
    expect(formatBlockValue(true, { key: 'b', title: 'Б', type: 'boolean' })).toBe('да')
    expect(formatBlockValue(null)).toBe('')
    expect(formatBlockValue(Number.NaN)).toBe('')
  })

  it('строки для книги: шапка из заголовков, числа как есть (Excel прочитает числом)', () => {
    expect(blockToRows(makeBlock(1))).toEqual([
      ['Отдел', 'Месяц', 'Текучесть, %', 'Численность', 'Работает'],
      ['Отдел 1', '01.01.2026', '33.333', '2026', 'да'],
    ])
  })
})
