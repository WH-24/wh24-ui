import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { Switch } from './Switch'

describe('Switch', () => {
  it('role="switch", состояние в aria-checked, имя — из подписи', () => {
    render(
      <Switch checked onChange={() => {}}>
        Уведомления на почту
      </Switch>,
    )
    const sw = screen.getByRole('switch', { name: 'Уведомления на почту' })
    expect(sw).toHaveAttribute('aria-checked', 'true')
  })

  it('щелчок и пробел переключают; отдаёт новое значение', async () => {
    const onChange = vi.fn()
    render(<Switch checked={false} onChange={onChange} ariaLabel="Тёмная тема" />)
    const sw = screen.getByRole('switch', { name: 'Тёмная тема' })
    await userEvent.click(sw)
    expect(onChange).toHaveBeenLastCalledWith(true)
    sw.focus()
    await userEvent.keyboard(' ')
    await userEvent.keyboard('{Enter}')
    expect(onChange).toHaveBeenCalledTimes(3)
  })

  it('подпись связана с переключателем (label htmlFor)', () => {
    render(
      <Switch checked={false} onChange={() => {}}>
        Показывать архив
      </Switch>,
    )
    const label = screen.getByText('Показывать архив')
    expect(label.tagName).toBe('LABEL')
    expect(label).toHaveAttribute('for', screen.getByRole('switch').id)
  })

  it('disabled не переключается', async () => {
    const onChange = vi.fn()
    render(
      <Switch checked={false} onChange={onChange} disabled>
        Выключено
      </Switch>,
    )
    await userEvent.click(screen.getByRole('switch'))
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByRole('switch')).toBeDisabled()
  })

  it('ref, className и прочие атрибуты доходят до кнопки', () => {
    const ref = createRef<HTMLButtonElement>()
    render(<Switch ref={ref} checked onChange={() => {}} ariaLabel="x" className="mine" data-testid="sw" />)
    expect(ref.current).toBe(screen.getByTestId('sw'))
    expect(ref.current).toHaveClass('mine')
  })
})
