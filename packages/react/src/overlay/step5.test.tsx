import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { Input } from '../form/Input'
import { DateField } from '../form/DateField'
import { Combobox } from '../list/Combobox'
import { ModuleLayout, ModuleNavLink, ModuleNavList } from '../module/ModuleLayout'
import { RecordCard } from '../record/RecordCard'
import { BulkActionBar } from '../BulkActionBar/BulkActionBar'
import { Drawer } from './Drawer'
import { Modal } from './Modal'
import { ToastProvider, useToast } from './Toast'

/** Телефон: медиазапрос листа снизу совпадает. */
function phone(on: boolean) {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: on && q.includes('max-width: 640px'),
    media: q,
    addEventListener() {},
    removeEventListener() {},
  }))
}
afterEach(() => vi.unstubAllGlobals())

const pointer = (el: Element, type: string, init: { clientX?: number; clientY?: number; pointerId?: number }) => {
  const ev = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: init.clientX ?? 0, clientY: init.clientY ?? 0 })
  Object.defineProperty(ev, 'pointerId', { value: init.pointerId ?? 1 })
  Object.defineProperty(ev, 'pointerType', { value: 'touch' })
  fireEvent(el, ev)
}

describe('Лист снизу на телефоне: смахивание за шапку', () => {
  it('Modal: дальше порога — onClose; ближе и медленно — лист возвращается', async () => {
    phone(true)
    const onClose = vi.fn()
    render(
      <Modal open title="Настройки" onClose={onClose}>
        тело
      </Modal>,
    )
    const dialog = screen.getByRole('dialog', { name: 'Настройки' })
    const head = dialog.querySelector('[data-dialog-head]')!
    expect(head).toHaveAttribute('data-swipe')
    pointer(head, 'pointerdown', { clientY: 100 })
    pointer(head, 'pointermove', { clientY: 140 })
    expect(dialog.style.transform).toBe('translateY(40px)')
    // Медленный короткий жест: быстрым 40px закрыли бы (порог скорости).
    await act(async () => {
      await new Promise((r) => setTimeout(r, 150))
    })
    pointer(head, 'pointerup', { clientY: 140 })
    expect(onClose).not.toHaveBeenCalled()
    expect(dialog.style.transform).toBe('')

    pointer(head, 'pointerdown', { clientY: 100 })
    pointer(head, 'pointermove', { clientY: 260 })
    // Второй палец жест не перехватывает.
    pointer(head, 'pointermove', { clientY: 0, pointerId: 2 })
    expect(dialog.style.transform).toBe('translateY(160px)')
    pointer(head, 'pointerup', { clientY: 260 })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('с кнопки шапки жест не начинается; вверх лист не тянется', () => {
    phone(true)
    const onClose = vi.fn()
    render(
      <Drawer open title="Карточка" onClose={onClose}>
        тело
      </Drawer>,
    )
    const dialog = screen.getByRole('dialog', { name: 'Карточка' })
    const head = dialog.querySelector('[data-dialog-head]')!
    pointer(screen.getByRole('button', { name: 'Закрыть' }), 'pointerdown', { clientY: 100 })
    pointer(head, 'pointermove', { clientY: 300 })
    expect(dialog.style.transform).toBe('')
    pointer(head, 'pointerdown', { clientY: 100 })
    pointer(head, 'pointermove', { clientY: 20 })
    expect(dialog.style.transform).toBe('translateY(0px)')
    pointer(head, 'pointercancel', { clientY: 20 })
    expect(onClose).not.toHaveBeenCalled()
  })

  it('без onClose и на широком экране смахивания нет', () => {
    phone(true)
    const { unmount } = render(
      <Modal open title="Идёт запрос">
        тело
      </Modal>,
    )
    expect(screen.getByRole('dialog').querySelector('[data-dialog-head]')).not.toHaveAttribute('data-swipe')
    unmount()
    phone(false)
    const onClose = vi.fn()
    render(
      <Modal open title="Широкий" onClose={onClose}>
        тело
      </Modal>,
    )
    const head = screen.getByRole('dialog').querySelector('[data-dialog-head]')!
    pointer(head, 'pointerdown', { clientY: 100 })
    pointer(head, 'pointermove', { clientY: 400 })
    pointer(head, 'pointerup', { clientY: 400 })
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog').style.transform).toBe('')
  })

  it('Esc и ловушка фокуса работают как раньше', async () => {
    phone(true)
    const onClose = vi.fn()
    render(
      <Modal open title="Окно" onClose={onClose}>
        <button>внутри</button>
      </Modal>,
    )
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

function Toasts() {
  const toast = useToast()
  return (
    <>
      <button onClick={() => toast.info('Первое')}>one</button>
      <button onClick={() => toast.info('Второе', { action: { label: 'Отменить', onClick: () => {} } })}>two</button>
    </>
  )
}

describe('Стопка тостов', () => {
  const stackOf = (text: string) => screen.getByText(text).closest<HTMLElement>('[role="status"]')!

  it('новый тост впереди, прежний — под ним уменьшенным; под курсором стопка раскрыта', async () => {
    render(
      <ToastProvider>
        <Toasts />
      </ToastProvider>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'one' }))
    await userEvent.click(screen.getByRole('button', { name: 'two' }))
    const first = stackOf('Первое')
    const second = stackOf('Второе')
    expect(second).not.toHaveAttribute('data-behind')
    expect(second.style.getPropertyValue('--s')).toBe('1')
    expect(first).toHaveAttribute('data-behind')
    expect(first.style.getPropertyValue('--s')).toBe('0.95')
    expect(first.style.getPropertyValue('--y')).toBe('10px')
    expect(Number(second.style.zIndex)).toBeGreaterThan(Number(first.style.zIndex))

    await userEvent.hover(second)
    expect(first).not.toHaveAttribute('data-behind')
    expect(first.style.getPropertyValue('--s')).toBe('1')
    expect(first.parentElement).toHaveAttribute('data-expanded')
    await userEvent.unhover(second)
    expect(first).toHaveAttribute('data-behind')
    // Фокус внутри — тоже раскрывает.
    act(() => screen.getByRole('button', { name: 'Отменить' }).focus())
    expect(first).not.toHaveAttribute('data-behind')
  })

  it('смахивание вправо: дальше порога — тост уходит, ближе — остаётся; щелчок после жеста не закрывает', async () => {
    render(
      <ToastProvider>
        <Toasts />
      </ToastProvider>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'one' }))
    const t = stackOf('Первое')
    pointer(t, 'pointerdown', { clientX: 10 })
    pointer(t, 'pointermove', { clientX: 40 })
    expect(t).toHaveAttribute('data-drag')
    expect(t.style.getPropertyValue('--dx')).toBe('30px')
    await act(async () => {
      await new Promise((r) => setTimeout(r, 120))
    })
    pointer(t, 'pointerup', { clientX: 40 })
    fireEvent.click(t)
    expect(t.style.getPropertyValue('--dx')).toBe('0px')
    expect(screen.getByText('Первое')).toBeInTheDocument()

    pointer(t, 'pointerdown', { clientX: 10 })
    pointer(t, 'pointermove', { clientX: 120 })
    pointer(t, 'pointerup', { clientX: 120 })
    expect(screen.queryByText('Первое')).not.toBeInTheDocument()
  })

  it('влево тост не тянется; с кнопки жест не начинается', async () => {
    render(
      <ToastProvider>
        <Toasts />
      </ToastProvider>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'two' }))
    const t = stackOf('Второе')
    pointer(t, 'pointerdown', { clientX: 100 })
    pointer(t, 'pointermove', { clientX: 20 })
    pointer(t, 'pointerup', { clientX: 20 })
    expect(screen.getByText('Второе')).toBeInTheDocument()
    pointer(screen.getByRole('button', { name: 'Отменить' }), 'pointerdown', { clientX: 10 })
    pointer(t, 'pointermove', { clientX: 300 })
    expect(t).not.toHaveAttribute('data-drag')
  })
})

