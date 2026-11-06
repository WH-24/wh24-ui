/**
 * HTTP-клиент wh24-brain-api. Хост даёт базовый адрес и заголовки авторизации;
 * клиент знает маршруты, формы тел и правила опроса.
 *
 * Ответ на вопрос приходит не сразу: `ask` возвращает 202 `{run_id}`, дальше
 * `waitForRun` опрашивает `GET /runs/:id` — один запрос в полёте, пауза 1 → 3 с,
 * при скрытой вкладке опрос останавливается до возвращения.
 */
import type {
  AskAccepted,
  AskRequest,
  FeedbackRequest,
  Run,
  RunStatus,
  SearchRequest,
  SearchResponse,
} from './types.js'

export interface BrainApiOptions {
  /** Напр. `/brain/api/v1`. Без слеша в конце. */
  base: string
  /** Подмена fetch (тесты, обёртка хоста с авторизацией). */
  fetch?: typeof fetch
  /** Заголовки на каждый запрос (Bearer / X-Internal-Token). */
  headers?: () => HeadersInit | Promise<HeadersInit>
  credentials?: RequestCredentials
}

/**
 * Ошибка API. `status` — HTTP-код, сообщение — `error` из тела (по-русски,
 * можно показывать как есть) или текст ответа.
 */
export class BrainApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly data?: unknown,
  ) {
    super(message)
    this.name = 'BrainApiError'
  }

  get forbidden(): boolean {
    return this.status === 403
  }
  get notFound(): boolean {
    return this.status === 404
  }
  /** Квота исчерпана. */
  get quotaExceeded(): boolean {
    return this.status === 429
  }
}

export interface WaitForRunOptions {
  /** Каждый свежий снимок прогона — чтобы показывать шаги по ходу. */
  onUpdate?: (run: Run) => void
  signal?: AbortSignal
  /** Первая пауза между опросами, мс. По умолчанию 1000. */
  minIntervalMs?: number
  /** Потолок паузы, мс. По умолчанию 3000. */
  maxIntervalMs?: number
}

export interface BrainApi {
  search(req: SearchRequest): Promise<SearchResponse>
  ask(req: AskRequest): Promise<AskAccepted>
  getRun(id: string): Promise<Run>
  waitForRun(id: string, opts?: WaitForRunOptions): Promise<Run>
  feedback(req: FeedbackRequest): Promise<void>
}

const TERMINAL: ReadonlySet<RunStatus> = new Set<RunStatus>(['completed', 'skipped', 'failed', 'cancelled'])

export function isRunFinished(status: RunStatus): boolean {
  return TERMINAL.has(status)
}

function abortError(): Error {
  return typeof DOMException !== 'undefined'
    ? new DOMException('Опрос прерван', 'AbortError')
    : Object.assign(new Error('Опрос прерван'), { name: 'AbortError' })
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw abortError()
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    function onAbort() {
      clearTimeout(t)
      reject(abortError())
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

/** Скрытая вкладка: ждём, пока её снова откроют, запросов не шлём. */
function whenVisible(signal?: AbortSignal): Promise<void> {
  if (typeof document === 'undefined' || document.visibilityState !== 'hidden') {
    return Promise.resolve()
  }
  return new Promise((resolve, reject) => {
    const done = () => {
      if (document.visibilityState === 'hidden') return
      document.removeEventListener('visibilitychange', done)
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }
    const onAbort = () => {
      document.removeEventListener('visibilitychange', done)
      reject(abortError())
    }
    document.addEventListener('visibilitychange', done)
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

export function createBrainApi(opts: BrainApiOptions): BrainApi {
  const base = opts.base.replace(/\/+$/, '')
  const doFetch = opts.fetch ?? ((...a: Parameters<typeof fetch>) => fetch(...a))

  async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers = new Headers(opts.headers ? await opts.headers() : undefined)
    headers.set('Accept', 'application/json')
    if (body !== undefined) headers.set('Content-Type', 'application/json')
    const res = await doFetch(`${base}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: opts.credentials,
    })
    const text = await res.text()
    let json: unknown = undefined
    if (text) {
      try {
        json = JSON.parse(text)
      } catch {
        json = undefined
      }
    }
    if (!res.ok) {
      const msg =
        json && typeof json === 'object' && typeof (json as { error?: unknown }).error === 'string'
          ? (json as { error: string }).error
          : text || `HTTP ${res.status}`
      throw new BrainApiError(res.status, msg, json)
    }
    return json as T
  }

  const api: BrainApi = {
    search: (req) => request<SearchResponse>('POST', '/search', req),
    ask: (req) => request<AskAccepted>('POST', '/ask', req),
    getRun: (id) => request<Run>('GET', `/runs/${encodeURIComponent(id)}`),
    async waitForRun(id, o = {}) {
      const min = o.minIntervalMs ?? 1000
      const max = o.maxIntervalMs ?? 3000
      let delay = min
      for (;;) {
        throwIfAborted(o.signal)
        await whenVisible(o.signal)
        // Один запрос в полёте: следующий уходит только после ответа на этот.
        const run = await api.getRun(id)
        throwIfAborted(o.signal)
        o.onUpdate?.(run)
        if (isRunFinished(run.status)) return run
        await sleep(delay, o.signal)
        delay = Math.min(max, Math.round(delay * 1.5))
      }
    },
    async feedback(req) {
      await request<unknown>('POST', '/feedback', req)
    },
  }
  return api
}
