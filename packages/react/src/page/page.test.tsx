import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { EmptyState } from './EmptyState'
import { ErrorState } from './ErrorState'
import { Loader } from './Loader'
import { PageHeader } from './PageHeader'

describe('PageHeader', () => {
  it('h1 с названием, подпись, счётчик и действия', () => {
    render(
      <PageHeader
        title="Теги"
        count={20}
        subtitle="Справочник тегов"
        actions={<button className="btn btn-primary">Создать тег</button>}
      />,
    )
    expect(screen.getByRole('heading', { level: 1, name: 'Теги 20' })).toBeInTheDocument()
    expect(screen.getByText('Справочник тегов')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Создать тег' })).toBeInTheDocument()
  })
})

describe('состояния', () => {
  it('пусто — заголовок, пояснение и действие', () => {
    render(
      <EmptyState
        title="Маршрутов пока нет"
        description="Создайте первый"
        actions={<button>Создать маршрут</button>}
      />,
    )
    expect(screen.getByText('Маршрутов пока нет')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Создать маршрут' })).toBeInTheDocument()
  })

  it('ошибка — alert и «Повторить»', async () => {
    const onRetry = vi.fn()
    render(<ErrorState onRetry={onRetry} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Не удалось загрузить')
    await userEvent.click(screen.getByRole('button', { name: 'Повторить' }))
    expect(onRetry).toHaveBeenCalled()
  })

  it('лоадер объявляет загрузку', () => {
    render(<Loader label="Загружаем теги" />)
    expect(screen.getByRole('status', { name: 'Загружаем теги' })).toBeInTheDocument()
  })
})
