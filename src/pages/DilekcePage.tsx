import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { Link, useLocation } from 'react-router-dom'
import type {
  DilekceRouteState,
} from './dilekceTypes'
import {
  buildLayout,
  generatePdfFromLayout,
} from './dilekcePdf'
import './DilekcePage.css'

export default function DilekcePage() {
  const { state } = useLocation()
  const routeState = (state as DilekceRouteState | null) ?? null

  const form = routeState?.form
  const generated = routeState?.generated

  const initialPdfUrl = routeState?.pdfUrl?.trim() || ''
  const [pdfUrl, setPdfUrl] = useState(initialPdfUrl)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [pdfError, setPdfError] = useState<string | null>(null)
  const ownedPdfUrlRef = useRef<string | null>(null)

  const layout = useMemo(
    () => (form && generated ? buildLayout(form, generated) : null),
    [form, generated],
  )

  useEffect(() => {
    return () => {
      if (ownedPdfUrlRef.current) {
        URL.revokeObjectURL(ownedPdfUrlRef.current)
        ownedPdfUrlRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!layout || pdfUrl) return

    let cancelled = false
    const generatePdf = async () => {
      setPdfLoading(true)
      setPdfError(null)
      try {
        const pdfBlob = await generatePdfFromLayout(layout)
        const blobUrl = URL.createObjectURL(pdfBlob)
        if (cancelled) {
          URL.revokeObjectURL(blobUrl)
          return
        }
        if (ownedPdfUrlRef.current) {
          URL.revokeObjectURL(ownedPdfUrlRef.current)
        }
        ownedPdfUrlRef.current = blobUrl
        setPdfUrl(blobUrl)
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

  const handleDownload = useCallback(
    async (e: MouseEvent<HTMLAnchorElement>) => {
      if (!pdfUrl) {
        e.preventDefault()
        return
      }

      // Blob URL download is made explicit to avoid viewer-specific failures.
      e.preventDefault()
      try {
        const response = await fetch(pdfUrl)
        if (!response.ok) throw new Error('PDF indirilemedi')
        const blob = await response.blob()
        const tempUrl = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = tempUrl
        a.download = 'trafik-cezasina-itiraz-dilekcesi.pdf'
        document.body.appendChild(a)
        a.click()
        a.remove()
        URL.revokeObjectURL(tempUrl)
      } catch {
        setPdfError('PDF indirilemedi. Lütfen tekrar deneyin.')
      }
    },
    [pdfUrl],
  )

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
            onClick={handleDownload}
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

    </div>
  )
}
