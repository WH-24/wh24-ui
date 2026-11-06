import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { AgentCard } from './AgentCard'
import { AgentPresetCard } from './AgentPresetCard'
import type { Agent, AgentPreset } from './types'

const agent = (over: Partial<Agent> = {}): Agent => ({
  id: 'a1',
  slug: 'utrenniy-stendap',
  name: 'Утренний стендап',
  description: 'По будням присылает сводку по лидам и проектам.',
  avatar: 'calendar',
  instructions: '',
  model: 'gpt-5.5',
  tools: [],
  knowledge: {},
  memory_enabled: true,
  write_policy: 'deny',
  run_as_user_id: 'u1',
  owner_user_id: 'u1',
  visibility: 'private',
  can_trigger: { mode: 'owner' },
  status: 'active',
  daily_budget_usd: 5,
  triggers: [
    { id: 't1', kind: 'schedule', enabled: true, config: { cron: '30 9 * * 1-5', tz: 'Europe/Moscow' } },
    { id: 't2', kind: 'manual', enabled: true, config: {} },
    { id: 't3', kind: 'schedule', enabled: false, config: { cron: '0 20 * * *', tz: 'Europe/Moscow' } },
  ],
  runs_total: 12,
  last_run_at: '2026-11-06T06:30:00Z',
  last_status: 'completed',
  can: { edit: true, run: true, delete: true, journal: true },
  ...over,
})

describe('AgentCard', () => {
  it('название, описание, статус, запуск кратко (только включённые триггеры), модель, счётчик запусков', () => {
    render(<AgentCard agent={agent()} />)
    expect(screen.getByRole('heading', { name: 'Утренний стендап' })).toBeInTheDocument()
    expect(screen.getByText('По будням присылает сводку по лидам и проектам.')).toBeInTheDocument()
    expect(screen.getByText('Включён')).toBeInTheDocument()
    expect(screen.getByText('По будням в 09:30 (МСК) · Вручную')).toBeInTheDocument()
    expect(screen.queryByText(/20:00/)).toBeNull()
    expect(screen.getByText('gpt-5.5')).toBeInTheDocument()
    expect(screen.getByText(/Запусков 12 · последний .* — Готово/)).toBeInTheDocument()
    expect(screen.queryByText('Общий')).toBeNull()
  })

  it('статусы: Черновик, Включён, Выключен — текстом', () => {
    const { rerender } = render(<AgentCard agent={agent({ status: 'draft' })} />)
    expect(screen.getByText('Черновик')).toBeInTheDocument()
    rerender(<AgentCard agent={agent({ status: 'paused' })} />)
    expect(screen.getByText('Выключен')).toBeInTheDocument()
  })

  it('общий агент помечен; нет запусков — «Запусков нет»', () => {
    render(<AgentCard agent={agent({ visibility: 'public', runs_total: 0, last_run_at: null })} />)
    expect(screen.getByText('Общий')).toBeInTheDocument()
    expect(screen.getByText('Запусков нет')).toBeInTheDocument()
  })

  it('«Запустить» — только при can.run и колбэке', async () => {
    const onRun = vi.fn()
    const a = agent()
    const { rerender } = render(<AgentCard agent={a} onRun={onRun} />)
    await userEvent.click(screen.getByRole('button', { name: 'Запустить' }))
    expect(onRun).toHaveBeenCalledWith(a)
    rerender(
      <AgentCard agent={agent({ can: { edit: true, run: false, delete: true, journal: true } })} onRun={onRun} />,
    )
    expect(screen.queryByRole('button', { name: 'Запустить' })).toBeNull()
    rerender(<AgentCard agent={a} />)
    expect(screen.queryByRole('button', { name: 'Запустить' })).toBeNull()
    rerender(<AgentCard agent={a} onRun={onRun} runBusy />)
    expect(screen.getByRole('button', { name: 'Запускаю…' })).toBeDisabled()
  })

  it('название открывает профиль', async () => {
    const onOpen = vi.fn()
    const a = agent()
    render(<AgentCard agent={a} onOpen={onOpen} />)
    await userEvent.click(screen.getByRole('button', { name: 'Утренний стендап' }))
    expect(onOpen).toHaveBeenCalledWith(a)
  })

  it('меню: Дублировать и Удалить зовут колбэки; Удалить — только при can.delete', async () => {
    const onDuplicate = vi.fn()
    const onDelete = vi.fn()
    const a = agent()
    const { rerender } = render(<AgentCard agent={a} onDuplicate={onDuplicate} onDelete={onDelete} />)
    const trigger = screen.getByRole('button', { name: 'Действия: Утренний стендап' })
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getAllByRole('menuitem').map((i) => i.textContent)).toEqual(['Дублировать', 'Удалить'])
    await userEvent.click(screen.getByRole('menuitem', { name: 'Дублировать' }))
    expect(onDuplicate).toHaveBeenCalledWith(a)
    expect(screen.queryByRole('menu')).toBeNull()

    await userEvent.click(trigger)
    await userEvent.click(screen.getByRole('menuitem', { name: 'Удалить' }))
    expect(onDelete).toHaveBeenCalledWith(a)

    rerender(
      <AgentCard
        agent={agent({ can: { edit: false, run: true, delete: false, journal: false } })}
        onDuplicate={onDuplicate}
        onDelete={onDelete}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Действия: Утренний стендап' }))
    expect(screen.getAllByRole('menuitem').map((i) => i.textContent)).toEqual(['Дублировать'])
  })

  it('меню с клавиатуры: фокус на первом пункте, стрелки, Esc закрывает и возвращает фокус', async () => {
    render(<AgentCard agent={agent()} onDuplicate={() => {}} onDelete={() => {}} />)
    const trigger = screen.getByRole('button', { name: 'Действия: Утренний стендап' })
    await userEvent.click(trigger)
    expect(screen.getByRole('menuitem', { name: 'Дублировать' })).toHaveFocus()
    await userEvent.keyboard('{ArrowDown}')
    expect(screen.getByRole('menuitem', { name: 'Удалить' })).toHaveFocus()
    await userEvent.keyboard('{ArrowDown}')
    expect(screen.getByRole('menuitem', { name: 'Дублировать' })).toHaveFocus()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).toBeNull()
    expect(trigger).toHaveFocus()
  })

  it('нет действий — нет и меню', () => {
    render(<AgentCard agent={agent()} />)
    expect(screen.queryByRole('button', { name: /Действия/ })).toBeNull()
  })
})

