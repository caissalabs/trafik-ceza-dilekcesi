import { jsPDF } from 'jspdf'
import type { DilekceFormPayload, GeneratedDilekceSections } from './dilekceTypes'

const TITLE_FALLBACK = "NÖBETÇİ SULH CEZA HÂKİMLİĞİ'NE"
const PAGE_MARGIN_PT = 42.5
const PAGE_NUMBER_OFFSET_FROM_BOTTOM_PT = 18
const LABEL_COL_MIN_WIDTH_PT = 110
const LABEL_COL_MAX_WIDTH_PT = 170
const LABEL_TO_COLON_GAP_PT = 10
const COLON_TO_VALUE_GAP_PT = 14
const PARAGRAPH_INDENT_PT = 28
const LINE_HEIGHT_PT = 18
const BODY_FONT_SIZE_PT = 12
const TITLE_FONT_SIZE_PT = 12
const BLOCK_GAP_LINES = 1
const TITLE_SPACER_LINES = 2
const PDF_FONT_FAMILY = 'DocSerif'
const PDF_FONT_REGULAR_FILE = 'DocSerif-Regular.ttf'
const PDF_FONT_BOLD_FILE = 'DocSerif-Bold.ttf'
const FONT_SOURCES = [
  // Common Windows filenames from C:\Windows\Fonts
  {
    regularUrl: '/fonts/TIMES.TTF',
    boldUrl: '/fonts/TIMESBD.TTF',
  },
  {
    regularUrl: '/fonts/times.ttf',
    boldUrl: '/fonts/timesbd.ttf',
  },
  // Project-friendly aliases
  {
    regularUrl: '/fonts/TimesNewRoman.ttf',
    boldUrl: '/fonts/TimesNewRoman-Bold.ttf',
  },
  {
    regularUrl: '/fonts/NotoSerif-Regular.ttf',
    boldUrl: '/fonts/NotoSerif-Bold.ttf',
  },
] as const

const INFO_LABELS = [
  'İTİRAZ EDEN',
  'KARARINA İTİRAZ EDİLEN',
  'TUTANAK TARİHİ',
  'TUTANAK NUMARASI',
  'KONU',
] as const

const LEGAL_LABELS = [
  'HUKUKİ NEDENLER',
  'HUKUKİ DELİLLER',
] as const

const LABELS = [...INFO_LABELS, ...LEGAL_LABELS] as const

type Label = (typeof LABELS)[number]

let cachedRegularFontBinary: string | null = null
let cachedBoldFontBinary: string | null = null
let cachedFontSourceKey: string | null = null

function arrayBufferToBinaryString(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  const chunkSize = 0x8000
  let binary = ''
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }
  return binary
}

async function fetchFontAsBinary(url: string): Promise<string | null> {
  try {
    const response = await fetch(url)
    if (!response.ok) return null
    const fontBuffer = await response.arrayBuffer()
    return arrayBufferToBinaryString(fontBuffer)
  } catch {
    return null
  }
}

async function ensurePdfFont(pdf: jsPDF): Promise<void> {
  if (!cachedRegularFontBinary || !cachedBoldFontBinary) {
    let found = false
    for (const source of FONT_SOURCES) {
      const [regular, bold] = await Promise.all([
        fetchFontAsBinary(source.regularUrl),
        fetchFontAsBinary(source.boldUrl),
      ])
      if (regular && bold) {
        cachedRegularFontBinary = regular
        cachedBoldFontBinary = bold
        cachedFontSourceKey = `${source.regularUrl}|${source.boldUrl}`
        found = true
        break
      }
    }

    if (!found || !cachedRegularFontBinary || !cachedBoldFontBinary) {
      throw new Error(
        'PDF yazı tipi bulunamadı. ' +
          'Lütfen public/fonts içine TimesNewRoman.ttf ve TimesNewRoman-Bold.ttf ekleyin.',
      )
    }
  }

  if (!cachedFontSourceKey) {
    throw new Error('PDF yazı tipi kaynak anahtarı oluşturulamadı.')
  }

  pdf.addFileToVFS(PDF_FONT_REGULAR_FILE, cachedRegularFontBinary)
  pdf.addFileToVFS(PDF_FONT_BOLD_FILE, cachedBoldFontBinary)
  pdf.addFont(PDF_FONT_REGULAR_FILE, PDF_FONT_FAMILY, 'normal')
  pdf.addFont(PDF_FONT_BOLD_FILE, PDF_FONT_FAMILY, 'bold')
}

