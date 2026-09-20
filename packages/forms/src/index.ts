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
