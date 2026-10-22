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
  FormRouteStep,
  FormVersion,
  MeAccess,
  NewComment,
  OrgOption,
  RecordAccess,
  RecordComment,
  RecordData,
  RecordFeed,
  RecordFieldError,
  RecordHistoryEntry,
  RecordRoute,
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
    /** `data` из тела ошибки (409 синхронизации карточки — разбор конфликтов). */
    public readonly data?: unknown,
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
  /** Только записи «На контроле» у вызывающего. */
  watching?: boolean
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

/** PUT /admin/forms/:id — метаданные формы (схема — отдельно, saveDraft). */
export interface UpdateFormBody {
  name?: string
  nav_label?: string
  page_title?: string
  description?: string
  icon?: string
  record_access?: RecordAccess
  sort_order?: number
  /**
   * Перенос формы в меню другого модуля вместе с записями: роль manage в
   * прежнем и новом модуле; форма-карточка не переносится (409).
   */
  module_key?: string
}

/** Справочник глазами модуля: только активные строки, значение поля catalog — id строки. */
/** Ответ /forms/:id/ref-records/:field_id (handler.RecordRefOptions). */
export interface RecordRefList {
  source: {
    form_id: string
    form_name: string
    /** forms — записи этого сервиса, external — карточка модуля (проекты, лиды). */
    data_source: 'forms' | 'external'
    module_key: string
    /** Сущность карточки: project, lead… (только у external). */
    entity?: string
  }
  data: { id: string; number: number; title: string; deleted?: boolean }[]
  total: number
}

export interface FormCatalog {
  id: string
  key: string
  name: string
  display_column: string
  items: { id: string; values: Record<string, unknown> }[]
}

/** Запись карты вебхука Pyrus: поле Pyrus → поле карточки (wowhaus-api fielddefsync). */
export interface FieldMapChange {
  pyrus_field_id: number
  key: string
  label: string
  from?: string
  to?: string
}

export interface FieldMapResult {
  binding_id: string
  pyrus_form_id: number
  added: FieldMapChange[]
  changed: FieldMapChange[]
  removed: FieldMapChange[]
  /** Ещё одно (историческое) поле Pyrus пишет в поле карточки — оставлено. */
  kept: FieldMapChange[]
  unchanged: number
  /** Записи карты, не относящиеся к полям карточки. */
  untouched: number
}

/** Результат синхронизации формы-карточки с реестром полей ОУП. */
export interface CardSyncResult {
  applied: boolean
  inserted: string[]
  updated: { key: string; columns: string[] }[]
  unchanged: number
  sections_added: string[]
  sections_changed: string[]
  sections_deleted: string[]
  not_in_form: string[]
  /** null/нет — реестр ОУП старой версии: карту вебхука не трогал. */
  field_map?: FieldMapResult | null
  conflicts: { field_id?: string; key?: string; message: string }[]
}

/** data.sync в ответе публикации формы-карточки. */
export interface CardSyncOutcome {
  applied: boolean
  result?: CardSyncResult
  error?: string
  /** Реестр ОУП не применил сопоставление с Pyrus (старая версия). */
  field_map_skipped?: boolean
}

export interface PublishResult {
  form: Form
  version: FormVersion
  /** Только у формы-карточки. */
  sync?: CardSyncOutcome
}

