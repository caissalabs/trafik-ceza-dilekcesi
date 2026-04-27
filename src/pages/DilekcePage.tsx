import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import type {
  DilekceRouteState,
} from './dilekceTypes'
import {
  buildLayout,
  DilekcePdfStage,
  generatePdfFromStage,
} from './dilekcePdf'
import './DilekcePage.css'

export default function DilekcePage() {
  const { state } = useLocation()
  const routeState = (state as DilekceRouteState | null) ?? null

  const form = routeState?.form
  const generated = routeState?.generated

  const sourceRef = useRef<HTMLDivElement>(null)
  const eklerBlockRef = useRef<HTMLDivElement>(null)
  const pdfEklerSpacerRef = useRef<HTMLDivElement>(null)
  const initialPdfUrl = routeState?.pdfUrl?.trim() || ''
  const [pdfUrl, setPdfUrl] = useState(initialPdfUrl)
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
    if (!layout || pdfUrl) return

    let cancelled = false
    const generatePdf = async () => {
      setPdfLoading(true)
      setPdfError(null)
      try {
        await new Promise((resolve) => requestAnimationFrame(() => resolve(null)))
        const target = sourceRef.current
        if (!target) throw new Error('Render kaynağı bulunamadı')
        const blobUrl = await generatePdfFromStage({
          target,
          eklerEl: eklerBlockRef.current,
          spacer: pdfEklerSpacerRef.current,
        })
        if (cancelled) {
          URL.revokeObjectURL(blobUrl)
          return
        }
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
  }, [layout, pdfUrl])

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

      <DilekcePdfStage
        layout={layout}
        sourceRef={sourceRef}
        eklerBlockRef={eklerBlockRef}
        pdfEklerSpacerRef={pdfEklerSpacerRef}
      />
    </div>
  )
}
