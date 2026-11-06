import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import type { SlashSkill } from '../skills/types'
import { BrainComposer, matchSlashSkills, slashQuery } from './BrainComposer'

const skills: SlashSkill[] = [
  { slash: 'дайджест', name: 'Дайджест проекта', description: 'Сводка по проекту' },
  { slash: 'стендап', name: 'Стендап по людям' },
  { slash: 'итог', name: 'Итог недели' },
  { slash: 'идеи', name: 'Дайджест идей' },
]

function Host({ onSend = () => {}, list = skills, initial = '' }: { onSend?: () => void; list?: SlashSkill[]; initial?: string }) {
  const [v, setV] = useState(initial)
  return (
    <>
      <BrainComposer value={v} onChange={setV} onSend={onSend} skills={list} autoFocus={false} />
      <span data-testid="value">{v}</span>
    </>
  )
}

const box = () => screen.getByRole('textbox', { name: 'Сообщение ассистенту' })

describe('slashQuery / matchSlashSkills', () => {
  it('slashQuery: только одно слово с «/» в начале', () => {
    expect(slashQuery('/')).toBe('')
    expect(slashQuery('/ди')).toBe('ди')
    expect(slashQuery('/дайджест ')).toBeNull()
    expect(slashQuery('/дайджест проект')).toBeNull()
    expect(slashQuery('привет /ди')).toBeNull()
    expect(slashQuery('/a\nb')).toBeNull()
    expect(slashQuery('')).toBeNull()
  })

  it('сначала начинается с введённого, затем содержит (по команде и названию)', () => {
    expect(matchSlashSkills(skills, 'и').map((s) => s.slash)).toEqual(['итог', 'идеи'])
    expect(matchSlashSkills(skills, 'дайдж').map((s) => s.slash)).toEqual(['дайджест', 'идеи'])
    expect(matchSlashSkills(skills, 'ЗЗЗ')).toEqual([])
    expect(matchSlashSkills(skills, '')).toHaveLength(4)
  })
})

describe('BrainComposer: меню «/»', () => {
  it('«/» открывает список; пока текст не начинается с «/» — списка нет', async () => {
    render(<Host />)
    await userEvent.type(box(), 'привет')
    expect(screen.queryByRole('listbox')).toBeNull()
    await userEvent.clear(box())
    await userEvent.type(box(), '/')
    const list = screen.getByRole('listbox', { name: 'Навыки' })
    expect(within(list).getAllByRole('option')).toHaveLength(4)
    expect(box()).toHaveAttribute('aria-controls', list.id)
    expect(screen.getByText(/↑↓ — выбрать/)).toBeInTheDocument()
  })

  it('фильтрует по набранному и закрывается пробелом', async () => {
    render(<Host />)
    await userEvent.type(box(), '/стен')
    expect(within(screen.getByRole('listbox')).getAllByRole('option').map((o) => o.textContent)).toEqual(['/стендапСтендап по людям'])
    await userEvent.type(box(), 'дап вопрос')
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('стрелки двигают выбор (aria-activedescendant), Enter вставляет «/команду » и НЕ отправляет', async () => {
    const onSend = vi.fn()
    render(<Host onSend={onSend} />)
    await userEvent.type(box(), '/')
    const opts = () => screen.getAllByRole('option')
    expect(opts()[0]).toHaveAttribute('aria-selected', 'true')
    await userEvent.keyboard('{ArrowDown}')
    expect(opts()[1]).toHaveAttribute('aria-selected', 'true')
    expect(box()).toHaveAttribute('aria-activedescendant', opts()[1]!.id)
    await userEvent.keyboard('{ArrowUp}{ArrowUp}')
    expect(opts()[3]).toHaveAttribute('aria-selected', 'true') // по кругу
    await userEvent.keyboard('{ArrowDown}{Enter}')
    expect(screen.getByTestId('value')).toHaveTextContent('/дайджест')
    expect(screen.getByTestId('value').textContent).toBe('/дайджест ')
    expect(onSend).not.toHaveBeenCalled()
    expect(screen.queryByRole('listbox')).toBeNull()
    // Следующий Enter — обычная отправка.
    await userEvent.type(box(), 'по Северу{Enter}')
    expect(onSend).toHaveBeenCalledTimes(1)
  })

  it('Tab тоже вставляет; клик мышью по пункту вставляет и оставляет фокус в поле', async () => {
    render(<Host />)
    await userEvent.type(box(), '/ит')
    await userEvent.keyboard('{Tab}')
    expect(screen.getByTestId('value').textContent).toBe('/итог ')

    await userEvent.clear(box())
    await userEvent.type(box(), '/')
    await userEvent.click(screen.getByRole('option', { name: /\/стендап/ }))
    expect(screen.getByTestId('value').textContent).toBe('/стендап ')
  })

  it('Esc закрывает список (и не уходит дальше), следующая правка открывает снова', async () => {
    const onHostKey = vi.fn()
    render(
      <div onKeyDown={onHostKey}>
        <Host />
      </div>,
    )
    await userEvent.type(box(), '/дай')
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(onHostKey.mock.calls.some(([e]) => (e as KeyboardEvent).key === 'Escape')).toBe(false)
    await userEvent.type(box(), 'д')
    expect(screen.getByRole('listbox')).toBeInTheDocument()
  })

  it('нет совпадений: подсказка, а Enter отправляет как обычно', async () => {
    const onSend = vi.fn()
    render(<Host onSend={onSend} />)
    await userEvent.type(box(), '/неттакого')
    expect(screen.getByRole('status')).toHaveTextContent('Нет навыка с такой командой')
    expect(screen.queryByRole('listbox')).toBeNull()
    fireEvent.keyDown(box(), { key: 'Enter' })
    expect(onSend).toHaveBeenCalledTimes(1)
  })

  it('без навыков (пустой список) меню нет, существующее поведение прежнее', async () => {
    const onSend = vi.fn()
    render(<Host list={[]} onSend={onSend} initial="" />)
    await userEvent.type(box(), '/что')
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(screen.queryByRole('status')).toBeNull()
    fireEvent.keyDown(box(), { key: 'Enter' })
    expect(onSend).toHaveBeenCalledTimes(1)
  })

  it('выключенное поле меню не показывает', () => {
    render(<BrainComposer value="/" onChange={() => {}} onSend={() => {}} skills={skills} disabledReason="Лимит" />)
    expect(screen.queryByRole('listbox')).toBeNull()
  })
})
