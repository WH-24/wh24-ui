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
export { createFormsApi, FormsApiError } from './api.js'
export type {
  FormsApi,
  FormsApiOptions,
  ListRecordsQuery,
  ListResult,
  CreateFormBody,
  PublishResult,
  PyrusImportBody,
  PyrusImportResult,
} from './api.js'

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
  initials,
  isBlank,
  isNumericType,
  plural,
} from './render/format.js'
export type { FormatContext } from './render/format.js'
