import { describe, expect, it } from 'vitest'

import { htmlForCopy, stripCitations } from './copy.js'
import { renumberCitations } from './markdown/citations.js'

describe('renumberCitations', () => {
  it('нумерует источники по порядку ссылок в тексте', () => {
    const r = renumberCitations('Лид [19] и проект [37]; снова лид [19], ещё [38].', [
      { n: 37, title: 'Проект' },
      { n: 19, title: 'Лид' },
      { n: 38, title: 'Договор' },
      { n: 52, title: 'Без ссылки' },
    ])
    expect(r.text).toBe('Лид [1] и проект [2]; снова лид [1], ещё [3].')
    expect(r.citations?.map((c) => [c.n, c.title])).toEqual([
      [1, 'Лид'],
      [2, 'Проект'],
      [3, 'Договор'],
      [4, 'Без ссылки'],
    ])
  })

  it('номера, которых нет среди источников, не трогает', () => {
    expect(renumberCitations('Пункт [7] и [2]', [{ n: 2 }]).text).toBe('Пункт [7] и [1]')
  })

  it('без источников возвращает текст как есть', () => {
    expect(renumberCitations('Текст [3]', undefined)).toEqual({ text: 'Текст [3]', citations: undefined })
    expect(renumberCitations('Текст [3]', [])).toEqual({ text: 'Текст [3]', citations: [] })
  })
})

describe('stripCitations', () => {
  it('убирает номера источников, но не ссылки markdown', () => {
    expect(stripCitations('Стоп [37]. Договор [1][2], см. [вики](/wiki/a).')).toBe(
      'Стоп. Договор, см. [вики](/wiki/a).',
    )
  })
})

describe('htmlForCopy', () => {
  it('вырезает кнопки (чипы источников, «Скачать .xlsx»)', () => {
    const el = document.createElement('div')
    el.innerHTML = '<p>Текст <button>3</button></p><table><tr><td>1</td></tr></table><button>Скачать .xlsx</button>'
    expect(htmlForCopy(el)).toBe('<p>Текст </p><table><tbody><tr><td>1</td></tr></tbody></table>')
    expect(el.querySelectorAll('button')).toHaveLength(2)
  })
})
