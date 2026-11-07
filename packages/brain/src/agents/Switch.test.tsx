import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { BrainSwitch } from './Switch'

describe('BrainSwitch', () => {
  it('role=switch, aria-checked, подпись видна и даёт имя', async () => {
    const onChange = vi.fn()
    const { rerender } = render(
      <BrainSwitch checked={false} onChange={onChange}>
        Включён
      </BrainSwitch>,
    )
    const sw = screen.getByRole('switch', { name: 'Включён' })
    expect(sw).toHaveAttribute('aria-checked', 'false')
    await userEvent.click(sw)
    expect(onChange).toHaveBeenCalledWith(true)
    rerender(
      <BrainSwitch checked onChange={onChange}>
        Включён
      </BrainSwitch>,
    )
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true')
    await userEvent.click(screen.getByRole('switch'))
    expect(onChange).toHaveBeenLastCalledWith(false)
  })

  it('переключается с клавиатуры (Space, Enter) и выключается через disabled', async () => {
    const onChange = vi.fn()
    const { rerender } = render(
      <BrainSwitch checked={false} onChange={onChange}>
        Память
      </BrainSwitch>,
    )
    await userEvent.tab()
    expect(screen.getByRole('switch')).toHaveFocus()
    await userEvent.keyboard(' ')
    await userEvent.keyboard('{Enter}')
    expect(onChange).toHaveBeenCalledTimes(2)
    rerender(
      <BrainSwitch checked={false} onChange={onChange} disabled>
        Память
      </BrainSwitch>,
    )
    await userEvent.click(screen.getByRole('switch'))
    expect(onChange).toHaveBeenCalledTimes(2)
  })

  it('ariaLabel заменяет имя, describedBy связывает пояснение', () => {
    render(
      <>
        <BrainSwitch checked onChange={() => {}} ariaLabel="Включён: По расписанию" describedBy="note">
          Включён
        </BrainSwitch>
        <p id="note">Пояснение</p>
      </>,
    )
    const sw = screen.getByRole('switch', { name: 'Включён: По расписанию' })
    expect(sw).toHaveAccessibleDescription('Пояснение')
  })
})
