/*
 * Иконки панели ИИ, которых нет в общем `Icon` из ui-react (копировать, 👍/👎,
 * повторить, искра, развернуть). Штриховые, наследуют цвет через currentColor,
 * 24×24 — как в `packages/react/src/list/Icon.tsx`.
 */
import type { ReactNode } from 'react'

export type BrainIconName =
  | 'copy'
  | 'thumbup'
  | 'thumbdown'
  | 'refresh'
  | 'sparkle'
  | 'expand'
  | 'task'
  | 'file'
  | 'table'
  | 'slash'
  | 'external'
  | 'shield'
  | 'pause'
  | 'lock'
  | 'alert'
  | 'undo'
  | 'check'

const paths: Record<BrainIconName, ReactNode> = {
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  copy: (
    <>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V6a2 2 0 0 1 2-2h9" />
    </>
  ),
  thumbup: (
    <>
      <path d="M7 11v9" />
      <path d="M3 11h4l3.6-7.2A2 2 0 0 1 13.6 3h.1a1.5 1.5 0 0 1 1.5 1.5V10h4.2a2 2 0 0 1 2 2.3l-1 6a2 2 0 0 1-2 1.7H7" />
    </>
  ),
  thumbdown: (
    <>
      <path d="M17 13V4" />
      <path d="M21 13h-4L13.4 20.2a2 2 0 0 1-1.8 1.1h-.1a1.5 1.5 0 0 1-1.5-1.5V14H5.8a2 2 0 0 1-2-2.3l1-6A2 2 0 0 1 6.8 4H17" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 11a8 8 0 0 0-14.9-3" />
      <path d="M4 4v4h4" />
      <path d="M4 13a8 8 0 0 0 14.9 3" />
      <path d="M20 20v-4h-4" />
    </>
  ),
  sparkle: (
    <>
      <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />
      <path d="M19 17l.7 1.8 1.8.7-1.8.7L19 22l-.7-1.8-1.8-.7 1.8-.7z" />
    </>
  ),
  expand: (
    <>
      <path d="M14 4h6v6" />
      <path d="M20 4l-7 7" />
      <path d="M10 20H4v-6" />
      <path d="M4 20l7-7" />
    </>
  ),
  task: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="2.5" />
      <path d="M8 12.5l2.5 2.5L16 9.5" />
    </>
  ),
  file: (
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5M9 13h6M9 17h6" />
    </>
  ),
  table: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 10h18M3 15h18M9 4v16" />
    </>
  ),
  slash: (
    <>
      <path d="M16 4L8 20" />
    </>
  ),
  external: (
    <>
      <path d="M14 4h6v6" />
      <path d="M20 4l-9 9" />
      <path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6z" />
      <path d="M9 12l2 2 4-4" />
    </>
  ),
  pause: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M10 9v6M14 9v6" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>
  ),
  alert: (
    <>
      <path d="M12 4l9 16H3z" />
      <path d="M12 10v4M12 17.2v.1" />
    </>
  ),
  undo: (
    <>
      <path d="M9 14L4 9l5-5" />
      <path d="M4 9h10a6 6 0 0 1 0 12h-3" />
    </>
  ),
}

export interface BrainIconProps {
  name: BrainIconName
  size?: number
  stroke?: number
}

export function BrainIcon({ name, size = 16, stroke = 1.6 }: BrainIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  )
}
