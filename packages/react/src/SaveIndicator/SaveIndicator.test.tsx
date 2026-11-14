import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { SaveIndicator } from './SaveIndicator'

describe('SaveIndicator', () => {
  it('живая область с подписью состояния; idle — пусто', () => {
    const { rerender, container } = render(<SaveIndicator state="idle" />)
    const el = container.querySelector('[role="status"]')!
    expect(el).toBeEmptyDOMElement()
    rerender(<SaveIndicator state="saving" />)
    expect(el).toHaveTextContent('Сохраняем')
    rerender(<SaveIndicator state="saved" />)
    expect(el).toHaveTextContent('Сохранено')
    rerender(<SaveIndicator state="error" labels={{ error: 'Нет связи' }} />)
    expect(el).toHaveTextContent('Нет связи')
    expect(el).toHaveAttribute('data-state', 'error')
  })
})
