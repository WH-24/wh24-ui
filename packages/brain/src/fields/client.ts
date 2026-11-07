/**
 * Клиент «Полей ИИ» и генераторов: маршруты и формы тел из docs/API.md
 * wh24-brain-api. Строится поверх `request` из `createBrainApi` — те же
 * заголовки и разбор ошибок (`BrainApiError`).
 *
 * Длинные списки клиент делит сам: значения — по 100 id (URL не раздувается),
 * заполнение — по 500 (потолок сервера).
 */
import type { Requester } from '../agents/client.js'
import type {
  AiField,
  AiFieldDraft,
  AiFieldFillBody,
  AiFieldFillResult,
  AiFieldList,
  AiFieldPatch,
  AiFieldUpdateResult,
  AiFieldValues,
  FieldPreview,
  FieldPreviewRequest,
  GeneratorAccepted,
  GeneratorKind,
  GeneratorRequest,
} from './types.js'

/** id в одном запросе `GET /fields/values` (сервер принимает до 300, но URL должен остаться коротким). */
export const VALUES_CHUNK = 100
/** id в одном запросе `POST /fields/:id/fill` — потолок сервера. */
export const FILL_CHUNK = 500

export interface FieldsApi {
  /**
   * Свои и общие колонки списка + дневной лимит и признак поддержки списка.
   * `scope` — id формы для записей форм (без него сервер отвечает `supported: false`).
   */
  list(module: string, entityType: string, scope?: string): Promise<AiFieldList>
  create(body: AiFieldDraft): Promise<AiField>
  update(id: string, patch: AiFieldPatch): Promise<AiFieldUpdateResult>
  remove(id: string): Promise<void>
  /** Значения колонок на записи списка; записи, которых вы не видите, в ответ не попадают. */
  values(module: string, entityType: string, ids: string[], scope?: string): Promise<AiFieldValues>
  /** Поставить записи в очередь расчёта (считает воркер, результат — опросом `values`). */
  fill(id: string, body: AiFieldFillBody): Promise<AiFieldFillResult>
  /** «Попробовать на 3 строках»: проба несохранённой колонки → `preview_id`. */
  preview(body: FieldPreviewRequest): Promise<{ preview_id: string }>
  getPreview(id: string): Promise<FieldPreview>
}

export interface GeneratorsApi {
  /** Запустить генератор → `run_id`; результат — `getRun`/`waitForRun`: Markdown с цитатами. */
  generate(kind: GeneratorKind, body?: GeneratorRequest): Promise<GeneratorAccepted>
}

export interface FieldsClient extends GeneratorsApi {
  fields: FieldsApi
}

const seg = encodeURIComponent

function chunks<T>(list: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size))
  return out
}

export function createFieldsClient(request: Requester): FieldsClient {
  return {
    fields: {
      async list(module, entityType, scope) {
        const q = new URLSearchParams({ module, entity_type: entityType })
        if (scope) q.set('scope', scope)
        const res = await request<Partial<AiFieldList> | undefined>('GET', `/fields?${q.toString()}`)
        return {
          fields: res?.fields ?? [],
          daily_limit: res?.daily_limit ?? 0,
          supported: res?.supported !== false,
        }
      },
      async create(body) {
        return (await request<{ field: AiField }>('POST', '/fields', body)).field
      },
      async update(id, patch) {
        const res = await request<{ field: AiField; values_reset?: boolean }>('PATCH', `/fields/${seg(id)}`, patch)
        return { field: res.field, values_reset: res.values_reset === true }
      },
      async remove(id) {
        await request<unknown>('DELETE', `/fields/${seg(id)}`)
      },
      async values(module, entityType, ids, scope) {
        const uniq = Array.from(new Set(ids.filter(Boolean)))
        const out: AiFieldValues = {}
        for (const part of chunks(uniq, VALUES_CHUNK)) {
          const q = new URLSearchParams({ module, entity_type: entityType, ids: part.join(',') })
          if (scope) q.set('scope', scope)
          const res = await request<{ values?: AiFieldValues } | undefined>('GET', `/fields/values?${q.toString()}`)
          for (const [fieldId, byEntity] of Object.entries(res?.values ?? {})) {
            out[fieldId] = { ...out[fieldId], ...byEntity }
          }
        }
        return out
      },
      async fill(id, body) {
        const uniq = Array.from(new Set(body.entity_ids.filter(Boolean)))
        const total: AiFieldFillResult = { queued: 0, requested: 0, no_access: 0, skipped_limit: 0, up_to_date: 0, limit_left: 0 }
        for (const part of chunks(uniq, FILL_CHUNK)) {
          const r = await request<AiFieldFillResult>('POST', `/fields/${seg(id)}/fill`, {
            entity_ids: part,
            ...(body.force ? { force: true } : {}),
          })
          total.queued += r.queued ?? 0
          total.requested += r.requested ?? 0
          total.no_access += r.no_access ?? 0
          total.skipped_limit += r.skipped_limit ?? 0
          total.up_to_date += r.up_to_date ?? 0
          total.limit_left = r.limit_left ?? total.limit_left
        }
        return total
      },
      preview: (body) => request<{ preview_id: string }>('POST', '/fields/preview', body),
      async getPreview(id) {
        return (await request<{ preview: FieldPreview }>('GET', `/fields/preview/${seg(id)}`)).preview
      },
    },
    generate: (kind, body = {}) => request<GeneratorAccepted>('POST', `/generate/${seg(kind)}`, body),
  }
}
