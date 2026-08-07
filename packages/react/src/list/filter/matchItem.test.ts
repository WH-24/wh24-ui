import { describe, it, expect } from 'vitest'

import { matchItem, activeCount, isEmptyValue } from './matchItem'
import type { FilterBarConfig } from './types'

interface Row {
  name: string
  dept: string
  tags: string[]
  hired: string // ISO
  active: boolean
}

const config: FilterBarConfig<Row> = {
  scope: 'test',
  search: { get: (r) => `${r.name} ${r.dept}` },
  fields: [
    { key: 'name', label: 'Имя', type: 'text', get: (r) => r.name },
    { key: 'dept', label: 'Отдел', type: 'select', get: (r) => r.dept },
    { key: 'tags', label: 'Теги', type: 'multiselect', get: (r) => r.tags },
    { key: 'hired', label: 'Принят', type: 'daterange', get: (r) => r.hired },
    { key: 'active', label: 'Активен', type: 'boolean', get: (r) => r.active },
  ],
}

const row: Row = {
  name: 'Анна Иванова',
  dept: 'eng',
  tags: ['lead', 'react'],
  hired: '2024-03-15',
  active: true,
}

const m = (state: Record<string, unknown>) => matchItem(row, state as never, config)

describe('isEmptyValue', () => {
  it('null/undefined/пустые строки и массивы — пусто', () => {
    expect(isEmptyValue(null)).toBe(true)
    expect(isEmptyValue(undefined as never)).toBe(true)
    expect(isEmptyValue('')).toBe(true)
    expect(isEmptyValue('   ')).toBe(true)
    expect(isEmptyValue([])).toBe(true)
    expect(isEmptyValue({ from: '', to: '' })).toBe(true)
  })

  it('false — валидное значение (tri-state boolean), не пусто', () => {
    expect(isEmptyValue(false)).toBe(false)
    expect(isEmptyValue(true)).toBe(false)
  })

  it('непустые значения — не пусто', () => {
    expect(isEmptyValue('x')).toBe(false)
    expect(isEmptyValue(['a'])).toBe(false)
    expect(isEmptyValue({ from: '2024-01-01', to: '' })).toBe(false)
  })
})

describe('activeCount', () => {
  it('считает только непустые поля', () => {
    expect(activeCount({})).toBe(0)
    expect(activeCount({ name: '', dept: null })).toBe(0)
    expect(activeCount({ name: 'Анна', dept: 'eng', tags: [] })).toBe(2)
    expect(activeCount({ active: false })).toBe(1) // false активно
  })
})

describe('matchItem', () => {
  it('пустой фильтр пропускает любую строку', () => {
    expect(m({})).toBe(true)
  })

  it('text — подстрока без учёта регистра', () => {
    expect(m({ name: 'анна' })).toBe(true)
    expect(m({ name: 'ИВАНОВА' })).toBe(true)
    expect(m({ name: 'Пётр' })).toBe(false)
  })

  it('select — точное совпадение', () => {
    expect(m({ dept: 'eng' })).toBe(true)
    expect(m({ dept: 'hr' })).toBe(false)
  })

  it('multiselect — OR внутри (пересечение хотя бы по одному)', () => {
    expect(m({ tags: ['lead'] })).toBe(true)
    expect(m({ tags: ['go', 'react'] })).toBe(true)
    expect(m({ tags: ['go', 'vue'] })).toBe(false)
  })

  // Поле могло раньше быть `select`, и в localStorage/пресете у пользователя
  // осталось скалярное значение. После смены типа на `multiselect` такое
  // значение не должно ронять фильтр — иначе страница падает при открытии,
  // и починить её изнутри нельзя: состояние читается снова при каждой загрузке.
  it('multiselect — переживает скалярное значение из старого select', () => {
    expect(m({ tags: 'react' as unknown as string[] })).toBe(true)
    expect(m({ tags: 'vue' as unknown as string[] })).toBe(false)
  })

  it('daterange — обе границы опциональны', () => {
    expect(m({ hired: { from: '2024-01-01', to: '2024-12-31' } })).toBe(true)
    expect(m({ hired: { from: '2024-04-01', to: '' } })).toBe(false) // принят раньше from
    expect(m({ hired: { from: '', to: '2024-04-01' } })).toBe(true)
    expect(m({ hired: { from: '2025-01-01', to: '' } })).toBe(false)
  })

  it('boolean — tri-state: и true, и false фильтруют', () => {
    expect(m({ active: true })).toBe(true)
    expect(m({ active: false })).toBe(false)
  })

  it('несколько полей — AND между ними', () => {
    expect(m({ name: 'анна', dept: 'eng' })).toBe(true)
    expect(m({ name: 'анна', dept: 'hr' })).toBe(false)
  })

  it('свободный поиск q — по config.search.get', () => {
    expect(m({ q: 'иванова' })).toBe(true)
    expect(m({ q: 'eng' })).toBe(true)
    expect(m({ q: 'нет такого' })).toBe(false)
    expect(m({ q: '   ' })).toBe(true) // пробелы игнорируются
  })
})
