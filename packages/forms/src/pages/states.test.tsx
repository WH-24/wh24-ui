import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { initials } from '../render/format'
import { StatusPill } from './StatusPill'
import { Banner, Skeleton, StateBox } from './states'

/** Состояния страницы форм — обёртки над общими элементами ui-react. */
describe('состояния форм на общих элементах', () => {
  it('StateBox — заголовок, текст и действие общего EmptyState', () => {
    render(
      <StateBox icon="inbox" title="Записей нет" text="Создайте первую" action={<button type="button">Создать</button>} />,
    )
    const box = screen.getByRole('status')
    expect(box).toHaveTextContent('Записей нет')
    expect(box).toHaveTextContent('Создайте первую')
    expect(screen.getByRole('heading', { name: 'Записей нет' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Создать' })).toBeInTheDocument()
  })

  it('Skeleton — столько полос, сколько просили', () => {
    render(<Skeleton rows={4} />)
    const sk = screen.getByLabelText('Загрузка')
    expect(sk).toHaveAttribute('aria-busy', 'true')
    expect(sk.children).toHaveLength(4)
  })

  it('Banner — ошибка объявляется сразу, остальное вежливо', () => {
    render(
      <>
        <Banner tone="bad">Не сохранилось</Banner>
        <Banner tone="warn">Форма в архиве</Banner>
      </>,
    )
    expect(screen.getByRole('alert')).toHaveTextContent('Не сохранилось')
    expect(screen.getByRole('status')).toHaveTextContent('Форма в архиве')
  })

  it('StatusPill — общий StatusBadge с текстом статуса и своим классом', () => {
    render(
      <StatusPill tone="good" className="mine">
        Утверждена
      </StatusPill>,
    )
    const pill = screen.getByText('Утверждена').parentElement!
    expect(pill.className).toContain('mine')
  })

  it('initials — тот же расчёт, что у общего Avatar', () => {
    expect(initials('Анна Соколова')).toBe('АС')
    expect(initials('«Ромашка» ООО')).toBe('РО')
    expect(initials('')).toBe('?')
  })
})
