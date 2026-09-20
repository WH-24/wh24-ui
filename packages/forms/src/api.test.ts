import { describe, expect, it, vi } from 'vitest'

import { createFormsApi, FormsApiError } from './api'

function mockFetch(status: number, body: unknown) {
  const calls: { url: string; init: RequestInit }[] = []
  const fn = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} })
    return new Response(body == null ? '' : JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  })
  return { fn: fn as unknown as typeof fetch, calls }
}

describe('createFormsApi', () => {
  it('разворачивает {data}, шлёт заголовки хоста и JSON-тело', async () => {
    const { fn, calls } = mockFetch(201, { data: { id: 'r1', title: 'x' } })
    const api = createFormsApi({
      baseUrl: '/api/v1',
      fetch: fn,
      headers: () => ({ Authorization: 'Bearer t' }),
    })
    const rec = await api.records.create('f1', { title: 'x', data: {} })
    expect(rec).toEqual({ id: 'r1', title: 'x' })
    expect(calls[0]!.url).toBe('/api/v1/forms/f1/records')
    const h = new Headers(calls[0]!.init.headers)
    expect(h.get('Authorization')).toBe('Bearer t')
    expect(h.get('Content-Type')).toBe('application/json')
    expect(calls[0]!.init.body).toBe('{"title":"x","data":{}}')
  })

  it('список записей отдаёт data+total и кладёт query-параметры', async () => {
    const { fn, calls } = mockFetch(200, { data: [{ id: '1' }], total: 1284 })
    const api = createFormsApi({ baseUrl: '/api/v1', fetch: fn })
    const res = await api.records.list('f1', {
      page: 2,
      limit: 50,
      search: 'Ло',
      sort: 'number_desc',
    })
    expect(res.total).toBe(1284)
    expect(res.data).toHaveLength(1)
    expect(calls[0]!.url).toBe(
      '/api/v1/forms/f1/records?search=%D0%9B%D0%BE&page=2&limit=50&sort=number_desc',
    )
  })

  it('400 с fields → FormsApiError.fields списком', async () => {
    const { fn } = mockFetch(400, {
      error: 'значения не прошли проверку',
      fields: [{ field_id: 'a', code: 'required', message: 'поле «A» обязательно для заполнения' }],
    })
    const api = createFormsApi({ baseUrl: '/api/v1', fetch: fn })
    const err = await api.records.create('f1', { title: '', data: {} }).catch((e) => e)
    expect(err).toBeInstanceOf(FormsApiError)
    expect(err.status).toBe(400)
    expect(err.message).toBe('значения не прошли проверку')
    expect(err.fields).toHaveLength(1)
  })

  it('422 с blockers → FormsApiError.blockers', async () => {
    const { fn } = mockFetch(422, {
      error: 'публикация заблокирована',
      blockers: [{ message: 'Поле «Название записи» не выбрано' }],
    })
    const api = createFormsApi({ baseUrl: '/api/v1', fetch: fn })
    const err = await api.admin.forms.publish('f1', 'note').catch((e) => e)
    expect(err.status).toBe(422)
    expect(err.blockers).toEqual([{ message: 'Поле «Название записи» не выбрано' }])
  })

  it('404/403/503 различимы — 503 это авария, не отказ', async () => {
    const api503 = createFormsApi({
      baseUrl: '/x',
      fetch: mockFetch(503, { error: 'модуль недоступен' }).fn,
    })
    const e = await api503.records.get('f', 'r').catch((x) => x as FormsApiError)
    expect(e.unavailable).toBe(true)
    expect(e.forbidden).toBe(false)
    expect(e.notFound).toBe(false)
  })

  it('загрузка файла — multipart без Content-Type от клиента', async () => {
    const { fn, calls } = mockFetch(201, { data: { id: 'file1' } })
    const api = createFormsApi({ baseUrl: '/api/v1', fetch: fn })
    const file = new File(['x'], 'a.txt', { type: 'text/plain' })
    await api.records.uploadFile('f1', 'r1', 'fld', file)
    expect(calls[0]!.init.body).toBeInstanceOf(FormData)
    expect(new Headers(calls[0]!.init.headers).get('Content-Type')).toBeNull()
    expect(calls[0]!.url).toBe('/api/v1/forms/f1/records/r1/files/fld')
  })

  it('exportCsvUrl — ссылка, а не запрос', () => {
    const api = createFormsApi({ baseUrl: '/api/v1', fetch: mockFetch(200, null).fn })
    expect(api.records.exportCsvUrl('f1')).toBe('/api/v1/forms/f1/export.csv')
  })

  it('ответ не-JSON при ошибке → текст как сообщение', async () => {
    const fn = vi.fn(
      async () => new Response('Bad Gateway', { status: 502 }),
    ) as unknown as typeof fetch
    const api = createFormsApi({ baseUrl: '/api/v1', fetch: fn })
    const e = await api.me.access().catch((x) => x as FormsApiError)
    expect(e.status).toBe(502)
    expect(e.message).toBe('Bad Gateway')
  })

  it('id в пути экранируются — сегмент из адреса не дописывает маршрут', async () => {
    const { fn, calls } = mockFetch(200, { data: {} })
    const api = createFormsApi({ baseUrl: '/api/v1', fetch: fn })
    await api.records.get('f/1', '..%2Fadmin')
    expect(calls[0]!.url).toBe('/api/v1/forms/f%2F1/records/..%252Fadmin')
  })
})
