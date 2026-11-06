import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { emptyAgentDraft } from './draft'
import { AgentProfile, type AgentProfileProps } from './AgentProfile'
import type { AgentDraft, AgentToolInfo } from './types'

const NOW = new Date('2026-11-06T10:00:00Z')
const tools: AgentToolInfo[] = [
  { name: 'search_workspace', title: 'Поиск по данным портала', description: '', write: false, source: 'builtin' },
  { name: 'oup_lead_create', title: 'Создать лид', description: '', write: true, source: 'oup' },
]
const users = [
  { value: 'u1', label: 'Анна Петрова' },
  { value: 'u2', label: 'Борис Орлов' },
]

const filled = (over: Partial<AgentDraft> = {}): AgentDraft => ({
  ...emptyAgentDraft(),
  name: 'Утренний стендап',
  description: 'Сводка по будням',
  instructions: 'Каждое утро собери стендап.',
  ...over,
})

function Host({
  initial,
  onValue,
  ...rest
}: { initial: AgentDraft; onValue?: (v: AgentDraft) => void } & Partial<AgentProfileProps>) {
  const [v, setV] = useState(initial)
  return (
    <AgentProfile
      now={NOW}
      tools={tools}
      {...rest}
      value={v}
      onChange={(n) => {
        setV(n)
        onValue?.(n)
      }}
    />
  )
}
const last = (fn: ReturnType<typeof vi.fn>) => fn.mock.calls.at(-1)![0] as AgentDraft

