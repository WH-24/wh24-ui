import { describe, expect, it, vi } from 'vitest'

import { BrainApiError, createBrainApi } from '../api'
import { brainErrorText, cellErrorText } from './errors'
import type { AiField } from './types'

function mockFetch(handler: (url: string, init: RequestInit) => { status: number; body?: unknown }) {
  const calls: { url: string; init: RequestInit }[] = []
  const fn = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} })
    const r = handler(String(url), init ?? {})
    return new Response(r.body === undefined ? '' : JSON.stringify(r.body), {
      status: r.status,
      headers: { 'Content-Type': 'application/json' },
    })
  })
  return { fn: fn as unknown as typeof fetch, calls }
}

const field: AiField = {
  id: 'f1',
  module: 'oup',
  entity_type: 'lead',
  scope: '',
  label: 'Теплота',
  kind: 'categorize',
  prompt: '',
  params: { options: ['Горячий', 'Холодный'] },
  model: '',
  on_change: false,
  visibility: 'private',
  enabled: true,
  created_by: 'u1',
  can: { edit: true },
}

describe('fields client', () => {
  it('list → GET /fields?module&entity_type, дефолты при пустом ответе', async () => {
    const { fn, calls } = mockFetch(() => ({ status: 200, body: { fields: [field], daily_limit: 500, supported: true } }))
    const api = createBrainApi({ base: '/b', fetch: fn })
    const res = await api.fields.list('oup', 'lead')
    expect(calls[0]!.url).toBe('/b/fields?module=oup&entity_type=lead')
    expect(res).toEqual({ fields: [field], daily_limit: 500, supported: true })

    const empty = mockFetch(() => ({ status: 200, body: {} }))
    const r2 = await createBrainApi({ base: '/b', fetch: empty.fn }).fields.list('forms', 'form_record')
    expect(r2).toEqual({ fields: [], daily_limit: 0, supported: true })

    const unsupported = mockFetch(() => ({ status: 200, body: { fields: [], daily_limit: 500, supported: false } }))
    expect((await createBrainApi({ base: '/b', fetch: unsupported.fn }).fields.list('finance', 'x')).supported).toBe(false)
  })

  it('scope формы: уходит в list и в каждую порцию values; без scope параметра нет', async () => {
    const { fn, calls } = mockFetch(() => ({ status: 200, body: { fields: [], daily_limit: 500, supported: true, values: {} } }))
    const api = createBrainApi({ base: '/b', fetch: fn })
    await api.fields.list('forms', 'form_record', 'form-7')
    expect(calls[0]!.url).toBe('/b/fields?module=forms&entity_type=form_record&scope=form-7')
    await api.fields.list('oup', 'lead')
    expect(calls[1]!.url).toBe('/b/fields?module=oup&entity_type=lead')
    const ids = Array.from({ length: 150 }, (_, i) => `r${i}`)
    await api.fields.values('forms', 'form_record', ids, 'form-7')
    expect(calls).toHaveLength(4)
    for (const c of calls.slice(2)) expect(new URL(c.url, 'http://x').searchParams.get('scope')).toBe('form-7')
    await api.fields.values('oup', 'lead', ['a'])
    expect(new URL(calls[4]!.url, 'http://x').searchParams.has('scope')).toBe(false)
  })

  it('create разворачивает {field}; update отдаёт values_reset; remove терпит 204', async () => {
    const { fn, calls } = mockFetch((url, init) => {
      if (init.method === 'POST') return { status: 201, body: { field } }
      if (init.method === 'PATCH') return { status: 200, body: { field, values_reset: true } }
      return { status: 204 }
    })
    const api = createBrainApi({ base: '/b', fetch: fn })
    const draft = {
      module: 'oup',
      entity_type: 'lead',
      label: 'Теплота',
      kind: 'categorize' as const,
      prompt: '',
      params: { options: ['Горячий', 'Холодный'] },
      on_change: false,
      visibility: 'private' as const,
    }
    expect((await api.fields.create(draft)).id).toBe('f1')
    expect(JSON.parse(String(calls[0]!.init.body))).toMatchObject({ label: 'Теплота', kind: 'categorize' })
    expect(await api.fields.update('f/1', { label: 'Новая' })).toEqual({ field, values_reset: true })
    expect(calls[1]!.url).toBe('/b/fields/f%2F1')
    await expect(api.fields.remove('f1')).resolves.toBeUndefined()
    expect(calls[2]!.init.method).toBe('DELETE')
  })

  it('values делит id на порции по 100, убирает дубли и склеивает ответы', async () => {
    const { fn, calls } = mockFetch((url) => {
      const ids = new URL(url, 'http://x').searchParams.get('ids')!.split(',')
      const part: Record<string, { status: string; text: string }> = {}
      for (const id of ids) part[id] = { status: 'fresh', text: `v${id}` }
      return { status: 200, body: { values: { f1: part } } }
    })
    const api = createBrainApi({ base: '/b', fetch: fn })
    const ids = Array.from({ length: 230 }, (_, i) => String(i))
    const res = await api.fields.values('oup', 'lead', [...ids, '5', ''])
    expect(calls).toHaveLength(3)
    expect(new URL(calls[0]!.url, 'http://x').searchParams.get('ids')!.split(',')).toHaveLength(100)
    expect(Object.keys(res.f1!)).toHaveLength(230)
    expect(res.f1!['229']).toEqual({ status: 'fresh', text: 'v229' })
    // Пустой набор — без запроса.
    expect(await api.fields.values('oup', 'lead', [])).toEqual({})
    expect(calls).toHaveLength(3)
  })

  it('fill делит по 500 и суммирует; force уходит только когда true', async () => {
    const { fn, calls } = mockFetch(() => ({
      status: 202,
      body: { queued: 300, requested: 500, no_access: 100, skipped_limit: 0, up_to_date: 100, limit_left: 50 },
    }))
    const api = createBrainApi({ base: '/b', fetch: fn })
    const ids = Array.from({ length: 700 }, (_, i) => `id${i}`)
    const res = await api.fields.fill('f1', { entity_ids: ids, force: true })
    expect(calls).toHaveLength(2)
    expect(JSON.parse(String(calls[0]!.init.body))).toMatchObject({ force: true })
    expect(res).toEqual({ queued: 600, requested: 1000, no_access: 200, skipped_limit: 0, up_to_date: 200, limit_left: 50 })

    await api.fields.fill('f1', { entity_ids: ['a'] })
    expect(JSON.parse(String(calls[2]!.init.body))).toEqual({ entity_ids: ['a'] })
  })

  it('preview и getPreview, generate', async () => {
    const { fn, calls } = mockFetch((url, init) => {
      if (url.endsWith('/fields/preview')) return { status: 202, body: { preview_id: 'p1' } }
      if (url.includes('/fields/preview/')) return { status: 200, body: { preview: { id: 'p1', status: 'done', rows: [], cost_usd: 0.01 } } }
      return { status: 202, body: { run_id: 'r1', status: 'queued' } }
    })
    const api = createBrainApi({ base: '/b', fetch: fn })
    expect(
      await api.fields.preview({
        module: 'oup',
        entity_type: 'lead',
        label: 'X',
        kind: 'summary',
        prompt: '',
        params: {},
        on_change: false,
        visibility: 'private',
        entity_ids: ['l1'],
      }),
    ).toEqual({ preview_id: 'p1' })
    expect((await api.fields.getPreview('p1')).status).toBe('done')
    expect(await api.generate('standup', { people: [{ user_id: 'u1', name: 'Иван' }] })).toMatchObject({ run_id: 'r1' })
    expect(calls[2]!.url).toBe('/b/generate/standup')
    expect(JSON.parse(String(calls[2]!.init.body))).toEqual({ people: [{ user_id: 'u1', name: 'Иван' }] })
  })

  it('ошибка 400 несёт поле формы', async () => {
    const { fn } = mockFetch(() => ({
      status: 400,
      body: { error: 'Добавьте хотя бы два варианта.', code: 'bad_request', field: 'params.options' },
    }))
    const api = createBrainApi({ base: '/b', fetch: fn })
    const err = await api.fields
      .create({
        module: 'oup',
        entity_type: 'lead',
        label: 'X',
        kind: 'categorize',
        prompt: '',
        params: {},
        on_change: false,
        visibility: 'private',
      })
      .catch((e) => e)
    expect(err).toBeInstanceOf(BrainApiError)
    expect(err.field).toBe('params.options')
  })
})

