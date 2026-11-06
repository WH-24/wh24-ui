import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { BrainApiError, createBrainApi } from './api'
import type { Run } from './types'

function mockFetch(responses: Array<{ status: number; body: unknown }>) {
  const calls: { url: string; init: RequestInit }[] = []
  let i = 0
  const fn = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} })
    const r = responses[Math.min(i, responses.length - 1)]!
    i++
    return new Response(r.body == null ? '' : JSON.stringify(r.body), {
      status: r.status,
      headers: { 'Content-Type': 'application/json' },
    })
  })
  return { fn: fn as unknown as typeof fetch, calls }
}

const run = (status: Run['status'], extra: Partial<Run> = {}): Run => ({
  id: 'r1',
  status,
  answer_md: '',
  citations: [],
  steps: [],
  suggested_actions: [],
  ...extra,
})

describe('createBrainApi', () => {
  it('search → POST {base}/search с JSON-телом и заголовками хоста', async () => {
    const { fn, calls } = mockFetch([{ status: 200, body: { hits: [], total: 0 } }])
    const api = createBrainApi({
      base: '/brain/api/v1/',
      fetch: fn,
      headers: () => ({ Authorization: 'Bearer t' }),
    })
    const res = await api.search({ q: 'офис', limit: 5 })
    expect(res.total).toBe(0)
    expect(calls[0]!.url).toBe('/brain/api/v1/search')
    expect(calls[0]!.init.method).toBe('POST')
    expect(calls[0]!.init.body).toBe('{"q":"офис","limit":5}')
    const h = new Headers(calls[0]!.init.headers)
    expect(h.get('Authorization')).toBe('Bearer t')
    expect(h.get('Content-Type')).toBe('application/json')
  })

  it('ask → 202 {run_id}; getRun → GET /runs/:id с экранированием', async () => {
    const { fn, calls } = mockFetch([
      { status: 202, body: { run_id: 'run/1' } },
      { status: 200, body: run('queued') },
    ])
    const api = createBrainApi({ base: '/b', fetch: fn })
    const { run_id } = await api.ask({ q: 'что по лиду?', context: { kind: 'lead', id: '7', module: 'oup' } })
    expect(run_id).toBe('run/1')
    const r = await api.getRun(run_id)
    expect(r.status).toBe('queued')
    expect(calls[1]!.url).toBe('/b/runs/run%2F1')
    expect(calls[1]!.init.method).toBe('GET')
    expect(calls[1]!.init.body).toBeUndefined()
  })

  it('ошибка → BrainApiError с текстом error из тела; 429 = квота', async () => {
    const api = createBrainApi({
      base: '/b',
      fetch: mockFetch([{ status: 429, body: { error: 'дневной лимит исчерпан' } }]).fn,
    })
    const e = await api.ask({ q: 'x' }).catch((x) => x as BrainApiError)
    expect(e).toBeInstanceOf(BrainApiError)
    expect(e.status).toBe(429)
    expect(e.quotaExceeded).toBe(true)
    expect(e.message).toBe('дневной лимит исчерпан')
  })

  it('feedback → POST /feedback, пустой ответ не ломает разбор', async () => {
    const { fn, calls } = mockFetch([{ status: 204, body: null }])
    const api = createBrainApi({ base: '/b', fetch: fn })
    await expect(api.feedback({ run_id: 'r1', vote: 'up' })).resolves.toBeUndefined()
    expect(calls[0]!.url).toBe('/b/feedback')
    expect(calls[0]!.init.body).toBe('{"run_id":"r1","vote":"up"}')
  })
})

