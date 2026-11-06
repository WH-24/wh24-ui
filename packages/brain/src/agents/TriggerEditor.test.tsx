import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { eventKeyChoices, eventKeyProblem } from './EventTriggerFields'
import { EVENT_LOCKED_HINT, TriggerEditor, type TriggerEditorProps } from './TriggerEditor'
import type { Trigger } from './types'

const NOW = new Date('2026-11-06T10:00:00Z')
const eventKeyOptions = [
  { key: 'oup.lead.stale', label: 'Лид застрял' },
  { key: 'oup.lead.created', label: 'Новый лид' },
  { key: 'forms.record.approval_requested', label: 'Назначено согласование' },
]

const manual: Trigger = { id: 't1', kind: 'manual', enabled: true, config: {} }
const schedule: Trigger = {
  id: 't2',
  kind: 'schedule',
  enabled: true,
  config: { cron: '30 9 * * 1-5', tz: 'Europe/Moscow', ends_at: null },
}
const event: Trigger = {
  id: 't3',
  kind: 'event',
  enabled: true,
  config: { event_keys: ['oup.lead.stale'], filter: [], condition_nl: '', include_payload: false },
}

function Host({
  initial,
  onValue,
  ...rest
}: { initial: Trigger[]; onValue?: (v: Trigger[]) => void } & Partial<TriggerEditorProps>) {
  const [v, setV] = useState(initial)
  return (
    <TriggerEditor
      now={NOW}
      eventKeyOptions={eventKeyOptions}
      {...rest}
      value={v}
      onChange={(n) => {
        setV(n)
        onValue?.(n)
      }}
    />
  )
}
const last = (fn: ReturnType<typeof vi.fn>) => fn.mock.calls.at(-1)![0] as Trigger[]