describe('тексты ошибок', () => {
  const err = (status: number, message: string, data?: unknown) => new BrainApiError(status, message, data)
  it('бюджет, квота, 401, 404 — по-человечески; «HTTP NNN» не показываем', () => {
    expect(brainErrorText(err(429, 'x', { code: 'budget' }))).toMatch(/бюджет/i)
    expect(brainErrorText(err(429, 'HTTP 429'))).toMatch(/Лимит ИИ/)
    expect(brainErrorText(err(401, 'HTTP 401'))).toMatch(/заново/)
    expect(brainErrorText(err(404, 'HTTP 404'))).toMatch(/Не найдено/)
    expect(brainErrorText(err(403, 'HTTP 403'))).toBe('Недостаточно прав для этого действия.')
    expect(brainErrorText(err(403, 'Общую колонку может создать только управляющий.'))).toBe(
      'Общую колонку может создать только управляющий.',
    )
    // Проба: не больше двух одновременно — текст сервера как есть, без «HTTP 429».
    expect(
      brainErrorText(err(429, 'Уже идут две пробы — дождитесь их результата.', { code: 'too_many', error: 'Уже идут две пробы — дождитесь их результата.' })),
    ).toBe('Уже идут две пробы — дождитесь их результата.')
    expect(brainErrorText(err(502, 'HTTP 502'), 'Запасной')).toBe('Запасной')
    expect(brainErrorText(new Error('boom'))).toBe('Не получилось. Попробуйте ещё раз.')
  })

  it('ошибка ячейки: текст сервера, иначе по коду', () => {
    expect(cellErrorText({ error: 'ИИ отключён для вашего отдела', error_code: 'quota' })).toBe('ИИ отключён для вашего отдела')
    expect(cellErrorText({ error_code: 'daily_limit' })).toBe('Дневной лимит колонки исчерпан')
    expect(cellErrorText({ error_code: 'quota' })).toBe('Лимит ИИ исчерпан — попробуйте позже')
    expect(cellErrorText({})).toBe('Не удалось заполнить')
  })
})
