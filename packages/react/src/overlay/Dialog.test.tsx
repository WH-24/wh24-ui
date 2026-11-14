import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { Spinner } from '../Spinner/Spinner'
import { CheckboxMark } from '../Checkbox/Checkbox'
import { Loader } from '../page/Loader'
import { DialogBody, DialogClose, DialogFooter, DialogHeader } from './Dialog'
import { Modal } from './Modal'

describe('части окна', () => {
  it('шапка: заголовок с id, действия и «Закрыть»', async () => {
    const onClose = vi.fn()
    render(
      <DialogHeader title="Настройки" titleId="t1" onClose={onClose} actions={<button type="button">Экспорт</button>} />,
    )
    expect(screen.getByRole('heading', { level: 2, name: 'Настройки' })).toHaveAttribute('id', 't1')
    expect(screen.getByRole('button', { name: 'Экспорт' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Закрыть' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('без onClose крестика нет; closeDisabled — крестик недоступен', () => {
    const { rerender } = render(<DialogHeader title="Окно" />)
    expect(screen.queryByRole('button', { name: 'Закрыть' })).toBeNull()
    rerender(<DialogHeader title="Окно" onClose={() => {}} closeDisabled />)
    expect(screen.getByRole('button', { name: 'Закрыть' })).toBeDisabled()
  })

  it('тело и подвал принимают свой класс и атрибуты', () => {
    render(
      <>
        <DialogBody id="b" className="mine">
          Текст
        </DialogBody>
        <DialogFooter data-testid="f">
          <button type="button">Ок</button>
        </DialogFooter>
      </>,
    )
    expect(screen.getByText('Текст')).toHaveAttribute('id', 'b')
    expect(screen.getByText('Текст').className).toContain('mine')
    expect(screen.getByTestId('f')).toContainElement(screen.getByRole('button', { name: 'Ок' }))
  })

  it('DialogClose — общий IconButton с подписью', () => {
    render(<DialogClose onClick={() => {}} label="Свернуть" />)
    expect(screen.getByRole('button', { name: 'Свернуть' })).toHaveAttribute('type', 'button')
  })
})

describe('Modal: описание, busy и клавиши окна', () => {
  it('description связан с окном; busy блокирует Esc, крестик и клик мимо', async () => {
    const onClose = vi.fn()
    const { rerender } = render(
      <Modal open onClose={onClose} title="Импорт" description="Файл проверяется" busy>
        <p>Тело</p>
      </Modal>,
    )
    const dialog = screen.getByRole('dialog', { name: 'Импорт' })
    expect(dialog).toHaveAccessibleDescription('Файл проверяется')
    expect(screen.getByRole('button', { name: 'Закрыть' })).toBeDisabled()
    await userEvent.keyboard('{Escape}')
    await userEvent.click(dialog.parentElement!)
    expect(onClose).not.toHaveBeenCalled()

    rerender(
      <Modal open onClose={onClose} title="Импорт">
        <p>Тело</p>
      </Modal>,
    )
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('onKeyDown окна получает клавиши раньше общих обработчиков', async () => {
    const onKeyDown = vi.fn()
    render(
      <Modal open title="Окно" onKeyDown={onKeyDown} className="wide">
        <input aria-label="Поле" />
      </Modal>,
    )
    expect(screen.getByRole('dialog').className).toContain('wide')
    await userEvent.type(screen.getByLabelText('Поле'), 'a')
    expect(onKeyDown).toHaveBeenCalled()
  })
})

describe('Spinner', () => {
  it('без подписи скрыт от читалки; с подписью — role=status', () => {
    const { container, rerender } = render(<Spinner />)
    const el = container.firstElementChild!
    expect(el).toHaveAttribute('aria-hidden', 'true')
    expect(el).not.toHaveAttribute('data-size')
    rerender(<Spinner label="Загрузка" size={24} className="mine" />)
    const status = screen.getByRole('status', { name: 'Загрузка' })
    expect(status).toHaveAttribute('data-size', '24')
    expect(status.className).toContain('mine')
  })

  it('Loader рисует то же кольцо', () => {
    render(<Loader label="Грузим" />)
    const loader = screen.getByRole('status', { name: 'Грузим' })
    expect(loader.querySelector('[data-size="32"]')).not.toBeNull()
  })
})

describe('CheckboxMark', () => {
  it('рисунок без поля ввода, состояние — атрибутом', () => {
    const { container, rerender } = render(<CheckboxMark checked />)
    const box = container.firstElementChild!
    expect(box).toHaveAttribute('data-checked')
    expect(box).toHaveAttribute('aria-hidden', 'true')
    expect(container.querySelector('input')).toBeNull()
    rerender(<CheckboxMark indeterminate />)
    expect(container.firstElementChild).toHaveAttribute('data-indeterminate')
    expect(container.firstElementChild).not.toHaveAttribute('data-checked')
  })
})
