import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import type { DilekceRouteState } from './dilekceTypes'
import './DilekcePage.css'

const A4_WIDTH_PX = 794
const A4_HEIGHT_PX = 1123

const ORDERED_LABELS = [
  'İTİRAZ EDEN',
  'KARARINA İTİRAZ EDİLEN',
  'TUTANAK TARİHİ',
  'TUTANAK NUMARASI',
  'KONU',
  'HUKUKİ NEDENLER',
  'HUKUKİ DELİLLER',
] as const

type LabelKey = (typeof ORDERED_LABELS)[number]

type DilekceLayout = {
  title: string
  fields: Record<LabelKey, string>
  continuations: Record<LabelKey, string[]>
  aciklamalar: string
  sonucVeIstem: string
  ekler: string[]
}

function normalizeText(content: string): string {
  return content
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function reEscape(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function matchLineByAliases(line: string, aliases: string[]): RegExpMatchArray | null {
  for (const alias of aliases) {
    const m = line.match(new RegExp(`^\\s*${reEscape(alias)}\\s*:?\\s*(.*)$`, 'i'))
    if (m) return m
  }
  return null
}

function toUpperTr(value: string): string {
  return value.toLocaleUpperCase('tr-TR')
}

function parseSection(lines: string[], headingAliases: string[], stopAliases: string[]): string[] {
  const start = lines.findIndex((line) => matchLineByAliases(line, headingAliases))
  if (start === -1) return []
  const out: string[] = []
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i].trim()
    if (!line) {
      out.push('')
      continue
    }
    if (matchLineByAliases(line, stopAliases)) break
    out.push(line)
  }
  while (out.length && out[0] === '') out.shift()
  while (out.length && out[out.length - 1] === '') out.pop()
  return out
}

function firstNonEmpty(lines: string[]): string {
  return lines.find((line) => line.trim().length > 0)?.trim() ?? ''
}

function parseLayout(content: string): DilekceLayout {
  const lines = content.split('\n').map((line) => line.trim())

  const titleCandidate =
    lines.find((line) => /HAK[İI]ML[İI][ĞG]/i.test(line) && /N[ÖO]BET[ÇC][İI]/i.test(line)) ??
    lines.find((line) => line.length > 0) ??
    "KARŞIYAKA NÖBETÇİ SULH CEZA HAKİMLİĞİ'NE"

  const title = toUpperTr(titleCandidate.replace(/[.:]+$/, ''))

  const getValue = (aliases: string[]): string => {
    const line = lines.find((l) => matchLineByAliases(l, aliases))
    if (!line) return ''
    const m = matchLineByAliases(line, aliases)
    return (m?.[1] ?? '').trim()
  }

  const fieldAliases: Record<LabelKey, string[]> = {
    'İTİRAZ EDEN': ['İTİRAZ EDEN', 'ITIRAZ EDEN', 'İtiraz Eden', 'MÜVEKKİL'],
    'KARARINA İTİRAZ EDİLEN': [
      'KARARINA İTİRAZ EDİLEN',
      'KARARINA ITIRAZ EDILEN',
      'KARŞI TARAF',
      'KARSI TARAF',
      'DAVALI',
    ],
    'TUTANAK TARİHİ': ['TUTANAK TARİHİ', 'TUTANAK TARIHI'],
    'TUTANAK NUMARASI': ['TUTANAK NUMARASI', 'TUTANAK NO', 'TUTANAK NUM', 'NUMARASI'],
    KONU: ['KONU'],
    'HUKUKİ NEDENLER': ['HUKUKİ NEDENLER', 'HUKUKI NEDENLER', 'HUKUKİ SEBEPLER', 'HUKUKI SEBEPLER'],
    'HUKUKİ DELİLLER': ['HUKUKİ DELİLLER', 'HUKUKI DELILLER'],
  }

  const fields = {
    'İTİRAZ EDEN': getValue(fieldAliases['İTİRAZ EDEN']) || '...',
    'KARARINA İTİRAZ EDİLEN': getValue(fieldAliases['KARARINA İTİRAZ EDİLEN']) || '...',
    'TUTANAK TARİHİ': getValue(fieldAliases['TUTANAK TARİHİ']) || '...',
    'TUTANAK NUMARASI': getValue(fieldAliases['TUTANAK NUMARASI']) || '',
    KONU: getValue(fieldAliases.KONU) || '...',
    'HUKUKİ NEDENLER': getValue(fieldAliases['HUKUKİ NEDENLER']) || '...',
    'HUKUKİ DELİLLER': '',
  } satisfies Record<LabelKey, string>

  if (!fields['TUTANAK NUMARASI']) {
    const seri = getValue(['SERİ NO', 'SERI NO'])
    const sira = getValue(['SIRA NO'])
    fields['TUTANAK NUMARASI'] =
      seri || sira ? `Seri No: ${seri || '...'} - Sıra No: ${sira || '...'}` : '...'
  }

  const continuationAddress = getValue(['ADRES'])
  const continuationPhone = getValue(['TELEFON', 'TEL'])

  const aciklamalarLines = parseSection(
    lines,
    ['AÇIKLAMALAR', 'ACIKLAMALAR'],
    ['HUKUKİ DELİLLER', 'HUKUKI DELILLER', 'HUKUKİ SEBEPLER', 'HUKUKI SEBEPLER', 'SONUÇ VE İSTEM', 'SONUC VE ISTEM', 'NETİCE-İ TALEP', 'NETICE-I TALEP', 'EKLER'],
  )
  const sonucLines = parseSection(
    lines,
    ['SONUÇ VE İSTEM', 'SONUC VE ISTEM', 'NETİCE-İ TALEP', 'NETICE-I TALEP'],
    ['EKLER'],
  )
  const eklerLines = parseSection(lines, ['EKLER'], [])

  const hukukiDelillerLines = parseSection(
    lines,
    ['HUKUKİ DELİLLER', 'HUKUKI DELILLER'],
    ['HUKUKİ SEBEPLER', 'HUKUKI SEBEPLER', 'SONUÇ VE İSTEM', 'SONUC VE ISTEM', 'NETİCE-İ TALEP', 'NETICE-I TALEP', 'EKLER'],
  )
    .map((line) => line.replace(/^[\-\d.)\s]+/, '').trim())
    .filter(Boolean)

  fields['HUKUKİ DELİLLER'] = firstNonEmpty(hukukiDelillerLines) || '...'

  const hukukiNedenFromSection = firstNonEmpty(
    parseSection(
      lines,
      ['HUKUKİ NEDENLER', 'HUKUKI NEDENLER', 'HUKUKİ SEBEPLER', 'HUKUKI SEBEPLER'],
      ['SONUÇ VE İSTEM', 'SONUC VE ISTEM', 'NETİCE-İ TALEP', 'NETICE-I TALEP', 'EKLER'],
    ),
  )
  if (hukukiNedenFromSection) fields['HUKUKİ NEDENLER'] = hukukiNedenFromSection

  const continuations: Record<LabelKey, string[]> = {
    'İTİRAZ EDEN': [continuationAddress && `Adres: ${continuationAddress}`, continuationPhone && `Telefon: ${continuationPhone}`].filter(Boolean) as string[],
    'KARARINA İTİRAZ EDİLEN': [],
    'TUTANAK TARİHİ': [],
    'TUTANAK NUMARASI': [],
    KONU: [],
    'HUKUKİ NEDENLER': [],
    'HUKUKİ DELİLLER': hukukiDelillerLines.slice(1, 4),
  }

  const aciklamalar = aciklamalarLines.join(' ').replace(/\s+/g, ' ').trim() || '...'
  const sonucVeIstem = sonucLines.join(' ').replace(/\s+/g, ' ').trim() || '...'
  const ekler = eklerLines
    .map((line) => line.replace(/^[\-\d.)\s]+/, '').trim())
    .filter(Boolean)
    .slice(0, 10)

  return { title, fields, continuations, aciklamalar, sonucVeIstem, ekler }
}