describe('ModuleLayout: нижняя навигация на телефоне', () => {
  const nav = (
    <ModuleNavList
      items={[
        { id: 'emp', label: 'Сотрудники отдела', icon: 'users', href: '/emp', shortLabel: 'Люди' },
        { id: 'prj', label: 'Проекты', icon: 'briefcase', href: '/prj' },
      ]}
      activeId="emp"
    />
  )

  it('по умолчанию — как раньше: без признака и переменной высоты', () => {
    const { container } = render(
      <ModuleLayout title="Модуль" icon="grid" nav={nav}>
        тело
      </ModuleLayout>,
    )
    expect(container.firstElementChild).not.toHaveAttribute('data-mobile-nav')
    expect(document.documentElement.style.getPropertyValue('--wh24-bottom-nav-h')).toBe('')
  })

  it('mobileNav="bottom": признак на раскладке, высота для тостов, короткая подпись при полном имени ссылки', () => {
    const { container, unmount } = render(
      <ModuleLayout title="Модуль" icon="grid" nav={nav} mobileNav="bottom">
        тело
      </ModuleLayout>,
    )
    expect(container.firstElementChild).toHaveAttribute('data-mobile-nav', 'bottom')
    expect(document.documentElement.style.getPropertyValue('--wh24-bottom-nav-h')).toBe('56px')
    const link = screen.getByRole('link', { name: 'Сотрудники отдела' })
    expect(link).toHaveTextContent('Люди')
    expect(screen.getByText('Люди')).toHaveAttribute('aria-hidden', 'true')
    unmount()
    expect(document.documentElement.style.getPropertyValue('--wh24-bottom-nav-h')).toBe('')
  })

  it('без shortLabel разметка пункта прежняя', () => {
    const { container } = render(<ModuleNavLink label="Теги" icon="tag" href="/tags" />)
    expect(container.querySelector('[data-has-short]')).toBeNull()
    expect(container.querySelector('[aria-hidden="true"]:not(svg)')).toBeNull()
  })
})

