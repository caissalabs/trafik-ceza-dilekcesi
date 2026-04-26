import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import type { DilekceRouteState } from './dilekceTypes'
import './DilekcePage.css'

const A4_WIDTH_PX = 794
const A4_HEIGHT_PX = 1123

interface ParsedSection {
  kind: 'heading' | 'label' | 'paragraph' | 'spacer'
  text: string
}

function normalizeText(content: string): string {
  return content
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim()
}

function parseLine(rawLine: string): ParsedSection {
  const line = rawLine.trim()
  if (!line) return { kind: 'spacer', text: '' }

  const isAllUpper =
    line.length <= 80 &&
    line === line.toLocaleUpperCase('tr-TR') &&
    /[A-ZÇĞİÖŞÜ]/.test(line)

  if (isAllUpper && line.length < 60) {
    return { kind: 'heading', text: line }
  }

  const labelMatch = line.match(/^([A-ZÇĞİÖŞÜa-zçğıöşü\s\-İÇŞĞÜÖ.]{3,40})\s*:\s*(.*)$/)
  if (labelMatch && labelMatch[1].length < 40 && labelMatch[1].split(' ').length <= 5) {
    return { kind: 'label', text: line }
  }

  return { kind: 'paragraph', text: line }
}

export default function DilekcePage() {
  const { state } = useLocation()
  const routeState = state as DilekceRouteState | null
  const rawContent = routeState?.content?.trim() ?? ''
  const content = normalizeText(rawContent)
  const sourceRef = useRef<HTMLDivElement>(null)

  const [pdfUrl, setPdfUrl] = useState('')
  const [pdfLoading, setPdfLoading] = useState(false)
  const [pdfError, setPdfError] = useState<string | null>(null)

  const sections = useMemo<ParsedSection[]>(() => {
    if (!content) return []
    return content.split('\n').map(parseLine)
  }, [content])

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

        const imgWidth = pageWidth
        const imgHeight = (canvas.height * imgWidth) / canvas.width

        const imgData = canvas.toDataURL('image/jpeg', 0.95)

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
  }, [content])

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
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden>
              <path
                d="M7.5 2v8M4.5 7l3 3 3-3M3 12h9"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
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
            <iframe
              title="Dilekçe PDF Önizleme"
              className="dp-viewer"
              src={pdfUrl}
            />
          )}
        </div>
      </main>

      {/* PDF render kaynağı */}
      <div className="dp-print-stage" aria-hidden>
        <div ref={sourceRef} className="dp-paper">
          {sections.map((section, index) => {
            if (section.kind === 'spacer') {
              return <div key={index} className="dp-paper__spacer" />
            }
            if (section.kind === 'heading') {
              return (
                <h3 key={index} className="dp-paper__heading">
                  {section.text}
                </h3>
              )
            }
            if (section.kind === 'label') {
              const colon = section.text.indexOf(':')
              const label = section.text.slice(0, colon).trim()
              const value = section.text.slice(colon + 1).trim()
              return (
                <p key={index} className="dp-paper__label-row">
                  <span className="dp-paper__label">{label}</span>
                  <span className="dp-paper__colon">:</span>
                  <span className="dp-paper__value">{value || '\u00A0'}</span>
                </p>
              )
            }
            return (
              <p key={index} className="dp-paper__paragraph">
                {section.text}
              </p>
            )
          })}
        </div>
      </div>
    </div>
  )
}
