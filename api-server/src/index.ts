import cors from 'cors'
import express from 'express'

const app = express()

app.use(cors())
app.use(express.json({ limit: '1mb' }))

app.get('/health', (_req, res) => {
  res.json({ ok: true })
})

app.get('/api/ping', (_req, res) => {
  res.json({ message: 'pong' })
})

const port = Number(process.env.PORT ?? 8080)

app.listen(port, '0.0.0.0', () => {
  // Railway expects binding to 0.0.0.0 and PORT
  console.log(`[api] listening on :${port}`)
})