/** Предпросмотр публикации черновика карточки (POST …/sync?draft=1). */
export interface CardSyncPreview {
  data: CardSyncResult | null
  blockers: SchemaValidationError[]
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

/** Сегмент пути: id из адреса страницы не должен уметь дописать маршрут. */
const seg = (v: string) => encodeURIComponent(v)

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

/** Тело сообщения ленты: пустые поля не уходят, '' у срока/ответственного — снять. */
export function commentForm(c: NewComment): FormData {
  const fd = new FormData()
  if (c.body) fd.append('body', c.body)
  if (c.reply_to) fd.append('reply_to', c.reply_to)
  if (c.mentions?.length) fd.append('mentions', JSON.stringify(c.mentions))
  if (c.approval) {
    fd.append('approval', c.approval.choice)
    fd.append('step_id', c.approval.step_id)
  }
  if (c.responsible !== undefined) fd.append('responsible', c.responsible)
  if (c.due !== undefined) fd.append('due', c.due)
  if (c.spent_minutes) fd.append('spent_minutes', String(c.spent_minutes))
  if (c.meeting) fd.append('meeting', JSON.stringify(c.meeting))
  for (const f of c.files ?? []) fd.append('files', f, f.name)
  return fd
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
        parsed?.data,
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
        get: (id: string) => request<Form>('GET', `/admin/forms/${seg(id)}`),
        update: (id: string, body: UpdateFormBody) =>
          request<Form>('PUT', `/admin/forms/${seg(id)}`, body),
        saveDraft: (id: string, schema: SchemaDocument) =>
          request<Form>('PUT', `/admin/forms/${seg(id)}/draft`, schema),
        /** 422 → FormsApiError.blockers — чек-лист, показывать списком. */
        publish: (id: string, changeNote: string) =>
          request<PublishResult>('POST', `/admin/forms/${seg(id)}/publish`, {
            change_note: changeNote,
          }),
        versions: (id: string) => request<FormVersion[]>('GET', `/admin/forms/${seg(id)}/versions`),
        version: (id: string, version: number) =>
          request<FormVersion>('GET', `/admin/forms/${seg(id)}/versions/${seg(String(version))}`),
        archive: (id: string) => request<Form>('POST', `/admin/forms/${seg(id)}/archive`),
        /** Повторно применить опубликованную карточку к реестру ОУП (`dryRun` — посчитать). */
        syncCard: (id: string, dryRun = false) =>
          request<CardSyncResult>(
            'POST',
            `/admin/forms/${seg(id)}/sync${dryRun ? '?dry_run=1' : ''}`,
          ),
        /** Что сделает публикация черновика карточки — без записи. */
        previewCardSync: (id: string) =>
          request<CardSyncPreview>('POST', `/admin/forms/${seg(id)}/sync?draft=1`, undefined, {
            raw: true,
          }),
      },
      catalogs: {
        list: () => request<Catalog[]>('GET', '/admin/catalogs'),
        create: (body: { key: string; name: string; columns?: unknown; display_column?: string }) =>
          request<Catalog>('POST', '/admin/catalogs', body),
        get: (id: string) => request<Catalog>('GET', `/admin/catalogs/${seg(id)}`),
        update: (id: string, body: { name?: string; columns?: unknown; display_column?: string }) =>
          request<Catalog>('PUT', `/admin/catalogs/${seg(id)}`, body),
        archive: (id: string) => request<Catalog>('POST', `/admin/catalogs/${seg(id)}/archive`),
        items: (id: string) => request<CatalogItem[]>('GET', `/admin/catalogs/${seg(id)}/items`),
        addItem: (id: string, body: { values: Record<string, unknown>; sort_order?: number }) =>
          request<CatalogItem>('POST', `/admin/catalogs/${seg(id)}/items`, body),
        updateItem: (
          itemId: string,
          body: { values: Record<string, unknown>; sort_order?: number },
        ) => request<CatalogItem>('PUT', `/admin/catalogs/items/${seg(itemId)}`, body),
        archiveItem: (itemId: string) =>
          request<CatalogItem>('POST', `/admin/catalogs/items/${seg(itemId)}/archive`),
      },
      audit: (entityType: 'form' | 'catalog', entityId: string) =>
        request<AuditLogEntry[]>('GET', `/admin/audit/${seg(entityType)}/${seg(entityId)}`),
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
      get: (formId: string) => request<FormWithSchema>('GET', `/forms/${seg(formId)}`),
      /** Опубликованная форма по коду (`oup`/`project`) — так карточка ОУП находит свою форму. */
      getByKey: (moduleKey: string, key: string) =>
        request<FormWithSchema>('GET', `/forms/by-key/${seg(moduleKey)}/${seg(key)}`),
      /** Снапшот схемы версии — для записей старше текущей. */
      version: (formId: string, version: number) =>
        request<FormVersion>('GET', `/forms/${seg(formId)}/versions/${seg(String(version))}`),
      /** Справочники, на которые ссылаются поля catalog текущей версии (под owning-guard, без гранта «Форм»). */
      catalogs: (formId: string) => request<FormCatalog[]>('GET', `/forms/${seg(formId)}/catalogs`),
      /**
       * Варианты поля «Форма»: активные записи формы-источника (поиск по
       * названию) или подписи выбранных (`ids`). У формы-карточки записей
       * здесь нет — `source` говорит, из какого модуля их брать.
       */
      refRecords: (formId: string, fieldId: string, q: { search?: string; ids?: string[]; limit?: number } = {}) =>
        request<RecordRefList>(
          'GET',
          `/forms/${seg(formId)}/ref-records/${seg(fieldId)}${toQuery({
            search: q.search,
            ids: q.ids?.length ? q.ids.join(',') : undefined,
            limit: q.limit,
          })}`,
        ),
    },

    records: {
      /** Метаданные вложений записи (имена, размеры) — ссылок здесь нет, только через fileUrl. */
      files: (formId: string, id: string) =>
        request<FormFile[]>('GET', `/forms/${seg(formId)}/records/${seg(id)}/files`),
      list: (formId: string, q: ListRecordsQuery = {}) =>
        request<ListResult<FormRecord>>(
          'GET',
          `/forms/${seg(formId)}/records${toQuery({
            search: q.search,
            page: q.page,
            limit: q.limit,
            sort: q.sort,
            watching: q.watching ? 'true' : undefined,
          })}`,
          undefined,
          { raw: true },
        ),
      /** 400 → FormsApiError.fields — ошибки заполнения списком; 409 — форма не опубликована. */
      create: (formId: string, body: { title: string; data: RecordData }) =>
        request<FormRecord>('POST', `/forms/${seg(formId)}/records`, body),
      get: (formId: string, id: string) =>
        request<FormRecord>('GET', `/forms/${seg(formId)}/records/${seg(id)}`),
      update: (formId: string, id: string, body: { title: string; data: RecordData }) =>
        request<FormRecord>('PUT', `/forms/${seg(formId)}/records/${seg(id)}`, body),
      remove: (formId: string, id: string) =>
        request<{ status: string }>(
          'DELETE',
          `/forms/${seg(formId)}/records/${seg(id)}`,
          undefined,
          {
            raw: true,
          },
        ),
      restore: (formId: string, id: string) =>
        request<{ status: string }>(
          'POST',
          `/forms/${seg(formId)}/records/${seg(id)}/restore`,
          undefined,
          {
            raw: true,
          },
        ),
      history: (formId: string, id: string) =>
        request<RecordHistoryEntry[]>('GET', `/forms/${seg(formId)}/records/${seg(id)}/history`),
      /** multipart, поле `file`; только в поле типа file из схемы версии записи. */
      uploadFile: (formId: string, id: string, fieldId: string, file: File) => {
        const fd = new FormData()
        fd.append('file', file, file.name)
        return request<FormFile>(
          'POST',
          `/forms/${seg(formId)}/records/${seg(id)}/files/${seg(fieldId)}`,
          fd,
        )
      },
      /** presigned-GET на 10 минут. Файл чужой записи — 404 (не 403): перебор id не выдаёт существование. */
      fileUrl: (formId: string, id: string, fileId: string) =>
        request<FileUrl>(
          'GET',
          `/forms/${seg(formId)}/records/${seg(id)}/files/${seg(fileId)}/url`,
        ),
      /** Лента записи: сообщения, маршрут глазами вызывающего, «На контроле». */
      feed: (formId: string, id: string) =>
        request<RecordFeed>('GET', `/forms/${seg(formId)}/records/${seg(id)}/feed`),
      /**
       * Сообщение ленты со всеми действиями панели (multipart). 403 — не
       * согласующий этапа, 409 — запись не на этом этапе.
       */
      comment: (formId: string, id: string, c: NewComment) =>
        request<{ comment: RecordComment; route: RecordRoute; record: FormRecord }>(
          'POST',
          `/forms/${seg(formId)}/records/${seg(id)}/comments`,
          commentForm(c),
        ),
      watch: (formId: string, id: string, on: boolean) =>
        request<{ watching: boolean }>(
          on ? 'PUT' : 'DELETE',
          `/forms/${seg(formId)}/records/${seg(id)}/watch`,
        ),
      /** URL выгрузки CSV — открывать как ссылку; заголовки авторизации хост передаёт сам. */
      exportCsvUrl: (formId: string) => `${opts.baseUrl}/forms/${seg(formId)}/export.csv`,
    },

    route: {
      get: (formId: string) => request<FormRouteStep[]>('GET', `/forms/${seg(formId)}/route`),
      /** Маршрут целиком (роль «Управление» в модуле формы). Этап без id — новый. */
      put: (formId: string, steps: Array<Pick<FormRouteStep, 'name' | 'approvers'> & { id?: string }>) =>
        request<FormRouteStep[]>('PUT', `/forms/${seg(formId)}/route`, { steps }),
    },

    options: {
      /** 503 — справочник недоступен; пустого списка не бывает («никого нет» — ложь). */
      staff: () => request<OrgOption[]>('GET', '/options/staff'),
      departments: () => request<OrgOption[]>('GET', '/options/departments'),
    },
  }
}

export type FormsApi = ReturnType<typeof createFormsApi>
