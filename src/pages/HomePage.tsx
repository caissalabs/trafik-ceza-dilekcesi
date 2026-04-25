import { useMemo, useState } from 'react'
import './HomePage.css'

type ChatResponse = { output?: string }

const FEATURES = [
  {
    icon: '⚡',
    title: 'Dakikalar İçinde Hazır',
    desc: 'Ceza bilgilerini girmen yeterli. Sistem otomatik olarak dilekçeni oluşturur.',
  },
  {
    icon: '⚖️',
    title: 'Hukuki Açıdan Sağlam',
    desc: 'Karayolları Trafik Kanunu ve Tebligat Kanununa uygun dil ile hazırlanır.',
  },
  {
    icon: '🤖',
    title: 'Yapay Zeka Destekli',
    desc: 'GPT tabanlı dil modeli her dilekçeyi senin durumuna özel olarak yazar.',
  },
  {
    icon: '🔒',
    title: 'Güvenli & Gizli',
    desc: 'Bilgilerin şifreli bağlantıyla iletilir ve sunucuda saklanmaz.',
  },
  {
    icon: '🇹🇷',
    title: 'Türkçe Arayüz',
    desc: 'Tüm adımlar sade Türkçe ile anlatılmıştır; hukuki terim bilgisi gerekmez.',
  },
  {
    icon: '📄',
    title: 'Hazır İndir',
    desc: 'Dilekçeyi PDF veya düz metin olarak indir, ilgili kuruma anında gönder.',
  },
]

const STEPS = [
  {
    n: '01',
    title: 'Ceza Bilgilerini Gir',
    desc: 'Ceza tutanağındaki tarih, madde ve açıklama bilgilerini forma ekle.',
  },
  {
    n: '02',
    title: 'AI Dilekçeyi Oluşturur',
    desc: 'Yapay zeka bilgileri analiz eder ve hukuki olarak geçerli bir itiraz metnini saniyeler içinde yazar.',
  },
  {
    n: '03',
    title: 'İndir & Gönder',
    desc: 'Hazırlanan dilekçeyi indir, imzala ve yetkili birime ilet.',
  },
]

const TESTIMONIALS = [
  {
    name: 'Ahmet Y.',
    role: 'Serbest Çalışan',
    text: 'Park cezasına itiraz etmek için avukata gitmeyi düşünüyordum. Bu sistemle 3 dakikada dilekçemi hazırladım, itirazım kabul edildi.',
  },
  {
    name: 'Selin K.',
    role: 'Öğretmen',
    text: 'Hız cezasına aldığımda nereye başvuracağımı bile bilmiyordum. Adım adım yönlendirmesi çok işe yaradı.',
  },
  {
    name: 'Murat D.',
    role: 'Küçük İşletme Sahibi',
    desc: 'Araç sahibi olmadan kesilen ceza için hazırladığı itiraz metni hukuki açıdan son derece sağlamdı.',
    text: 'Araç sahibi olmadan kesilen ceza için hazırladığı itiraz metni son derece sağlamdı. Kesinlikle tavsiye ederim.',
  },
]

const PLANS = [
  {
    name: 'Ücretsiz',
    price: '₺0',
    period: 'her zaman',
    highlight: false,
    features: ['3 dilekçe/ay', 'Temel şablonlar', 'PDF indirme', 'E-posta desteği'],
  },
  {
    name: 'Standart',
    price: '₺49',
    period: '/ ay',
    highlight: true,
    features: ['Sınırsız dilekçe', 'AI destekli metin', 'PDF + Word indirme', 'Öncelikli destek', 'Geçmiş dilekçeler'],
  },
  {
    name: 'Pro',
    price: '₺129',
    period: '/ ay',
    highlight: false,
    features: ['Standart\'ın tüm özellikleri', 'Toplu dilekçe (ekip)', 'API erişimi', 'Özel şablon yönetimi', 'SLA garantisi'],
  },
]

const FAQS = [
  {
    q: 'Dilekçe gerçekten hukuki geçerliliği var mı?',
    a: 'Sistem, yürürlükteki Karayolları Trafik Kanunu ve ilgili yönetmeliklere dayanarak metin üretir. Ancak hukuki kesinlik için bir avukata danışmanızı öneririz.',
  },
  {
    q: 'Bilgilerim saklanıyor mu?',
    a: 'Hayır. Gönderdiğiniz veriler yalnızca dilekçe üretimi için anlık olarak işlenir ve sunucularımızda kalıcı olarak tutulmaz.',
  },
  {
    q: 'Hangi ceza türlerine itiraz yapabilirim?',
    a: 'Hız ihlali, park yasağı, kırmızı ışık ve diğer trafik cezaları desteklenmektedir.',
  },
  {
    q: 'Aboneliği istediğimde iptal edebilir miyim?',
    a: 'Evet, aboneliğinizi istediğiniz zaman bir tık ile iptal edebilirsiniz; ek ücret alınmaz.',
  },
  {
    q: 'Ücretsiz planda kredi kartı gerekiyor mu?',
    a: 'Hayır. Ücretsiz plan için herhangi bir ödeme bilgisi girmeniz gerekmez.',
  },
]

