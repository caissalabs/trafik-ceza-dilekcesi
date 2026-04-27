import type { RefObject } from 'react'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import type { DilekceFormPayload, GeneratedDilekceSections } from './dilekceTypes'

const A4_WIDTH_PX = 794
const A4_HEIGHT_PX = 1123
const TITLE_FALLBACK = "NÖBETÇİ SULH CEZA HÂKİMLİĞİ'NE"
const PDF_PAGE_BREAK_PAD_MAX_ITERS = 4

const LABELS = [
  'İTİRAZ EDEN',
  'KARARINA İTİRAZ EDİLEN',
  'TUTANAK TARİHİ',
  'TUTANAK NUMARASI',
  'KONU',
  'HUKUKİ NEDENLER',
  'HUKUKİ DELİLLER',
] as const

type Label = (typeof LABELS)[number]

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

/** html2canvas + jsPDF dikey kesiminde EKLER bloğu ikiye bölünüyorsa itilecek ekstra px. */
function measureEklerPageBreakPadPx(
  paper: HTMLElement,
  eklerBlock: HTMLElement,
  pageHeightPt: number,
  pageWidthPt: number,
  canvas: HTMLCanvasElement,
): number {
  const imgHeightPt = (canvas.height * pageWidthPt) / canvas.width
  if (imgHeightPt <= pageHeightPt + 0.5) return 0

  const yBreakPx = (pageHeightPt / imgHeightPt) * paper.scrollHeight
  const paperRect = paper.getBoundingClientRect()
  const ekRect = eklerBlock.getBoundingClientRect()
  const ekTopPx = ekRect.top - paperRect.top + paper.scrollTop
  const ekBottomPx = ekTopPx + ekRect.height

  const crossesBreak = ekTopPx < yBreakPx - 1 && ekBottomPx > yBreakPx + 1
  if (!crossesBreak) return 0

  return Math.ceil(yBreakPx - ekTopPx) + 12
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

  const continuationItirazEden = [`T.C. Kimlik No: ${clean(form.ihlalEdenTc) || '...'}`]
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

export function renderResultWithBoldDate(text: string) {
  const pattern = /(\.{2,}\/\.{2,}\/20\.{2}|\d{2}\/\d{2}\/\d{4}|\([^)]*tarih[^)]*\))/gi
  const chunks = text.split(pattern)
  const check = /^(\.{2,}\/\.{2,}\/20\.{2}|\d{2}\/\d{2}\/\d{4}|\([^)]*tarih[^)]*\))$/i
  return chunks.map((chunk, idx) =>
    check.test(chunk) ? <strong key={idx}>{chunk}</strong> : <span key={idx}>{chunk}</span>,
  )
}

export async function generatePdfFromStage({
  target,
  eklerEl,
  spacer,
}: {
  target: HTMLElement
  eklerEl: HTMLElement | null
  spacer: HTMLDivElement | null
}): Promise<string> {
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()

  let padPx = 0
  let canvas: HTMLCanvasElement | null = null

  for (let i = 0; i < PDF_PAGE_BREAK_PAD_MAX_ITERS; i += 1) {
    if (spacer) spacer.style.height = `${padPx}px`
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve())
    })

    canvas = await html2canvas(target, {
      scale: 3,
      backgroundColor: '#ffffff',
      useCORS: true,
      logging: false,
      windowWidth: A4_WIDTH_PX,
      windowHeight: A4_HEIGHT_PX,
    })

    if (!eklerEl) break
    const add = measureEklerPageBreakPadPx(target, eklerEl, pageHeight, pageWidth, canvas)
    if (add <= 0) break
    padPx += add
  }

  if (!canvas) throw new Error('PDF görüntüsü oluşturulamadı')

  const imgData = canvas.toDataURL('image/png')
  const imgWidth = pageWidth
  const imgHeight = (canvas.height * imgWidth) / canvas.width

  let heightLeft = imgHeight
  let position = 0

  pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST')
  heightLeft -= pageHeight

  while (heightLeft > 0) {
    position -= pageHeight
    pdf.addPage()
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST')
    heightLeft -= pageHeight
  }

  const totalPages = pdf.getNumberOfPages()
  pdf.setTextColor(0, 0, 0)
  pdf.setFont('times', 'normal')
  pdf.setFontSize(12)
  for (let page = 1; page <= totalPages; page += 1) {
    pdf.setPage(page)
    pdf.text(`${page} / ${totalPages}`, pageWidth / 2, pageHeight - 20, {
      align: 'center',
    })
  }

  return String(pdf.output('bloburl'))
}

export function DilekcePdfStage({
  layout,
  sourceRef,
  eklerBlockRef,
  pdfEklerSpacerRef,
}: {
  layout: DilekceLayout
  sourceRef: RefObject<HTMLDivElement | null>
  eklerBlockRef: RefObject<HTMLDivElement | null>
  pdfEklerSpacerRef: RefObject<HTMLDivElement | null>
}) {
  return (
    <div className="dp-print-stage" aria-hidden>
      <div ref={sourceRef} className="dp-paper">
        <h1 className="dp-paper__title">{layout.title}</h1>
        <div className="dp-paper__blank" />
        <div className="dp-paper__blank" />

        {LABELS.map((label) => (
          <div key={label} className="dp-paper__block">
            <p className="dp-paper__label-row">
              <span className="dp-paper__label">{label}</span>
              <span className="dp-paper__colon">:</span>
              <span className="dp-paper__value">{layout.values[label]}</span>
            </p>
            {layout.continuations[label].map((line, idx) => (
              <p key={`${label}-${idx}`} className="dp-paper__continuation">
                {line}
              </p>
            ))}
          </div>
        ))}

        <div className="dp-paper__block">
          <p className="dp-paper__section-head">
            <span>AÇIKLAMALAR</span>
            <span className="dp-paper__section-colon">:</span>
          </p>
          <div className="dp-paper__blank" />
          <p className="dp-paper__paragraph dp-paper__paragraph--indented">{layout.aciklamalar}</p>
        </div>

        <div className="dp-paper__block">
          <p className="dp-paper__section-head">
            <span>SONUÇ VE İSTEM</span>
            <span className="dp-paper__section-colon">:</span>
          </p>
          <div className="dp-paper__blank" />
          <p className="dp-paper__paragraph dp-paper__paragraph--indented">
            {renderResultWithBoldDate(layout.sonucVeIstem)}
          </p>
        </div>

        <div ref={pdfEklerSpacerRef} className="dp-paper__pdf-page-adjust" aria-hidden />
        <div ref={eklerBlockRef} className="dp-paper__block">
          <p className="dp-paper__section-title">EKLER</p>
          <div className="dp-paper__blank" />
          <ol className="dp-paper__list">
            {(layout.ekler.length > 0 ? layout.ekler : ['...']).map((item, index) => (
              <li key={`${item}-${index}`}>{item}</li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  )
}
