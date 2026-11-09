import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { ConfirmProvider, useAlert, useConfirm } from './Confirm'
import { Drawer } from './Drawer'
import { Modal } from './Modal'
import { ToastProvider, useToast } from './Toast'

function ModalHarness({ onClose }: { onClose: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button onClick={() => setOpen(true)}>Открыть</button>
      <Modal
        open={open}
        title="Новый тег"
        onClose={() => {
          onClose()
          setOpen(false)
        }}
        footer={<button className="btn btn-primary">Создать</button>}
      >
        <input aria-label="Название" />
      </Modal>
    </>
  )
}

describe('Modal', () => {
  it('названное окно, Esc закрывает, фокус возвращается на кнопку', async () => {
    const onClose = vi.fn()
    render(<ModalHarness onClose={onClose} />)
    const opener = screen.getByRole('button', { name: 'Открыть' })
    await userEvent.click(opener)
    expect(screen.getByRole('dialog', { name: 'Новый тег' })).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(opener).toHaveFocus()
  })

  it('Tab ходит по кругу внутри окна', async () => {
    render(<ModalHarness onClose={() => {}} />)
    await userEvent.click(screen.getByRole('button', { name: 'Открыть' }))
    const dialog = screen.getByRole('dialog')
    for (let i = 0; i < 5; i++) {
      await userEvent.tab()
      expect(dialog.contains(document.activeElement)).toBe(true)
    }
  })

  it('без onClose нет «Закрыть»', () => {
    render(
      <Modal open title="Идёт сохранение">
        …
      </Modal>,
    )
    expect(screen.queryByRole('button', { name: 'Закрыть' })).not.toBeInTheDocument()
  })
})

describe('Drawer', () => {
  it('модальная боковая панель с названием и закрытием', async () => {
    const onClose = vi.fn()
    render(
      <Drawer open title="Назначение" onClose={onClose}>
        тело
      </Drawer>,
    )
    expect(screen.getByRole('dialog', { name: 'Назначение' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Закрыть' }))
    expect(onClose).toHaveBeenCalled()
  })
})

function ConfirmHarness({ onResult }: { onResult: (v: unknown) => void }) {
  const confirm = useConfirm()
  const notify = useAlert()
  return (
    <>
      <button onClick={async () => onResult(await confirm({ message: 'Удалить тег «Сталь»?' }))}>Удалить</button>
      <button onClick={async () => onResult(await notify('Не удалось', 'Ошибка'))}>Сообщить</button>
    </>
  )
}

describe('ConfirmProvider', () => {
  it('согласие — true; фокус на кнопке согласия', async () => {
    const onResult = vi.fn()
    render(
      <ConfirmProvider>
        <ConfirmHarness onResult={onResult} />
      </ConfirmProvider>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Удалить' }))
    const dialog = screen.getByRole('alertdialog', { name: 'Подтверждение' })
    expect(dialog).toHaveTextContent('Удалить тег «Сталь»?')
    const ok = screen.getAllByRole('button', { name: 'Удалить' }).at(-1)!
    expect(ok).toHaveFocus()
    await userEvent.click(ok)
    expect(onResult).toHaveBeenCalledWith(true)
  })

  it('Esc — отмена (false)', async () => {
    const onResult = vi.fn()
    render(
      <ConfirmProvider>
        <ConfirmHarness onResult={onResult} />
      </ConfirmProvider>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Удалить' }))
    await userEvent.keyboard('{Escape}')
    expect(onResult).toHaveBeenCalledWith(false)
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('сообщение — одна кнопка «Понятно»', async () => {
    const onResult = vi.fn()
    render(
      <ConfirmProvider>
        <ConfirmHarness onResult={onResult} />
      </ConfirmProvider>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Сообщить' }))
    expect(screen.getByRole('alertdialog', { name: 'Ошибка' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Отмена' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Понятно' }))
    expect(onResult).toHaveBeenCalledWith(undefined)
  })
})

function ToastHarness() {
  const toast = useToast()
  return (
    <>
      <button onClick={() => toast.success('Тег сохранён')}>ok</button>
      <button onClick={() => toast.error('Не сохранилось')}>err</button>
    </>
  )
}

describe('ToastProvider', () => {
  it('успех — status, ошибка — alert, исчезают сами', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    render(
      <ToastProvider>
        <ToastHarness />
      </ToastProvider>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'ok' }))
    await userEvent.click(screen.getByRole('button', { name: 'err' }))
    expect(screen.getByRole('status')).toHaveTextContent('Тег сохранён')
    expect(screen.getByRole('alert')).toHaveTextContent('Не сохранилось')
    act(() => {
      vi.advanceTimersByTime(3100)
    })
    expect(screen.queryByText('Тег сохранён')).not.toBeInTheDocument()
    vi.useRealTimers()
  })
})
