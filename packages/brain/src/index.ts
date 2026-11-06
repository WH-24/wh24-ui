/**
 * @wowhaus-24/brain-react — компоненты панели «Спросить ИИ» (WH24 Brain).
 *
 * Пакет data-agnostic: данные и действия приходят через пропсы и колбэки,
 * состояние разговора держит хост. Источники показываются ровно в том составе,
 * что прислал сервер (он уже отфильтровал по правам пользователя); ничего не
 * кешируется в localStorage.
 *
 * Подключение CSS — как у остальных пакетов дизайн-системы: tokens.css,
 * base.css и button.css из @wowhaus-24/ui-tokens один раз в точке входа.
 */
export * from './types.js'

export { createBrainApi, BrainApiError, isRunFinished } from './api.js'
export type { BrainApi, BrainApiOptions, WaitForRunOptions } from './api.js'

export { Markdown, tableRows, isInternalHref } from './markdown/Markdown.js'
export type { MarkdownProps, MarkdownCitation } from './markdown/Markdown.js'
export { CitationChip } from './markdown/CitationChip.js'
export type { CitationChipProps } from './markdown/CitationChip.js'
export { splitCitations, remarkCitations } from './markdown/citations.js'
export { buildXlsx, downloadBytes, asNumber, zipStore, XLSX_MIME } from './xlsx.js'

export { SourceCard } from './sources/SourceCard.js'
export type { SourceCardProps } from './sources/SourceCard.js'
export { SourceList } from './sources/SourceList.js'
export type { SourceListProps, NumberedSource } from './sources/SourceList.js'
export { moduleMeta, DEFAULT_MODULES, shortDate } from './sources/modules.js'
export type { ModuleMeta, ModuleMetaMap } from './sources/modules.js'

export { AssistantMessage } from './messages/AssistantMessage.js'
export type { AssistantMessageProps } from './messages/AssistantMessage.js'
export { UserMessage } from './messages/UserMessage.js'
export type { UserMessageProps, UserMessageAttachment } from './messages/UserMessage.js'

export { AgentSteps } from './agent/AgentSteps.js'
export type { AgentStepsProps } from './agent/AgentSteps.js'
export { AiActionCard, ACTION_STATUS_LABEL } from './agent/AiActionCard.js'
export type { AiActionCardProps } from './agent/AiActionCard.js'

export { BrainComposer } from './composer/BrainComposer.js'
export type { BrainComposerProps } from './composer/BrainComposer.js'
export {
  addBrainFiles,
  isSupportedFile,
  formatSize,
  ACCEPT,
  MAX_FILES,
  MAX_FILE_BYTES,
  MAX_TOTAL_BYTES,
} from './composer/files.js'
export type { BrainFile, BrainUploadFile, AddFilesLimits } from './composer/files.js'

export { UsageMeter } from './meta/UsageMeter.js'
export type { UsageMeterProps } from './meta/UsageMeter.js'
export { AiLabel } from './meta/AiLabel.js'
export type { AiLabelProps } from './meta/AiLabel.js'
export { PrivacyNotice } from './meta/PrivacyNotice.js'
export type { PrivacyNoticeProps } from './meta/PrivacyNotice.js'

export { AskAiPanel } from './panel/AskAiPanel.js'
export type { AskAiPanelProps, AskAiPreset, BrainMode } from './panel/AskAiPanel.js'

export { BrainIcon } from './icons.js'
export type { BrainIconName, BrainIconProps } from './icons.js'
