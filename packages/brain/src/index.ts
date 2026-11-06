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

// ─── Агенты ИИ (0.2.0): конструктор, триггеры, журнал ───
export * from './agents/types.js'
export { createAgentsClient } from './agents/client.js'
export type { AgentsApi, AgentRunsApi, AgentsClient, Requester } from './agents/client.js'

export { AgentProfile, AGENT_LIMITS } from './agents/AgentProfile.js'
export type { AgentProfileProps } from './agents/AgentProfile.js'
export { TriggerEditor, MAX_TRIGGERS, EVENT_LOCKED_HINT } from './agents/TriggerEditor.js'
export type { TriggerEditorProps } from './agents/TriggerEditor.js'
export { ScheduleEditor } from './agents/ScheduleEditor.js'
export type { ScheduleEditorProps, ScheduleValue } from './agents/ScheduleEditor.js'
export { EventTriggerFields, eventKeyChoices, eventKeyProblem, MAX_FILTER_RULES } from './agents/EventTriggerFields.js'
export type { EventTriggerFieldsProps } from './agents/EventTriggerFields.js'
export { ToolPicker } from './agents/ToolPicker.js'
export type { ToolPickerProps } from './agents/ToolPicker.js'
export { KnowledgePicker } from './agents/KnowledgePicker.js'
export type { KnowledgePickerProps, PinnedDocument } from './agents/KnowledgePicker.js'
export { MemoryEditor } from './agents/MemoryEditor.js'
export type { MemoryEditorProps } from './agents/MemoryEditor.js'
export { RunLogTable, RunStatusBadge, runStatusView, RESTRICTED_NOTE } from './agents/RunLogTable.js'
export type { RunLogTableProps, RunStatusView } from './agents/RunLogTable.js'
export { RunDetail } from './agents/RunDetail.js'
export type { RunDetailProps } from './agents/RunDetail.js'
export { AgentCard, AgentStatusBadge } from './agents/AgentCard.js'
export type { AgentCardProps } from './agents/AgentCard.js'
export { AgentPresetCard } from './agents/AgentPresetCard.js'
export type { AgentPresetCardProps } from './agents/AgentPresetCard.js'
export { AgentAvatar } from './agents/AgentAvatar.js'
export type { AgentAvatarProps } from './agents/AgentAvatar.js'
export { AgentBuilderChat } from './agents/AgentBuilderChat.js'
export type { AgentBuilderChatProps, BuilderMessage } from './agents/AgentBuilderChat.js'
export { BrainSwitch } from './agents/Switch.js'
export type { BrainSwitchProps } from './agents/Switch.js'

export {
  emptyAgentDraft,
  agentToDraft,
  applyAgentPatch,
  agentPrivacyWarning,
  patchSummary,
  triggerSummary,
} from './agents/draft.js'
export type { PatchSummaryOptions } from './agents/draft.js'
export {
  TRIGGER_KIND_LABEL,
  AGENT_STATUS_LABEL,
  RUN_STATUS_LABEL,
  MEMORY_KIND_LABEL,
  WRITE_POLICY_LABEL,
  skipReasonText,
  formatCost,
  formatDuration,
  formatDateTime,
} from './agents/labels.js'
export {
  SCHEDULE_MIN_MINUTES,
  DEFAULT_TZ,
  DEFAULT_TIMEZONES,
  cronFromParts,
  partsFromCron,
  scheduleProblem,
  describeSchedule,
  describeNextRun,
  dateToEndsAt,
  endsAtToDate,
} from './agents/schedule.js'
export type { Frequency, ScheduleParts, TimezoneOption } from './agents/schedule.js'

// ─── Поля ИИ и генераторы (0.3.0) ───
export * from './fields/types.js'
export { createFieldsClient, VALUES_CHUNK, FILL_CHUNK } from './fields/client.js'
export type { FieldsApi, GeneratorsApi, FieldsClient } from './fields/client.js'
export { brainErrorText, cellErrorText } from './fields/errors.js'
export {
  AI_FIELD_KINDS,
  AI_FIELD_KIND_LABEL,
  SENTIMENT_OPTIONS,
  LANGUAGES,
  GENERATOR_LABEL,
  MAX_STANDUP_PEOPLE,
} from './fields/labels.js'
export { isoDate, defaultPeriod, periodDays, periodLabel, MAX_PERIOD_DAYS } from './fields/period.js'