describe('AgentProfile', () => {
  it('шесть секций по порядку', () => {
    render(<Host initial={filled()} />)
    const titles = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)
    expect(titles).toEqual(['Инструкции и навыки', 'Триггеры', 'Инструменты', 'Знания', 'Память', 'Доставка и права'])
  })

  it('все поля с видимыми подписями; значения из профиля', () => {
    render(<Host initial={filled({ model: 'gpt-5.5' })} />)
    expect(screen.getByLabelText(/Название/)).toHaveValue('Утренний стендап')
    expect(screen.getByLabelText('Описание')).toHaveValue('Сводка по будням')
    expect(screen.getByLabelText('Инструкции')).toHaveValue('Каждое утро собери стендап.')
    expect(screen.getByLabelText('Модель')).toHaveValue('gpt-5.5')
    expect(screen.getByLabelText('Дневной бюджет, $')).toHaveValue('5')
  })

  it('правка полей идёт через onChange целиком, без побочных изменений', async () => {
    const onValue = vi.fn()
    render(<Host initial={filled()} onValue={onValue} />)
    await userEvent.type(screen.getByLabelText(/Название/), '!')
    expect(last(onValue).name).toBe('Утренний стендап!')
    expect(last(onValue).instructions).toBe('Каждое утро собери стендап.')
    await userEvent.clear(screen.getByLabelText('Дневной бюджет, $'))
    await userEvent.type(screen.getByLabelText('Дневной бюджет, $'), '7,5')
    expect(last(onValue).daily_budget_usd).toBe(7.5)
  })

  it('модель — Combobox, если хост дал список; поле ввода — если нет', async () => {
    const onValue = vi.fn()
    const { unmount } = render(
      <Host initial={filled()} onValue={onValue} modelOptions={[{ value: 'gpt-5.5', label: 'GPT-5.5' }]} />,
    )
    await userEvent.click(screen.getByLabelText('Модель'))
    await userEvent.click(screen.getByRole('option', { name: 'GPT-5.5' }))
    expect(last(onValue).model).toBe('gpt-5.5')
    unmount()
    render(<Host initial={filled()} />)
    expect(screen.getByLabelText('Модель').tagName).toBe('INPUT')
  })

  it('политика записи: ask / deny понятными подписями', async () => {
    const onValue = vi.fn()
    render(<Host initial={filled()} onValue={onValue} />)
    const ask = screen.getByRole('radio', { name: /Только с подтверждением/ })
    const deny = screen.getByRole('radio', { name: /Только читать/ })
    expect(ask).toBeChecked()
    await userEvent.click(deny)
    expect(last(onValue).write_policy).toBe('deny')
    expect(screen.getByText(/Инструменты записи агенту не выдаются/, { selector: 'span' })).toBeInTheDocument()
  })

  it('память: переключатель role=switch меняет memory_enabled', async () => {
    const onValue = vi.fn()
    render(<Host initial={filled()} onValue={onValue} />)
    const sw = screen.getByRole('switch', { name: /Запоминать предпочтения/ })
    expect(sw).toHaveAttribute('aria-checked', 'true')
    await userEvent.click(sw)
    expect(last(onValue).memory_enabled).toBe(false)
    expect(sw).toHaveAttribute('aria-checked', 'false')
  })

  it('память агента показывается, если хост её передал, и «Забыть» зовёт колбэк', async () => {
    const onForget = vi.fn()
    const item = { id: 'm1', kind: 'fact' as const, text: 'Ведёт проект «Офис»' }
    const { rerender } = render(<Host initial={filled()} />)
    expect(screen.queryByText(/Это ваша память/)).toBeNull()
    rerender(<Host initial={filled()} memory={[item]} onForgetMemory={onForget} />)
    expect(screen.getByText('Это ваша память этого агента: другие её не видят.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Забыть: Ведёт/ }))
    expect(onForget).toHaveBeenCalledWith(item)
  })

  describe('права', () => {
    it('без canManage: видимость — только текстом, нет can_trigger и «от чьего имени»', () => {
      render(<Host initial={filled()} userOptions={users} />)
      expect(screen.queryByLabelText('Видимость')).toBeNull()
      expect(screen.getByText('Личный — виден только вам')).toBeInTheDocument()
      expect(screen.queryByLabelText('Кто может запускать')).toBeNull()
      expect(screen.queryByLabelText(/От чьего имени/)).toBeNull()
    })

    it('canManage: видимость, can_trigger у общего агента, run_as', async () => {
      const onValue = vi.fn()
      render(<Host initial={filled()} onValue={onValue} canManage userOptions={users} />)
      expect(screen.queryByLabelText('Кто может запускать')).toBeNull()
      await userEvent.click(screen.getByLabelText('Видимость'))
      await userEvent.click(screen.getByRole('option', { name: /Общий/ }))
      expect(last(onValue).visibility).toBe('public')

      await userEvent.click(screen.getByLabelText('Кто может запускать'))
      await userEvent.click(screen.getByRole('option', { name: 'Выбранные сотрудники' }))
      expect(last(onValue).can_trigger).toEqual({ mode: 'users', user_ids: [] })
      await userEvent.click(screen.getByLabelText('Сотрудники'))
      await userEvent.click(screen.getByRole('option', { name: /Анна Петрова/ }))
      expect(last(onValue).can_trigger).toEqual({ mode: 'users', user_ids: ['u1'] })
      await userEvent.keyboard('{Escape}')

      await userEvent.click(screen.getByLabelText(/От чьего имени/))
      await userEvent.click(screen.getByRole('option', { name: 'Борис Орлов' }))
      expect(last(onValue).run_as_user_id).toBe('u2')
    })

    it('триггеры по событиям: без canManage заблокированы с подсказкой', () => {
      const withEvent = filled({
        triggers: [{ kind: 'event', enabled: true, config: { event_keys: ['oup.lead.stale'] } }],
      })
      render(<Host initial={withEvent} />)
      expect(screen.getAllByText('Триггеры по событиям настраивает управляющий модулем ИИ').length).toBeGreaterThan(0)
      expect(screen.getByLabelText('События')).toBeDisabled()
    })
  })

  describe('предупреждение о приватности', () => {
    it('агент с событием — баннер до сохранения', () => {
      const { unmount } = render(<Host initial={filled()} canManage />)
      expect(screen.queryByText(/запускается без вас/)).toBeNull()
      unmount()
      render(
        <Host
          canManage
          initial={filled({ triggers: [{ kind: 'event', enabled: true, config: { event_keys: ['a.b'] } }] })}
        />,
      )
      expect(screen.getByText(/запускается без вас/)).toBeInTheDocument()
    })

    it('privacy_warning с сервера тоже показывает баннер', () => {
      render(<Host initial={filled({ privacy_warning: true })} />)
      expect(screen.getByText(/запускается без вас/)).toBeInTheDocument()
    })
  })

  describe('подсветка изменённого конструктором', () => {
    it('поля и секции из highlight подписаны «Изменено конструктором», остальные — нет', () => {
      render(<Host initial={filled()} highlight={['name', 'tools', 'triggers']} />)
      const tags = screen.getAllByText('Изменено конструктором')
      // Название + секция «Инструкции и навыки», «Триггеры», «Инструменты».
      expect(tags).toHaveLength(4)
      const name = screen.getByText('Название').closest('label')!
      expect(within(name).getByText('Изменено конструктором')).toBeInTheDocument()
      const desc = screen.getByText('Описание').closest('label')!
      expect(within(desc).queryByText('Изменено конструктором')).toBeNull()
    })

    it('без highlight подписей нет', () => {
      render(<Host initial={filled()} />)
      expect(screen.queryByText('Изменено конструктором')).toBeNull()
    })
  })

  it('ошибки по полям из errors показываются у своих полей', () => {
    render(
      <Host
        initial={filled({ name: '' })}
        errors={{
          name: 'укажите название агента',
          instructions: 'не длиннее 12000 знаков',
          daily_budget_usd: 'от 0 до 100',
          tools: 'не больше 128',
          'triggers[0]': 'вид триггера: manual, schedule или event',
        }}
      />,
    )
    expect(screen.getByLabelText(/Название/)).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByText('укажите название агента')).toBeInTheDocument()
    expect(screen.getByText('не длиннее 12000 знаков')).toBeInTheDocument()
    expect(screen.getByText('от 0 до 100')).toBeInTheDocument()
    expect(screen.getByText('не больше 128')).toBeInTheDocument()
    expect(screen.getByText('вид триггера: manual, schedule или event')).toBeInTheDocument()
  })

  it('знания: модули и закреплённые документы с названиями от хоста', async () => {
    const onValue = vi.fn()
    const onPick = vi.fn()
    render(
      <Host
        initial={filled({ knowledge: { modules: ['oup'], pinned_document_ids: ['d1'] } })}
        onValue={onValue}
        pinnedDocuments={[{ id: 'd1', title: 'Регламент отпусков' }]}
        onPickDocument={onPick}
        moduleKeys={['oup', 'wiki']}
      />,
    )
    expect(screen.getByText('Регламент отпусков')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Вики' }))
    expect(last(onValue).knowledge).toEqual({ modules: ['oup', 'wiki'], pinned_document_ids: ['d1'] })
    await userEvent.click(screen.getByRole('button', { name: /Убрать документ/ }))
    expect(last(onValue).knowledge.pinned_document_ids).toEqual([])
    await userEvent.click(screen.getByRole('button', { name: /Закрепить документ/ }))
    expect(onPick).toHaveBeenCalled()
  })

  it('инструменты правятся через ToolPicker', async () => {
    const onValue = vi.fn()
    render(<Host initial={filled()} onValue={onValue} />)
    await userEvent.click(screen.getByRole('switch', { name: 'Все доступные' }))
    expect(last(onValue).tools).toEqual(['search_workspace', 'oup_lead_create'])
  })

  it('readOnly: текстовые поля только для чтения, остальное выключено, кнопок правки нет', () => {
    render(<Host initial={filled()} readOnly />)
    expect(screen.getByLabelText(/Название/)).toHaveAttribute('readonly')
    expect(screen.getByLabelText('Инструкции')).toHaveAttribute('readonly')
    expect(screen.getByRole('switch', { name: /Запоминать/ })).toBeDisabled()
    expect(screen.getByRole('radio', { name: /Только читать/ })).toBeDisabled()
    expect(screen.queryByRole('group', { name: 'Добавить триггер' })).toBeNull()
  })
})
