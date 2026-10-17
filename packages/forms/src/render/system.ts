/**
 * Значения вычисляемых системных полей (schema/system.go): автор и дата
 * создания — из записи, форма — её название. В data их нет, поэтому хосты
 * (карточка, правка, список) подставляют их перед показом.
 *
 * Автор хранится учёткой IAM (created_by), а поле показывается как обычное
 * «Сотрудник» по id сотрудника — переводим через auth_user_id справочника.
 * Не нашли — остаётся учётка: это честнее пустоты.
 */
import type { Field, FormRecord, OrgOption, RecordData, SchemaDocument } from '../types.js'
import { isComputedField } from '../types.js'

export interface SystemSource {
  /** Нет — новая запись: автор и дата создания появятся после сохранения. */
  record?: Pick<FormRecord, 'created_by' | 'created_at'> | null
  formName?: string
  staff?: OrgOption[]
}

const NIL_UUID = '00000000-0000-0000-0000-000000000000'

/** Значение вычисляемого системного поля; undefined — у обычного поля или пока нечего показать. */
export function systemValue(field: Pick<Field, 'system'>, src: SystemSource): unknown {
  switch (field.system) {
    case 'author': {
      const by = src.record?.created_by
      if (!by || by === NIL_UUID) return undefined
      return src.staff?.find((o) => o.auth_user_id === by)?.id ?? by
    }
    case 'created_at':
      return src.record?.created_at || undefined
    case 'form':
      return src.formName || undefined
    default:
      return undefined
  }
}

/** data записи с подставленными вычисляемыми системными полями (новый объект; без них — тот же). */
export function withSystemValues(doc: SchemaDocument, data: RecordData | null | undefined, src: SystemSource): RecordData {
  const base = data ?? {}
  const computed = doc.fields.filter(isComputedField)
  if (computed.length === 0) return base
  const out: RecordData = { ...base }
  for (const f of computed) {
    const v = systemValue(f, src)
    if (v === undefined) delete out[f.id]
    else out[f.id] = v
  }
  return out
}
