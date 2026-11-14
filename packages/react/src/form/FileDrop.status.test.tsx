import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { FileDrop } from './FileDrop'

describe('FileDrop: состояние загрузки', () => {
  it('без status строка прежняя: ни подписи, ни полосы', () => {
    render(<FileDrop files={[{ id: '1', name: 'a.pdf' }]} />)
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('uploading: подпись и полоса; с progress — проценты', () => {
    const { rerender } = render(<FileDrop files={[{ id: '1', name: 'a.pdf', status: 'uploading' }]} />)
    expect(screen.getByRole('status')).toHaveTextContent('Загружается…')
    expect(screen.getByRole('progressbar')).not.toHaveAttribute('aria-valuenow')

    rerender(<FileDrop files={[{ id: '1', name: 'a.pdf', status: 'uploading', progress: 42.4 }]} />)
    expect(screen.getByRole('status')).toHaveTextContent('Загружается… 42%')
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '42')
  })

  it('done: «Загружен», полосы нет', () => {
    render(<FileDrop files={[{ id: '1', name: 'a.pdf', status: 'done' }]} />)
    expect(screen.getByRole('status')).toHaveTextContent('Загружен')
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  })

  it('error: сообщение и «Повторить»; без onRetry ссылки нет', async () => {
    const onRetry = vi.fn()
    const { rerender } = render(<FileDrop files={[{ id: '1', name: 'g.dwg', status: 'error', onRetry }]} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Не загрузился')
    await userEvent.click(screen.getByRole('button', { name: 'Повторить' }))
    expect(onRetry).toHaveBeenCalledTimes(1)

    rerender(<FileDrop files={[{ id: '1', name: 'g.dwg', status: 'error' }]} />)
    expect(screen.queryByRole('button', { name: 'Повторить' })).not.toBeInTheDocument()
  })

  it('свои подписи', () => {
    render(
      <FileDrop files={[{ id: '1', name: 'a.pdf', status: 'done' }]} statusLabels={{ done: 'Готово' }} />,
    )
    expect(screen.getByRole('status')).toHaveTextContent('Готово')
  })
})
