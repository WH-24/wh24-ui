import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { Avatar, AvatarStack, avatarTint, initialsOf } from './Avatar'

describe('initialsOf', () => {
  it('первые буквы двух первых слов, не больше двух', () => {
    expect(initialsOf('Анна Соколова')).toBe('АС')
    expect(initialsOf('  анна   мария  соколова ')).toBe('АМ')
    expect(initialsOf('Пётр')).toBe('П')
  })

  it('пустое имя — «?»; эмодзи и буквы вне основной плоскости не режутся', () => {
    expect(initialsOf('')).toBe('?')
    expect(initialsOf(undefined)).toBe('?')
    expect(initialsOf('   ')).toBe('?')
    expect(initialsOf('😀 Смайл')).toBe('😀С')
  })
})

describe('Avatar (имя, фото, размер, статус)', () => {
  it('без onClick — картинка с именем, а не кнопка', () => {
    render(<Avatar name="Анна Соколова" />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    const av = screen.getByRole('img', { name: 'Анна Соколова' })
    expect(av.tagName).toBe('SPAN')
    expect(av).toHaveTextContent('АС')
  })

  it('с onClick — кнопка', async () => {
    const onClick = vi.fn()
    render(<Avatar name="Анна Соколова" onClick={onClick} />)
    await userEvent.click(screen.getByRole('button', { name: 'Профиль Анна Соколова' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('фото; не загрузилось — инициалы', () => {
    const { container } = render(<Avatar name="Илья Громов" src="/p.jpg" />)
    const img = container.querySelector('img')!
    expect(img).toHaveAttribute('src', '/p.jpg')
    expect(container).not.toHaveTextContent('ИГ')
    fireEvent.error(img)
    expect(container.querySelector('img')).toBeNull()
    expect(container).toHaveTextContent('ИГ')
  })

  it('статус «в сети» попадает в подпись', () => {
    render(<Avatar name="Павел Ефимов" status="online" />)
    expect(screen.getByRole('img', { name: 'Павел Ефимов, в сети' })).toBeInTheDocument()
  })

  it('цвет по имени устойчив и в пределах пяти тонов; размер меняет класс', () => {
    expect(avatarTint('Анна Соколова')).toBe(avatarTint('Анна Соколова'))
    expect(avatarTint('Анна Соколова')).toBeGreaterThanOrEqual(0)
    expect(avatarTint('Анна Соколова')).toBeLessThan(5)
    const { rerender } = render(<Avatar name="Анна" data-testid="a" />)
    const base = screen.getByTestId('a').className
    rerender(<Avatar name="Анна" size={56} data-testid="a" />)
    expect(screen.getByTestId('a').className).not.toBe(base)
    rerender(<Avatar name="Анна" tint={false} data-testid="a" />)
    expect(screen.getByTestId('a').className).not.toBe(base)
  })
})

describe('AvatarStack', () => {
  const people = ['Анна Соколова', 'Илья Громов', 'Павел Ефимов', 'Ольга Демченко', 'Никита Морозов'].map(
    (name) => ({ name }),
  )

  it('показывает не больше max, остальных — счётчиком', () => {
    render(<AvatarStack people={people} max={3} />)
    const group = screen.getByRole('group')
    expect(group).toHaveAccessibleName(/Анна Соколова.*Никита Морозов/)
    expect(group).toHaveTextContent('АС')
    expect(group).toHaveTextContent('ПЕ')
    expect(group).not.toHaveTextContent('ОД')
    expect(group).toHaveTextContent('+2')
  })

  it('все помещаются — счётчика нет', () => {
    render(<AvatarStack people={people.slice(0, 2)} ariaLabel="Команда" />)
    expect(screen.getByRole('group', { name: 'Команда' })).not.toHaveTextContent('+')
  })
})
