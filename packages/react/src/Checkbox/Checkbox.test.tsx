import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createRef, useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { Checkbox } from './Checkbox'

describe('Checkbox', () => {
  it('настоящий checkbox с именем из подписи; щелчок по подписи переключает', async () => {
    const onCheckedChange = vi.fn()
    function Harness() {
      const [on, setOn] = useState(false)
      return (
        <Checkbox
          checked={on}
          onCheckedChange={(v) => {
            setOn(v)
            onCheckedChange(v)
          }}
        >
          Только мои
        </Checkbox>
      )
    }
    render(<Harness />)
    const cb = screen.getByRole('checkbox', { name: 'Только мои' })
    expect(cb).not.toBeChecked()
    await userEvent.click(screen.getByText('Только мои'))
    expect(onCheckedChange).toHaveBeenLastCalledWith(true)
    expect(cb).toBeChecked()
  })

  it('пробел переключает с клавиатуры', async () => {
    const onChange = vi.fn()
    render(<Checkbox onChange={onChange}>Согласен</Checkbox>)
    screen.getByRole('checkbox').focus()
    await userEvent.keyboard(' ')
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('indeterminate ставится свойством и снимается', () => {
    const { rerender } = render(
      <Checkbox indeterminate checked={false} onChange={() => {}} aria-label="Выбрать все" />,
    )
    const cb = screen.getByRole('checkbox', { name: 'Выбрать все' }) as HTMLInputElement
    expect(cb.indeterminate).toBe(true)
    rerender(<Checkbox checked={false} onChange={() => {}} aria-label="Выбрать все" />)
    expect(cb.indeterminate).toBe(false)
  })

  it('disabled не переключается', async () => {
    const onChange = vi.fn()
    render(
      <Checkbox disabled onChange={onChange}>
        Недоступно
      </Checkbox>,
    )
    await userEvent.click(screen.getByText('Недоступно'))
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByRole('checkbox')).toBeDisabled()
  })

  it('ref и атрибуты — на input, className — на корне', () => {
    const ref = createRef<HTMLInputElement>()
    const { container } = render(
      <Checkbox ref={ref} name="agree" className="mine">
        Да
      </Checkbox>,
    )
    expect(ref.current).toBe(screen.getByRole('checkbox'))
    expect(ref.current).toHaveAttribute('name', 'agree')
    expect(container.firstElementChild).toHaveClass('mine')
  })

  it('«выбрана часть» переживает щелчок, пока хозяин её не снял', async () => {
    render(<Checkbox indeterminate checked={false} onChange={() => {}} aria-label="Все" />)
    const box = screen.getByRole('checkbox') as HTMLInputElement
    expect(box.indeterminate).toBe(true)
    await userEvent.click(box)
    // Браузер на щелчке сбрасывает свойство; проп не менялся — возвращаем.
    expect(box.indeterminate).toBe(true)
    expect(box).toHaveAttribute('data-indeterminate')
  })
})
