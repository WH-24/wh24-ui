import type { ReactNode } from 'react'

import { BrainIcon } from '../icons.js'
import styles from './meta.module.css'

export interface AiLabelProps {
  /** Кто спросил — «по запросу Петровой». */
  by?: string
  /** Модель или агент, если нужно показать. */
  model?: string
  children?: ReactNode
  className?: string
}

/** Пометка «Ответ ИИ · по запросу …» над ответом в ленте или комментарии. */
export function AiLabel({ by, model, children, className }: AiLabelProps) {
  return (
    <span className={[styles.aiLabel, className].filter(Boolean).join(' ')}>
      <BrainIcon name="sparkle" size={13} />
      <span>Ответ ИИ</span>
      {by && <span className={styles.labelDim}>· по запросу {by}</span>}
      {model && <span className={styles.labelDim}>· {model}</span>}
      {children}
    </span>
  )
}
