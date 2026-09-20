/**
 * HTTP-клиент wh24-forms-api (см. docs/API.md сервиса). Хост даёт baseUrl и
 * заголовки авторизации; клиент знает маршруты, формы тел и коды ошибок.
 *
 * Коды охраны записей различаются намеренно и должны доходить до экрана как
 * есть: 404 — формы/записи нет, 403 — роль в модуле-владельце мала,
 * 503 — роль спросить не удалось (модуль лежит). Сводить 503 к «нет доступа»
 * нельзя: это маскирует аварию под отказ.
 */
import type {
  AuditLogEntry,
  Catalog,
  CatalogItem,
  FileUrl,
  Form,
  FormFile,
  FormRecord,
  FormVersion,
  MeAccess,
  OrgOption,
  RecordAccess,
  RecordData,
  RecordFieldError,
  RecordHistoryEntry,
  SchemaDocument,
  SchemaValidationError,
} from './types.js'

export interface FormsApiOptions {
  /** Напр. `/forms-api/api/v1` или `https://host:8089/api/v1`. Без слеша в конце. */
  baseUrl: string
  /** Заголовки авторизации (Bearer / X-Internal-Token) — на каждый запрос. */
  headers?: () => HeadersInit | Promise<HeadersInit>
  credentials?: RequestCredentials
  /** Подмена fetch (тесты). */
  fetch?: typeof fetch
}

/**
 * Ошибка API. `status` — HTTP-код; `fields` — ошибки заполнения (400 у
 * записей), `blockers` — чек-лист публикации (422 у publish). Сообщение —
 * `error` из тела, по-русски, можно показывать как есть.
 */
export class FormsApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly fields?: RecordFieldError[],
    public readonly blockers?: SchemaValidationError[],
  ) {
    super(message)
    this.name = 'FormsApiError'
  }

  get notFound(): boolean {
    return this.status === 404
  }
  get forbidden(): boolean {
    return this.status === 403
  }
  /** Источник роли или справочник недоступен — авария, не отказ. */
  get unavailable(): boolean {
    return this.status === 503
  }
}

export interface ListRecordsQuery {
  search?: string
  page?: number
  limit?: number
  sort?: 'created_at_desc' | 'created_at_asc' | 'number_desc' | 'number_asc'
}

export interface ListResult<T> {
  data: T[]
  total: number
}

export interface CreateFormBody {
  module_key: string
  key: string
  name: string
  nav_label?: string
  page_title?: string
  description?: string
  icon?: string
  record_access?: RecordAccess
}

/** Ответ GET /forms/:id: форма и схема её текущей опубликованной версии. */
export interface FormWithSchema {
  form: Form
  schema: SchemaDocument
  version: number
}

export interface PublishResult {
  form: Form
  version: FormVersion
}

export interface PyrusImportBody {
  module_key: string
  key: string
  name: string
  dry_run?: boolean
  /** Ответ Pyrus GET /forms/{id} как есть. */
  form: unknown
}

export interface PyrusImportResult {
  data: SchemaDocument | Form
  report: { field?: string; reason: string }[]
}

async function parseBody(res: Response): Promise<unknown> {
  const text = await res.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return { error: text }
  }
}

function toQuery(q: Record<string, string | number | undefined>): string {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(q)) {
    if (v !== undefined && v !== '') p.set(k, String(v))
  }
  const s = p.toString()
  return s ? `?${s}` : ''
}

