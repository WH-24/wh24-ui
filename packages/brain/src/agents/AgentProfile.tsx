import { useEffect, useId, useState, type ReactNode } from 'react'
import {
  Combobox,
  FieldGrid,
  FieldRow,
  Input,
  MultiCombobox,
  StaticValue,
  Textarea,
  type ComboboxOption,
} from '@wowhaus-24/ui-react'

import { BrainIcon } from '../icons.js'
import { PrivacyNotice } from '../meta/PrivacyNotice.js'
import type { ModuleMetaMap } from '../sources/modules.js'
import { agentPrivacyWarning } from './draft.js'
import { KnowledgePicker, type PinnedDocument } from './KnowledgePicker.js'
import { WRITE_POLICY_LABEL } from './labels.js'
import { MemoryEditor } from './MemoryEditor.js'
import type { TimezoneOption } from './schedule.js'
import { BrainSwitch } from './Switch.js'
import { ToolPicker } from './ToolPicker.js'
import { TriggerEditor } from './TriggerEditor.js'
import styles from './profile.module.css'
import type {
  AgentDraft,
  AgentMemoryItem,
  AgentToolInfo,
  AgentVisibility,
  CanTriggerMode,
  EventKeyOption,
  WritePolicy,
} from './types.js'

/** Ограничения полей (те же, что у сервера). */
export const AGENT_LIMITS = { name: 80, description: 400, instructions: 12000, budgetMax: 100 } as const

export interface AgentProfileProps {
  /** Профиль в форме. Состояние у хоста: компонент ничего не хранит и не пишет в localStorage. */
  value: AgentDraft
  onChange: (next: AgentDraft) => void
  readOnly?: boolean
  /** Управляет модулем ИИ: общие агенты, события, чужой запуск от имени. Только видимость полей — сервер проверит сам. */
  canManage?: boolean
  /** Поля, которые только что изменил конструктор (`name`, `instructions`, `tools`, `triggers`…): подсвечиваются и подписываются. */
  highlight?: string[]
  /** Ошибки по полям из `BrainApiError.field`: `name`, `instructions`, `triggers[0]`… */
  errors?: Record<string, string>

  // Данные для выбора — даёт хост.
  tools?: AgentToolInfo[]
  toolsLoading?: boolean
  toolsError?: string | null
  eventKeyOptions?: EventKeyOption[]
  timezones?: TimezoneOption[]
  /** Модели для выбора (`Combobox`); без списка — обычное поле ввода. */
  modelOptions?: ComboboxOption[]
  /** Сотрудники для «От чьего имени» и «Кто может запускать». */
  userOptions?: ComboboxOption[]
  moduleKeys?: string[]
  moduleLabels?: ModuleMetaMap
  /** Закреплённые документы с названиями (по `knowledge.pinned_document_ids`). */
  pinnedDocuments?: PinnedDocument[]
  onPickDocument?: () => void
  onOpenDocument?: (doc: PinnedDocument) => void
  /** Ваша память агента; без неё блок памяти — только переключатель. */
  memory?: AgentMemoryItem[]
  memoryLoading?: boolean
  memoryError?: string | null
  memoryBusyId?: string | null
  onForgetMemory?: (item: AgentMemoryItem) => void
  /** «Сейчас» для расчёта ближайшего запуска (тесты). */
  now?: Date
  className?: string
}

const VISIBILITY: ComboboxOption[] = [
  { value: 'private', label: 'Личный — виден только вам' },
  { value: 'public', label: 'Общий — виден сотрудникам с доступом к ИИ' },
]

const CAN_TRIGGER: ComboboxOption[] = [
  { value: 'owner', label: 'Только владелец' },
  { value: 'all', label: 'Все, кто видит агента' },
  { value: 'users', label: 'Выбранные сотрудники' },
]

function Section({
  title,
  hint,
  changed,
  children,
}: {
  title: string
  hint?: ReactNode
  changed?: boolean
  children: ReactNode
}) {
  const id = useId()
  return (
    <section className={styles.section} aria-labelledby={id} data-changed={changed || undefined}>
      <header className={styles.sectionHead}>
        <h3 id={id} className={styles.sectionTitle}>
          {title}
        </h3>
        {changed && <ChangedTag />}
      </header>
      {hint && <p className={styles.sectionHint}>{hint}</p>}
      {children}
    </section>
  )
}

