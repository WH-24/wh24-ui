import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { BrainComposer } from './BrainComposer'

const file = (name: string, type = 'text/plain') => new File(['x'], name, { type })

describe('BrainComposer', () => {
  it('Enter отправляет, Shift+Enter — нет, пустое не уходит', () => {
    const onSend = vi.fn()
    const { rerender } = render(<BrainComposer value="" onChange={() => {}} onSend={onSend} />)
    const ta = screen.getByRole('textbox', { name: 'Сообщение ассистенту' })
    fireEvent.keyDown(ta, { key: 'Enter' })
    expect(onSend).not.toHaveBeenCalled()

    rerender(<BrainComposer value="вопрос" onChange={() => {}} onSend={onSend} />)
    fireEvent.keyDown(ta, { key: 'Enter', shiftKey: true })
    expect(onSend).not.toHaveBeenCalled()
    fireEvent.keyDown(ta, { key: 'Enter' })
    expect(onSend).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Отправить' }))
    expect(onSend).toHaveBeenCalledTimes(2)
  })

  it('пока идёт ответ — отправка заблокирована, поле живое; onStop даёт «Остановить»', () => {
    const onSend = vi.fn()
    const onStop = vi.fn()
    const { rerender } = render(<BrainComposer value="ещё" onChange={() => {}} onSend={onSend} busy />)
    const ta = screen.getByRole('textbox')
    expect(ta).not.toBeDisabled()
    fireEvent.keyDown(ta, { key: 'Enter' })
    expect(onSend).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Ассистент отвечает' })).toBeDisabled()

    rerender(<BrainComposer value="ещё" onChange={() => {}} onSend={onSend} busy onStop={onStop} />)
    fireEvent.click(screen.getByRole('button', { name: 'Остановить' }))
    expect(onStop).toHaveBeenCalledTimes(1)
  })

  it('disabledReason выключает поле и показывает причину', () => {
    render(
      <BrainComposer
        value=""
        onChange={() => {}}
        onSend={() => {}}
        disabledReason="Дневной лимит исчерпан"
      />,
    )
    expect(screen.getByRole('textbox')).toBeDisabled()
    expect(screen.getByRole('status')).toHaveTextContent('Дневной лимит исчерпан')
    expect(screen.getByRole('button', { name: 'Отправить' })).toBeDisabled()
  })

  it('вложения: чипы, удаление, перетаскивание и вставка из буфера идут в onAddFiles', () => {
    const onAddFiles = vi.fn()
    const onRemoveFile = vi.fn()
    const { container } = render(
      <BrainComposer
        value=""
        onChange={() => {}}
        onSend={() => {}}
        files={[
          { id: 'a', name: 'смета.xlsx', mime: 'application/vnd.ms-excel', size: 2048 },
          {
            id: 'b',
            name: 'фото.png',
            mime: 'image/png',
            size: 10,
            previewUrl: 'data:image/png;base64,AA==',
          },
        ]}
        onAddFiles={onAddFiles}
        onRemoveFile={onRemoveFile}
        maxFiles={3}
      />,
    )
    expect(screen.getByText('смета.xlsx')).toBeInTheDocument()
    expect(container.querySelector('img')).toHaveAttribute('src', 'data:image/png;base64,AA==')
    fireEvent.click(screen.getByRole('button', { name: 'Убрать «смета.xlsx»' }))
    expect(onRemoveFile).toHaveBeenCalledWith('a')

    const root = container.firstElementChild as HTMLElement
    const dropped = [file('a.txt'), file('b.txt'), file('c.txt')]
    fireEvent.drop(root, { dataTransfer: { files: dropped, types: ['Files'] } })
    // Потолок 3, два уже есть — проходит один.
    expect(onAddFiles).toHaveBeenCalledWith([dropped[0]])

    fireEvent.paste(screen.getByRole('textbox'), {
      clipboardData: { files: [file('shot.png', 'image/png')] },
    })
    expect(onAddFiles).toHaveBeenCalledTimes(2)
    expect(onAddFiles.mock.calls[1]![0]).toHaveLength(1)

    expect(screen.getByRole('button', { name: 'Приложить файл' })).toBeInTheDocument()
  })

  it('без onAddFiles скрепки нет; «+», «@», «/» — только от своих колбэков', () => {
    const onContext = vi.fn()
    const onMention = vi.fn()
    const { rerender } = render(<BrainComposer value="" onChange={() => {}} onSend={() => {}} />)
    expect(screen.queryByRole('button', { name: 'Приложить файл' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Добавить контекст' })).toBeNull()

    rerender(
      <BrainComposer
        value=""
        onChange={() => {}}
        onSend={() => {}}
        onContext={onContext}
        onMention={onMention}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Добавить контекст' }))
    fireEvent.click(screen.getByRole('button', { name: 'Упомянуть' }))
    expect(onContext).toHaveBeenCalledTimes(1)
    expect(onMention).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('button', { name: 'Навык' })).toBeNull()
  })
})
