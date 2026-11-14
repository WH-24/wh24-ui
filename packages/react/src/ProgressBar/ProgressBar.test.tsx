import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ProgressBar } from './ProgressBar'

describe('ProgressBar', () => {
  it('с value — progressbar со значением, заполнение через scaleX', () => {
    const { getByRole } = render(<ProgressBar value={40} ariaLabel="Загрузка файла" />)
    const bar = getByRole('progressbar', { name: 'Загрузка файла' })
    expect(bar).toHaveAttribute('aria-valuenow', '40')
    expect(bar).toHaveAttribute('aria-valuemin', '0')
    expect(bar).toHaveAttribute('aria-valuemax', '100')
    expect((bar.firstElementChild as HTMLElement).style.transform).toBe('scaleX(0.4)')
  })

  it('значение зажато в 0–100', () => {
    const { getByRole, rerender } = render(<ProgressBar value={140} />)
    expect(getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100')
    rerender(<ProgressBar value={-5} />)
    expect(getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0')
  })

  it('без value — неопределённый ход: без aria-valuenow', () => {
    const { getByRole } = render(<ProgressBar />)
    const bar = getByRole('progressbar')
    expect(bar).not.toHaveAttribute('aria-valuenow')
    expect(bar).toHaveAttribute('data-indeterminate')
  })
})
