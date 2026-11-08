import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { Markdown } from './Markdown'
import { splitCitations } from './citations'

describe('splitCitations', () => {
  it('делит текст на куски и номера, чужие номера оставляет текстом', () => {
    expect(splitCitations('см. [1] и [2], но не [9]', (n) => n <= 2)).toEqual([
      'см. ',
      { n: 1 },
      ' и ',
      { n: 2 },
      ', но не [9]',
    ])
  })
  it('без цитат — одна строка', () => {
    expect(splitCitations('просто текст', () => true)).toEqual(['просто текст'])
  })
})

describe('Markdown', () => {
  it('последнее слово и номер источника — один неразрывный кусок', () => {
    const { container } = render(
      <Markdown text="Лид поставлен на стоп [2]." citations={[{ n: 2, title: 'Лид' }]} />,
    )
    const chip = container.querySelector('[aria-label^="Источник 2"]')!
    const group = chip.parentElement!
    expect(group.tagName).toBe('SPAN')
    expect(group.textContent).toBe('стоп\u00a02')
    expect(container.querySelector('p')!.textContent).toBe('Лид поставлен на стоп\u00a02.')
  })

  it('цитаты [n] из списка источников → чипы, клик отдаёт номер', () => {
    const onCitationClick = vi.fn()
    render(
      <Markdown
        text="Срок — 12 мая [1]. Бюджет согласован [2], а [7] не источник."
        citations={[
          { n: 1, title: 'Лид: Офис на Мясницкой' },
          { n: 2, title: 'ФМ 2026' },
        ]}
        onCitationClick={onCitationClick}
      />,
    )
    const chip1 = screen.getByRole('button', { name: 'Источник 1: Лид: Офис на Мясницкой' })
    expect(chip1).toHaveTextContent('1')
    expect(screen.getByRole('button', { name: 'Источник 2: ФМ 2026' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Источник 7/ })).toBeNull()
    expect(screen.getByText(/\[7\] не источник/)).toBeInTheDocument()
    fireEvent.click(chip1)
    expect(onCitationClick).toHaveBeenCalledWith(1)
  })

  it('без onCitationClick чипы — просто пометки, без кнопок', () => {
    render(<Markdown text="Факт [1]." citations={[{ n: 1, title: 'Вики' }]} />)
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByLabelText('Источник 1: Вики')).toHaveTextContent('1')
  })

  it('внутри кода [n] не трогается', () => {
    render(
      <Markdown
        text="Массив `a[1]` и блок:\n\n```\nx[2]\n```"
        citations={[{ n: 1 }, { n: 2 }]}
        onCitationClick={() => {}}
      />,
    )
    expect(screen.queryByRole('button', { name: /Источник/ })).toBeNull()
    expect(screen.getByText('a[1]')).toBeInTheDocument()
  })

  it('внешняя ссылка — новая вкладка и noreferrer; внутренняя — onNavigate без перехода', () => {
    const onNavigate = vi.fn()
    render(<Markdown text="[Сайт](https://example.com) и [лид](/oup/leads/7)" onNavigate={onNavigate} />)
    const ext = screen.getByRole('link', { name: 'Сайт' })
    expect(ext).toHaveAttribute('target', '_blank')
    expect(ext.getAttribute('rel')).toContain('noreferrer')
    const int = screen.getByRole('link', { name: 'лид' })
    expect(int).not.toHaveAttribute('target')
    fireEvent.click(int)
    expect(onNavigate).toHaveBeenCalledWith('/oup/leads/7')
  })

  it('сырой HTML остаётся текстом, картинка — ссылкой', () => {
    const { container } = render(
      <Markdown text={'<script>alert(1)</script> и <b>жирно</b>\n\n![схема](https://x/y.png)'} />,
    )
    expect(container.querySelector('script')).toBeNull()
    expect(container.querySelector('b')).toBeNull()
    expect(container.querySelector('img')).toBeNull()
    expect(screen.getByRole('link', { name: 'схема' })).toHaveAttribute('href', 'https://x/y.png')
  })
})

describe('Markdown — файлы из ответа', () => {
  const origCreate = URL.createObjectURL
  const origRevoke = URL.revokeObjectURL
  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => 'blob:x')
    URL.revokeObjectURL = vi.fn()
  })
  afterEach(() => {
    URL.createObjectURL = origCreate
    URL.revokeObjectURL = origRevoke
  })

  it('под таблицей — «Скачать .xlsx», клик собирает книгу из строк таблицы', () => {
    const clicks: string[] = []
    const spy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clicks.push(this.download)
    })
    render(<Markdown text={'| Проект | Часы |\n|---|---|\n| Офис | 12 |\n| Школа | 7,5 |'} />)
    expect(screen.getByRole('table')).toBeInTheDocument()
    const btn = screen.getByRole('button', { name: /Скачать \.xlsx/ })
    fireEvent.click(btn)
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1)
    expect(clicks[0]).toMatch(/^таблица_\d{4}-\d{2}-\d{2}_\d{4}\.xlsx$/)
    spy.mockRestore()
  })

  it('под блоком кода — «Скачать .csv» по языку', () => {
    render(<Markdown text={'```csv\na;b\n1;2\n```'} />)
    expect(screen.getByRole('button', { name: /Скачать \.csv/ })).toBeInTheDocument()
  })
})
