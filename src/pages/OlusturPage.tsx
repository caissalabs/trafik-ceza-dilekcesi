import { jsPDF } from 'jspdf'
import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import './OlusturPage.css'

interface FormState {
  birim: string
  seriNo: string
  siraNo: string
  plaka: string
  tarih: string
  saat: string
  ihlalMaddesi: string
  cezaTutari: string
  not: string
  ihlalYeri: string
  ihlalEdenAd: string
  ihlalEdenTc: string
  olayAkisi: string
  ekler: string[]
}

type DilekceResponse = { output?: string; error?: string }

const INITIAL: FormState = {
  birim: '',
  seriNo: '',
  siraNo: '',
  plaka: '',
  tarih: '',
  saat: '',
  ihlalMaddesi: '',
  cezaTutari: '',
  not: '',
  ihlalYeri: '',
  ihlalEdenAd: '',
  ihlalEdenTc: '',
  olayAkisi: '',
  ekler: [''],
}

function formatDateForPrompt(dateIso: string): string {
  if (!dateIso) return ''
  const [year, month, day] = dateIso.split('-')
  if (!year || !month || !day) return dateIso
  return `${day}/${month}/${year}`
}

function createPdfBlobUrl(text: string): string {
  const doc = new jsPDF({
    unit: 'pt',
    format: 'a4',
  })
  const margin = 56
  const lineHeight = 16
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const maxTextWidth = pageWidth - margin * 2
  let y = margin

  doc.setFont('times', 'normal')
  doc.setFontSize(12)

  const paragraphs = text
    .replace(/\r\n/g, '\n')
    .split('\n')

  for (const paragraph of paragraphs) {
    const value = paragraph.trim()
    if (!value) {
      y += lineHeight
      continue
    }

    const lines = doc.splitTextToSize(value, maxTextWidth) as string[]
    for (const line of lines) {
      if (y > pageHeight - margin) {
        doc.addPage()
        y = margin
      }
      doc.text(line, margin, y)
      y += lineHeight
    }
  }

  return String(doc.output('bloburl'))
}

