import { describe, it, expect, beforeEach, afterEach } from 'vitest'

import {
  loadState,
  saveState,
  loadPresets,
  savePresets,
  encodeShare,
  decodeShare,
  readShareFromUrl,
  shareParam,
  type StoredFilter,
} from './storage'

const SCOPE = 'test'
const sample: StoredFilter = {
  state: { name: 'Анна', tags: ['lead'] },
  fields: ['name', 'tags'],
}

beforeEach(() => localStorage.clear())
afterEach(() => window.history.replaceState({}, '', '/'))

describe('loadState / saveState', () => {
  it('round-trip по scope', () => {
    saveState(SCOPE, sample)
    expect(loadState(SCOPE)).toEqual(sample)
  })

  it('нет ключа → null', () => {
    expect(loadState('missing')).toBeNull()
  })

  it('битый JSON → null (не кидает)', () => {
    localStorage.setItem('wh_filter_test', '{не json')
    expect(loadState(SCOPE)).toBeNull()
  })

  it('частичный объект добивается дефолтами', () => {
    localStorage.setItem('wh_filter_test', JSON.stringify({ state: { a: 1 } }))
    expect(loadState(SCOPE)).toEqual({ state: { a: 1 }, fields: [] })
  })

  it('разные scope изолированы', () => {
    saveState('a', sample)
    expect(loadState('b')).toBeNull()
  })
})

describe('loadPresets / savePresets', () => {
  it('round-trip', () => {
    const presets = [{ id: '1', name: 'Мой', state: { dept: 'eng' } }]
    savePresets(SCOPE, presets)
    expect(loadPresets(SCOPE)).toEqual(presets)
  })

  it('нет ключа → []', () => {
    expect(loadPresets('missing')).toEqual([])
  })

  it('не-массив в хранилище → []', () => {
    localStorage.setItem('wh_filter_test_saved', JSON.stringify({ not: 'array' }))
    expect(loadPresets(SCOPE)).toEqual([])
  })
})

describe('encodeShare / decodeShare', () => {
  it('round-trip с кириллицей', () => {
    const encoded = encodeShare(sample)
    expect(encoded).not.toBe('')
    expect(decodeShare(encoded)).toEqual(sample)
  })

  it('мусор → null', () => {
    expect(decodeShare('###не-base64###')).toBeNull()
  })
})

describe('readShareFromUrl', () => {
  it('читает фильтр из ?f_<scope>=…', () => {
    const encoded = encodeShare(sample)
    window.history.replaceState({}, '', `/?${shareParam(SCOPE)}=${encoded}`)
    expect(readShareFromUrl(SCOPE)).toEqual(sample)
  })

  it('нет параметра → null', () => {
    window.history.replaceState({}, '', '/?other=1')
    expect(readShareFromUrl(SCOPE)).toBeNull()
  })
})
