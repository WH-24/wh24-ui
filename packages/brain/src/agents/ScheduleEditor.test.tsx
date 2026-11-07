import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { ScheduleEditor, type ScheduleValue } from './ScheduleEditor'

// Пятница, 6 ноября 2026, 13:00 по Москве.
const NOW = new Date('2026-11-06T10:00:00Z')

function Host({ initial, onValue }: { initial: ScheduleValue; onValue?: (v: ScheduleValue) => void }) {
  const [v, setV] = useState(initial)
  return (
    <ScheduleEditor
      now={NOW}
      value={v}
      onChange={(n) => {
        setV(n)
        onValue?.(n)
      }}
    />
  )
}

const weekdays: ScheduleValue = { cron: '30 9 * * 1-5', tz: 'Europe/Moscow', ends_at: null }
const last = (fn: ReturnType<typeof vi.fn>) => fn.mock.calls.at(-1)![0] as ScheduleValue

describe('ScheduleEditor', () => {
  it('показывает периодичность, время, пояс и «Следующий запуск»', () => {
    render(<Host initial={weekdays} />)
    expect(screen.getByLabelText('Как часто')).toHaveValue('По будням')
    expect(screen.getByLabelText('Время')).toHaveValue('09:30')
    expect(screen.getByLabelText('Часовой пояс')).toHaveValue('Москва (UTC+3)')
    expect(screen.getByText('Следующий запуск: пн, 9 ноября, 09:30 (МСК)')).toBeInTheDocument()
    expect(screen.getByLabelText('Заканчивается')).toBeInTheDocument()
  })

  it('смена периодичности пересобирает cron и сохраняет время', async () => {
    const onValue = vi.fn()
    render(<Host initial={weekdays} onValue={onValue} />)
    await userEvent.click(screen.getByLabelText('Как часто'))
    await userEvent.click(screen.getByRole('option', { name: 'Каждый день' }))
    expect(last(onValue).cron).toBe('30 9 * * *')

    await userEvent.click(screen.getByLabelText('Как часто'))
    await userEvent.click(screen.getByRole('option', { name: 'Раз в месяц' }))
    expect(last(onValue).cron).toBe('30 9 1 * *')
    const day = screen.getByLabelText('Число месяца')
    await userEvent.clear(day)
    await userEvent.type(day, '15')
    expect(last(onValue).cron).toBe('30 9 15 * *')
    expect(screen.getByText(/Следующий запуск: .*15 ноября/)).toBeInTheDocument()
  })

  it('дни недели переключаются, последний день снять нельзя', async () => {
    const onValue = vi.fn()
    render(<Host initial={{ ...weekdays, cron: '0 9 * * 1' }} onValue={onValue} />)
    expect(screen.getByLabelText('Как часто')).toHaveValue('По дням недели')
    const group = screen.getByRole('group', { name: 'Дни недели' })
    expect(within(group).getByRole('button', { name: 'Пн' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(group).getByRole('button', { name: 'Ср' })).toHaveAttribute('aria-pressed', 'false')

    await userEvent.click(within(group).getByRole('button', { name: 'Ср' }))
    expect(last(onValue).cron).toBe('0 9 * * 1,3')
    await userEvent.click(within(group).getByRole('button', { name: 'Вс' }))
    expect(last(onValue).cron).toBe('0 9 * * 1,3,0')

    // Остался один день — снять нельзя.
    await userEvent.click(within(group).getByRole('button', { name: 'Пн' }))
    await userEvent.click(within(group).getByRole('button', { name: 'Ср' }))
    const calls = onValue.mock.calls.length
    await userEvent.click(within(group).getByRole('button', { name: 'Вс' }))
    expect(onValue.mock.calls.length).toBe(calls)
    expect(within(group).getByRole('button', { name: 'Вс' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('время вводится с маской и применяется, когда оно полное', async () => {
    const onValue = vi.fn()
    render(<Host initial={weekdays} onValue={onValue} />)
    const time = screen.getByLabelText('Время')
    await userEvent.clear(time)
    await userEvent.type(time, '1830')
    expect(time).toHaveValue('18:30')
    expect(last(onValue).cron).toBe('30 18 * * 1-5')
  })

  it('раскрывающееся поле cron правит расписание; нестандартный cron включает «Своё расписание»', async () => {
    const onValue = vi.fn()
    render(<Host initial={weekdays} onValue={onValue} />)
    expect(screen.queryByLabelText('Расписание в формате cron')).toBeNull()
    const toggle = screen.getByRole('button', { name: /Расширенно: cron/ })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    const cron = screen.getByLabelText('Расписание в формате cron')
    expect(cron).toHaveValue('30 9 * * 1-5')

    await userEvent.clear(cron)
    await userEvent.type(cron, '0 */2 * * *')
    expect(last(onValue).cron).toBe('0 */2 * * *')
    expect(screen.getByLabelText('Как часто')).toHaveValue('Своё расписание (cron)')
    expect(screen.queryByLabelText('Время')).toBeNull()
    expect(screen.getByText(/Следующий запуск/)).toBeInTheDocument()
  })

  it('чаще раза в 5 минут — понятная ошибка вместо «Следующий запуск»', async () => {
    render(<Host initial={{ ...weekdays, cron: '*/2 * * * *' }} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Запускать чаще раза в 5 минут нельзя')
    expect(screen.queryByText(/Следующий запуск/)).toBeNull()
    // Поле cron раскрыто и подсвечено как неверное.
    expect(screen.getByLabelText('Расписание в формате cron')).toHaveAttribute('aria-invalid', 'true')
  })

  it('ошибка с сервера показывается, если своей проверки нет', () => {
    render(<ScheduleEditor now={NOW} value={weekdays} onChange={() => {}} error="неизвестная таймзона" />)
    expect(screen.getByRole('alert')).toHaveTextContent('неизвестная таймзона')
  })

  it('смена часового пояса пересчитывает подпись и оставляет ту же дату конца', async () => {
    const onValue = vi.fn()
    render(
      <Host
        initial={{ cron: '0 18 * * *', tz: 'Europe/Moscow', ends_at: '2026-12-31T20:59:59.000Z' }}
        onValue={onValue}
      />,
    )
    expect(screen.getByLabelText('Заканчивается')).toHaveValue('31.12.2026')
    await userEvent.click(screen.getByLabelText('Часовой пояс'))
    await userEvent.click(screen.getByRole('option', { name: 'Екатеринбург (UTC+5)' }))
    expect(last(onValue).tz).toBe('Asia/Yekaterinburg')
    expect(last(onValue).ends_at).toBe('2026-12-31T18:59:59.000Z')
    expect(screen.getByLabelText('Заканчивается')).toHaveValue('31.12.2026')
    expect(screen.getByText('Следующий запуск: сегодня в 18:00 (Екатеринбург)')).toBeInTheDocument()
  })

  it('«Заканчивается» вводится датой и пишется как RFC 3339', async () => {
    const onValue = vi.fn()
    render(<Host initial={weekdays} onValue={onValue} />)
    await userEvent.type(screen.getByLabelText('Заканчивается'), '31122026')
    expect(last(onValue).ends_at).toBe('2026-12-31T20:59:59.000Z')
  })

  it('disabled выключает все поля', () => {
    render(<ScheduleEditor now={NOW} value={weekdays} onChange={() => {}} disabled />)
    expect(screen.getByLabelText('Как часто')).toBeDisabled()
    expect(screen.getByLabelText('Время')).toBeDisabled()
    expect(screen.getByLabelText('Часовой пояс')).toBeDisabled()
  })
})