function ChangedTag() {
  return (
    <span className={styles.changedTag}>
      <BrainIcon name="sparkle" size={11} />
      Изменено конструктором
    </span>
  )
}

/**
 * Профиль агента одной формой по секциям — как карточки портала:
 * «Инструкции и навыки», «Триггеры», «Инструменты», «Знания», «Память»,
 * «Доставка и права». Контролируемый: `value` и `onChange`, сохраняет хост.
 *
 * 🔴 Права: `canManage` только прячет поля, которые всё равно проверит сервер
 * (общий агент, чужой запуск от имени, триггеры по событиям).
 */
export function AgentProfile({
  value,
  onChange,
  readOnly = false,
  canManage = false,
  highlight = [],
  errors = {},
  tools = [],
  toolsLoading,
  toolsError,
  eventKeyOptions,
  timezones,
  modelOptions,
  userOptions,
  moduleKeys,
  moduleLabels,
  pinnedDocuments,
  onPickDocument,
  onOpenDocument,
  memory,
  memoryLoading,
  memoryError,
  memoryBusyId,
  onForgetMemory,
  now,
  className,
}: AgentProfileProps) {
  const uid = useId()
  const hl = new Set(highlight)
  const changed = (key: string) => hl.has(key)
  const set = <K extends keyof AgentDraft>(key: K, v: AgentDraft[K]) => onChange({ ...value, [key]: v })
  const lbl = (text: string, key: string) =>
    changed(key) ? (
      <>
        {text} <ChangedTag />
      </>
    ) : (
      text
    )
  const cls = (key: string) => (changed(key) ? styles.changed : undefined)
  const id = (s: string) => `${uid}-${s}`

  const privacy = Boolean(value.privacy_warning) || agentPrivacyWarning(value)
  const triggerErrors = Object.fromEntries(Object.entries(errors).filter(([k]) => k.startsWith('triggers')))
  const modules = value.knowledge.modules ?? []
  const pinnedIds = value.knowledge.pinned_document_ids ?? []
  const pinned: PinnedDocument[] = pinnedIds.map((pid) => pinnedDocuments?.find((d) => d.id === pid) ?? { id: pid })
  const knowledgeChanged = changed('knowledge')
  const publicAgent = value.visibility === 'public'

  // Бюджет — текстом: «1.» и «1,5» при вводе не должны перескакивать.
  const [budgetText, setBudgetText] = useState(String(value.daily_budget_usd))
  useEffect(() => {
    setBudgetText((t) => (Number(t.replace(',', '.')) === value.daily_budget_usd ? t : String(value.daily_budget_usd)))
  }, [value.daily_budget_usd])

  const instructionsLen = [...value.instructions].length

  return (
    <div className={[styles.profile, className].filter(Boolean).join(' ')}>
      {privacy && (
        <PrivacyNotice tone="warn">
          <p>
            Этот агент запускается без вас — по расписанию или событию — и работает правами выбранного сотрудника (по
            умолчанию владельца). Его ответы и уведомления получает этот сотрудник. Перед включением потребуется
            подтверждение.
          </p>
        </PrivacyNotice>
      )}

      <Section
        title="Инструкции и навыки"
        changed={changed('name') || changed('description') || changed('instructions')}
      >
        <FieldGrid>
          <FieldRow
            label={lbl('Название', 'name')}
            htmlFor={id('name')}
            required
            span={12}
            error={errors.name}
            className={cls('name')}
          >
            <Input
              id={id('name')}
              maxLength={AGENT_LIMITS.name}
              value={value.name}
              readOnly={readOnly}
              invalid={Boolean(errors.name)}
              placeholder="Например: Утренний стендап"
              onChange={(e) => set('name', e.target.value)}
            />
          </FieldRow>
          <FieldRow
            label={lbl('Описание', 'description')}
            htmlFor={id('desc')}
            span={12}
            error={errors.description}
            className={cls('description')}
          >
            <Textarea
              id={id('desc')}
              rows={2}
              maxLength={AGENT_LIMITS.description}
              value={value.description}
              readOnly={readOnly}
              invalid={Boolean(errors.description)}
              placeholder="Что делает агент — одной-двумя фразами"
              onChange={(e) => set('description', e.target.value)}
            />
          </FieldRow>
          <FieldRow
            label={lbl('Инструкции', 'instructions')}
            htmlFor={id('instr')}
            span={12}
            error={errors.instructions}
            hint={`Что искать, в каком виде отвечать и чего не делать — от второго лица. ${instructionsLen} из ${AGENT_LIMITS.instructions.toLocaleString('ru-RU')} знаков`}
            className={cls('instructions')}
          >
            <Textarea
              id={id('instr')}
              rows={8}
              value={value.instructions}
              readOnly={readOnly}
              invalid={Boolean(errors.instructions) || instructionsLen > AGENT_LIMITS.instructions}
              placeholder="Каждое утро собери короткий стендап по моим проектам: что изменилось, что горит, что ждёт решения…"
              onChange={(e) => set('instructions', e.target.value)}
            />
          </FieldRow>
          <FieldRow
            label={lbl('Модель', 'model')}
            htmlFor={id('model')}
            span={6}
            error={errors.model}
            hint="Необязательно. Пусто — модель по умолчанию"
            className={cls('model')}
          >
            {modelOptions ? (
              <Combobox
                id={id('model')}
                ariaLabel="Открыть список моделей"
                options={modelOptions}
                value={value.model}
                placeholder="По умолчанию"
                disabled={readOnly}
                invalid={Boolean(errors.model)}
                onChange={(v) => set('model', v)}
              />
            ) : (
              <Input
                id={id('model')}
                value={value.model}
                readOnly={readOnly}
                invalid={Boolean(errors.model)}
                placeholder="По умолчанию"
                onChange={(e) => set('model', e.target.value)}
              />
            )}
          </FieldRow>
        </FieldGrid>
      </Section>

      <Section
        title="Триггеры"
        hint="Когда агент запускается. Запуск вручную идёт вашими правами, по расписанию — правами выбранного сотрудника."
        changed={changed('triggers')}
      >
        <TriggerEditor
          value={value.triggers}
          onChange={(t) => set('triggers', t)}
          canManage={canManage}
          readOnly={readOnly}
          eventKeyOptions={eventKeyOptions}
          timezones={timezones}
          errors={triggerErrors}
          now={now}
        />
      </Section>

      <Section title="Инструменты" hint="Что агент умеет делать в портале." changed={changed('tools')}>
        <ToolPicker
          tools={tools}
          value={value.tools}
          writePolicy={value.write_policy}
          readOnly={readOnly}
          loading={toolsLoading}
          error={errors.tools ?? toolsError}
          modules={moduleLabels}
          onChange={(t) => set('tools', t)}
        />
      </Section>

      <Section title="Знания" hint="Где агент ищет и какие документы видит всегда." changed={knowledgeChanged}>
        <KnowledgePicker
          modules={modules}
          moduleKeys={moduleKeys}
          moduleLabels={moduleLabels}
          pinned={pinned}
          readOnly={readOnly}
          onModulesChange={(m) => set('knowledge', { ...value.knowledge, modules: m })}
          onRemovePinned={(pid) =>
            set('knowledge', { ...value.knowledge, pinned_document_ids: pinnedIds.filter((x) => x !== pid) })
          }
          onPickDocument={onPickDocument}
          onOpenDocument={onOpenDocument}
        />
        {(errors['knowledge.modules'] || errors['knowledge.pinned_document_ids'] || errors.knowledge) && (
          <p className={styles.error} role="alert">
            {errors['knowledge.modules'] ?? errors['knowledge.pinned_document_ids'] ?? errors.knowledge}
          </p>
        )}
      </Section>

      <Section title="Память" changed={changed('memory_enabled')}>
        <BrainSwitch
          checked={value.memory_enabled}
          disabled={readOnly}
          describedBy={id('memory-note')}
          onChange={(v) => set('memory_enabled', v)}
        >
          Запоминать предпочтения и итоги запусков
        </BrainSwitch>
        <p id={id('memory-note')} className={styles.sectionHint}>
          Память собирается на каждого человека отдельно — по тем данным, что доступны ему.
        </p>
        {memory && (
          <MemoryEditor
            items={memory}
            loading={memoryLoading}
            error={memoryError}
            busyId={memoryBusyId}
            onForget={onForgetMemory}
          />
        )}
      </Section>

      <Section title="Доставка и права" changed={changed('write_policy')}>
        <fieldset className={styles.radios} disabled={readOnly}>
          <legend className={styles.legend}>{lbl('Запись в портале', 'write_policy')}</legend>
          {(['ask', 'deny'] as WritePolicy[]).map((p) => (
            <label key={p} className={styles.radio} data-on={value.write_policy === p || undefined}>
              <input
                type="radio"
                name={id('write')}
                checked={value.write_policy === p}
                onChange={() => set('write_policy', p)}
              />
              <span className={styles.radioBody}>
                <span className={styles.radioTitle}>{WRITE_POLICY_LABEL[p].title}</span>
                <span className={styles.radioText}>{WRITE_POLICY_LABEL[p].text}</span>
              </span>
            </label>
          ))}
          {errors.write_policy && (
            <p className={styles.error} role="alert">
              {errors.write_policy}
            </p>
          )}
        </fieldset>

        <FieldGrid>
          {canManage ? (
            <FieldRow
              label={lbl('Видимость', 'visibility')}
              htmlFor={id('vis')}
              span={6}
              error={errors.visibility}
              className={cls('visibility')}
            >
              <Combobox
                id={id('vis')}
                ariaLabel="Открыть список: видимость"
                options={VISIBILITY}
                value={value.visibility}
                clearable={false}
                searchable={false}
                disabled={readOnly}
                invalid={Boolean(errors.visibility)}
                onChange={(v) => v && set('visibility', v as AgentVisibility)}
              />
            </FieldRow>
          ) : (
            <FieldRow label="Видимость" span={6}>
              <StaticValue>
                {publicAgent ? 'Общий — виден сотрудникам с доступом к ИИ' : 'Личный — виден только вам'}
              </StaticValue>
            </FieldRow>
          )}

          {canManage && publicAgent && (
            <FieldRow
              label="Кто может запускать"
              htmlFor={id('trig')}
              span={6}
              error={errors.can_trigger}
              hint="Запуск идёт правами нажавшего: доступ к данным он не расширяет"
            >
              <Combobox
                id={id('trig')}
                ariaLabel="Открыть список: кто может запускать"
                options={CAN_TRIGGER}
                value={value.can_trigger.mode}
                clearable={false}
                searchable={false}
                disabled={readOnly}
                invalid={Boolean(errors.can_trigger)}
                onChange={(v) =>
                  v &&
                  set('can_trigger', {
                    mode: v as CanTriggerMode,
                    ...(v === 'users' ? { user_ids: value.can_trigger.user_ids ?? [] } : {}),
                  })
                }
              />
            </FieldRow>
          )}

          {canManage && publicAgent && value.can_trigger.mode === 'users' && (
            <FieldRow
              label="Сотрудники"
              htmlFor={id('users')}
              span={12}
              hint={userOptions ? undefined : 'Список сотрудников недоступен'}
            >
              <MultiCombobox
                id={id('users')}
                options={userOptions ?? []}
                values={value.can_trigger.user_ids ?? []}
                placeholder="— выбрать сотрудников —"
                ariaLabel="Открыть список сотрудников"
                disabled={readOnly || !userOptions}
                onChange={(ids) => set('can_trigger', { mode: 'users', user_ids: ids })}
              />
            </FieldRow>
          )}

          {canManage && userOptions && (
            <FieldRow
              label="От чьего имени по расписанию и событиям"
              htmlFor={id('runas')}
              span={12}
              error={errors.run_as_user_id}
              hint="Его правами агент ищет и читает данные без вас. Нужен доступ к модулю ИИ. Пусто — владелец агента"
            >
              <Combobox
                id={id('runas')}
                ariaLabel="Открыть список сотрудников"
                options={userOptions}
                value={value.run_as_user_id ?? ''}
                placeholder="Владелец агента"
                disabled={readOnly}
                invalid={Boolean(errors.run_as_user_id)}
                onChange={(v) => set('run_as_user_id', v)}
              />
            </FieldRow>
          )}

          <FieldRow
            label="Дневной бюджет, $"
            htmlFor={id('budget')}
            span={6}
            error={errors.daily_budget_usd}
            hint={`Запуски сверх бюджета пропускаются и видны в журнале. Не больше ${AGENT_LIMITS.budgetMax} $`}
          >
            <Input
              id={id('budget')}
              inputMode="decimal"
              value={budgetText}
              readOnly={readOnly}
              invalid={Boolean(errors.daily_budget_usd)}
              onChange={(e) => {
                setBudgetText(e.target.value)
                const n = Number(e.target.value.replace(',', '.'))
                if (e.target.value.trim() !== '' && Number.isFinite(n) && n >= 0) set('daily_budget_usd', n)
              }}
              onBlur={() => setBudgetText(String(value.daily_budget_usd))}
            />
          </FieldRow>
        </FieldGrid>
      </Section>
    </div>
  )
}
