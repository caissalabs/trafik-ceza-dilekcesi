import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import type {
  DilekceFormPayload,
  DilekceRouteState,
  GeneratedDilekceSections,
} from './dilekceTypes'
import './DilekcePage.css'

const A4_WIDTH_PX = 794
const A4_HEIGHT_PX = 1123
const TITLE_FALLBACK = "NÖBETÇİ SULH CEZA HAKİMLİĞİ'NE"

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

type Layout = {
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

function renderResultWithBoldDate(text: string) {
  const pattern = /(\.{2,}\/\.{2,}\/20\.{2}|\d{2}\/\d{2}\/\d{4}|\([^)]*tarih[^)]*\))/gi
  const chunks = text.split(pattern)
  const check = /^(\.{2,}\/\.{2,}\/20\.{2}|\d{2}\/\d{2}\/\d{4}|\([^)]*tarih[^)]*\))$/i
  return chunks.map((chunk, idx) =>
    check.test(chunk) ? <strong key={idx}>{chunk}</strong> : <span key={idx}>{chunk}</span>,
  )
}

function buildLayout(
  form: DilekceFormPayload,
  generated: GeneratedDilekceSections,
): Layout {
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

export default function DilekcePage() {
  const { state } = useLocation()
  const routeState = (state as DilekceRouteState | null) ?? null

  const form = routeState?.form
  const generated = routeState?.generated

  const sourceRef = useRef<HTMLDivElement>(null)
  const [pdfUrl, setPdfUrl] = useState('')
  const [pdfLoading, setPdfLoading] = useState(false)
  const [pdfError, setPdfError] = useState<string | null>(null)

  const layout = useMemo(
    () => (form && generated ? buildLayout(form, generated) : null),
    [form, generated],
  )

  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl)
    }
  }, [pdfUrl])

  useEffect(() => {
    if (!layout) return

    let cancelled = false
    const generatePdf = async () => {
      setPdfLoading(true)
      setPdfError(null)
      try {
        await new Promise((resolve) => requestAnimationFrame(() => resolve(null)))
        const target = sourceRef.current
        if (!target) throw new Error('Render kaynağı bulunamadı')

        const canvas = await html2canvas(target, {
          scale: 3,
          backgroundColor: '#ffffff',
          useCORS: true,
          logging: false,
          windowWidth: A4_WIDTH_PX,
          windowHeight: A4_HEIGHT_PX,
        })
        if (cancelled) return

        const pdf = new jsPDF({ unit: 'pt', format: 'a4' })
        const pageWidth = pdf.internal.pageSize.getWidth()
        const pageHeight = pdf.internal.pageSize.getHeight()
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

        if (cancelled) return
        const blobUrl = String(pdf.output('bloburl'))
        setPdfUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev)
          return blobUrl
        })
      } catch (err) {
        if (cancelled) return
        console.error(err)
        setPdfError('PDF oluşturulurken bir hata oluştu.')
      } finally {
        if (!cancelled) setPdfLoading(false)
      }
    }

    generatePdf()
    return () => {
      cancelled = true
    }
  }, [layout])

  if (!layout) {
    return (
      <main className="dp-empty">
        <h1>Henüz dilekçe yok</h1>
        <p>Dilekçeyi görmek için önce formu doldurup tekrar oluştur.</p>
        <Link to="/olustur" className="dp-back-link">
          Form sayfasına dön
        </Link>
      </main>
    )
  }

  return (
    <div className="dp-root">
      <header className="dp-header">
        <Link to="/" className="dp-logo">
          trafik<span>.</span>ceza
        </Link>
        <div className="dp-actions">
          <Link to="/olustur" className="dp-secondary-btn">
            Forma geri dön
          </Link>
          <a
            href={pdfUrl || '#'}
            download="trafik-cezasina-itiraz-dilekcesi.pdf"
            className={`dp-primary-btn${!pdfUrl ? ' dp-primary-btn--disabled' : ''}`}
            onClick={(e) => {
              if (!pdfUrl) e.preventDefault()
            }}
          >
            PDF indir
          </a>
        </div>
      </header>

      <main className="dp-main">
        {pdfError ? <p className="dp-error">{pdfError}</p> : null}
        <div className="dp-viewer-wrap">
          {pdfLoading || !pdfUrl ? (
            <div className="dp-viewer-loading">
              <span className="dp-viewer-spinner" aria-hidden />
              <p>PDF hazırlanıyor</p>
            </div>
          ) : (
            <iframe title="Dilekçe PDF Önizleme" className="dp-viewer" src={pdfUrl} />
          )}
        </div>
      </main>

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
            <p className="dp-paper__paragraph dp-paper__paragraph--indented">
              {layout.aciklamalar}
            </p>
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

          <div className="dp-paper__block">
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
    </div>
  )
}
