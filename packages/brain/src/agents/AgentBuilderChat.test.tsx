import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { AgentBuilderChat, type BuilderMessage } from './AgentBuilderChat'

const tools = [{ name: 'oup_lead_create', title: 'Создать лид', description: '', write: true, source: 'oup' }]

const conversation: BuilderMessage[] = [
  { id: '1', role: 'user', text: 'Каждое утро присылай сводку по лидам' },
  {
    id: '2',
    role: 'assistant',
    text: 'Настроил агента: сводка по будням в 9:30.',
    patch: {
      name: 'Утренняя сводка',
      write_policy: 'deny',
      triggers: [{ kind: 'schedule', enabled: true, config: { cron: '30 9 * * 1-5', tz: 'Europe/Moscow' } }],
    },
    notes: ['Триггер по событию недоступен: его настраивает управляющий модулем ИИ'],
  },
]

describe('AgentBuilderChat', () => {
  it('пустой диалог: подсказка и примеры; пример отправляется как сообщение', async () => {
    const onSend = vi.fn()
    render(<AgentBuilderChat messages={[]} onSend={onSend} suggestions={['Раз в неделю собирай апдейт']} />)
    expect(screen.getByText('Опишите агента словами')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Раз в неделю собирай апдейт' }))
    expect(onSend).toHaveBeenCalledWith('Раз в неделю собирай апдейт')
  })

  it('реплики; под ответом — «Что изменено в профиле» человеческими подписями и «Не применено»', () => {
    render(<AgentBuilderChat messages={conversation} onSend={() => {}} tools={tools} />)
    expect(screen.getByText('Каждое утро присылай сводку по лидам')).toBeInTheDocument()
    expect(screen.getByText('Настроил агента: сводка по будням в 9:30.')).toBeInTheDocument()
    const changes = screen.getByRole('region', { name: 'Что изменено в профиле' })
    const lines = within(changes)
      .getAllByRole('listitem')
      .map((li) => li.textContent)
    expect(lines).toEqual(['Название: «Утренняя сводка»', 'Запись: только читать', 'Триггеры: По будням в 09:30 (МСК)'])
    const notes = screen.getByRole('note', { name: 'Что не применено' })
    expect(notes).toHaveTextContent('Триггер по событию недоступен')
  })

  it('«Отменить правку» — только под последней применённой правкой', async () => {
    const onUndo = vi.fn()
    const two: BuilderMessage[] = [
      ...conversation,
      { id: '3', role: 'user', text: 'и ещё включи память' },
      { id: '4', role: 'assistant', text: 'Включил.', patch: { memory_enabled: true } },
      { id: '5', role: 'user', text: 'а что с бюджетом?' },
      { id: '6', role: 'assistant', text: 'Бюджет настраивается внизу формы.', patch: {} },
    ]
    render(<AgentBuilderChat messages={two} onSend={() => {}} onUndo={onUndo} />)
    const buttons = screen.getAllByRole('button', { name: 'Отменить правку' })
    expect(buttons).toHaveLength(1)
    // Кнопка — в блоке второй правки (память), не первой.
    expect(buttons[0]!.closest('section')).toHaveTextContent('Память: включена')
    await userEvent.click(buttons[0]!)
    expect(onUndo).toHaveBeenCalledTimes(1)
  })

  it('откатанная правка помечена, кнопка уезжает к предыдущей', () => {
    const msgs: BuilderMessage[] = [
      conversation[0]!,
      conversation[1]!,
      { id: '3', role: 'user', text: 'включи память' },
      { id: '4', role: 'assistant', text: 'Включил.', patch: { memory_enabled: true }, undone: true },
    ]
    render(<AgentBuilderChat messages={msgs} onSend={() => {}} onUndo={() => {}} />)
    expect(screen.getByText('Правка отменена')).toBeInTheDocument()
    const btn = screen.getByRole('button', { name: 'Отменить правку' })
    expect(btn.closest('section')).toHaveTextContent('Название: «Утренняя сводка»')
  })

  it('без onUndo кнопки нет', () => {
    render(<AgentBuilderChat messages={conversation} onSend={() => {}} />)
    expect(screen.queryByRole('button', { name: 'Отменить правку' })).toBeNull()
  })

  it('отправка: Enter, поле очищается, пустое не уходит', async () => {
    const onSend = vi.fn()
    render(<AgentBuilderChat messages={conversation} onSend={onSend} />)
    const input = screen.getByRole('textbox', { name: 'Сообщение конструктору агента' })
    await userEvent.type(input, '   {Enter}')
    expect(onSend).not.toHaveBeenCalled()
    await userEvent.type(input, 'добавь расписание{Enter}')
    expect(onSend).toHaveBeenCalledWith('добавь расписание')
    expect(input).toHaveValue('')
  })

  it('пока конструктор отвечает — индикатор, отправка и откат заблокированы', async () => {
    const onSend = vi.fn()
    render(<AgentBuilderChat messages={conversation} onSend={onSend} onUndo={() => {}} busy />)
    expect(screen.getByRole('status', { name: 'Ассистент отвечает' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Отменить правку' })).toBeNull()
    await userEvent.type(screen.getByRole('textbox'), 'ещё{Enter}')
    expect(onSend).not.toHaveBeenCalled()
  })

  it('disabledReason выключает поле и показывает причину; ошибка ответа — alert', () => {
    render(
      <AgentBuilderChat
        messages={[{ id: '1', role: 'assistant', text: '', error: 'Лимит ИИ исчерпан' }]}
        onSend={() => {}}
        disabledReason="Создавать агентов может сотрудник с ролью «Редактирование»"
        error="Не удалось связаться с конструктором"
      />,
    )
    expect(screen.getByRole('textbox')).toBeDisabled()
    expect(screen.getByText(/ролью «Редактирование»/)).toBeInTheDocument()
    const alerts = screen.getAllByRole('alert').map((a) => a.textContent)
    expect(alerts).toContain('Лимит ИИ исчерпан')
    expect(alerts).toContain('Не удалось связаться с конструктором')
  })
})
