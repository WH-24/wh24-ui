/**
 * Файлы к вопросу. Пределы и форматы — те же, что проверяет сервер:
 * проверяем заранее, чтобы человек узнал об отказе до отправки, а не после
 * ожидания. Перенесено из wh24-ai-web/src/lib/chatFiles.ts.
 */
export const MAX_FILES = 5
export const MAX_FILE_BYTES = 15 * 1024 * 1024
export const MAX_TOTAL_BYTES = 20 * 1024 * 1024

const IMAGE_EXT = ['png', 'jpg', 'jpeg', 'webp', 'gif']
const DOC_EXT = ['pdf', 'xlsx', 'docx', 'pptx']
const TEXT_EXT = [
  'txt',
  'csv',
  'tsv',
  'md',
  'json',
  'xml',
  'yaml',
  'yml',
  'log',
  'sql',
  'html',
  'htm',
  'ini',
  'cfg',
  'py',
  'js',
  'ts',
  'tsx',
  'go',
  'java',
  'cs',
  'css',
  'sh',
  'ifc',
]

/** Для атрибута accept у выбора файла. */
export const ACCEPT = [...IMAGE_EXT, ...DOC_EXT, ...TEXT_EXT].map((e) => `.${e}`).join(',')

/** Вложение в композере: что показать чипом. */
export interface BrainFile {
  id: string
  name: string
  mime: string
  size: number
  /** Превью картинки (data-URL или ссылка). Нет — рисуется иконка документа. */
  previewUrl?: string
}

/** Вложение, прочитанное в data-URL — готово к отправке. */
export interface BrainUploadFile extends BrainFile {
  dataUrl: string
}

function ext(name: string): string {
  const i = name.lastIndexOf('.')
  return i >= 0 ? name.slice(i + 1).toLowerCase() : ''
}

export function isSupportedFile(name: string): boolean {
  const e = ext(name)
  return IMAGE_EXT.includes(e) || DOC_EXT.includes(e) || TEXT_EXT.includes(e)
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} МБ`
}

function read(file: File): Promise<BrainUploadFile> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onerror = () => reject(new Error(`не удалось прочитать «${file.name}»`))
    r.onload = () => {
      const dataUrl = String(r.result ?? '')
      const mime = file.type || 'application/octet-stream'
      resolve({
        id: `${file.name}-${file.size}-${file.lastModified}`,
        name: file.name || 'вставленное изображение.png',
        mime,
        size: file.size,
        dataUrl,
        previewUrl: mime.startsWith('image/') ? dataUrl : undefined,
      })
    }
    r.readAsDataURL(file)
  })
}

export interface AddFilesLimits {
  maxFiles?: number
  maxFileBytes?: number
  maxTotalBytes?: number
}

/**
 * Добавляет файлы к уже выбранным. Возвращает новый список и понятные причины
 * отказа по тем, что не подошли (остальные добавляются).
 */
export async function addBrainFiles(
  current: BrainUploadFile[],
  incoming: File[],
  limits: AddFilesLimits = {},
): Promise<{ files: BrainUploadFile[]; errors: string[] }> {
  const maxFiles = limits.maxFiles ?? MAX_FILES
  const maxFileBytes = limits.maxFileBytes ?? MAX_FILE_BYTES
  const maxTotalBytes = limits.maxTotalBytes ?? MAX_TOTAL_BYTES
  const errors: string[] = []
  const out = [...current]
  let total = current.reduce((s, f) => s + f.size, 0)
  for (const f of incoming) {
    const name = f.name || 'вставленное изображение.png'
    if (out.length >= maxFiles) {
      errors.push(`Не больше ${maxFiles} файлов в одном сообщении.`)
      break
    }
    if (!isSupportedFile(name) && !f.type.startsWith('image/')) {
      const e = ext(name)
      errors.push(
        e === 'xls' || e === 'doc' || e === 'ppt'
          ? `«${name}»: сохраните как .${e}x — старый формат не читается.`
          : `«${name}»: такой формат не поддерживается. Подойдут картинки, PDF, xlsx, docx и текстовые файлы.`,
      )
      continue
    }
    if (f.size > maxFileBytes) {
      errors.push(`«${name}» больше ${formatSize(maxFileBytes)}.`)
      continue
    }
    if (total + f.size > maxTotalBytes) {
      errors.push(`Вместе файлы больше ${formatSize(maxTotalBytes)}.`)
      continue
    }
    const id = `${name}-${f.size}-${f.lastModified}`
    if (out.some((x) => x.id === id)) continue
    try {
      out.push(await read(f))
      total += f.size
    } catch (e) {
      errors.push(e instanceof Error ? e.message : `не удалось прочитать «${name}»`)
    }
  }
  return { files: out, errors }
}
