import { describe, expect, it } from 'vitest'
import { catalogOptions } from './format.js'

// Справочник = общий список вариантов полей-списков (владелец 03.11.2026):
// у строки, как у варианта своего списка, — подпись, иконка и цвет.
describe('catalogOptions', () => {
  const cat = {
    id: 'c1',
    key: 'stages',
    name: 'Стадии',
    display_column: 'name',
    items: [
      { id: 'i1', values: { name: 'Концепция', icon: 'lucide:Lightbulb', color: 'yellow' } },
      { id: 'i2', values: { name: 'Эскиз' } },
      { id: 'i3', values: { name: '', color: 'неизвестный' } },
    ],
  }

  it('значение — id строки, подпись, иконка и цвет из строки', () => {
    expect(catalogOptions(cat)).toEqual([
      { value: 'i1', label: 'Концепция', icon: 'lucide:Lightbulb', color: 'yellow' },
      { value: 'i2', label: 'Эскиз' },
      // Пустая подпись — id; цвет не из палитры не берём.
      { value: 'i3', label: 'i3' },
    ])
  })
})
