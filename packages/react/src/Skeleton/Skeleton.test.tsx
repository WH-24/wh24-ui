import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Skeleton, SkeletonRow, SkeletonText } from './Skeleton'

describe('Skeleton', () => {
  it('скрыта от читалки; размеры — из пропсов', () => {
    const { container } = render(<Skeleton width={120} height={14} className="mine" />)
    const el = container.firstElementChild as HTMLElement
    expect(el).toHaveAttribute('aria-hidden', 'true')
    expect(el).toHaveClass('mine')
    expect(el.style.width).toBe('120px')
    expect(el.style.height).toBe('14px')
  })

  it('круг: высота равна ширине', () => {
    const { container } = render(<Skeleton circle width={44} />)
    const el = container.firstElementChild as HTMLElement
    expect(el.style.width).toBe('44px')
    expect(el.style.height).toBe('44px')
  })

  it('SkeletonText — столько строк, сколько просили; последняя короче', () => {
    const { container } = render(<SkeletonText lines={4} />)
    const lines = container.firstElementChild!.children
    expect(lines).toHaveLength(4)
    expect((lines[3] as HTMLElement).style.width).toBe('60%')
  })

  it('SkeletonRow — круг и две полосы; без аватара — только полосы', () => {
    const { container, rerender } = render(<SkeletonRow />)
    expect(container.firstElementChild!.children).toHaveLength(2)
    rerender(<SkeletonRow avatar={false} />)
    expect(container.firstElementChild!.children).toHaveLength(1)
  })
})