function renderHighlightedResult(text: string) {
  const regex = /(\.{2,}\/\.{2,}\/20\.{2}|\d{2}\/\d{2}\/\d{4}|\([^)]*tarih[^)]*\))/gi
  const parts = text.split(regex)
  const highlightCheck = /^(\.{2,}\/\.{2,}\/20\.{2}|\d{2}\/\d{2}\/\d{4}|\([^)]*tarih[^)]*\))$/i
  return parts.map((part, index) =>
    highlightCheck.test(part) ? (
      <strong key={index}>{part}</strong>
    ) : (
      <span key={index}>{part}</span>
    ),
  )
}

export default function DilekcePage() {
  const { state } = useLocation()
  const routeState = state as DilekceRouteState | null
  const rawContent = routeState?.content?.trim() ?? ''
  const content = normalizeText(rawContent)
  const layout = useMemo(() => parseLayout(content), [content])
  const sourceRef = useRef<HTMLDivElement>(null)

  const [pdfUrl, setPdfUrl] = useState('')
  const [pdfLoading, setPdfLoading] = useState(false)
  const [pdfError, setPdfError] = useState<string | null>(null)

  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl)
    }
  }, [pdfUrl])

  useEffect(() => {
    if (!content) return

    let cancelled = false
    const generatePdf = async () => {
      setPdfLoading(true)
      setPdfError(null)
      try {
        await new Promise((resolve) => requestAnimationFrame(() => resolve(null)))
        const target = sourceRef.current
        if (!target) throw new Error('Render kaynağı bulunamadı')

        const canvas = await html2canvas(target, {
          scale: 2,
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
        const imgData = canvas.toDataURL('image/jpeg', 0.95)
        const imgWidth = pageWidth
        const imgHeight = (canvas.height * imgWidth) / canvas.width

        let heightLeft = imgHeight
        let position = 0
        pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'FAST')
        heightLeft -= pageHeight

        while (heightLeft > 0) {
          position -= pageHeight
          pdf.addPage()
          pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'FAST')
          heightLeft -= pageHeight
        }

        const totalPages = pdf.getNumberOfPages()
        pdf.setFont('times', 'normal')
        pdf.setFontSize(12)
        for (let page = 1; page <= totalPages; page += 1) {
          pdf.setPage(page)
          pdf.text(`${page} / ${totalPages}`, pageWidth / 2, pageHeight - 20, { align: 'center' })
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
  }, [content, layout])

  if (!content) {
    return (
      <main className="dp-empty">
        <h1>Henüz dilekçe yok</h1>
        <p>Dilekçe oluşturmak için önce formu doldurman gerekiyor.</p>
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

          {ORDERED_LABELS.map((label) => (
            <div key={label} className="dp-paper__block">
              <p className="dp-paper__label-row">
                <span className="dp-paper__label">{label}</span>
                <span className="dp-paper__colon">:</span>
                <span className="dp-paper__value">{layout.fields[label] || '...'}</span>
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
              {renderHighlightedResult(layout.sonucVeIstem)}
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