export function createFormsApi(opts: FormsApiOptions) {
  const doFetch = opts.fetch ?? fetch

  async function request<T>(
    method: string,
    path: string,
    body?: unknown,
    init?: { raw?: boolean },
  ): Promise<T> {
    const headers = new Headers(opts.headers ? await opts.headers() : undefined)
    let payload: BodyInit | undefined
    if (body instanceof FormData) {
      payload = body
    } else if (body !== undefined) {
      headers.set('Content-Type', 'application/json')
      payload = JSON.stringify(body)
    }
    headers.set('Accept', 'application/json')
    const res = await doFetch(`${opts.baseUrl}${path}`, {
      method,
      headers,
      body: payload,
      credentials: opts.credentials,
    })
    const parsed = (await parseBody(res)) as Record<string, unknown> | null
    if (!res.ok) {
      const msg =
        (parsed && typeof parsed.error === 'string' && parsed.error) || `HTTP ${res.status}`
      throw new FormsApiError(
        res.status,
        msg,
        (parsed?.fields as RecordFieldError[] | undefined) ?? undefined,
        (parsed?.blockers as SchemaValidationError[] | undefined) ?? undefined,
      )
    }
    if (init?.raw) return parsed as T
    return (parsed?.data ?? parsed) as T
  }

  return {
    /** Без guard: отсутствие гранта — `{role: "none"}`, не 403. */
    me: {
      access: () => request<MeAccess>('GET', '/me/access'),
    },

    admin: {
      forms: {
        list: (moduleKey?: string) =>
          request<Form[]>('GET', `/admin/forms${toQuery({ module_key: moduleKey })}`),
        create: (body: CreateFormBody) => request<Form>('POST', '/admin/forms', body),
        get: (id: string) => request<Form>('GET', `/admin/forms/${id}`),
        saveDraft: (id: string, schema: SchemaDocument) =>
          request<Form>('PUT', `/admin/forms/${id}/draft`, schema),
        /** 422 → FormsApiError.blockers — чек-лист, показывать списком. */
        publish: (id: string, changeNote: string) =>
          request<PublishResult>('POST', `/admin/forms/${id}/publish`, { change_note: changeNote }),
        versions: (id: string) => request<FormVersion[]>('GET', `/admin/forms/${id}/versions`),
        version: (id: string, version: number) =>
          request<FormVersion>('GET', `/admin/forms/${id}/versions/${version}`),
        archive: (id: string) => request<Form>('POST', `/admin/forms/${id}/archive`),
      },
      catalogs: {
        list: () => request<Catalog[]>('GET', '/admin/catalogs'),
        create: (body: { key: string; name: string; columns?: unknown; display_column?: string }) =>
          request<Catalog>('POST', '/admin/catalogs', body),
        get: (id: string) => request<Catalog>('GET', `/admin/catalogs/${id}`),
        update: (id: string, body: { name?: string; columns?: unknown; display_column?: string }) =>
          request<Catalog>('PUT', `/admin/catalogs/${id}`, body),
        archive: (id: string) => request<Catalog>('POST', `/admin/catalogs/${id}/archive`),
        items: (id: string) => request<CatalogItem[]>('GET', `/admin/catalogs/${id}/items`),
        addItem: (id: string, body: { values: Record<string, unknown>; sort_order?: number }) =>
          request<CatalogItem>('POST', `/admin/catalogs/${id}/items`, body),
        updateItem: (itemId: string, body: { values: Record<string, unknown>; sort_order?: number }) =>
          request<CatalogItem>('PUT', `/admin/catalogs/items/${itemId}`, body),
        archiveItem: (itemId: string) =>
          request<CatalogItem>('POST', `/admin/catalogs/items/${itemId}/archive`),
      },
      audit: (entityType: 'form' | 'catalog', entityId: string) =>
        request<AuditLogEntry[]>('GET', `/admin/audit/${entityType}/${entityId}`),
      importPyrus: (body: PyrusImportBody) =>
        request<PyrusImportResult>('POST', '/admin/import/pyrus', body, { raw: true }),
    },

    /**
     * Формы глазами модуля-владельца — без админского гранта «Форм»: право
     * даёт роль пользователя в модуле (owning-guard, как у записей).
     */
    forms: {
      /** Опубликованные формы модуля — для пунктов меню; никогда не должен ломать навигацию. */
      listForModule: (moduleKey: string) =>
        request<Form[]>('GET', `/forms${toQuery({ module_key: moduleKey })}`),
      /** Форма + схема текущей опубликованной версии. */
      get: (formId: string) => request<FormWithSchema>('GET', `/forms/${formId}`),
      /** Снапшот схемы версии — для записей старше текущей. */
      version: (formId: string, version: number) =>
        request<FormVersion>('GET', `/forms/${formId}/versions/${version}`),
    },

    records: {
      /** Метаданные вложений записи (имена, размеры) — ссылок здесь нет, только через fileUrl. */
      files: (formId: string, id: string) =>
        request<FormFile[]>('GET', `/forms/${formId}/records/${id}/files`),
      list: (formId: string, q: ListRecordsQuery = {}) =>
        request<ListResult<FormRecord>>(
          'GET',
          `/forms/${formId}/records${toQuery({ search: q.search, page: q.page, limit: q.limit, sort: q.sort })}`,
          undefined,
          { raw: true },
        ),
      /** 400 → FormsApiError.fields — ошибки заполнения списком; 409 — форма не опубликована. */
      create: (formId: string, body: { title: string; data: RecordData }) =>
        request<FormRecord>('POST', `/forms/${formId}/records`, body),
      get: (formId: string, id: string) =>
        request<FormRecord>('GET', `/forms/${formId}/records/${id}`),
      update: (formId: string, id: string, body: { title: string; data: RecordData }) =>
        request<FormRecord>('PUT', `/forms/${formId}/records/${id}`, body),
      remove: (formId: string, id: string) =>
        request<{ status: string }>('DELETE', `/forms/${formId}/records/${id}`, undefined, {
          raw: true,
        }),
      restore: (formId: string, id: string) =>
        request<{ status: string }>('POST', `/forms/${formId}/records/${id}/restore`, undefined, {
          raw: true,
        }),
      history: (formId: string, id: string) =>
        request<RecordHistoryEntry[]>('GET', `/forms/${formId}/records/${id}/history`),
      /** multipart, поле `file`; только в поле типа file из схемы версии записи. */
      uploadFile: (formId: string, id: string, fieldId: string, file: File) => {
        const fd = new FormData()
        fd.append('file', file, file.name)
        return request<FormFile>('POST', `/forms/${formId}/records/${id}/files/${fieldId}`, fd)
      },
      /** presigned-GET на 10 минут. Файл чужой записи — 404 (не 403): перебор id не выдаёт существование. */
      fileUrl: (formId: string, id: string, fileId: string) =>
        request<FileUrl>('GET', `/forms/${formId}/records/${id}/files/${fileId}/url`),
      /** URL выгрузки CSV — открывать как ссылку; заголовки авторизации хост передаёт сам. */
      exportCsvUrl: (formId: string) => `${opts.baseUrl}/forms/${formId}/export.csv`,
    },

    options: {
      /** 503 — справочник недоступен; пустого списка не бывает («никого нет» — ложь). */
      staff: () => request<OrgOption[]>('GET', '/options/staff'),
      departments: () => request<OrgOption[]>('GET', '/options/departments'),
    },
  }
}

export type FormsApi = ReturnType<typeof createFormsApi>
