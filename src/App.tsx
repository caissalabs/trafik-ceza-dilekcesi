import { useMemo, useState } from 'react'
import './App.css'

function App() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [output, setOutput] = useState<string>('')

  const apiBase = useMemo(() => {
    const raw = import.meta.env.VITE_API_BASE_URL as string | undefined
    return raw && raw.trim().length > 0 ? raw.trim().replace(/\/+$/, '') : ''
  }, [])

  const onClick = async () => {
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

      const data = (await resp.json()) as { output?: string }
      setOutput(data.output ?? '')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <section id="center">
        <div>
          <h1>GPT Demo</h1>
          <p>Butona basınca GPT’ye “buttona bastım” gönderir.</p>
        </div>
        <button
          type="button"
          className="counter"
          onClick={onClick}
          disabled={loading}
        >
          {loading ? 'Gönderiliyor…' : 'GPT’ye gönder'}
        </button>

        {error ? (
          <p style={{ color: 'tomato', maxWidth: 520, marginTop: 16 }}>
            Hata: {error}
          </p>
        ) : null}

        {output ? (
          <pre
            style={{
              textAlign: 'left',
              maxWidth: 720,
              marginTop: 16,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {output}
          </pre>
        ) : null}
      </section>
    </>
  )
}

export default App
