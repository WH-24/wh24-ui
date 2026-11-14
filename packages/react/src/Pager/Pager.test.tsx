import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { Pager, pagerRange } from './Pager'

describe('pagerRange', () => {
  it('первая, последняя, текущая с соседями; разрыв — многоточие', () => {
    expect(pagerRange(3, 12)).toEqual([1, 2, 3, 4, null, 12])
    expect(pagerRange(6, 12)).toEqual([1, null, 5, 6, 7, null, 12])
    expect(pagerRange(1, 12)).toEqual([1, 2, null, 12])
    expect(pagerRange(12, 12)).toEqual([1, null, 11, 12])
  })

  it('разрыв в одну страницу показывается страницей, а не многоточием', () => {
    expect(pagerRange(4, 12)).toEqual([1, 2, 3, 4, 5, null, 12])
    expect(pagerRange(2, 3)).toEqual([1, 2, 3])
  })
})

describe('Pager', () => {
  it('навигация с подписью, текущая — aria-current="page"', () => {
    render(<Pager page={3} pageCount={12} onChange={() => {}} />)
    expect(screen.getByRole('navigation', { name: 'Страницы' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Страница 3' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('button', { name: 'Страница 4' })).not.toHaveAttribute('aria-current')
  })

  it('номер, «вперёд» и «назад» зовут onChange', async () => {
    const onChange = vi.fn()
    render(<Pager page={3} pageCount={12} onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: 'Страница 12' }))
    expect(onChange).toHaveBeenLastCalledWith(12)
    await userEvent.click(screen.getByRole('button', { name: 'Следующая страница' }))
    expect(onChange).toHaveBeenLastCalledWith(4)
    await userEvent.click(screen.getByRole('button', { name: 'Предыдущая страница' }))
    expect(onChange).toHaveBeenLastCalledWith(2)
    // Текущая страница — не переход.
    await userEvent.click(screen.getByRole('button', { name: 'Страница 3' }))
    expect(onChange).toHaveBeenCalledTimes(3)
  })

  it('на краях стрелки выключены; с клавиатуры — Tab и Enter', async () => {
    const onChange = vi.fn()
    render(<Pager page={1} pageCount={3} onChange={onChange} />)
    expect(screen.getByRole('button', { name: 'Предыдущая страница' })).toBeDisabled()
    await userEvent.tab()
    expect(screen.getByRole('button', { name: 'Страница 1' })).toHaveFocus()
    await userEvent.tab()
    await userEvent.keyboard('{Enter}')
    expect(onChange).toHaveBeenLastCalledWith(2)
  })

  it('одна страница — пейджера нет', () => {
    const { container } = render(<Pager page={1} pageCount={1} onChange={() => {}} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('стрелка на краю выключается — фокус переходит на текущую страницу', async () => {
    function Host() {
      const [page, setPage] = useState(2)
      return <Pager page={page} pageCount={5} onChange={setPage} />
    }
    render(<Host />)
    const prev = screen.getByRole('button', { name: 'Предыдущая страница' })
    prev.focus()
    await userEvent.keyboard('{Enter}')
    expect(prev).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Страница 1' })).toHaveFocus()
  })

  it('переход не на край фокус со стрелки не уводит', async () => {
    function Host() {
      const [page, setPage] = useState(1)
      return <Pager page={page} pageCount={5} onChange={setPage} />
    }
    render(<Host />)
    const next = screen.getByRole('button', { name: 'Следующая страница' })
    next.focus()
    await userEvent.keyboard('{Enter}')
    expect(next).toHaveFocus()
  })
})