export type DilekceLayout = {
  title: string
  values: Record<Label, string>
  continuations: Record<Label, string[]>
  aciklamalar: string
  sonucVeIstem: string
  ekler: string[]
}

function formatDisplayDate(input: string): string {
  if (!input) return '...'
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(input)) return input
  const [year, month, day] = input.split('-')
  if (year && month && day) return `${day}/${month}/${year}`
  return input
}

function clean(value: string | undefined): string {
  return value?.trim() || ''
}

export function buildLayout(
  form: DilekceFormPayload,
  generated: GeneratedDilekceSections,
): DilekceLayout {
  const mahkemeRaw = clean(generated.mahkeme)
  const title = (mahkemeRaw || TITLE_FALLBACK).toLocaleUpperCase('tr-TR')

  const values: Record<Label, string> = {
    'İTİRAZ EDEN': clean(form.ihlalEdenAd) || '...',
    'KARARINA İTİRAZ EDİLEN':
      clean(generated.kararinaItirazEdilen) || clean(form.birim) || '...',
    'TUTANAK TARİHİ': formatDisplayDate(clean(form.tarih)),
    'TUTANAK NUMARASI':
      clean(form.seriNo) || clean(form.siraNo)
        ? `Seri No: ${clean(form.seriNo) || '...'} - Sıra No: ${clean(form.siraNo) || '...'}`
        : '...',
    KONU: clean(generated.konu) || '...',
    'HUKUKİ NEDENLER': clean(generated.hukukiNedenler) || '...',
    'HUKUKİ DELİLLER':
      generated.hukukiDeliller?.[0]?.trim() ||
      clean(form.ekler[0]) ||
      '...',
  }

  const continuationItirazEden = [
    `T.C. Kimlik No: ${clean(form.ihlalEdenTc) || '...'}`,
    `${clean(form.ihlalAdresi) || '...'}, ${clean(form.ihlalIl) || '...'} / ${clean(form.ihlalIlce) || '...'}`,
  ]
  const continuationHukukiDeliller = [
    ...(generated.hukukiDeliller ?? []).slice(1),
    ...form.ekler,
  ]
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 4)

  const continuations: Record<Label, string[]> = {
    'İTİRAZ EDEN': continuationItirazEden,
    'KARARINA İTİRAZ EDİLEN': [],
    'TUTANAK TARİHİ': [],
    'TUTANAK NUMARASI': [],
    KONU: [],
    'HUKUKİ NEDENLER': [],
    'HUKUKİ DELİLLER': continuationHukukiDeliller,
  }

  return {
    title,
    values,
    continuations,
    aciklamalar: clean(generated.aciklamalar) || clean(form.olayAkisi) || '...',
    sonucVeIstem: clean(generated.sonucVeIstem) || '...',
    ekler: form.ekler.map((x) => x.trim()).filter(Boolean),
  }
}

function ensureSpace(
  pdf: jsPDF,
  y: number,
  minHeight: number,
  topY: number,
  bottomY: number,
): number {
  if (y + minHeight <= bottomY) return y
  pdf.addPage()
  return topY
}

function splitLines(pdf: jsPDF, text: string, maxWidth: number): string[] {
  const result = pdf.splitTextToSize(text || '...', maxWidth)
  if (Array.isArray(result)) return result.map((line) => String(line))
  return [String(result)]
}