export default function HomePage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [output, setOutput] = useState<string>('')
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  const apiBase = useMemo(() => {
    const raw = import.meta.env.VITE_API_BASE_URL as string | undefined
    return raw && raw.trim().length > 0 ? raw.trim().replace(/\/+$/, '') : ''
  }, [])

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

  return (
    <>
      {/* ───────── NAVBAR ───────── */}
      <nav className="lp-nav">
        <span className="lp-nav__logo">trafik<span className="lp-nav__dot">.</span>ceza</span>
        <ul className="lp-nav__links" role="list">
          <li><a href="#features">Özellikler</a></li>
          <li><a href="#how">Nasıl Çalışır</a></li>
          <li><a href="#pricing">Fiyatlar</a></li>
          <li><a href="#faq">SSS</a></li>
        </ul>
        <a href="#pricing" className="lp-nav__cta">Başla</a>
      </nav>

      {/* ───────── HERO ───────── */}
      <section className="lp-hero" id="hero">
        <div className="lp-hero__glow" aria-hidden />
        <div className="lp-hero__inner">
          <p className="lp-eyebrow">Yapay Zeka Destekli</p>
          <h1 className="lp-hero__title">
            Trafik Cezana İtiraz Dilekçeni{' '}
            <span className="lp-hero__accent">Dakikalar İçinde</span> Hazırla
          </h1>
          <p className="lp-hero__sub">
            Avukata gerek yok. Ceza bilgilerini gir, yapay zeka hukuki olarak
            sağlam dilekçeni anında oluştursun.
          </p>
          <div className="lp-hero__ctas">
            <a href="#pricing" className="lp-btn lp-btn--primary">Ücretsiz Dene</a>
            <a href="#how" className="lp-btn lp-btn--ghost">Nasıl Çalışır?</a>
          </div>

          {/* GPT Demo kutusu */}
          <div className="lp-demo">
            <p className="lp-demo__label">Canlı Demo — GPT bağlantısını test et</p>
            <button
              type="button"
              className="lp-btn lp-btn--accent"
              onClick={onDemo}
              disabled={loading}
            >
              {loading ? 'Yanıt bekleniyor…' : 'GPT\'ye gönder'}
            </button>
            {error && <p className="lp-demo__error">Hata: {error}</p>}
            {output && <pre className="lp-demo__output">{output}</pre>}
          </div>
        </div>
      </section>

      {/* ───────── FEATURES ───────── */}
      <section className="lp-section" id="features">
        <div className="lp-container">
          <p className="lp-eyebrow lp-center">Neden Biz?</p>
          <h2 className="lp-section__title lp-center">Her Şey Düşünüldü</h2>
          <p className="lp-section__sub lp-center">
            İtiraz sürecinin her adımını kolaylaştırmak için tasarlandı.
          </p>
          <div className="lp-feat-grid">
            {FEATURES.map((f) => (
              <article key={f.title} className="lp-feat-card">
                <span className="lp-feat-card__icon" aria-hidden>{f.icon}</span>
                <h3 className="lp-feat-card__title">{f.title}</h3>
                <p className="lp-feat-card__desc">{f.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

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

      {/* ───────── TESTIMONIALS ───────── */}
      <section className="lp-section" id="testimonials">
        <div className="lp-container">
          <p className="lp-eyebrow lp-center">Kullanıcılar Ne Diyor?</p>
          <h2 className="lp-section__title lp-center">Gerçek Sonuçlar</h2>
          <div className="lp-testi-grid">
            {TESTIMONIALS.map((t) => (
              <blockquote key={t.name} className="lp-testi">
                <p className="lp-testi__text">"{t.text}"</p>
                <footer className="lp-testi__footer">
                  <span className="lp-testi__name">{t.name}</span>
                  <span className="lp-testi__role">{t.role}</span>
                </footer>
              </blockquote>
            ))}
          </div>
        </div>
      </section>

      {/* ───────── PRICING ───────── */}
      <section className="lp-section lp-section--alt" id="pricing">
        <div className="lp-container">
          <p className="lp-eyebrow lp-center">Fiyatlandırma</p>
          <h2 className="lp-section__title lp-center">Sade & Şeffaf</h2>
          <p className="lp-section__sub lp-center">
            Gizli ücret yok. İstediğinde iptal et.
          </p>
          <div className="lp-plan-grid">
            {PLANS.map((p) => (
              <article key={p.name} className={`lp-plan${p.highlight ? ' lp-plan--highlight' : ''}`}>
                {p.highlight && <span className="lp-plan__badge">Popüler</span>}
                <h3 className="lp-plan__name">{p.name}</h3>
                <p className="lp-plan__price">
                  {p.price}<span className="lp-plan__period">{p.period}</span>
                </p>
                <ul className="lp-plan__features" role="list">
                  {p.features.map((f) => (
                    <li key={f}>
                      <span aria-hidden>✓</span> {f}
                    </li>
                  ))}
                </ul>
                <a
                  href="#hero"
                  className={`lp-btn lp-btn--full${p.highlight ? ' lp-btn--primary' : ' lp-btn--ghost'}`}
                >
                  {p.name === 'Ücretsiz' ? 'Ücretsiz Başla' : 'Seç'}
                </a>
              </article>
            ))}
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
          <p className="lp-footer__copy">© {new Date().getFullYear()} trafik.ceza — Tüm hakları saklıdır.</p>
        </div>
      </footer>
    </>
  )
}