export { BrainDialog, BrainConfirm } from './fields/Dialog.js'
export type { BrainDialogProps, BrainConfirmProps } from './fields/Dialog.js'
export { AiFieldCell } from './fields/AiFieldCell.js'
export type { AiFieldCellProps } from './fields/AiFieldCell.js'
export { AiFieldColumnMenu } from './fields/AiFieldColumnMenu.js'
export type { AiFieldColumnMenuProps } from './fields/AiFieldColumnMenu.js'
export { AiFieldDialog } from './fields/AiFieldDialog.js'
export type { AiFieldDialogProps } from './fields/AiFieldDialog.js'
export { GeneratorDialog } from './fields/GeneratorDialog.js'
export type { GeneratorDialogProps, GeneratorDefaults } from './fields/GeneratorDialog.js'
export { useAiFieldColumns, fillSummary } from './fields/useAiFieldColumns.js'
export type { UseAiFieldColumnsOptions, UseAiFieldColumnsResult, ConfirmRequest } from './fields/useAiFieldColumns.js'

// ─── Навыки, память, модели и индекс (0.4.0) ───
export * from './skills/types.js'
export { createSkillsClient } from './skills/client.js'
export type { SkillsApi, SkillsClient } from './skills/client.js'
export { SKILL_STATUS_LABEL, SLASH_RE, SLASH_HINT, normalizeSlash, slugify, slashProblem, usesLabel } from './skills/labels.js'
export { SkillCard } from './skills/SkillCard.js'
export type { SkillCardProps } from './skills/SkillCard.js'
export { SkillsList } from './skills/SkillsList.js'
export type { SkillsListProps } from './skills/SkillsList.js'
export { SkillDialog } from './skills/SkillDialog.js'
export type { SkillDialogProps } from './skills/SkillDialog.js'
export { SkillSuggestionsDialog } from './skills/SkillSuggestionsDialog.js'
export type { SkillSuggestionsDialogProps } from './skills/SkillSuggestionsDialog.js'
export { useSlashSkills } from './skills/useSlashSkills.js'
export type { UseSlashSkillsOptions, UseSlashSkillsResult } from './skills/useSlashSkills.js'
export { slashQuery, matchSlashSkills } from './composer/BrainComposer.js'

export * from './memory/types.js'
export { createMemoryClient } from './memory/client.js'
export type { MemoryApi, MemoryClient } from './memory/client.js'
export { USER_MEMORY_KIND_LABEL, MEMORY_SOURCE_LABEL, IMPORT_MAX_LINES, parseImportText, linesLabel } from './memory/labels.js'
export type { ParsedImport } from './memory/labels.js'
export { MemoryPanel } from './memory/MemoryPanel.js'
export type { MemoryPanelProps } from './memory/MemoryPanel.js'
export { MemoryImportDialog } from './memory/MemoryImportDialog.js'
export type { MemoryImportDialogProps } from './memory/MemoryImportDialog.js'

export * from './models/types.js'
export { createModelsClient } from './models/client.js'
export type { AdminApi, EmbeddingsAdminApi, IndexAdminApi, ModelsApi, ModelsClient } from './models/client.js'
export { PROVIDER_LABEL, coveragePercent, coverageOf, relativeTime, formatCount } from './models/format.js'
export { ModelSelect } from './models/ModelSelect.js'
export type { ModelSelectProps } from './models/ModelSelect.js'
export { ModelSettingsDialog } from './models/ModelSettingsDialog.js'
export type { ModelSettingsDialogProps } from './models/ModelSettingsDialog.js'
export { IndexStatusDialog } from './models/IndexStatusDialog.js'
export type { IndexStatusDialogProps } from './models/IndexStatusDialog.js'