export default function OlusturPage() {
  const [form, setForm] = useState<FormState>(INITIAL)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [generatedText, setGeneratedText] = useState('')
  const [pdfUrl, setPdfUrl] = useState('')

  const apiBase = useMemo(() => {
    const raw = import.meta.env.VITE_API_BASE_URL as string | undefined
    return raw && raw.trim().length > 0 ? raw.trim().replace(/\/+$/, '') : ''
  }, [])

  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl)
    }
  }, [pdfUrl])

  const fillTestData = () => {
    setForm({
      birim: 'İzmir Trafik Denetleme Şube Müdürlüğü',
      seriNo: 'MA',
      siraNo: '45871236',
      plaka: '35 ABC 123',
      tarih: '2026-03-15',
      saat: '14:35',
      ihlalMaddesi: '47/1-B',
      cezaTutari: '1.506',
      not: 'Sürücünün kırmızı ışık ihlali yaptığı tespit edilmiştir.',
      ihlalYeri: 'İzmir Atatürk Caddesi Alsancak',
      ihlalEdenAd: 'Ahmet Yılmaz',
      ihlalEdenTc: '12345678901',
      olayAkisi:
        'Belirtilen tarih ve saatte aracımla seyir halindeydim. İlgili kavşağa yaklaştığımda trafik ışığının sarıdan kırmızıya döndüğü esnada ani fren yapmanın trafik güvenliğini tehlikeye atacağını düşünerek kontrollü şekilde geçiş yaptım. Herhangi bir kasıtlı ihlal söz konusu değildir. Ayrıca olay yerinde trafik akışının yoğun olması nedeniyle ani duruşun arkadan çarpma riskini artıracağı kanaatindeyim. Bu sebeplerle tarafıma yazılan cezanın haksız olduğunu düşünüyorum.',
      ekler: ['Trafik Ceza Tutanağı', 'Sürücü Belgesi Fotokopisi', 'Ruhsat Fotokopisi'],
    })
  }

  const set = (field: keyof Omit<FormState, 'ekler'>) =>
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }))

  const setEk = (idx: number, value: string) => {
    setForm((prev) => {
      const ekler = [...prev.ekler]
      ekler[idx] = value
      return { ...prev, ekler }
    })
  }

  const addEk = () =>
    setForm((prev) => ({ ...prev, ekler: [...prev.ekler, ''] }))

  const removeEk = (idx: number) =>
    setForm((prev) => ({
      ...prev,
      ekler: prev.ekler.filter((_, i) => i !== idx),
    }))

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!e.currentTarget.checkValidity()) {
      e.currentTarget.reportValidity()
      return
    }

    setLoading(true)
    setError(null)

    try {
      const payload = {
        ...form,
        tarih: formatDateForPrompt(form.tarih),
        ekler: form.ekler.map((item) => item.trim()).filter((item) => item.length > 0),
      }

      const response = await fetch(`${apiBase}/api/dilekce`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ form: payload }),
      })

      const data = (await response.json()) as DilekceResponse
      if (!response.ok || !data.output) {
        throw new Error(data.error || 'Dilekçe oluşturulamadı')
      }

      const nextPdfUrl = createPdfBlobUrl(data.output)
      setGeneratedText(data.output)
      setPdfUrl((previousUrl) => {
        if (previousUrl) URL.revokeObjectURL(previousUrl)
        return nextPdfUrl
      })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Beklenmeyen bir hata oluştu')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="op-root">
      {/* ── NAVBAR ── */}
      <nav className="op-nav">
        <Link to="/" className="op-nav__logo">
          trafik<span className="op-nav__dot">.</span>ceza
        </Link>
        <Link to="/" className="op-nav__back">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Ana Sayfa
        </Link>
      </nav>

      {/* ── MAIN ── */}
      <main className="op-main">
        {loading ? (
          <section className="op-loading-screen" aria-live="polite" aria-busy="true">
            <div className="op-loading-card">
              <span className="op-loading-spinner" aria-hidden />
              <h2>Dilekçen hazırlanıyor...</h2>
              <p>
                Bilgilerin GPT&apos;ye gönderildi. Hukuki metin oluşturuluyor, lütfen bekleyin.
              </p>
            </div>
          </section>
        ) : null}

        {error ? (
          <div className="op-error" role="alert">
            {error}
          </div>
        ) : null}

        {pdfUrl ? (
          <section className="op-result" aria-live="polite">
            <div className="op-result__header">
              <h2>Dilekçen PDF olarak hazır</h2>
              <a href={pdfUrl} download="trafik-cezasina-itiraz-dilekcesi.pdf" className="op-result__download">
                PDF indir
              </a>
            </div>
            <iframe
              title="Dilekçe PDF Önizleme"
              className="op-result__viewer"
              src={pdfUrl}
            />
            <details className="op-result__text">
              <summary>Üretilen metni göster</summary>
              <pre>{generatedText}</pre>
            </details>
          </section>
        ) : null}

        <div className="op-header">
          <p className="op-eyebrow">Adım 1 / 2</p>
          <h1 className="op-title">Ceza Tutanağı Bilgilerini Gir</h1>
          <p className="op-subtitle">
            Tutanaktaki bilgileri eksiksiz doldur. Yapay zeka senin için en güçlü itiraz dilekçesini hazırlayacak.
          </p>
          <div className="op-header__actions">
            <button type="button" className="op-btn-test" onClick={fillTestData}>
              Test et (formu doldur)
            </button>
          </div>
        </div>

        <form className="op-form" onSubmit={handleSubmit} noValidate>

          {/* ─── BÖLÜM 1: TUTANAK BİLGİLERİ ─── */}
          <fieldset className="op-fieldset">
            <legend className="op-fieldset__legend">
              <span className="op-fieldset__icon" aria-hidden>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <rect x="2" y="2" width="14" height="14" rx="3" stroke="currentColor" strokeWidth="1.6"/>
                  <path d="M5.5 6.5h7M5.5 9h7M5.5 11.5h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
              </span>
              Tutanak Bilgileri
            </legend>

            <div className="op-field op-field--full">
              <label className="op-label" htmlFor="birim">
                Cezayı Düzenleyen Birim
                <span className="op-label__required" aria-hidden> *</span>
              </label>
              <input
                id="birim"
                className="op-input"
                type="text"
                placeholder="Örn: Gümüşhane Trafik Tescil ve Denetleme Şube Müdürlüğü…"
                value={form.birim}
                onChange={set('birim')}
                required
              />
              <p className="op-hint">Davalı yan ve yetkili Sulh Ceza Hakimliği bu bilgiye göre belirlenir.</p>
            </div>

            <div className="op-row">
              <div className="op-field">
                <label className="op-label" htmlFor="seriNo">
                  Seri No
                  <span className="op-label__required" aria-hidden> *</span>
                </label>
                <input
                  id="seriNo"
                  className="op-input op-input--short"
                  type="text"
                  placeholder="Örn: MA"
                  value={form.seriNo}
                  onChange={set('seriNo')}
                  required
                />
              </div>
              <div className="op-field">
                <label className="op-label" htmlFor="siraNo">
                  Sıra No
                  <span className="op-label__required" aria-hidden> *</span>
                </label>
                <input
                  id="siraNo"
                  className="op-input"
                  type="text"
                  placeholder="Örn: 39965277"
                  value={form.siraNo}
                  onChange={set('siraNo')}
                  required
                />
              </div>
            </div>

            <div className="op-row">
              <div className="op-field">
                <label className="op-label" htmlFor="tarih">
                  Ceza Tarihi
                  <span className="op-label__required" aria-hidden> *</span>
                </label>
                <input
                  id="tarih"
                  className="op-input"
                  type="date"
                  value={form.tarih}
                  onChange={set('tarih')}
                  required
                />
              </div>
              <div className="op-field">
                <label className="op-label" htmlFor="saat">
                  Ceza Saati
                  <span className="op-label__required" aria-hidden> *</span>
                </label>
                <input
                  id="saat"
                  className="op-input"
                  type="time"
                  value={form.saat}
                  onChange={set('saat')}
                  required
                />
              </div>
            </div>

          </fieldset>

          {/* ─── BÖLÜM 2: ARAÇ VE İHLAL BİLGİLERİ ─── */}
          <fieldset className="op-fieldset">
            <legend className="op-fieldset__legend">
              <span className="op-fieldset__icon" aria-hidden>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M3 11.5h12M4.5 11.5l1.5-4h6l1.5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="6" cy="13" r="1.2" stroke="currentColor" strokeWidth="1.4"/>
                  <circle cx="12" cy="13" r="1.2" stroke="currentColor" strokeWidth="1.4"/>
                  <path d="M6.5 7.5l.5-2h4l.5 2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </span>
              Araç ve İhlal Bilgileri
            </legend>

            <div className="op-row">
              <div className="op-field">
                <label className="op-label" htmlFor="plaka">
                  Araç Plakası
                  <span className="op-label__required" aria-hidden> *</span>
                </label>
                <input
                  id="plaka"
                  className="op-input op-input--plaka"
                  type="text"
                  placeholder="Örn: 35 XYZ 1912"
                  value={form.plaka}
                  onChange={set('plaka')}
                  required
                />
              </div>
              <div className="op-field">
                <label className="op-label" htmlFor="ihlalMaddesi">
                  İhlal Edilen Kanun Maddesi
                  <span className="op-label__required" aria-hidden> *</span>
                </label>
                <input
                  id="ihlalMaddesi"
                  className="op-input"
                  type="text"
                  placeholder="Örn: 46/2-H"
                  value={form.ihlalMaddesi}
                  onChange={set('ihlalMaddesi')}
                  required
                />
              </div>
            </div>

            <div className="op-row">
              <div className="op-field op-field--grow">
                <label className="op-label" htmlFor="ihlalYeri">
                  İhlalin Yeri
                  <span className="op-label__required" aria-hidden> *</span>
                </label>
                <input
                  id="ihlalYeri"
                  className="op-input"
                  type="text"
                  placeholder="Örn: Atatürk Caddesi Gratis Önü"
                  value={form.ihlalYeri}
                  onChange={set('ihlalYeri')}
                  required
                />
              </div>
              <div className="op-field">
                <label className="op-label" htmlFor="cezaTutari">
                  Toplam Ceza Tutarı
                  <span className="op-label__required" aria-hidden> *</span>
                </label>
                <div className="op-input-prefix-wrap">
                  <span className="op-input-prefix">₺</span>
                  <input
                    id="cezaTutari"
                    className="op-input op-input--prefixed"
                    type="text"
                    placeholder="Örn: 1.000"
                    value={form.cezaTutari}
                    onChange={set('cezaTutari')}
                    required
                  />
                </div>
              </div>
            </div>

            <div className="op-field op-field--full">
              <label className="op-label" htmlFor="not">
                Tutanaktaki Notlar
              </label>
              <textarea
                id="not"
                className="op-textarea op-textarea--sm"
                placeholder="Memurun tutanağa düştüğü şerhler veya notlar (varsa)"
                value={form.not}
                onChange={set('not')}
                rows={3}
              />
            </div>

          </fieldset>

          {/* ─── BÖLÜM 3: KİŞİ BİLGİLERİ ─── */}
          <fieldset className="op-fieldset">
            <legend className="op-fieldset__legend">
              <span className="op-fieldset__icon" aria-hidden>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <circle cx="9" cy="6.5" r="2.8" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M3.5 15c0-3.038 2.462-5.5 5.5-5.5s5.5 2.462 5.5 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </span>
              Kural İhlal Edenin Bilgileri
            </legend>

            <div className="op-row">
              <div className="op-field op-field--grow">
                <label className="op-label" htmlFor="ihlalEdenAd">
                  Ad Soyad
                  <span className="op-label__required" aria-hidden> *</span>
                </label>
                <input
                  id="ihlalEdenAd"
                  className="op-input"
                  type="text"
                  placeholder="Örn: Fatih AVCI"
                  value={form.ihlalEdenAd}
                  onChange={set('ihlalEdenAd')}
                  required
                />
              </div>
              <div className="op-field">
                <label className="op-label" htmlFor="ihlalEdenTc">
                  TC Kimlik No
                  <span className="op-label__required" aria-hidden> *</span>
                </label>
                <input
                  id="ihlalEdenTc"
                  className="op-input"
                  type="text"
                  placeholder="Örn: 12345678901"
                  maxLength={11}
                  value={form.ihlalEdenTc}
                  onChange={set('ihlalEdenTc')}
                  required
                />
              </div>
            </div>

          </fieldset>

          {/* ─── BÖLÜM 4: OLAY AKIŞI ─── */}
          <fieldset className="op-fieldset">
            <legend className="op-fieldset__legend">
              <span className="op-fieldset__icon" aria-hidden>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M3 5h12M3 9h8M3 13h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </span>
              Dilekçeye Eklenecek Bilgiler
            </legend>

            <div className="op-field op-field--full">
              <label className="op-label" htmlFor="olayAkisi">
                Olay Akışı ve Ek Hususlar
                <span className="op-label__required" aria-hidden> *</span>
              </label>
              <textarea
                id="olayAkisi"
                className="op-textarea"
                placeholder="Olayın nasıl gerçekleştiğini, neden haksız olduğunu düşündüğünüzü veya dilekçeye eklemek istediğiniz herhangi bir husus varsa buraya yazın…"
                value={form.olayAkisi}
                onChange={set('olayAkisi')}
                rows={6}
                required
              />
              <p className="op-hint">Yapay zeka bu bilgileri kullanarak dilekçeni kişiselleştirecek.</p>
            </div>

          </fieldset>

          {/* ─── BÖLÜM 5: EKLER ─── */}
          <fieldset className="op-fieldset">
            <legend className="op-fieldset__legend">
              <span className="op-fieldset__icon" aria-hidden>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M4 9.5V5a3 3 0 016 0v8a1.5 1.5 0 01-3 0V6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </span>
              Ekler
            </legend>

            <p className="op-fieldset__desc">
              Dilekçeye fiziksel olarak ekleyeceğiniz belgelerin isimlerini girin. Ceza tutanağı veya e-devlet çıktısı eklemeniz tavsiye edilir.
            </p>

            <div className="op-ekler">
              {form.ekler.map((ek, idx) => (
                <div key={idx} className="op-ek-row">
                  <span className="op-ek-num">{idx + 1}.</span>
                  <input
                    className="op-input"
                    type="text"
                    placeholder={idx === 0 ? 'Örn: Trafik Ceza Tutanağı' : idx === 1 ? 'Örn: Sürücü Belgesi Fotokopisi' : 'Belge adı'}
                    value={ek}
                    onChange={(e) => setEk(idx, e.target.value)}
                  />
                  {form.ekler.length > 1 && (
                    <button
                      type="button"
                      className="op-ek-remove"
                      onClick={() => removeEk(idx)}
                      aria-label="Eki sil"
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                        <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                      </svg>
                    </button>
                  )}
                </div>
              ))}
              <button type="button" className="op-add-ek" onClick={addEk}>
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden>
                  <path d="M7.5 2v11M2 7.5h11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
                Ek Ekle
              </button>
            </div>

          </fieldset>

          {/* ─── GÖNDER ─── */}
          <div className="op-submit-row">
            <button type="submit" className="op-btn-submit">
              Dilekçemi Oluştur
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
                <path d="M3.5 9h11M10 4.5l4.5 4.5-4.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>

        </form>
      </main>
    </div>
  )
}
