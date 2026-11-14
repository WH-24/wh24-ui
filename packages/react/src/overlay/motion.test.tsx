import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { ActionsMenu } from '../record/ActionsMenu'
import { SegmentedControl } from '../tabs/SegmentedControl'
import { Tabs } from '../tabs/Tabs'
import { ConfirmProvider, useConfirm } from './Confirm'
import { MOTION_FALLBACK, motionEase, motionMs, motionScale } from './motion'

// Единые правила движения: токены в коде — зеркало tokens.css; выход окна
// подтверждения; действие с клавиатуры не анимируется; бегунок вкладок.

let css = ''
beforeAll(async () => {
  const fs = (await import(/* @vite-ignore */ 'node:' + 'fs')) as {
    readFileSync: (p: string, enc: string) => string
  }
  css = fs.readFileSync('../tokens/src/tokens.css', 'utf8')
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('токены движения в коде', () => {
  it('запасные значения совпадают с tokens.css', () => {
    expect(css.length).toBeGreaterThan(1000)
    for (const [name, value] of Object.entries(MOTION_FALLBACK)) {
      const m = css.match(new RegExp(`${name}:\\s*([^;]+);`))
      expect(m?.[1]?.trim(), name).toBe(value)
    }
  })

  it('без tokens.css отдаёт запасные; с переменной на <html> — её значение', () => {
    expect(motionMs('--dur-slow-exit')).toBe(180)
    expect(motionEase('--ease-drawer')).toBe('cubic-bezier(0.32, 0.72, 0, 1)')
    expect(motionScale('--pop-scale')).toBe(0.96)
    document.documentElement.style.setProperty('--dur-slow-exit', '0.5s')
    try {
      expect(motionMs('--dur-slow-exit')).toBe(500)
    } finally {
      document.documentElement.style.removeProperty('--dur-slow-exit')
    }
  })
})

/** Включает Web Animations в тестовом DOM; возвращает запущенные анимации. */
function fakeAnimations() {
  const runs: { el: Element; frames: Keyframe[]; options: KeyframeAnimationOptions; finish: () => void }[] = []
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 Chrome/130')
  const proto = HTMLElement.prototype as unknown as { animate?: unknown }
  const original = proto.animate
  proto.animate = function (this: Element, frames: Keyframe[], options: KeyframeAnimationOptions) {
    let finish = () => {}
    const finished = new Promise<void>((resolve) => {
      finish = resolve
    })
    runs.push({ el: this, frames, options, finish })
    return { finished, cancel() {} }
  }
  return {
    runs,
    restore() {
      proto.animate = original
    },
  }
}

function Ask({ onAnswer }: { onAnswer: (ok: boolean) => void }) {
  const confirm = useConfirm()
  return (
    <button type="button" onClick={async () => onAnswer(await confirm({ message: 'Удалить тег?' }))}>
      спросить
    </button>
  )
}

describe('Confirm: выход', () => {
  it('ответ приходит сразу, окно доигрывает выход и только потом уходит', async () => {
    const anim = fakeAnimations()
    try {
      const onAnswer = vi.fn()
      render(
        <ConfirmProvider>
          <Ask onAnswer={onAnswer} />
        </ConfirmProvider>,
      )
      await userEvent.click(screen.getByRole('button', { name: 'спросить' }))
      const dialog = screen.getByRole('alertdialog')
      await userEvent.click(screen.getByRole('button', { name: 'Удалить' }))

      expect(onAnswer).toHaveBeenCalledWith(true)
      // Окно ещё в DOM: закрыто для кликов и читалки, играет выход.
      expect(dialog.isConnected).toBe(true)
      expect(dialog.parentElement).toHaveAttribute('data-state', 'closed')
      expect(dialog).toHaveAttribute('inert')
      expect(anim.runs).toHaveLength(2)
      for (const run of anim.runs) {
        expect(run.options.duration).toBe(180)
        expect(run.options.easing).toBe('cubic-bezier(0.23, 1, 0.32, 1)')
      }
      expect(anim.runs[1]!.frames[1]).toMatchObject({ opacity: 0, transform: 'scale(0.97)' })

      await act(async () => {
        anim.runs.forEach((r) => r.finish())
      })
      expect(dialog.isConnected).toBe(false)
    } finally {
      anim.restore()
    }
  })

  it('следующий вопрос показывается после выхода предыдущего', async () => {
    const anim = fakeAnimations()
    try {
      function Two() {
        const confirm = useConfirm()
        return (
          <button
            type="button"
            onClick={() => {
              void confirm({ message: 'Первый?' })
              void confirm({ message: 'Второй?' })
            }}
          >
            два
          </button>
        )
      }
      render(
        <ConfirmProvider>
          <Two />
        </ConfirmProvider>,
      )
      await userEvent.click(screen.getByRole('button', { name: 'два' }))
      expect(screen.getByRole('alertdialog')).toHaveTextContent('Первый?')
      await userEvent.click(screen.getByRole('button', { name: 'Отмена' }))
      expect(screen.queryByText('Второй?')).toBeNull()
      await act(async () => {
        anim.runs.forEach((r) => r.finish())
      })
      expect(screen.getByRole('alertdialog')).toHaveTextContent('Второй?')
    } finally {
      anim.restore()
    }
  })
})

describe('всплывающее: клавиатура без анимации', () => {
  const items = [{ id: 'a', label: 'Действие', onSelect: () => {} }]

  it('открыто мышью — анимируется; с клавиатуры — data-instant', async () => {
    render(<ActionsMenu items={items} />)
    const btn = screen.getByRole('button', { name: 'Ещё действия' })
    await userEvent.click(btn)
    expect(screen.getByRole('menu')).not.toHaveAttribute('data-instant')
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).toBeNull()

    btn.focus()
    await userEvent.keyboard('{Enter}')
    expect(screen.getByRole('menu')).toHaveAttribute('data-instant')
  })

  it('закрытие с клавиатуры убирает меню сразу, мышью — после выхода', async () => {
    const anim = fakeAnimations()
    try {
      render(<ActionsMenu items={items} />)
      const btn = screen.getByRole('button', { name: 'Ещё действия' })
      await userEvent.click(btn)
      await userEvent.keyboard('{Escape}')
      expect(screen.queryByRole('menu')).toBeNull()
      expect(anim.runs).toHaveLength(0)

      await userEvent.click(btn)
      const menu = screen.getByRole('menu')
      await userEvent.click(btn)
      expect(menu.isConnected).toBe(true)
      expect(anim.runs).toHaveLength(1)
      expect(anim.runs[0]!.options.duration).toBe(135)
      expect(anim.runs[0]!.frames[1]).toMatchObject({ opacity: 0, transform: 'scale(0.96)' })
      await act(async () => {
        anim.runs[0]!.finish()
      })
      expect(menu.isConnected).toBe(false)
    } finally {
      anim.restore()
    }
  })
})

/** Раскладки в тестовом DOM нет: задаём вкладкам ширину 80 и шаг 100. */
function fakeLayout() {
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (this: HTMLElement) {
    return this.tagName === 'BUTTON' ? 80 : 0
  })
  vi.spyOn(HTMLElement.prototype, 'offsetLeft', 'get').mockImplementation(function (this: HTMLElement) {
    const buttons = Array.from(this.parentElement?.querySelectorAll('button') ?? [])
    return Math.max(0, buttons.indexOf(this as HTMLButtonElement)) * 100
  })
}