function drawJustifiedLine(
  pdf: jsPDF,
  line: string,
  x: number,
  y: number,
  maxWidth: number,
): void {
  const words = line.trim().split(/\s+/).filter(Boolean)
  if (words.length < 2) {
    pdf.text(line, x, y)
    return
  }

  const wordsWidth = words.reduce((sum, word) => sum + pdf.getTextWidth(word), 0)
  const freeSpace = maxWidth - wordsWidth
  const gaps = words.length - 1
  if (freeSpace <= 0) {
    pdf.text(line, x, y)
    return
  }

  const gapWidth = freeSpace / gaps
  if (gapWidth > pdf.getTextWidth(' ') * 2.7) {
    pdf.text(line, x, y)
    return
  }

  let cursorX = x
  words.forEach((word, index) => {
    pdf.text(word, cursorX, y)
    cursorX += pdf.getTextWidth(word)
    if (index < gaps) cursorX += gapWidth
  })
}

function drawWrappedJustified(
  pdf: jsPDF,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  firstLineIndent: number = 0,
): number {
  const paragraphs = (text || '...')
    .split(/\n+/)
    .map((part) => part.trim())
    .filter(Boolean)
  const safeParagraphs = paragraphs.length > 0 ? paragraphs : ['...']

  safeParagraphs.forEach((paragraph, paragraphIndex) => {
    const firstLineWidth = Math.max(24, maxWidth - firstLineIndent)
    const firstLine = splitLines(pdf, paragraph, firstLineWidth)[0] ?? ''
    const restText = paragraph.slice(firstLine.length).trim()
    const restLines = restText ? splitLines(pdf, restText, maxWidth) : []
    const lines = [firstLine, ...restLines].filter(Boolean)
    lines.forEach((line, lineIndex) => {
      const isLastLine = lineIndex === lines.length - 1
      const lineX = lineIndex === 0 ? x + firstLineIndent : x
      const lineWidth = lineIndex === 0 ? firstLineWidth : maxWidth
      if (isLastLine) {
        pdf.text(line, lineX, y)
      } else {
        drawJustifiedLine(pdf, line, lineX, y, lineWidth)
      }
      y += lineHeight
    })
    if (paragraphIndex < safeParagraphs.length - 1) {
      y += lineHeight
    }
  })

  return y
}

