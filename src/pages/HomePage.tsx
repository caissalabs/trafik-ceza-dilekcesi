import { useEffect, useMemo, useState, type MouseEvent } from 'react'
import { Link } from 'react-router-dom'
import './HomePage.css'

type ChatResponse = { output?: string }

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Tek sayfa: `/` veya `/home` (ileride router ile uyumlu). */
function isHomePath(): boolean {
  const p = window.location.pathname.replace(/\/+$/, '') || '/'
  return p === '/' || p === '/home'
}

function smoothScrollToElementId(id: string): void {
  const el = document.getElementById(id)
  if (!el) return
  el.scrollIntoView({
    behavior: prefersReducedMotion() ? 'instant' : 'smooth',
    block: 'start',
  })
  window.history.replaceState(null, '', `#${id}`)
}

function onHomePageHashLink(e: MouseEvent<HTMLAnchorElement>, id: string): void {
  if (!isHomePath()) return
  e.preventDefault()
  smoothScrollToElementId(id)
}

const STEPS = [
  {
    n: '01',
    title: 'Ceza Tutanağını Gir',
    desc: 'Tutanaktaki bilgileri forma gir. Tarih, madde, açıklama - hepsi bu.',
  },
  {
    n: '02',
    title: 'Dilekçeni Oluştur',
    desc:
      'Sistemimiz bilgileri analiz eder ve itiraz dilekçeni anında yazar. Yetkili sulh ceza hakimliği otomatik belirlenir. Özel olarak eğitilmiş yapay zeka, olayına en uygun kanun maddelerini ve yargı kararlarını bulup dilekçeni zenginleştirir.',
  },
  {
    n: '03',
    title: 'İndir ve İlet',
    desc: 'Dilekçeni indir, imzala, ilgili birime teslim et.',
  },
]

const PRICING_BULLETS = [
  '1 dakikada hazır',
  'PDF olarak indir',
  'Abonelik yok',
]

const FAQS = [
  {
    q: 'Bilgilerim saklanıyor mu?',
    a:
      'Sisteme girdiğiniz hiçbir bilgi tarafımızca görüntülenemez. Tüm veriler uçtan uca şifrelenir; girdiğiniz bilgilere yalnızca siz erişebilirsiniz. Üçüncü taraflarla herhangi bir veri paylaşımı yapılmaz.',
  },
  {
    q: 'İtiraz süresi ne kadar?',
    a:
      "Trafik cezasına tebliğden itibaren 15 gün içinde ilgili Sulh Ceza Hakimliği'ne itiraz edebilirsiniz. Bu süreyi kaçırmamak son derece önemlidir. Sistemimiz dilekçenizi saniyeler içinde hazırlar.",
  },
  {
    q: 'Hangi ceza türlerine itiraz yapabilirim?',
    a:
      'Karayolları Trafik Kanunu kapsamında düzenlenen idari para cezalarına itiraz edebilirsiniz. Hız ihlali, park cezası, sinyal ihlali, alkollü araç kullanma ve şerit ihlali gibi yaygın ceza türleri desteklenmektedir.',
  },
  {
    q: "Türkiye'de en çok hangi trafik cezaları kesiliyor?",
    a:
      "Emniyet Genel Müdürlüğü verilerine göre Türkiye'de yılda 25 milyonun üzerinde trafik cezası düzenlenmektedir. En sık kesilen cezalar sırasıyla hız ihlali, hatalı park, sinyal ihlali, şerit ihlali ve belgesiz araç kullanımıdır. Sürücülerin büyük çoğunluğu bu cezalara itiraz etme hakkından habersiz olduğu için cezaları doğrudan ödemektedir.",
  },
  {
    q: 'İtiraz etmek mantıklı mı?',
    a:
      "İtiraz hakkı, Karayolları Trafik Kanunu'nun size tanıdığı yasal bir haktır. Her itirazın kabul edileceği garanti edilemez; ancak usule uygun, gerekçeli ve zamanında yapılan itirazlar değerlendirmeye alınır. Özellikle tutanakta eksik bilgi, yanlış tespit veya usul hatası bulunduğunu düşünüyorsanız itiraz etmek hakkınızdır.",
  },
  {
    q: "Davalı tarafı ve Sulh Ceza Hakimliği'ni nasıl belirliyorsunuz?",
    a:
      "Sistemimiz, cezayı düzenleyen birimin bilgisini analiz ederek davalı tarafı otomatik olarak belirler. Yetkili Sulh Ceza Hakimliği ise Türkiye genelindeki adli yargı yapılanmasına ilişkin güncel veriler doğrultusunda sistemimiz tarafından tespit edilir. Dilekçeniz oluşturulmadan önce bu bilgiler size gösterilir ve onayınız alınır. Onay sonrası sorumluluk kullanıcıya aittir.",
  },
  {
    q: 'Ödeme ne zaman alınır?',
    a:
      'Dilekçenizi indirmeden önce tek seferlik ödeme yapmanız gerekir. Abonelik sistemi yoktur, her dilekçe için ayrı ödeme alınır.',
  },
  {
    q: 'Hangi formatta indirebilirim?',
    a:
      "Dilekçeniz PDF formatında hazırlanır. Çıktı alıp imzaladıktan sonra ilgili Sulh Ceza Hakimliği'ne şahsen teslim edebilir ya da posta yoluyla gönderebilirsiniz.",
  },
  {
    q: 'İtirazım kabul edilmezse ne olur?',
    a:
      "İtirazın sonucu tamamen mahkemenin takdirindedir. Ödenen ücret, itirazın sonucundan bağımsız olarak iade edilmez. Sonuç konusunda herhangi bir taahhütte bulunulmamaktadır. Davanızın karmaşık olduğunu düşünüyorsanız bir avukattan destek almanızı öneririz.",
  },
]