function TabsHarness() {
  const [v, setV] = useState('a')
  return (
    <Tabs
      ariaLabel="Разделы"
      idPrefix="t"
      value={v}
      onChange={setV}
      tabs={[
        { id: 'a', label: 'Первая' },
        { id: 'b', label: 'Вторая' },
        { id: 'c', label: 'Третья' },
      ]}
    />
  )
}

describe('Tabs: полоса-индикатор', () => {
  it('без раскладки индикатор выключен, вкладок по-прежнему три', () => {
    render(<TabsHarness />)
    const list = screen.getByRole('tablist')
    expect(list).not.toHaveAttribute('data-indicator')
    expect(screen.getAllByRole('tab')).toHaveLength(3)
  })

  it('клик — полоса переезжает; стрелки — встаёт сразу, фокус и выбор верные', async () => {
    fakeLayout()
    render(<TabsHarness />)
    const list = screen.getByRole('tablist')
    const ind = list.querySelector<HTMLElement>('[role="presentation"]')!
    expect(list).toHaveAttribute('data-indicator')
    // Первая постановка — без перехода.
    expect(ind).toHaveAttribute('data-instant')
    expect(ind.style.transform).toBe('translateX(0px) scaleX(0.8)')

    await userEvent.click(screen.getByRole('tab', { name: 'Третья' }))
    expect(ind.style.transform).toBe('translateX(200px) scaleX(0.8)')
    expect(ind).not.toHaveAttribute('data-instant')

    await userEvent.keyboard('{ArrowLeft}')
    const second = screen.getByRole('tab', { name: 'Вторая' })
    expect(second).toHaveFocus()
    expect(second).toHaveAttribute('aria-selected', 'true')
    expect(ind.style.transform).toBe('translateX(100px) scaleX(0.8)')
    expect(ind).toHaveAttribute('data-instant')

    await userEvent.keyboard('{Home}')
    expect(screen.getByRole('tab', { name: 'Первая' })).toHaveFocus()
    expect(ind.style.transform).toBe('translateX(0px) scaleX(0.8)')
  })
})

describe('SegmentedControl: плашка', () => {
  it('переезжает к выбранному варианту, ширина — по кнопке', async () => {
    fakeLayout()
    function Seg() {
      const [v, setV] = useState('list')
      return (
        <SegmentedControl
          ariaLabel="Вид"
          value={v}
          onChange={setV}
          options={[
            { value: 'list', label: 'Список' },
            { value: 'cards', label: 'Карточки' },
          ]}
        />
      )
    }
    render(<Seg />)
    const group = screen.getByRole('group', { name: 'Вид' })
    const thumb = group.querySelector<HTMLElement>('span[aria-hidden="true"]')!
    expect(group).toHaveAttribute('data-indicator')
    expect(thumb.style.width).toBe('80px')
    expect(thumb.style.transform).toBe('translateX(0px)')

    await userEvent.click(screen.getByRole('button', { name: 'Карточки' }))
    expect(screen.getByRole('button', { name: 'Карточки' })).toHaveAttribute('aria-pressed', 'true')
    expect(thumb.style.transform).toBe('translateX(100px)')
    expect(thumb).not.toHaveAttribute('data-instant')
  })
})
