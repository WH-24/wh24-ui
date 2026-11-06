import { describe, expect, it } from 'vitest'

import { createBrainApi } from '../api'
import { mockFetch } from '../testing'

describe('memory client', () => {
  it('get: GET /me/memory; дефолты и лимиты при неполном ответе', async () => {
    const { fn, calls } = mockFetch(() => ({ status: 200, body: { nickname: 'Тарас', items: [] } }))
    const m = await createBrainApi({ base: '/b', fetch: fn }).memory.get()
    expect(calls[0]!.url).toBe('/b/me/memory')
    expect(m).toEqual({
      enabled: true,
      nickname: 'Тарас',
      role: '',
      items: [],
      limits: { max_items: 100, max_text: 300 },
    })
  })

  it('update: PUT с частичным телом, ответ — вся память', async () => {
    const { fn, calls } = mockFetch(() => ({
      status: 200,
      body: { enabled: false, nickname: '', role: 'владелец', items: [], limits: { max_items: 50, max_text: 200 } },
    }))
    const m = await createBrainApi({ base: '/b', fetch: fn }).memory.update({ enabled: false, role: 'владелец' })
    expect(calls[0]!.init.method).toBe('PUT')
    expect(JSON.parse(String(calls[0]!.init.body))).toEqual({ enabled: false, role: 'владелец' })
    expect(m.enabled).toBe(false)
    expect(m.limits).toEqual({ max_items: 50, max_text: 200 })
  })

  it('addItem / removeItem / forget / importText: маршруты и тела', async () => {
    const { fn, calls } = mockFetch((url, init) => {
      if (url.endsWith('/items') && init.method === 'POST')
        return { status: 201, body: { item: { id: 'i1', kind: 'fact', text: 'Работаю в ОУП', source: 'manual' } } }
      if (url.endsWith('/import')) return { status: 200, body: { added: 2, skipped: 1, items: [] } }
      return { status: 204 }
    })
    const api = createBrainApi({ base: '/b', fetch: fn })
    const item = await api.memory.addItem({ kind: 'fact', text: 'Работаю в ОУП' })
    expect(item.id).toBe('i1')
    expect(calls[0]!.url).toBe('/b/me/memory/items')
    await api.memory.removeItem('i/1')
    expect(calls[1]!.url).toBe('/b/me/memory/items/i%2F1')
    expect(calls[1]!.init.method).toBe('DELETE')
    await api.memory.forget()
    expect(calls[2]!.url).toBe('/b/me/memory')
    expect(calls[2]!.init.method).toBe('DELETE')
    const r = await api.memory.importText('- любит кратко')
    expect(JSON.parse(String(calls[3]!.init.body))).toEqual({ text: '- любит кратко' })
    expect(r).toEqual({ added: 2, skipped: 1, items: [] })
  })
})
