/**
 * Typed mirror of CSS custom properties from `tokens.css`.
 *
 * Keep manually in sync with `tokens.css` — both files are sources of
 * truth for their respective consumers (CSS files reference custom
 * properties, TS code references this object).
 */

export const colors = {
  terra: 'var(--terra)',
  terraD: 'var(--terra-d)',
  terraBg: 'var(--terra-bg)',
  terraBd: 'var(--terra-bd)',
  terraMark: 'var(--terra-mark)',

  ink: 'var(--ink)',
  ink2: 'var(--ink-2)',
  ink3: 'var(--ink-3)',
  ink4: 'var(--ink-4)',
  ink5: 'var(--ink-5)',

  bg: 'var(--bg)',
  surf: 'var(--surf)',
  surf2: 'var(--surf-2)',
  surf3: 'var(--surf-3)',

  bd: 'var(--bd)',
  bdSoft: 'var(--bd-soft)',
  bdStrong: 'var(--bd-strong)',

  tpProj: 'var(--tp-proj)',
  tpStd: 'var(--tp-std)',
  tpSol: 'var(--tp-sol)',
  tpArt: 'var(--tp-art)',

  good: 'var(--good)',
  goodBg: 'var(--good-bg)',
  goodBd: 'var(--good-bd)',
  warn: 'var(--warn)',
  warnBg: 'var(--warn-bg)',
  warnBd: 'var(--warn-bd)',
  info: 'var(--info)',
  infoBg: 'var(--info-bg)',
  infoBd: 'var(--info-bd)',
  bad: 'var(--bad)',
  badBg: 'var(--bad-bg)',
  badBd: 'var(--bad-bd)',
} as const

export const radii = {
  xs: 'var(--r-xs)',
  sm: 'var(--r-sm)',
  md: 'var(--r-md)',
  lg: 'var(--r-lg)',
  xl: 'var(--r-xl)',
  pill: 'var(--r-pill)',
} as const

export const fonts = {
  sans: 'var(--font-sans)',
  mono: 'var(--font-mono)',
} as const

export const fontSizes = {
  h1: 'var(--fs-h1)',
  h1Min: 'var(--fs-h1-min)',
  h2: 'var(--fs-h2)',
  h3: 'var(--fs-h3)',
  card: 'var(--fs-card)',
  body: 'var(--fs-body)',
  meta: 'var(--fs-meta)',
  metaSm: 'var(--fs-meta-sm)',
} as const

export const lineHeights = {
  tight: 'var(--lh-tight)',
  snug: 'var(--lh-snug)',
  body: 'var(--lh-body)',
} as const

export const fontWeights = {
  regular: 'var(--fw-regular)',
  medium: 'var(--fw-medium)',
  semibold: 'var(--fw-semibold)',
  bold: 'var(--fw-bold)',
} as const

export const space = {
  1: 'var(--sp-1)',
  2: 'var(--sp-2)',
  3: 'var(--sp-3)',
  4: 'var(--sp-4)',
  5: 'var(--sp-5)',
  6: 'var(--sp-6)',
  7: 'var(--sp-7)',
  8: 'var(--sp-8)',
  9: 'var(--sp-9)',
  10: 'var(--sp-10)',
} as const

export const shadows = {
  sm: 'var(--shadow-sm)',
  md: 'var(--shadow-md)',
} as const

export const zIndex = {
  mega: 'var(--z-mega)',
  modal: 'var(--z-modal)',
  toast: 'var(--z-toast)',
} as const

export const layout = {
  sidebarWidth: 'var(--sb-w)',
  contentWidth: 'var(--content-w)',
  drawerWidth: 'var(--drawer-w)',
} as const

export const focus = {
  color: 'var(--focus)',
  ringWidth: 'var(--focus-ring-w)',
  ringOffset: 'var(--focus-ring-offset)',
} as const

export const fields = {
  height: 'var(--field-h)',
  paddingX: 'var(--field-px)',
  radius: 'var(--field-r)',
  background: 'var(--field-bg)',
  border: 'var(--field-bd)',
  borderFocus: 'var(--field-bd-focus)',
} as const

/** Article type — drives badge/marker color. */
export const ARTICLE_TYPES = ['project', 'standard', 'solution', 'article'] as const
export type ArticleType = (typeof ARTICLE_TYPES)[number]

/** Russian display labels for article types. */
export const ARTICLE_TYPE_LABELS: Record<ArticleType, string> = {
  project: 'Проект',
  standard: 'Стандарт',
  solution: 'Решение',
  article: 'Статья',
}

/** Foreground (text/marker) color per article type. */
export const articleTypeColor: Record<ArticleType, string> = {
  project: colors.tpProj,
  standard: colors.tpStd,
  solution: colors.tpSol,
  article: colors.tpArt,
}

/** Background (tint) color per article type — for badges, card covers. */
export const articleTypeBg: Record<ArticleType, string> = {
  project: 'var(--tp-proj-bg)',
  standard: 'var(--tp-std-bg)',
  solution: 'var(--tp-sol-bg)',
  article: 'var(--tp-art-bg)',
}

/** Status tone — drives surface/text/border triad. */
export type StatusTone = 'good' | 'warn' | 'info' | 'bad'

export interface StatusTriad {
  fg: string
  bg: string
  bd: string
}

export const statusToneTriad: Record<StatusTone, StatusTriad> = {
  good: { fg: colors.good, bg: colors.goodBg, bd: colors.goodBd },
  warn: { fg: colors.warn, bg: colors.warnBg, bd: colors.warnBd },
  info: { fg: colors.info, bg: colors.infoBg, bd: colors.infoBd },
  bad: { fg: colors.bad, bg: colors.badBg, bd: colors.badBd },
}
