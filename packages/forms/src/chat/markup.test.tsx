import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'

import { Markup, listSelection, parseBlocks, parseInline, wrapSelection } from './markup.js'

describe('parseInline', () => {
  it('жирный, курсив, зачёркнутый и код', () => {
    expect(parseInline('**а** _б_ ~~в~~ `г`')).toEqual([
      { kind: 'bold', children: [{ kind: 'text', text: 'а' }] },
      { kind: 'text', text: ' ' },
      { kind: 'italic', children: [{ kind: 'text', text: 'б' }] },
      { kind: 'text', text: ' ' },
      { kind: 'strike', children: [{ kind: 'text', text: 'в' }] },
      { kind: 'text', text: ' ' },
      { kind: 'code', text: 'г' },
    ])
  })

  it('подчёркивание внутри слова и незакрытые маркеры — текст', () => {
    expect(parseInline('snake_case_name')).toEqual([{ kind: 'text', text: 'snake_case_name' }])
    expect(parseInline('**не закрыт')).toEqual([{ kind: 'text', text: '**не закрыт' }])
  })

  it('ссылка без хвостовой пунктуации', () => {
    expect(parseInline('см. https://telemost.yandex.ru/j/1.')).toEqual([
      { kind: 'text', text: 'см. ' },
      { kind: 'link', href: 'https://telemost.yandex.ru/j/1' },
      { kind: 'text', text: '.' },
    ])
  })

  it('упоминание берёт самое длинное имя', () => {
    expect(parseInline('@Иванов Пётр, глянь', ['Иванов', 'Иванов Пётр'])).toEqual([
      { kind: 'mention', name: 'Иванов Пётр' },
      { kind: 'text', text: ', глянь' },
    ])
  })
})

describe('parseBlocks', () => {
  it('строки «- » собираются в один список', () => {
    const b = parseBlocks('Итог:\n- раз\n- два\nконец')
    expect(b.map((x) => x.kind)).toEqual(['para', 'list', 'para'])
    expect(b[1].kind === 'list' && b[1].items.length).toBe(2)
  })
})

describe('Markup', () => {
  it('HTML из текста не исполняется', () => {
    const { container } = render(<Markup text={'<img src=x onerror=alert(1)> **ок**'} />)
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('strong')?.textContent).toBe('ок')
  })

  it('javascript: не становится ссылкой', () => {
    const { container } = render(<Markup text="javascript:alert(1)" />)
    expect(container.querySelector('a')).toBeNull()
  })
})

describe('кнопки форматирования', () => {
  it('оборачивают выделение', () => {
    expect(wrapSelection('сделай срочно', 7, 13, '**')).toEqual({ value: 'сделай **срочно**', start: 9, end: 15 })
  })
  it('делают из строк список, не задваивая маркер', () => {
    expect(listSelection('раз\n- два', 0, 8).value).toBe('- раз\n- два')
  })
})