describe('waitForRun', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
  })

  it('опрашивает с паузой 1 → 1,5 → 2,25 → 3 с и отдаёт каждый снимок в onUpdate', async () => {
    const { fn, calls } = mockFetch([
      { status: 200, body: run('queued') },
      { status: 200, body: run('running') },
      { status: 200, body: run('running') },
      { status: 200, body: run('running') },
      { status: 200, body: run('completed', { answer_md: 'готово' }) },
    ])
    const api = createBrainApi({ base: '/b', fetch: fn })
    const seen: string[] = []
    const p = api.waitForRun('r1', { onUpdate: (r) => seen.push(r.status) })

    await vi.advanceTimersByTimeAsync(0)
    expect(calls).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(999)
    expect(calls).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(calls).toHaveLength(2)
    await vi.advanceTimersByTimeAsync(1500)
    expect(calls).toHaveLength(3)
    await vi.advanceTimersByTimeAsync(2250)
    expect(calls).toHaveLength(4)
    // Потолок 3 с: следующая пауза не растёт дальше.
    await vi.advanceTimersByTimeAsync(2999)
    expect(calls).toHaveLength(4)
    await vi.advanceTimersByTimeAsync(1)
    expect(calls).toHaveLength(5)

    const final = await p
    expect(final.answer_md).toBe('готово')
    expect(seen).toEqual(['queued', 'running', 'running', 'running', 'completed'])
  })

  it('один запрос в полёте: пока ответ не пришёл, новый не уходит', async () => {
    let release: (() => void) | null = null
    const calls: string[] = []
    const fn = vi.fn(async (url: string | URL | Request) => {
      calls.push(String(url))
      if (calls.length === 1) {
        await new Promise<void>((res) => {
          release = res
        })
      }
      const body = calls.length === 1 ? run('running') : run('completed')
      return new Response(JSON.stringify(body), { status: 200 })
    }) as unknown as typeof fetch
    const api = createBrainApi({ base: '/b', fetch: fn })
    const p = api.waitForRun('r1')
    await vi.advanceTimersByTimeAsync(10_000)
    expect(calls).toHaveLength(1)
    release!()
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(1000)
    expect(calls).toHaveLength(2)
    await expect(p).resolves.toMatchObject({ status: 'completed' })
  })

  it('при скрытой вкладке опрос стоит и продолжается, когда вкладку открыли', async () => {
    const { fn, calls } = mockFetch([
      { status: 200, body: run('running') },
      { status: 200, body: run('completed') },
    ])
    const api = createBrainApi({ base: '/b', fetch: fn })
    const p = api.waitForRun('r1')
    await vi.advanceTimersByTimeAsync(0)
    expect(calls).toHaveLength(1)

    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    await vi.advanceTimersByTimeAsync(10_000)
    expect(calls).toHaveLength(1)

    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
    await vi.advanceTimersByTimeAsync(0)
    expect(calls).toHaveLength(2)
    await expect(p).resolves.toMatchObject({ status: 'completed' })
  })

  it('signal.abort() прерывает ожидание и больше не опрашивает', async () => {
    const { fn, calls } = mockFetch([{ status: 200, body: run('running') }])
    const api = createBrainApi({ base: '/b', fetch: fn })
    const ac = new AbortController()
    const p = api.waitForRun('r1', { signal: ac.signal })
    const settled = p.catch((e: Error) => e.name)
    await vi.advanceTimersByTimeAsync(0)
    expect(calls).toHaveLength(1)
    ac.abort()
    await expect(settled).resolves.toBe('AbortError')
    await vi.advanceTimersByTimeAsync(10_000)
    expect(calls).toHaveLength(1)
  })

  it('failed / skipped / cancelled — завершение, не бесконечный опрос', async () => {
    for (const status of ['failed', 'skipped', 'cancelled'] as const) {
      const { fn, calls } = mockFetch([{ status: 200, body: run(status, { error: 'упало' }) }])
      const api = createBrainApi({ base: '/b', fetch: fn })
      const p = api.waitForRun('r1')
      await vi.advanceTimersByTimeAsync(0)
      await expect(p).resolves.toMatchObject({ status })
      expect(calls).toHaveLength(1)
    }
  })
})
