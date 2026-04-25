import { useMemo, useState } from 'react'
import './HomePage.css'

type ChatResponse = { input?: string; output?: string; error?: string }

export default function HomePage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [output, setOutput] = useState<string>('')

  const apiBase = useMemo(() => {
    const raw = import.meta.env.VITE_API_BASE_URL as string | undefined
    return raw && raw.trim().length > 0 ? raw.trim().replace(/\/+$/, '') : ''
  }, [])

  const onSend = async () => {
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
    <main className="home">
      <header className="home__hero">
        <div className="home__heroGlow" aria-hidden />
        <div className="home__heroInner">
          <p className="home__eyebrow">trafik-ceza-dilekcesi</p>
          <h1 className="home__title">Ana Sayfa</h1>
          <p className="home__subtitle">
            Basit demo: butona basınca GPT’ye “buttona bastım” gider ve cevabı burada
            görürsün.
          </p>

          <div className="home__heroCtas">
            <button
              type="button"
              className="home__primaryBtn"
              onClick={onSend}
              disabled={loading}
            >
              {loading ? 'Gönderiliyor…' : 'GPT’ye gönder'}
            </button>
            <a
              className="home__secondaryBtn"
              href={apiBase ? `${apiBase}/health` : undefined}
              target="_blank"
              rel="noreferrer"
            >
              API health
            </a>
          </div>
        </div>
      </header>

      <section className="home__grid" aria-label="Home content">
        <article className="home__card home__card--span2">
          <div className="home__cardHead">
            <h2 className="home__cardTitle">GPT Yanıtı</h2>
            <p className="home__cardHint">İstek: “buttona bastım”</p>
          </div>

          {error ? <p className="home__error">Hata: {error}</p> : null}

          <div className="home__output">
            {output ? (
              <pre className="home__outputPre">{output}</pre>
            ) : (
              <p className="home__outputEmpty">
                Henüz cevap yok. Yukarıdaki butona bas.
              </p>
            )}
          </div>
        </article>

        <article className="home__card">
          <div className="home__cardHead">
            <h2 className="home__cardTitle">Bağlantı</h2>
            <p className="home__cardHint">Frontend → API</p>
          </div>
          <dl className="home__kv">
            <div>
              <dt>VITE_API_BASE_URL</dt>
              <dd>{apiBase || '(boş)'} </dd>
            </div>
            <div>
              <dt>Endpoint</dt>
              <dd>/api/chat</dd>
            </div>
          </dl>
        </article>

        <article className="home__card">
          <div className="home__cardHead">
            <h2 className="home__cardTitle">Notlar</h2>
            <p className="home__cardHint">Railway kurulumu</p>
          </div>
          <ul className="home__list">
            <li>OpenAI key sadece API servisinde olmalı.</li>
            <li>Web servisinde `VITE_API_BASE_URL` API domain’ini göstermeli.</li>
          </ul>
        </article>
      </section>
    </main>
  )
}

