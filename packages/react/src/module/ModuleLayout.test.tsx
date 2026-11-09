import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { ModuleLayout, ModuleNavGroup, ModuleNavLink, ModuleNavList } from './ModuleLayout'

describe('ModuleLayout', () => {
  it('панель — область с названием модуля, активный пункт — aria-current', () => {
    render(
      <ModuleLayout
        title="База знаний"
        icon="book"
        nav={
          <ModuleNavList
            items={[
              { id: 'home', label: 'Главная', icon: 'home', href: '/' },
              { id: 'search', label: 'Поиск', icon: 'search', href: '/search' },
            ]}
            activeId="search"
          />
        }
      >
        <p>Содержимое</p>
      </ModuleLayout>,
    )
    expect(screen.getByRole('complementary', { name: 'База знаний' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Поиск' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Главная' })).not.toHaveAttribute('aria-current')
    expect(screen.getByText('Содержимое')).toBeInTheDocument()
  })

  it('обычный клик — переход через onClick, с Cmd — браузеру (новая вкладка)', async () => {
    const onClick = vi.fn()
    render(<ModuleNavLink label="Теги" icon="tag" href="/admin/tags" onClick={onClick} />)
    const link = screen.getByRole('link', { name: 'Теги' })
    await userEvent.click(link)
    expect(onClick).toHaveBeenCalledTimes(1)
    fireEvent.click(link, { button: 0, metaKey: true })
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('пункт без адреса фокусируется и срабатывает с Enter', async () => {
    const onClick = vi.fn()
    render(<ModuleNavLink label="Логи" icon="filetext" onClick={onClick} />)
    const link = screen.getByRole('link', { name: 'Логи' })
    link.focus()
    await userEvent.keyboard('{Enter}')
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('счётчик показывается, ноль — нет; группа подписана', () => {
    render(
      <ModuleNavGroup label="Контент">
        <ModuleNavLink label="Очередь ревью" icon="inbox" href="/r" count={3} />
        <ModuleNavLink label="Корзина" icon="trash" href="/t" count={0} />
      </ModuleNavGroup>,
    )
    expect(screen.getByRole('group', { name: 'Контент' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Очередь ревью 3' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Корзина' })).toBeInTheDocument()
  })
})
