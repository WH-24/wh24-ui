import { vi } from 'vitest'

/** Подставной fetch для тестов клиентов и компонентов: записывает вызовы, отвечает JSON. */
export function mockFetch(handler: (url: string, init: RequestInit) => { status: number; body?: unknown }) {
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
