import type { ReactNode } from 'react'

import { BrainIcon } from '../icons.js'
import styles from './messages.module.css'

export interface UserMessageAttachment {
  id: string
  name: string
  mime?: string
  size?: number
  /** Ссылка на файл или превью картинки, если уже есть. */
  url?: string
}

export interface UserMessageProps {
  text: string
  attachments?: UserMessageAttachment[]
  /** Подпись под сообщением: время, «из карточки лида …». */
  meta?: ReactNode
  className?: string
}

/** Вопрос пользователя — компактно, справа, на светлой подложке. */
export function UserMessage({ text, attachments, meta, className }: UserMessageProps) {
  return (
    <div className={[styles.userWrap, className].filter(Boolean).join(' ')}>
      <div className={styles.user}>
        {attachments && attachments.length > 0 && (
          <div className={styles.userFiles}>
            {attachments.map((a) =>
              a.url && a.mime?.startsWith('image/') ? (
                <img key={a.id} className={styles.userImg} src={a.url} alt={a.name} />
              ) : (
                <span key={a.id} className={styles.userFile} title={a.name}>
                  <BrainIcon name="file" size={13} />
                  <span className={styles.userFileName}>{a.name}</span>
                </span>
              ),
            )}
          </div>
        )}
        {text && <div className={styles.userText}>{text}</div>}
      </div>
      {meta && <div className={styles.userMeta}>{meta}</div>}
    </div>
  )
}
