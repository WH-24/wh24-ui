import { describe, expect, it } from 'vitest'

import { createBrainApi } from '../api'
import { mockFetch } from '../testing'

describe('models / admin client', () => {
  it('models.list: GET /models, дефолты', async () => {
    const { fn, calls } = mockFetch(() => ({ status: 200, body: { models: [{ id: 'gpt-5.5', label: 'GPT-5.5' }], default_model: 'gpt-5.5' } }))
    const api = createBrainApi({ base: '/b', fetch: fn })
    expect(await api.models.list()).toEqual({ models: [{ id: 'gpt-5.5', label: 'GPT-5.5' }], default_model: 'gpt-5.5' })
    expect(calls[0]!.url).toBe('/b/models')
  })

  it('admin.setDefaultModel: PUT /admin/models {default_model}', async () => {
    const { fn, calls } = mockFetch(() => ({ status: 200, body: { default_model: 'gpt-5.5-pro' } }))
    const api = createBrainApi({ base: '/b', fetch: fn })
    expect(await api.admin.setDefaultModel('gpt-5.5-pro')).toBe('gpt-5.5-pro')
    expect(calls[0]!.url).toBe('/b/admin/models')
    expect(calls[0]!.init.method).toBe('PUT')
    expect(JSON.parse(String(calls[0]!.init.body))).toEqual({ default_model: 'gpt-5.5-pro' })
  })

  it('admin.embeddings: get / put / activate / check', async () => {
    const state = {
      provider: 'relay',
      active_model: 'multilingual-e5-large',
      target_model: 'text-embedding-3-large@1024',
      switching: true,
      available: { local: true, relay: true },
      coverage: [{ model: 'text-embedding-3-large@1024', embedded: 40, total: 100, pending: 60, failed: 0 }],
    }
    const { fn, calls } = mockFetch((url) =>
      url.endsWith('/check') ? { status: 200, body: { provider: 'relay', model: 'x', dims: 1024, ms: 412 } } : { status: 200, body: state },
    )
    const api = createBrainApi({ base: '/b', fetch: fn })
    expect((await api.admin.embeddings.get()).switching).toBe(true)
    expect(calls[0]!.url).toBe('/b/admin/embeddings')
    await api.admin.embeddings.put('relay')
    expect(calls[1]!.init.method).toBe('PUT')
    expect(JSON.parse(String(calls[1]!.init.body))).toEqual({ provider: 'relay' })
    await api.admin.embeddings.activate()
    expect(calls[2]!.url).toBe('/b/admin/embeddings/activate')
    const chk = await api.admin.embeddings.check()
    expect(chk).toEqual({ provider: 'relay', model: 'x', dims: 1024, ms: 412 })
    expect(JSON.parse(String(calls[3]!.init.body))).toEqual({})
    await api.admin.embeddings.check('привет')
    expect(JSON.parse(String(calls[4]!.init.body))).toEqual({ text: 'привет' })
  })

  it('admin.embeddings.get: пустой ответ → безопасные дефолты', async () => {
    const { fn } = mockFetch(() => ({ status: 200, body: {} }))
    const s = await createBrainApi({ base: '/b', fetch: fn }).admin.embeddings.get()
    expect(s.available).toEqual({ local: false, relay: false })
    expect(s.coverage).toEqual([])
    expect(s.switching).toBe(false)
  })

  it('admin.index: status / sync / reindex (с источником и без)', async () => {
    const { fn, calls } = mockFetch((url, init) =>
      init.method === 'GET'
        ? { status: 200, body: { connectors: [{ connector: 'wowhaus', last_ok_at: '2026-11-06T10:00:00Z' }], modules: [{ module: 'oup', entity_type: 'lead', documents: 5, chunks: 9 }] } }
        : { status: 202, body: { status: 'queued' } },
    )
    const api = createBrainApi({ base: '/b', fetch: fn })
    const st = await api.admin.index.status()
    expect(st.connectors[0]!.connector).toBe('wowhaus')
    expect(st.modules[0]!.documents).toBe(5)
    await api.admin.index.sync()
    expect(calls[1]!.url).toBe('/b/admin/index/sync')
    await api.admin.index.reindex()
    expect(JSON.parse(String(calls[2]!.init.body))).toEqual({})
    await api.admin.index.reindex('wowhaus')
    expect(JSON.parse(String(calls[3]!.init.body))).toEqual({ source: 'wowhaus' })
  })
})
