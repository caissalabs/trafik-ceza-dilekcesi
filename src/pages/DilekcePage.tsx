import { jsPDF } from 'jspdf'
import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import type { DilekceRouteState } from './dilekceTypes'
import './DilekcePage.css'

function normalizeText(content: string): string {
  return content
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim()
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

  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl)
    }
  }, [pdfUrl])

  useEffect(() => {
    if (!content || !sourceRef.current) return

    let cancelled = false
    const generatePdf = async () => {
      setPdfLoading(true)
      setPdfError(null)
      try {
        const doc = new jsPDF({ unit: 'pt', format: 'a4' })
        await doc.html(sourceRef.current as HTMLElement, {
          margin: [42, 42, 42, 42],
          autoPaging: 'text',
          width: 510,
          windowWidth: 900,
          html2canvas: {
            backgroundColor: '#ffffff',
            scale: 0.9,
            useCORS: true,
          },
        })

        if (cancelled) return
        const nextPdfUrl = String(doc.output('bloburl'))
        setPdfUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev)
          return nextPdfUrl
        })
      } catch {
        if (!cancelled) setPdfError('PDF oluşturulurken bir hata oluştu.')
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
            PDF indir
          </a>
        </div>
      </header>

      <main className="dp-main">
        {pdfLoading ? <p className="dp-status">PDF hazırlanıyor...</p> : null}
        {pdfError ? <p className="dp-error">{pdfError}</p> : null}

        {pdfUrl ? (
          <iframe
            title="Dilekçe PDF Önizleme"
            className="dp-viewer"
            src={pdfUrl}
          />
        ) : (
          <section className="dp-fallback-preview">
            <h2>Metin Önizleme</h2>
            <pre>{content}</pre>
          </section>
        )}
      </main>

      {/* PDF render kaynağı (Türkçe karakter bozulmaması için HTML render) */}
      <div className="dp-print-source" aria-hidden>
        <div ref={sourceRef} className="dp-paper">
          {content.split('\n').map((line, index) => (
            <p key={index}>{line || '\u00A0'}</p>
          ))}
        </div>
      </div>
    </div>
  )
}
