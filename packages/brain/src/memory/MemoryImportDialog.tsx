import { useEffect, useMemo, useState } from 'react'
import { FieldRow, Textarea } from '@wowhaus-24/ui-react'

import { BrainDialog } from '../fields/Dialog.js'
import { brainErrorText } from '../fields/errors.js'
import { DEFAULT_MEMORY_LIMITS, type MemoryImportResult } from './types.js'
import { IMPORT_MAX_LINES, linesLabel, parseImportText } from './labels.js'
import type { MemoryApi } from './client.js'
import styles from './memory.module.css'

export interface MemoryImportDialogProps {
  api: { memory: Pick<MemoryApi, 'importText'> }
  open: boolean
  onClose: () => void
  /** Предел длины одной записи (`limits.max_text`). */
  maxText?: number
  /** Импорт прошёл: хост (или `MemoryPanel`) обновляет список. */
  onImported?: (result: MemoryImportResult) => void
}

/**
 * «Импорт памяти»: вставьте текст из другого ассистента (ChatGPT, Claude, Gemini —
 * «что ты обо мне помнишь»). Строки и маркированные пункты станут записями-фактами;
 * до отправки показано, сколько строк распознано.
 */
export function MemoryImportDialog({ api, open, onClose, maxText = DEFAULT_MEMORY_LIMITS.max_text, onImported }: MemoryImportDialogProps) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setText('')
    setError('')
    setBusy(false)
  }, [open])

  const parsed = useMemo(() => parseImportText(text, maxText), [text, maxText])

  const submit = async () => {
    if (parsed.lines.length === 0) return
    setBusy(true)
    setError('')
    try {
      const res = await api.memory.importText(text)
      onImported?.(res)
      onClose()
    } catch (e) {
      setError(brainErrorText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <BrainDialog
      open={open}
      onClose={onClose}
      title="Импорт памяти"
      description="Перенесите то, что о вас помнит другой ассистент: попросите его «выпиши всё, что ты обо мне помнишь», и вставьте ответ сюда."
      busy={busy}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
            Отмена
          </button>
          <button type="button" className="btn btn-primary" onClick={() => void submit()} disabled={busy || parsed.lines.length === 0}>
            {busy ? 'Импортирую…' : parsed.lines.length > 0 ? `Импортировать (${parsed.lines.length})` : 'Импортировать'}
          </button>
        </>
      }
    >
      <FieldRow
        label="Текст для импорта"
        htmlFor="memory-import-text"
        span={12}
        hint="Каждая строка или пункт списка станет отдельной записью. Дубли и пустые строки пропускаются."
      >
        <Textarea
          id="memory-import-text"
          rows={9}
          value={text}
          placeholder={'- Любит короткие ответы без вступлений\n- Работает над проектом «Дом у озера»'}
          onChange={(e) => {
            setText(e.target.value)
            setError('')
          }}
        />
      </FieldRow>
      <p className={styles.importCount} role="status">
        {parsed.lines.length === 0
          ? 'Пока ничего не распознано.'
          : `Распознано: ${linesLabel(parsed.lines.length)}.`}
        {parsed.overLimit > 0 && ` За один раз принимается до ${IMPORT_MAX_LINES}: ещё ${parsed.overLimit} не войдёт — импортируйте их отдельно.`}
        {parsed.tooLong > 0 && ` Слишком длинных (больше ${maxText} знаков): ${parsed.tooLong} — они могут быть обрезаны или пропущены.`}
      </p>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </BrainDialog>
  )
}
