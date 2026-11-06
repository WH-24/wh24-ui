import { describe, expect, it } from 'vitest'

import type { Field } from '../types'
import { SECTION_COLORS } from '../types'
import { formatDateRange, formatDuration, formatValue, isNumericType } from './format'
import { systemValue } from './system'

// Показ значений типов шага 1 (06.11.2026) и системные number/updated_*.

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
const nb = ' '

describe('формат новых типов', () => {
  it('длительность', () => {
    expect(formatDuration(150)).toBe(`2${nb}ч${nb}30${nb}мин`)
    expect(formatDuration(45)).toBe(`45${nb}мин`)
    expect(formatDuration(180)).toBe(`3${nb}ч`)
    expect(formatDuration(0)).toBe(`0${nb}мин`)
  })
  it('период', () => {
    expect(formatDateRange({ start: '2026-02-01', end: '2026-02-05' })).toBe('01.02.2026 – 05.02.2026')
  })
  it('formatValue', () => {
    expect(formatValue(f({ id: 'r', type: 'rating', config: { max: 5 } }), 4)).toBe('4 из 5')
    expect(formatValue(f({ id: 'r', type: 'rating' }), 3)).toBe('3 из 5')
    expect(formatValue(f({ id: 'p', type: 'percent' }), 45)).toBe(`45${nb}%`)
    expect(formatValue(f({ id: 'd', type: 'duration' }), 150)).toBe(`2${nb}ч${nb}30${nb}мин`)
    expect(formatValue(f({ id: 't', type: 'time' }), '09:30')).toBe('09:30')
    expect(formatValue(f({ id: 'dr', type: 'date_range' }), { start: '2026-02-01', end: '2026-02-05' })).toBe(
      '01.02.2026 – 05.02.2026',
    )
    expect(formatValue(f({ id: 'tg', type: 'tags' }), ['срочно', 'клиент'])).toBe('срочно, клиент')
    expect(formatValue(f({ id: 'l', type: 'location' }), { address: 'Москва, Тверская 1', lat: 55.7 })).toBe(
      'Москва, Тверская 1',
    )
    const teal = SECTION_COLORS.find((c) => c.key === 'teal')!
    expect(formatValue(f({ id: 'c', type: 'color' }), 'teal')).toBe(teal.label)
    expect(formatValue(f({ id: 'c', type: 'color' }), 'nope')).toBe('nope')
  })
  it('числовые типы выравниваются вправо', () => {
    for (const t of ['rating', 'percent', 'duration'] as const) expect(isNumericType(t)).toBe(true)
    expect(isNumericType('time')).toBe(false)
  })
})

describe('системные number / updated_at / updated_by', () => {
  const record = {
    number: 42,
    created_by: 'iam-1',
    created_at: '2026-10-17T10:00:00Z',
    updated_by: 'iam-2',
    updated_at: '2026-11-06T14:05:00Z',
  }
  const staff = [
    { id: 'emp-2', label: 'Иванов Иван', auth_user_id: 'iam-2' },
  ]
  it('значения из записи', () => {
    expect(systemValue({ system: 'number' }, { record })).toBe(42)
    expect(systemValue({ system: 'updated_at' }, { record })).toBe('2026-11-06T14:05:00Z')
    expect(systemValue({ system: 'updated_by' }, { record, staff })).toBe('emp-2')
    expect(systemValue({ system: 'updated_by' }, { record: { ...record, updated_by: null } })).toBeUndefined()
    expect(systemValue({ system: 'number' }, { record: null })).toBeUndefined()
  })
})