describe('TriggerEditor', () => {
  it('рисует триггеры по виду, у каждого — переключатель «Включён»', () => {
    render(<Host initial={[manual, schedule, event]} canManage />)
    expect(screen.getByText('Вручную', { selector: 'span' })).toBeInTheDocument()
    expect(screen.getByText('По расписанию', { selector: 'span' })).toBeInTheDocument()
    expect(screen.getByText('По событию', { selector: 'span' })).toBeInTheDocument()
    const switches = screen.getAllByRole('switch')
    expect(switches).toHaveLength(3 + 1) // три триггера и «Передавать агенту данные события»
    expect(screen.getByRole('switch', { name: 'Включён: По расписанию' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByText('Следующий запуск: пн, 9 ноября, 09:30 (МСК)')).toBeInTheDocument()
  })

  it('выключатель и удаление меняют список', async () => {
    const onValue = vi.fn()
    render(<Host initial={[manual, schedule]} onValue={onValue} />)
    await userEvent.click(screen.getByRole('switch', { name: 'Включён: По расписанию' }))
    expect(last(onValue)[1]).toMatchObject({ kind: 'schedule', enabled: false })
    expect(screen.getByRole('switch', { name: 'Включён: По расписанию' })).toHaveAttribute('aria-checked', 'false')
    await userEvent.click(screen.getByRole('button', { name: 'Удалить триггер: По расписанию' }))
    expect(last(onValue)).toEqual([manual])
  })

  it('добавляет расписание с разумным значением; «Вручную» скрыт, если уже есть', async () => {
    const onValue = vi.fn()
    render(<Host initial={[manual]} onValue={onValue} canManage />)
    const add = screen.getByRole('group', { name: 'Добавить триггер' })
    expect(within(add).queryByRole('button', { name: /Вручную/ })).toBeNull()
    await userEvent.click(within(add).getByRole('button', { name: /По расписанию/ }))
    expect(last(onValue)[1]).toEqual({
      kind: 'schedule',
      enabled: true,
      config: { cron: '0 9 * * 1-5', tz: 'Europe/Moscow', ends_at: null },
    })
  })

  it('фокус не теряется: новый триггер — в первое поле, удалённый — на соседа, последний — на «Добавить»', async () => {
    render(<Host initial={[manual, schedule]} canManage />)
    await userEvent.click(screen.getByRole('button', { name: /По событию/ }))
    expect(screen.getByLabelText('События')).toHaveFocus()

    await userEvent.click(screen.getByRole('button', { name: 'Удалить триггер: По событию' }))
    expect(screen.getByRole('button', { name: 'Удалить триггер: По расписанию' })).toHaveFocus()

    await userEvent.click(screen.getByRole('button', { name: 'Удалить триггер: Вручную' }))
    expect(screen.getByRole('button', { name: 'Удалить триггер: По расписанию' })).toHaveFocus()

    await userEvent.click(screen.getByRole('button', { name: 'Удалить триггер: По расписанию' }))
    const add = screen.getByRole('group', { name: 'Добавить триггер' })
    expect(add.contains(document.activeElement)).toBe(true)
  })

  it('без триггеров подсказывает и предлагает «Вручную»', async () => {
    const onValue = vi.fn()
    render(<Host initial={[]} onValue={onValue} />)
    expect(screen.getByText('Триггеров нет: агента нельзя запустить.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Вручную/ }))
    expect(last(onValue)).toEqual([{ kind: 'manual', enabled: true, config: {} }])
  })

  it('не больше 10 триггеров', () => {
    const many = Array.from({ length: 10 }, (_, i): Trigger => ({ ...schedule, id: `s${i}` }))
    render(<Host initial={many} />)
    const add = screen.getByRole('group', { name: 'Добавить триггер' })
    expect(within(add).getByRole('button', { name: /По расписанию/ })).toBeDisabled()
    expect(screen.getByText(/не больше 10 триггеров/)).toBeInTheDocument()
  })

  describe('без права управления модулем', () => {
    it('добавить событие нельзя, объяснение на виду', () => {
      render(<Host initial={[manual]} />)
      expect(screen.getByRole('button', { name: /По событию/ })).toBeDisabled()
      expect(screen.getByRole('note')).toHaveTextContent(EVENT_LOCKED_HINT)
      expect(EVENT_LOCKED_HINT).toBe('Триггеры по событиям настраивает управляющий модулем ИИ')
    })

    it('существующий триггер по событию показан заблокированным: ни правки, ни удаления', () => {
      render(<Host initial={[manual, event]} />)
      expect(screen.getByRole('note')).toHaveTextContent(EVENT_LOCKED_HINT)
      expect(screen.getByRole('switch', { name: 'Включён: По событию' })).toBeDisabled()
      expect(screen.getByLabelText('События')).toBeDisabled()
      expect(screen.getByLabelText('Условие своими словами')).toBeDisabled()
      expect(screen.queryByRole('button', { name: 'Удалить триггер: По событию' })).toBeNull()
      // Обычные триггеры при этом правятся.
      expect(screen.getByRole('button', { name: 'Удалить триггер: Вручную' })).toBeEnabled()
    })
  })

  describe('триггер по событию (canManage)', () => {
    it('ключ выбирается из списка, есть шаблоны «префикс.*»', async () => {
      const onValue = vi.fn()
      render(<Host initial={[{ ...event, config: { ...event.config, event_keys: [] } }]} onValue={onValue} canManage />)
      await userEvent.click(screen.getByLabelText('События'))
      const options = screen.getAllByRole('option').map((o) => o.textContent)
      expect(options.some((t) => t?.includes('Лид застрял'))).toBe(true)
      expect(options.some((t) => t?.includes('oup.lead.*'))).toBe(true)
      expect(options.some((t) => t?.includes('oup.*'))).toBe(true)
      await userEvent.click(screen.getByRole('option', { name: /Лид застрял/ }))
      expect(last(onValue)[0]!.config.event_keys).toEqual(['oup.lead.stale'])
      await userEvent.click(screen.getByRole('option', { name: /oup\.lead\.\*/ }))
      expect(last(onValue)[0]!.config.event_keys).toEqual(['oup.lead.stale', 'oup.lead.*'])
    })

    it('ключ или шаблон вводится вручную и проверяется как на сервере', async () => {
      const onValue = vi.fn()
      render(<Host initial={[{ ...event, config: { ...event.config, event_keys: [] } }]} onValue={onValue} canManage />)
      await userEvent.click(screen.getByRole('button', { name: 'Ввести ключ или шаблон вручную' }))
      const input = screen.getByLabelText('Ключ события или шаблон')
      await userEvent.type(input, 'Forms Record')
      await userEvent.click(screen.getByRole('button', { name: 'Добавить' }))
      expect(screen.getByRole('alert')).toHaveTextContent(/латиница/)
      expect(onValue).not.toHaveBeenCalled()

      await userEvent.clear(input)
      await userEvent.type(input, 'forms.*')
      await userEvent.click(screen.getByRole('button', { name: 'Добавить' }))
      expect(last(onValue)[0]!.config.event_keys).toEqual(['forms.*'])
      // Чип ключа не из списка тоже виден.
      expect(screen.getByText('forms.*')).toBeInTheDocument()
    })

    it('фильтр: до 8 условий, оператор «заполнено» прячет значение', async () => {
      const onValue = vi.fn()
      render(<Host initial={[event]} onValue={onValue} canManage />)
      const add = screen.getByRole('button', { name: /Условие/ })
      for (let i = 0; i < 8; i++) await userEvent.click(add)
      expect(last(onValue)[0]!.config.filter).toHaveLength(8)
      expect(add).toBeDisabled()

      await userEvent.type(screen.getByLabelText('Значение условия 1'), 'lead')
      expect(last(onValue)[0]!.config.filter![0]).toEqual({ path: 'subject_type', op: 'eq', value: 'lead' })

      await userEvent.click(screen.getByLabelText('Операция условия 1'))
      await userEvent.click(screen.getByRole('option', { name: 'заполнено' }))
      expect(last(onValue)[0]!.config.filter![0]).toEqual({ path: 'subject_type', op: 'exists' })
      expect(screen.queryByLabelText('Значение условия 1')).toBeNull()

      await userEvent.click(screen.getByRole('button', { name: 'Убрать условие 8' }))
      expect(last(onValue)[0]!.config.filter).toHaveLength(7)
      expect(add).toBeEnabled()
    })

    it('фокус в фильтре: новое условие — в его поле, убранное — на соседнее, последнее — на «Условие»', async () => {
      render(<Host initial={[event]} canManage />)
      const add = screen.getByRole('button', { name: /Условие/ })
      await userEvent.click(add)
      expect(screen.getByLabelText('Поле условия 1')).toHaveFocus()
      await userEvent.click(add)
      expect(screen.getByLabelText('Поле условия 2')).toHaveFocus()
      await userEvent.click(screen.getByRole('button', { name: 'Убрать условие 1' }))
      expect(screen.getByRole('button', { name: 'Убрать условие 1' })).toHaveFocus()
      await userEvent.click(screen.getByRole('button', { name: 'Убрать условие 1' }))
      expect(add).toHaveFocus()
    })

    it('«одно из» хранит список; условие по данным события дополняет путь ключом', async () => {
      const onValue = vi.fn()
      render(
        <Host
          initial={[{ ...event, config: { ...event.config, filter: [{ path: 'subject_type', op: 'eq', value: '' }] } }]}
          onValue={onValue}
          canManage
        />,
      )
      await userEvent.click(screen.getByLabelText('Операция условия 1'))
      await userEvent.click(screen.getByRole('option', { name: 'одно из' }))
      await userEvent.type(screen.getByLabelText('Значения условия 1'), 'lead, project,')
      expect(last(onValue)[0]!.config.filter![0]).toEqual({
        path: 'subject_type',
        op: 'in',
        value: ['lead', 'project'],
      })
      // Запятая в конце не съедается при вводе.
      expect(screen.getByLabelText('Значения условия 1')).toHaveValue('lead, project,')

      await userEvent.click(screen.getByLabelText('Поле условия 1'))
      await userEvent.click(screen.getByRole('option', { name: /Поле данных события/ }))
      await userEvent.type(screen.getByLabelText('Ключ данных события в условии 1'), 'amount')
      expect(last(onValue)[0]!.config.filter![0]!.path).toBe('payload.amount')
    })

    it('условие своими словами и «Передавать данные события» с предупреждением', async () => {
      const onValue = vi.fn()
      render(<Host initial={[event]} onValue={onValue} canManage />)
      await userEvent.type(screen.getByLabelText('Условие своими словами'), 'только крупнее 10 млн')
      expect(last(onValue)[0]!.config.condition_nl).toBe('только крупнее 10 млн')

      expect(screen.queryByText(/могут быть шире ваших прав/)).toBeNull()
      const payload = screen.getByRole('switch', { name: 'Передавать агенту данные события' })
      expect(payload).toHaveAttribute('aria-checked', 'false')
      await userEvent.click(payload)
      expect(last(onValue)[0]!.config.include_payload).toBe(true)
      expect(screen.getByText(/могут быть шире ваших прав/)).toBeInTheDocument()
    })
  })

  it('ошибки по триггерам показываются у нужной карточки', () => {
    render(
      <Host
        initial={[manual, event]}
        canManage
        errors={{ 'triggers[1]': 'укажите от 1 до 20 ключей событий', triggers: 'не больше 10' }}
      />,
    )
    const alerts = screen.getAllByRole('alert').map((a) => a.textContent)
    expect(alerts).toContain('укажите от 1 до 20 ключей событий')
    expect(alerts).toContain('не больше 10')
  })

  it('readOnly: ни кнопок добавления, ни удаления; всё выключено', () => {
    render(<Host initial={[manual, schedule]} readOnly />)
    expect(screen.queryByRole('group', { name: 'Добавить триггер' })).toBeNull()
    expect(screen.queryByRole('button', { name: /Удалить триггер/ })).toBeNull()
    expect(screen.getByLabelText('Как часто')).toBeDisabled()
    expect(screen.getByRole('switch', { name: 'Включён: По расписанию' })).toBeDisabled()
  })
})

describe('eventKeyChoices / eventKeyProblem', () => {
  it('шаблоны — только там, где под префиксом больше одного ключа', () => {
    const values = eventKeyChoices(eventKeyOptions).map((o) => o.value)
    expect(values).toContain('oup.lead.*')
    expect(values).toContain('oup.*')
    expect(values).not.toContain('forms.*')
    expect(values).not.toContain('forms.record.*')
  })

  it('ключ проверяется как на сервере', () => {
    expect(eventKeyProblem('oup.lead.stale')).toBeNull()
    expect(eventKeyProblem('oup.lead.*')).toBeNull()
    expect(eventKeyProblem('forms.*')).toBeNull()
    expect(eventKeyProblem('')).toMatch(/Введите/)
    expect(eventKeyProblem('Oup.Lead')).toMatch(/латиница/)
    expect(eventKeyProblem('oup.*.stale')).toMatch(/латиница/)
    expect(eventKeyProblem('oup..stale')).toMatch(/латиница/)
  })
})