export default function HomePage() {
  const [gptModalOpen, setGptModalOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [output, setOutput] = useState<string>('')
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [showScrollTop, setShowScrollTop] = useState(false)

  const apiBase = useMemo(() => {
    const raw = import.meta.env.VITE_API_BASE_URL as string | undefined
    return raw && raw.trim().length > 0 ? raw.trim().replace(/\/+$/, '') : ''
  }, [])

  const closeGptModal = () => {
    setGptModalOpen(false)
    setError(null)
    setOutput('')
    setLoading(false)
  }

  const onDemo = async () => {
    setLoading(true)
    setError(null)
    setOutput('')
    try {
      const resp = await fetch(`${apiBase}/api/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ input: 'buttona bastım' }),
      })
      if (!resp.ok) {
        const text = await resp.text()
        throw new Error(text || `Request failed (${resp.status})`)
      }
      const data = (await resp.json()) as ChatResponse
      setOutput(data.output ?? '')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!gptModalOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setGptModalOpen(false)
        setError(null)
        setOutput('')
        setLoading(false)
      }
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [gptModalOpen])

  useEffect(() => {
    const threshold = 360
    const onScroll = () => {
      setShowScrollTop(window.scrollY > threshold)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const scrollPageToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: prefersReducedMotion() ? 'instant' : 'smooth',
    })
    const { pathname, search } = window.location
    window.history.replaceState(null, '', `${pathname}${search}`)
  }

  return (
    <>
      <div className="lp-first-screen">
      {/* ───────── NAVBAR ───────── */}
      <nav className="lp-nav">
        <span className="lp-nav__logo">trafik<span className="lp-nav__dot">.</span>ceza</span>
        <ul className="lp-nav__links" role="list">
          <li>
            <a href="#how" onClick={(e) => onHomePageHashLink(e, 'how')}>
              Nasıl Çalışır
            </a>
          </li>
          <li>
            <a href="#pricing" onClick={(e) => onHomePageHashLink(e, 'pricing')}>
              Fiyatlar
            </a>
          </li>
          <li>
            <a href="#faq" onClick={(e) => onHomePageHashLink(e, 'faq')}>
              Sık Sorulan Sorular
            </a>
          </li>
        </ul>
        <div className="lp-nav__actions">
          <button
            type="button"
            className="lp-nav__gpt"
            onClick={() => setGptModalOpen(true)}
          >
            GPT test et
          </button>
          <Link to="/olustur" className="lp-nav__cta">
            Dilekçeni Oluştur
          </Link>
        </div>
      </nav>

      {/* ───────── HERO ───────── */}
      <section className="lp-hero" id="hero">
        <div className="lp-hero__bg" aria-hidden>
          <div className="lp-hero__glow lp-hero__glow--1" />
          <div className="lp-hero__glow lp-hero__glow--2" />
          <div className="lp-hero__grid" />
        </div>
        <div className="lp-hero__inner">
          <h1 className="lp-hero__title">
            Trafik Cezana İtiraz<br />
            Dilekçeni{' '}
            <span className="lp-hero__accent">Anında</span> Hazırla
          </h1>
          <p className="lp-hero__sub">
          Ceza bilgilerini gir - yapay zeka senin için en iyi itiraz dilekçesini hazırlasın.
          </p>
          <div className="lp-hero__ctas">
            <Link to="/olustur" className="lp-btn lp-btn--primary lp-btn--hero">
              Dilekçeni Oluştur
              <svg className="lp-btn__icon" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </Link>
            <a
              href="#how"
              className="lp-btn lp-btn--ghost"
              onClick={(e) => onHomePageHashLink(e, 'how')}
            >
              Nasıl Çalışır?
            </a>
          </div>
          <div className="lp-hero__trust">
            <span className="lp-hero__trust-item">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                <path d="M7 1l1.5 3.2L12 4.7l-2.5 2.5.6 3.5L7 9.2l-3.1 1.5.6-3.5L2 4.7l3.5-.5L7 1z" fill="var(--accent)" stroke="var(--accent)" strokeWidth="0.5"/>
              </svg>
              PDF olarak indir
            </span>
            <span className="lp-hero__trust-sep" aria-hidden>·</span>
            <span className="lp-hero__trust-item">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                <path d="M7 1l1.5 3.2L12 4.7l-2.5 2.5.6 3.5L7 9.2l-3.1 1.5.6-3.5L2 4.7l3.5-.5L7 1z" fill="var(--accent)" stroke="var(--accent)" strokeWidth="0.5"/>
              </svg>
              Abonelik yok
            </span>
            <span className="lp-hero__trust-sep" aria-hidden>·</span>
            <span className="lp-hero__trust-item">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                <path d="M7 1l1.5 3.2L12 4.7l-2.5 2.5.6 3.5L7 9.2l-3.1 1.5.6-3.5L2 4.7l3.5-.5L7 1z" fill="var(--accent)" stroke="var(--accent)" strokeWidth="0.5"/>
              </svg>
              Veriler saklanmaz
            </span>
          </div>
        </div>
        <a
          href="#how"
          className="lp-hero__scroll"
          aria-label="Aşağı kaydır"
          onClick={(e) => onHomePageHashLink(e, 'how')}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
            <path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </a>
      </section>
      </div>

      {/* ───────── HOW IT WORKS ───────── */}
      <section className="lp-section lp-section--alt" id="how">
        <div className="lp-container">
          <p className="lp-eyebrow lp-center">Sadece 3 Adım</p>
          <h2 className="lp-section__title lp-center">Nasıl Çalışır?</h2>
          <div className="lp-steps">
            {STEPS.map((s) => (
              <div key={s.n} className="lp-step">
                <span className="lp-step__n" aria-hidden>{s.n}</span>
                <h3 className="lp-step__title">{s.title}</h3>
                <p className="lp-step__desc">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────── PRICING ───────── */}
      <section className="lp-section lp-section--alt" id="pricing">
        <div className="lp-container">
          <p className="lp-eyebrow lp-center lp-pricing__eyebrow">Fiyatlandırma</p>
          <div className="lp-plan-single">
            <article className="lp-plan lp-plan--highlight lp-plan--solo lp-plan--simple">
              <h2 className="lp-plan__lead">
                <span className="lp-plan__leadStrong">Tek fiyat.</span>
                <span className="lp-plan__leadMuted">Hepsi bu.</span>
              </h2>
              <p className="lp-plan__price">
                ₺24<span className="lp-plan__cents">,99</span>
              </p>
              <p className="lp-plan__perUnit">her dilekçe için</p>
              <ul
                className="lp-plan__features lp-plan__features--simple"
                role="list"
              >
                {PRICING_BULLETS.map((f) => (
                  <li key={f}>
                    <span className="lp-plan__tick" aria-hidden>
                      ✔
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
              <div className="lp-plan__actions">
                <Link to="/olustur" className="lp-btn lp-btn--full lp-btn--primary">
                  Dilekçeni Oluştur
                </Link>
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* ───────── FAQ ───────── */}
      <section className="lp-section" id="faq">
        <div className="lp-container lp-container--narrow">
          <p className="lp-eyebrow lp-center">Merak Edilenler</p>
          <h2 className="lp-section__title lp-center">Sık Sorulan Sorular</h2>
          <div className="lp-faq">
            {FAQS.map((f, i) => (
              <div
                key={i}
                className={`lp-faq__item${openFaq === i ? ' lp-faq__item--open' : ''}`}
              >
                <button
                  type="button"
                  className="lp-faq__q"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  aria-expanded={openFaq === i}
                >
                  {f.q}
                  <span className="lp-faq__arrow" aria-hidden>
                    {openFaq === i ? '▲' : '▼'}
                  </span>
                </button>
                {openFaq === i && <p className="lp-faq__a">{f.a}</p>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────── FOOTER ───────── */}
      <footer className="lp-footer">
        <div className="lp-container lp-footer__inner">
          <span className="lp-nav__logo">trafik<span className="lp-nav__dot">.</span>ceza</span>
          <p className="lp-footer__note">
            Bu sistem hukuki danışmanlık hizmeti vermez; resmi başvurularda bir
            hukuk uzmanına danışmanız önerilir.
          </p>
          <p className="lp-footer__copy">© {new Date().getFullYear()} trafik.ceza - Tüm hakları saklıdır.</p>
        </div>
      </footer>

      <button
        type="button"
        className={`lp-scroll-top${showScrollTop ? ' lp-scroll-top--visible' : ''}`}
        onClick={scrollPageToTop}
        aria-label="Sayfanın başına kaydır"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
          <path
            d="M10 16V4M6 8l4-4 4 4"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {gptModalOpen ? (
        <div
          className="lp-modal-root"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeGptModal()
          }}
        >
          <div
            className="lp-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="gpt-modal-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="lp-modal__close"
              onClick={closeGptModal}
              aria-label="Kapat"
            >
              ×
            </button>
            <h2 id="gpt-modal-title" className="lp-modal__title">
              GPT bağlantı testi
            </h2>
            <p className="lp-modal__desc">
              Aşağıdaki buton GPT’ye “buttona bastım” mesajını gönderir; cevabı
              burada görürsün.
            </p>
            <button
              type="button"
              className="lp-btn lp-btn--accent lp-modal__send"
              onClick={onDemo}
              disabled={loading}
            >
              {loading ? 'Yanıt bekleniyor…' : 'GPT’ye gönder'}
            </button>
            {error ? <p className="lp-modal__error">Hata: {error}</p> : null}
            {output ? (
              <pre className="lp-modal__output">{output}</pre>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  )
}
