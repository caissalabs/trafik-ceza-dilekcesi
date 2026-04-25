import cors from 'cors'
import express from 'express'
import OpenAI from 'openai'

const app = express()

app.use(cors())
app.use(express.json({ limit: '1mb' }))

const openaiApiKey = process.env.OPENAI_API_KEY
const openai =
  openaiApiKey && openaiApiKey.trim().length > 0
    ? new OpenAI({ apiKey: openaiApiKey })
    : null

app.get('/health', (_req, res) => {
  res.json({ ok: true })
})

app.get('/api/ping', (_req, res) => {
  res.json({ message: 'pong' })
})

app.post('/api/chat', async (req, res) => {
  if (!openai) {
    res.status(500).json({ error: 'OPENAI_API_KEY is not set' })
    return
  }

  const input =
    typeof req.body?.input === 'string' && req.body.input.trim().length > 0
      ? req.body.input.trim()
      : 'buttona bastım'

  try {
    const model = process.env.OPENAI_MODEL?.trim() || 'gpt-4.1-mini'

    const completion = await openai.chat.completions.create({
      model,
      messages: [{ role: 'user', content: input }],
    })

    const text = completion.choices[0]?.message?.content ?? ''
    res.json({ input, output: text })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'OpenAI request failed' })
  }
})

const port = Number(process.env.PORT ?? 8080)

app.listen(port, '0.0.0.0', () => {
  // Railway expects binding to 0.0.0.0 and PORT
  console.log(`[api] listening on :${port}`)
})