export async function generatePdfFromLayout(layout: DilekceLayout): Promise<Blob> {
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' })
  await ensurePdfFont(pdf)
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const topY = PAGE_MARGIN_PT
  const bottomY = pageHeight - PAGE_MARGIN_PT
  const leftX = PAGE_MARGIN_PT
  const rightX = pageWidth - PAGE_MARGIN_PT

  pdf.setFont(PDF_FONT_FAMILY, 'bold')
  pdf.setFontSize(BODY_FONT_SIZE_PT)
  const longestLabelWidth = Math.max(...LABELS.map((label) => pdf.getTextWidth(label)))
  const labelColWidth = Math.min(
    LABEL_COL_MAX_WIDTH_PT,
    Math.max(LABEL_COL_MIN_WIDTH_PT, longestLabelWidth + 2),
  )
  const colonX = leftX + labelColWidth + LABEL_TO_COLON_GAP_PT
  const valueX = colonX + COLON_TO_VALUE_GAP_PT
  const valueWidth = rightX - valueX

  let y = topY
  pdf.setTextColor(0, 0, 0)
  pdf.setFont(PDF_FONT_FAMILY, 'bold')
  pdf.setFontSize(TITLE_FONT_SIZE_PT)
  pdf.text(layout.title, pageWidth / 2, y, { align: 'center' })
  y += LINE_HEIGHT_PT * (TITLE_SPACER_LINES + 1)

  const renderLabelBlock = (label: Label) => {
    pdf.setFont(PDF_FONT_FAMILY, 'normal')
    pdf.setFontSize(BODY_FONT_SIZE_PT)
    const valueLines = splitLines(pdf, layout.values[label], valueWidth)
    const continuationLines = layout.continuations[label].flatMap((line) =>
      splitLines(pdf, line, valueWidth),
    )
    const totalLines = valueLines.length + continuationLines.length
    const blockHeight = totalLines * LINE_HEIGHT_PT + BLOCK_GAP_LINES * LINE_HEIGHT_PT
    y = ensureSpace(pdf, y, blockHeight, topY, bottomY)

    pdf.setFont(PDF_FONT_FAMILY, 'bold')
    pdf.text(label, leftX, y)
    pdf.text(':', colonX, y, { align: 'center' })

    pdf.setFont(PDF_FONT_FAMILY, 'normal')
    pdf.setFontSize(BODY_FONT_SIZE_PT)
    valueLines.forEach((line) => {
      drawJustifiedLine(pdf, line, valueX, y, valueWidth)
      y += LINE_HEIGHT_PT
    })

    continuationLines.forEach((line) => {
      y = ensureSpace(pdf, y, LINE_HEIGHT_PT, topY, bottomY)
      drawJustifiedLine(pdf, line, valueX, y, valueWidth)
      y += LINE_HEIGHT_PT
    })

    y += BLOCK_GAP_LINES * LINE_HEIGHT_PT
  }

  INFO_LABELS.forEach((label) => renderLabelBlock(label))

  const renderSection = (title: string, body: string) => {
    const sectionTextWidth = rightX - leftX - PARAGRAPH_INDENT_PT
    const sectionLines = splitLines(pdf, body, sectionTextWidth)
    const minHeight =
      LINE_HEIGHT_PT * (sectionLines.length + 2 + BLOCK_GAP_LINES)
    y = ensureSpace(pdf, y, minHeight, topY, bottomY)

    pdf.setFont(PDF_FONT_FAMILY, 'bold')
    pdf.text(title, leftX, y)
    pdf.text(':', colonX, y, { align: 'center' })
    y += LINE_HEIGHT_PT * 2

    pdf.setFont(PDF_FONT_FAMILY, 'normal')
    y = ensureSpace(pdf, y, LINE_HEIGHT_PT * Math.max(1, sectionLines.length), topY, bottomY)
    y = drawWrappedJustified(
      pdf,
      body,
      leftX,
      y,
      sectionTextWidth,
      LINE_HEIGHT_PT,
      PARAGRAPH_INDENT_PT,
    )

    y += BLOCK_GAP_LINES * LINE_HEIGHT_PT
  }

  renderSection('AÇIKLAMALAR', layout.aciklamalar)
  LEGAL_LABELS.forEach((label) => renderLabelBlock(label))
  renderSection('SONUÇ VE İSTEM', layout.sonucVeIstem)

  const ekLines = (layout.ekler.length > 0 ? layout.ekler : ['...']).flatMap((item, index) =>
    splitLines(pdf, `${index + 1}. ${item}`, rightX - leftX),
  )
  y = ensureSpace(pdf, y, LINE_HEIGHT_PT * (ekLines.length + 2), topY, bottomY)
  pdf.setFont(PDF_FONT_FAMILY, 'bold')
  pdf.text('EKLER', leftX, y)
  y += LINE_HEIGHT_PT * 2
  pdf.setFont(PDF_FONT_FAMILY, 'normal')
  ekLines.forEach((line) => {
    y = ensureSpace(pdf, y, LINE_HEIGHT_PT, topY, bottomY)
    pdf.text(line, leftX, y)
    y += LINE_HEIGHT_PT
  })

  const totalPages = pdf.getNumberOfPages()
  pdf.setTextColor(0, 0, 0)
  pdf.setFont(PDF_FONT_FAMILY, 'normal')
  pdf.setFontSize(BODY_FONT_SIZE_PT)
  for (let page = 1; page <= totalPages; page += 1) {
    pdf.setPage(page)
    pdf.text(
      `${page}/${totalPages}`,
      pageWidth / 2,
      pageHeight - PAGE_NUMBER_OFFSET_FROM_BOTTOM_PT,
      {
      align: 'center',
      },
    )
  }

  return pdf.output('blob')
}
