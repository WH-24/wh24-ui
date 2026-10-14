import { describe, expect, it } from 'vitest'

import type { Field, SchemaDocument } from './types'
import { chainDepth, normalize, validateForPublish, visibilityDeps } from './schema'

const f = (over: Partial<Field> & Pick<Field, 'id' | 'type'>): Field => ({
  key: over.id,
  label: over.id,
  section_id: 's',
  span: 6,
  required: false,
  show_in_list: false,
  filterable: false,
  archived: false,
  ...over,
})
const doc = (fields: Field[], title = fields[0]?.id ?? ''): SchemaDocument => ({
  schema_version: 1,
  title_field: title,
  sections: [{ id: 's', title: 'Основное', sort: 0 }],
  fields,
})
const dep = (id: string, on: string): Field =>
  f({ id, type: 'text', visible_if: { all: [{ field: on, op: 'not_empty' }] } })

describe('normalize', () => {
  it('годный черновик — null; проблемы — первая найденная', () => {
    expect(normalize(doc([f({ id: 'a', type: 'text' })]))).toBeNull()
    expect(normalize(null)).toMatch(/не задан/)
    expect(normalize(doc([f({ id: 'a', type: 'text', span: 5 as never })]))).toMatch(/span=5/)
    expect(normalize(doc([f({ id: 'a', type: 'text', section_id: 'zzz' })]))).toMatch(/секцию "zzz"/)
    expect(normalize(doc([f({ id: 'a', type: 'text' }), f({ id: 'a', type: 'text' })]))).toMatch(/повторяющийся id поля/)
    expect(normalize(doc([f({ id: 'a', type: 'wat' as never })]))).toMatch(/неизвестный тип/)
  })
})

describe('validateForPublish — контрольный прогон на корректной схеме', () => {
  it('публикуемая схема без блокеров', () => {
    const d = doc([
      f({ id: 'name', type: 'text' }),
      f({ id: 'over', type: 'checkbox' }),
      dep('reason', 'over'),
      f({ id: 't', type: 'table', config: { columns: [{ id: 'c', key: 'c', label: 'C', type: 'money' }] } }),
    ])
    expect(validateForPublish(null, d)).toEqual([])
    expect(validateForPublish(d, d)).toEqual([])
  })
})

describe('validateForPublish — блокеры', () => {
  it('название записи: не выбрано / не существует / неподходящий тип', () => {
    expect(validateForPublish(null, doc([f({ id: 'a', type: 'text' })], ''))[0]?.message).toBe(
      'Поле «Название записи» не выбрано',
    )
    expect(validateForPublish(null, doc([f({ id: 'a', type: 'text' })], 'zzz'))[0]?.message).toBe(
      'Поле «Название записи» ссылается на несуществующее поле',
    )
    expect(validateForPublish(null, doc([f({ id: 'n', type: 'number', label: 'Число' })]))[0]?.message).toBe(
      'Поле «Число» не подходит для названия записи (тип «number»)',
    )
  })

  it('дубли ключей — только среди неархивных; сообщение называет оба поля', () => {
    const d = doc([
      f({ id: 'a', type: 'text', key: 'k', label: 'Первое' }),
      f({ id: 'b', type: 'text', key: 'k', label: 'Второе' }),
      f({ id: 'c', type: 'text', key: 'k', archived: true }),
    ])
    const errs = validateForPublish(null, d)
    expect(errs).toHaveLength(1)
    expect(errs[0]).toEqual({ field_id: 'b', message: 'Поле «Второе» использует ключ "k", уже занятый полем «Первое»' })
  })

  it('условия: несуществующее поле, цикл (одна ошибка на цикл), глубина > 3', () => {
    const missing = doc([f({ id: 'a', type: 'text' }), dep('b', 'zzz')])
    expect(validateForPublish(null, missing).map((e) => e.message)).toEqual([
      'Поле «b»: условие показа ссылается на несуществующее поле "zzz"',
    ])

    const cycle = doc([f({ id: 'a', type: 'text' }), dep('x', 'y'), dep('y', 'x')])
    const cErrs = validateForPublish(null, cycle)
    expect(cErrs).toHaveLength(1)
    expect(cErrs[0]!.message).toMatch(/образуют цикл/)

    const deep = doc([f({ id: 'a', type: 'text' }), dep('d1', 'd2'), dep('d2', 'd3'), dep('d3', 'd4'), dep('d4', 'a')])
    const dErrs = validateForPublish(null, deep)
    expect(dErrs.map((e) => e.field_id)).toEqual(['d1'])
    expect(dErrs[0]!.message).toBe(
      'Условие показа поля «d1» зависит от слишком длинной цепочки полей (глубина 4, максимум 3)',
    )
  })

  it('смена типа опубликованного поля — блокер; новое поле любого типа — нет', () => {
    const prev = doc([f({ id: 'a', type: 'text' })])
    const next = doc([f({ id: 'a', type: 'number', label: 'A' }), f({ id: 'b', type: 'money' })])
    const errs = validateForPublish(prev, next)
    expect(errs.map((e) => e.message)).toEqual([
      'Поле «A» не подходит для названия записи (тип «number»)',
      'Тип поля «A» нельзя менять после публикации (было «text», стало «number») — архивируйте поле и создайте новое',
    ])
  })

  it('колонка таблицы недопустимого типа', () => {
    const d = doc([
      f({ id: 'a', type: 'text' }),
      f({ id: 't', type: 'table', label: 'Смета', config: { columns: [{ id: 'c', key: 'f', label: 'Файл', type: 'file' }] } }),
    ])
    expect(validateForPublish(null, d).map((e) => e.message)).toEqual([
      'Поле «Смета»: столбец «Файл» использует недопустимый для таблицы тип «file»',
    ])
  })
})

describe('chainDepth / visibilityDeps', () => {
  it('глубина считается по рёбрам, ссылки на несуществующие поля не в графе', () => {
    const fields = [f({ id: 'a', type: 'text' }), dep('b', 'a'), dep('c', 'b'), dep('d', 'zzz')]
    const deps = visibilityDeps(fields)
    expect(chainDepth('c', deps)).toBe(2)
    expect(chainDepth('a', deps)).toBe(0)
    expect(deps.has('d')).toBe(false)
  })
})
