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

describe('createBrainApi: агенты', () => {
  const agent = { id: 'a/1', name: 'Стендап', can: { edit: true, run: true, delete: true, journal: true } }

  it('agents.list → GET /agents?scope=…, разворачивает {agents}', async () => {
    const { fn, calls } = mockFetch([
      { status: 200, body: { agents: [agent] } },
      { status: 200, body: {} },
    ])
    const api = createBrainApi({ base: '/b', fetch: fn })
    expect(await api.agents.list({ scope: 'shared' })).toHaveLength(1)
    expect(calls[0]!.url).toBe('/b/agents?scope=shared')
    expect(calls[0]!.init.method).toBe('GET')
    expect(await api.agents.list()).toEqual([])
    expect(calls[1]!.url).toBe('/b/agents')
  })

  it('agents.get/create/update/duplicate: пути, методы и тела; id экранируется', async () => {
    const { fn, calls } = mockFetch([{ status: 200, body: { agent } }])
    const api = createBrainApi({ base: '/b', fetch: fn })
    expect((await api.agents.get('a/1')).name).toBe('Стендап')
    await api.agents.create({ preset_key: 'standup', name: 'Мой стендап' })
    await api.agents.create({ name: 'Новый', instructions: 'x' })
    await api.agents.update('a/1', { name: 'Новое имя', triggers: [] })
    await api.agents.duplicate('a/1')
    expect(calls.map((c) => `${c.init.method} ${c.url}`)).toEqual([
      'GET /b/agents/a%2F1',
      'POST /b/agents',
      'POST /b/agents',
      'PATCH /b/agents/a%2F1',
      'POST /b/agents/a%2F1/duplicate',
    ])
    expect(calls[1]!.init.body).toBe('{"preset_key":"standup","name":"Мой стендап"}')
    expect(calls[2]!.init.body).toBe('{"name":"Новый","instructions":"x"}')
    expect(calls[3]!.init.body).toBe('{"name":"Новое имя","triggers":[]}')
  })

  it('agents.remove и deleteMemory принимают пустой 204', async () => {
    const { fn, calls } = mockFetch([{ status: 204, body: null }])
    const api = createBrainApi({ base: '/b', fetch: fn })
    await expect(api.agents.remove('a1')).resolves.toBeUndefined()
    await expect(api.agents.deleteMemory('a1', 'm/2')).resolves.toBeUndefined()
    expect(calls[0]!.init.method).toBe('DELETE')
    expect(calls[0]!.url).toBe('/b/agents/a1')
    expect(calls[1]!.url).toBe('/b/agents/a1/memory/m%2F2')
  })

  it('agents.run → POST /agents/:id/run {input} → {run_id}', async () => {
    const { fn, calls } = mockFetch([{ status: 202, body: { run_id: 'r1', status: 'queued' } }])
    const api = createBrainApi({ base: '/b', fetch: fn })
    expect((await api.agents.run('a1', { input: 'апдейт по Офису' })).run_id).toBe('r1')
    await api.agents.run('a1')
    expect(calls[0]!.url).toBe('/b/agents/a1/run')
    expect(calls[0]!.init.body).toBe('{"input":"апдейт по Офису"}')
    expect(calls[1]!.init.body).toBe('{}')
  })

  it('agents.runs и agentRuns.list: фильтры в строке запроса, пустые пропускаются', async () => {
    const { fn, calls } = mockFetch([{ status: 200, body: { runs: [{ id: 'r1', status: 'completed' }] } }])
    const api = createBrainApi({ base: '/b', fetch: fn })
    expect(await api.agents.runs('a1', { status: 'skipped', limit: 20, before: '2026-11-06T10:00:00Z' })).toHaveLength(1)
    await api.agentRuns.list({ agent_id: 'a1', status: '', limit: 30 })
    await api.agentRuns.list()
    expect(calls[0]!.url).toBe('/b/agents/a1/runs?status=skipped&limit=20&before=2026-11-06T10%3A00%3A00Z')
    expect(calls[1]!.url).toBe('/b/agent-runs?agent_id=a1&limit=30')
    expect(calls[2]!.url).toBe('/b/agent-runs')
  })

  it('agents.memory, agentPresets, agentTools разворачивают обёртки', async () => {
    const { fn, calls } = mockFetch([
      { status: 200, body: { memory: [{ id: 'm1', kind: 'fact', text: 'Любит кратко' }] } },
      { status: 200, body: { presets: [{ key: 'standup', available: true }] } },
      { status: 200, body: { tools: [{ name: 'search_workspace', write: false }] } },
    ])
    const api = createBrainApi({ base: '/b', fetch: fn })
    expect((await api.agents.memory('a1'))[0]!.text).toBe('Любит кратко')
    expect((await api.agentPresets())[0]!.key).toBe('standup')
    expect((await api.agentTools())[0]!.name).toBe('search_workspace')
    expect(calls.map((c) => c.url)).toEqual(['/b/agents/a1/memory', '/b/agent-presets', '/b/agent-tools'])
  })

  it('agentDraft → POST /agent-draft с историей и текущим профилем', async () => {
    const { fn, calls } = mockFetch([
      { status: 200, body: { reply: 'Готово', patch: { name: 'Стендап' }, notes: ['Триггер по событию недоступен'] } },
    ])
    const api = createBrainApi({ base: '/b', fetch: fn })
    const res = await api.agentDraft({
      message: 'каждое утро',
      history: [{ role: 'user', content: 'привет' }],
      agent: { name: 'A' },
    })
    expect(res.patch.name).toBe('Стендап')
    expect(res.notes).toEqual(['Триггер по событию недоступен'])
    expect(calls[0]!.url).toBe('/b/agent-draft')
    expect(JSON.parse(String(calls[0]!.init.body))).toEqual({
      message: 'каждое утро',
      history: [{ role: 'user', content: 'привет' }],
      agent: { name: 'A' },
    })
  })

  it('400 → BrainApiError с полем; 429 budget отличается от квоты ИИ', async () => {
    const api = createBrainApi({
      base: '/b',
      fetch: mockFetch([
        { status: 400, body: { error: 'не длиннее 80 знаков', code: 'bad_request', field: 'name' } },
        { status: 429, body: { error: 'дневной бюджет агента исчерпан', code: 'budget' } },
        { status: 429, body: { error: 'лимит ИИ исчерпан', code: 'quota' } },
        { status: 403, body: { error: 'агент выключен — включите его, чтобы запускать', code: 'forbidden' } },
      ]).fn,
    })
    const e1 = await api.agents.update('a1', { name: 'x'.repeat(81) }).catch((x) => x as BrainApiError)
    expect(e1).toBeInstanceOf(BrainApiError)
    expect(e1.status).toBe(400)
    expect(e1.field).toBe('name')
    expect(e1.message).toBe('не длиннее 80 знаков')
    expect(e1.budgetExceeded).toBe(false)

    const e2 = await api.agents.run('a1').catch((x) => x as BrainApiError)
    expect(e2.status).toBe(429)
    expect(e2.budgetExceeded).toBe(true)
    expect(e2.quotaExceeded).toBe(true)
    expect(e2.code).toBe('budget')

    const e3 = await api.agentDraft({ message: 'x' }).catch((x) => x as BrainApiError)
    expect(e3.budgetExceeded).toBe(false)
    expect(e3.quotaExceeded).toBe(true)

    const e4 = await api.agents.run('a1').catch((x) => x as BrainApiError)
    expect(e4.forbidden).toBe(true)
    expect(e4.field).toBeUndefined()
  })

  it('getAgentRun отдаёт поля агента; ошибка 404 — notFound', async () => {
    const { fn } = mockFetch([
      { status: 200, body: { id: 'r1', status: 'skipped', skip_reason: 'budget', trigger_kind: 'schedule' } },
      { status: 404, body: { error: 'запуск не найден' } },
    ])
    const api = createBrainApi({ base: '/b', fetch: fn })
    const r = await api.getAgentRun('r1')
    expect(r.skip_reason).toBe('budget')
    expect(r.trigger_kind).toBe('schedule')
    const e = await api.getAgentRun('x').catch((x) => x as BrainApiError)
    expect(e.notFound).toBe(true)
  })
})