describe('Поле-призрак и отметка сохранения', () => {
  it('variant="ghost" ставит признак; без него разметка прежняя', () => {
    const { container } = render(
      <>
        <Input aria-label="обычное" />
        <Input aria-label="призрак" variant="ghost" />
        <DateField ariaLabel="дата" value="" onChange={() => {}} variant="ghost" />
        <Combobox options={[{ value: 'a', label: 'А' }]} value="a" onChange={() => {}} variant="ghost" />
        <Combobox options={[{ value: 'a', label: 'А' }]} value="a" onChange={() => {}} />
      </>,
    )
    expect(screen.getByLabelText('обычное')).not.toHaveAttribute('data-variant')
    expect(screen.getByLabelText('призрак')).toHaveAttribute('data-variant', 'ghost')
    expect(container.querySelectorAll('[data-variant="ghost"]')).toHaveLength(3)
  })

  it('RecordCard: saveState показывает отметку в шапке; без него её нет', () => {
    const right = { label: 'Поля', tabs: [{ id: 'main', label: 'Сведения' }], render: () => <div>поля</div> }
    const { rerender, container } = render(<RecordCard crumbs={[{ label: 'Проекты' }]} title="Дом" right={right} />)
    expect(container.querySelector('[role="status"][data-state]')).toBeNull()
    rerender(<RecordCard crumbs={[{ label: 'Проекты' }]} title="Дом" right={right} saveState="saved" />)
    expect(container.querySelector('[role="status"][data-state="saved"]')).toHaveTextContent('Сохранено')
  })
})

describe('BulkActionBar', () => {
  it('Esc в панели снимает выбор; keepSelection выбор оставляет', async () => {
    const onClear = vi.fn()
    const exportIt = vi.fn()
    render(
      <BulkActionBar
        selectedIds={['a', 'b']}
        onClear={onClear}
        countLabel={(n) => `Отмечено: ${n}`}
        actions={[{ label: 'Выгрузить', onRun: exportIt, keepSelection: true }]}
      />,
    )
    expect(screen.getByRole('status')).toHaveTextContent('Отмечено: 2')
    await userEvent.click(screen.getByRole('button', { name: 'Выгрузить' }))
    expect(exportIt).toHaveBeenCalledWith(['a', 'b'], undefined)
    expect(onClear).not.toHaveBeenCalled()
    await userEvent.keyboard('{Escape}')
    expect(onClear).toHaveBeenCalledTimes(1)
  })
})
