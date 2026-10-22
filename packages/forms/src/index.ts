/**
 * @wowhaus-24/forms-react — платформа «Формы» WH-24, Этап 1.
 *
 * Слой без React (types/conditions/validate/api) и React-рендер записей.
 * Без роутинга, навигации и chrome страницы — это забота модуля-хоста:
 * записи формы рендерятся как обычная страница ОУП/АХО/HR.
 */
export * from './types.js'
export { evaluate, isEmptyValue, UnknownOpError } from './conditions/conditions.js'
export type { Values } from './conditions/conditions.js'
export { validateRecord, isEmpty } from './validate.js'
export { normalize, validateForPublish, visibilityDeps, chainDepth, conditionFieldRefs } from './schema.js'
export { createFormsApi, FormsApiError, commentForm } from './api.js'
export { systemValue, withSystemValues } from './render/system.js'
export type { SystemSource } from './render/system.js'
export type {
  FormsApi,
  FormsApiOptions,
  FormWithSchema,
  FormCatalog,
  RecordRefList,
  UpdateFormBody,
  ListRecordsQuery,
  ListResult,
  CreateFormBody,
  PublishResult,
  PyrusImportBody,
  PyrusImportResult,
  CardSyncResult,
  CardSyncOutcome,
  CardSyncPreview,
  FieldMapResult,
  FieldMapChange,
} from './api.js'
export {
  pyrusCompat,
  BUILTIN_PYRUS_FIELDS,
  flattenPyrusFields,
  isPyrusPersonType,
  isPyrusValuelessType,
} from './pyrusMapping.js'
export type { PyrusSchemaField, FlatPyrusField } from './pyrusMapping.js'

// React-рендер записи: реестр контролов по типу поля + тело формы.
export { fieldRegistry, FieldControl } from './render/registry.js'
export type { FieldRenderer, FieldRenderProps, RenderContext, RenderMode } from './render/registry.js'
export { FormRenderer, errorsByField, visibleFields } from './render/FormRenderer.js'
export type { FormRendererProps, FieldErrors } from './render/FormRenderer.js'
export {
  formatValue,
  formatNumber,
  formatMoney,
  formatDate,
  formatDateTime,
  formatSize,
  optionLabel,
  fieldOptions,
  catalogOptions,
  catalogsToContext,
  initials,
  isBlank,
  isNumericType,
  plural,
} from './render/format.js'
export type { FormatContext } from './render/format.js'

// Страницы записей (экраны B и C): без роутинга и chrome — контейнер даёт хост.
export { FormRecordsPage } from './pages/FormRecordsPage.js'
export type { FormRecordsPageProps } from './pages/FormRecordsPage.js'
export { FormRecordView } from './pages/FormRecordView.js'
export type { FormRecordViewProps } from './pages/FormRecordView.js'
export { FormRecordEditor } from './pages/FormRecordEditor.js'
export type { FormRecordEditorProps } from './pages/FormRecordEditor.js'
export { RecordHistory } from './pages/RecordHistory.js'
export type { RecordHistoryProps } from './pages/RecordHistory.js'
export { Pager, pageItems } from './pages/Pager.js'
export type { PagerProps } from './pages/Pager.js'
export { StatusPill, statusLabel, DEFAULT_RECORD_STATUSES } from './pages/StatusPill.js'
export type { StatusPillProps, StatusTone, StatusLabel } from './pages/StatusPill.js'
export { StateBox, Skeleton, Banner } from './pages/states.js'
export type { StateBoxProps, BannerProps } from './pages/states.js'

// Лента записи (панель комментария как в Pyrus): сообщения, маршрут, действия.
export { RecordChat } from './chat/RecordChat.js'
export type { RecordChatProps } from './chat/RecordChat.js'
export { Markup, parseInline, parseBlocks } from './chat/markup.js'
export { formatMinutes, parseMinutes, CHOICE_LABEL } from './chat/logic.js'
