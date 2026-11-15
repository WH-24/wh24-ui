import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { Avatar } from './Avatar'

describe('Avatar', () => {
  it('renders initials', () => {
    render(<Avatar initials="АА" />)
    expect(screen.getByText('АА')).toBeInTheDocument()
  })

  it('uses ariaLabel when provided', () => {
    render(<Avatar initials="АА" ariaLabel="Профиль Анны" />)
    expect(screen.getByRole('img', { name: 'Профиль Анны' })).toBeInTheDocument()
  })

  it('без обработчика — не кнопка: картинка с подписью из инициалов', () => {
    render(<Avatar initials="ЕП" />)
    expect(screen.getByRole('img', { name: 'ЕП' })).toBeInTheDocument()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('fires onClick', async () => {
    const onClick = vi.fn()
    render(<Avatar initials="АА" onClick={onClick} />)
    await userEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})

describe('Avatar: худшие данные', () => {
  it('готовые инициалы длиннее двух символов обрезаются', () => {
    render(<Avatar initials="Wiśniewska" />)
    expect(screen.getByRole('img')).toHaveTextContent(/^Wi$/)
  })

  it('пустые инициалы — «?», а не пустой круг', () => {
    render(<Avatar initials="  " />)
    expect(screen.getByRole('img', { name: '?' })).toHaveTextContent('?')
  })

  it('эмодзи не режется пополам', () => {
    render(<Avatar initials="🦊Лиса" />)
    expect(screen.getByRole('img')).toHaveTextContent(/^🦊Л$/)
  })
})

describe('Avatar: свой размер и квадрат', () => {
  it('размер вне макета — ширина, высота и шрифт в пропорции', () => {
    render(<Avatar name="Анна Соколова" size={104} />)
    const av = screen.getByRole('img', { name: 'Анна Соколова' })
    expect(av).toHaveStyle({ width: '104px', height: '104px', fontSize: '40px' })
  })

  it('размер макета — без встроенных размеров', () => {
    render(<Avatar name="Анна Соколова" size={44} />)
    expect(screen.getByRole('img').style.width).toBe('')
  })

  it('квадрат для компании', () => {
    render(<Avatar name="Ромашка" square />)
    expect(screen.getByRole('img').className).toMatch(/square/)
  })
})
