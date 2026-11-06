/**
 * Минимальный .xlsx из таблицы ответа ассистента (владелец, 07.10.2026:
 * «создай файл excel…»). Модель отвечает markdown-таблицей, а интерфейс
 * отдаёт её файлом. Перенесено из wh24-ai-web/src/lib/xlsx.ts.
 *
 * Своя сборка вместо библиотеки: нужна одна книга с одним листом из строк и
 * чисел. ExcelJS/SheetJS — сотни килобайт в бандле и собственные уязвимости в
 * гейте npm-audit ради того, что укладывается в zip без сжатия и пять XML.
 */

const enc = new TextEncoder()

// ─── ZIP (метод «без сжатия», как в спецификации PKWARE APPNOTE) ───

let crcTable: Uint32Array | null = null
function crc32(data: Uint8Array): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256)
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      crcTable[n] = c >>> 0
    }
  }
  let crc = 0xffffffff
  for (let i = 0; i < data.length; i++) {
    crc = (crcTable[(crc ^ (data[i] ?? 0)) & 0xff] ?? 0) ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

export function zipStore(files: Array<{ name: string; data: Uint8Array }>): Uint8Array {
  const chunks: Uint8Array[] = []
  const central: Uint8Array[] = []
  let offset = 0
  for (const f of files) {
    const name = enc.encode(f.name)
    const crc = crc32(f.data)
    const local = new DataView(new ArrayBuffer(30))
    local.setUint32(0, 0x04034b50, true)
    local.setUint16(4, 20, true) // версия для распаковки
    local.setUint16(6, 0x0800, true) // имена в UTF-8
    local.setUint16(8, 0, true) // без сжатия
    local.setUint32(14, crc, true)
    local.setUint32(18, f.data.length, true)
    local.setUint32(22, f.data.length, true)
    local.setUint16(26, name.length, true)
    chunks.push(new Uint8Array(local.buffer), name, f.data)

    const cd = new DataView(new ArrayBuffer(46))
    cd.setUint32(0, 0x02014b50, true)
    cd.setUint16(4, 20, true)
    cd.setUint16(6, 20, true)
    cd.setUint16(8, 0x0800, true)
    cd.setUint16(10, 0, true)
    cd.setUint32(16, crc, true)
    cd.setUint32(20, f.data.length, true)
    cd.setUint32(24, f.data.length, true)
    cd.setUint16(28, name.length, true)
    cd.setUint32(42, offset, true)
    central.push(new Uint8Array(cd.buffer), name)

    offset += 30 + name.length + f.data.length
  }
  const cdSize = central.reduce((s, c) => s + c.length, 0)
  const end = new DataView(new ArrayBuffer(22))
  end.setUint32(0, 0x06054b50, true)
  end.setUint16(8, files.length, true)
  end.setUint16(10, files.length, true)
  end.setUint32(12, cdSize, true)
  end.setUint32(16, offset, true)
  const all = [...chunks, ...central, new Uint8Array(end.buffer)]
  const out = new Uint8Array(all.reduce((s, c) => s + c.length, 0))
  let p = 0
  for (const c of all) {
    out.set(c, p)
    p += c.length
  }
  return out
}

// ─── XLSX ───

function esc(s: string): string {
  return (
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      // Управляющие символы XML 1.0 запрещает — Excel откажется открывать файл.
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
  )
}

function colName(i: number): string {
  let s = ''
  let n = i + 1
  while (n > 0) {
    const m = (n - 1) % 26
    s = String.fromCharCode(65 + m) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

/**
 * Число ли это для Excel. Пробелы-разделители тысяч и десятичная запятая
 * («1 234,5») — число; «007», «+7 495…», даты и проценты — текст, чтобы Excel
 * не съел ведущие нули и не превратил телефон в 7,49E+9.
 */
export function asNumber(raw: string): number | null {
  const t = raw.replace(/[\s ]/g, '')
  if (!/^-?(0|[1-9]\d*)([.,]\d+)?$/.test(t)) return null
  const n = Number(t.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

/** Имя листа: до 31 символа, без []:*?/\ — иначе Excel «восстанавливает» книгу. */
function sheetName(s: string): string {
  return (s.replace(/[[\]:*?/\\]/g, ' ').trim() || 'Лист1').slice(0, 31)
}

export function buildXlsx(rows: string[][], title = 'Лист1'): Uint8Array {
  const width = Math.max(1, ...rows.map((r) => r.length))
  const cols = Array.from({ length: width }, (_, c) => {
    const len = Math.max(...rows.map((r) => (r[c] ?? '').length), 4)
    return `<col min="${c + 1}" max="${c + 1}" width="${Math.min(60, len + 2)}" customWidth="1"/>`
  }).join('')
  const sheetRows = rows
    .map((r, ri) => {
      const cells = r
        .map((v, ci) => {
          const ref = `${colName(ci)}${ri + 1}`
          const style = ri === 0 ? ' s="1"' : ''
          const n = ri === 0 ? null : asNumber(v)
          if (n !== null) return `<c r="${ref}"${style}><v>${n}</v></c>`
          if (v === '') return ''
          return `<c r="${ref}" t="inlineStr"${style}><is><t xml:space="preserve">${esc(v)}</t></is></c>`
        })
        .join('')
      return `<row r="${ri + 1}">${cells}</row>`
    })
    .join('')

  const files: Record<string, string> = {
    '[Content_Types].xml':
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
      '</Types>',
    '_rels/.rels':
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
      '</Relationships>',
    'xl/workbook.xml':
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      `<sheets><sheet name="${esc(sheetName(title))}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    'xl/_rels/workbook.xml.rels':
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
      '</Relationships>',
    // Стиль 1 — жирная шапка; 0 — обычный.
    'xl/styles.xml':
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
      '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
      '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
      '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>' +
      '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
      '</styleSheet>',
    'xl/worksheets/sheet1.xml':
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      // Закреплённая шапка: таблица из ответа обычно длиннее экрана.
      '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
      `<cols>${cols}</cols><sheetData>${sheetRows}</sheetData></worksheet>`,
  }
  return zipStore(Object.entries(files).map(([name, xml]) => ({ name, data: enc.encode(xml) })))
}

/** Скачать байты файлом. */
export function downloadBytes(data: Uint8Array | string, filename: string, mime: string): void {
  const blob = new Blob([data as BlobPart], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