const preset = (over: Partial<AgentPreset> = {}): AgentPreset => ({
  key: 'standup',
  name: 'Утренний стендап',
  description: 'По будням в 9:30 присылает сводку.',
  avatar: 'calendar',
  needs_manager: false,
  available: true,
  agent: agent(),
  ...over,
})

describe('AgentPresetCard', () => {
  it('«Создать» зовёт колбэк с пресетом', async () => {
    const onCreate = vi.fn()
    const p = preset()
    render(<AgentPresetCard preset={p} onCreate={onCreate} />)
    expect(screen.getByText('По будням в 9:30 присылает сводку.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Создать' }))
    expect(onCreate).toHaveBeenCalledWith(p)
  })

  it('недоступный пресет: кнопка выключена, причина написана и связана с кнопкой', () => {
    render(<AgentPresetCard preset={preset({ available: false, needs_manager: true })} onCreate={() => {}} />)
    const btn = screen.getByRole('button', { name: 'Создать' })
    expect(btn).toBeDisabled()
    const reason = screen.getByText('Триггеры по событиям настраивает управляющий модулем ИИ')
    expect(btn).toHaveAttribute('aria-describedby', reason.id)
  })

  it('идёт создание — «Создаю…»', () => {
    render(<AgentPresetCard preset={preset()} onCreate={() => {}} busy />)
    expect(screen.getByRole('button', { name: 'Создаю…' })).toBeDisabled()
  })
})
