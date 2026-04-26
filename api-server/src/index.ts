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

type DilekceForm = {
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

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeForm(raw: unknown): DilekceForm {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const eklerRaw = Array.isArray(obj.ekler) ? obj.ekler : []
  const ekler = eklerRaw
    .map((item) => cleanText(item))
    .filter((item) => item.length > 0)

  return {
    birim: cleanText(obj.birim),
    seriNo: cleanText(obj.seriNo),
    siraNo: cleanText(obj.siraNo),
    plaka: cleanText(obj.plaka),
    tarih: cleanText(obj.tarih),
    saat: cleanText(obj.saat),
    ihlalMaddesi: cleanText(obj.ihlalMaddesi),
    cezaTutari: cleanText(obj.cezaTutari),
    not: cleanText(obj.not),
    ihlalYeri: cleanText(obj.ihlalYeri),
    ihlalEdenAd: cleanText(obj.ihlalEdenAd),
    ihlalEdenTc: cleanText(obj.ihlalEdenTc),
    olayAkisi: cleanText(obj.olayAkisi),
    ekler,
  }
}

function buildDilekcePrompt(form: DilekceForm): string {
  return `
Sen bir Türkiye trafik hukuku uzmanı gibi yazacaksın.

Kullanıcının verdiği tutanak bilgilerine göre Türkçe bir "Trafik Cezasına İtiraz Dilekçesi" yaz.
Çıktı, resmi ve mahkemeye sunulabilir bir dilde olmalı.
İçerik, örnek formatı takip etmeli:
- NÖBETÇİ SULH CEZA HAKİMLİĞİ'NE hitabı
- İTİRAZ EDEN, KARŞI TARAF, TUTANAK TARİHİ, KONU, AÇIKLAMALAR
- HUKUKİ DELİLLER, HUKUKİ SEBEPLER, NETİCE-İ TALEP
- en sonda isim-soyisim ve imza alanı

Kurallar:
1) Sadece dilekçe metni döndür, açıklama veya markdown kullanma.
2) Bilgisi olmayan yerlerde makul ve kısa placeholder kullan (örn: "...").
3) KARŞI TARAF ve yetkili mahkemeyi "cezayı düzenleyen birim" bilgisine göre en uygun şekilde belirle.
4) Olay akışı bölümünü güçlü ama dürüst bir hukuki anlatımla dilekçeye yedir.
5) "Ekler" başlığı altında kullanıcının verdiği ekleri maddeler halinde yaz.

KULLANICI VERİLERİ:
- Cezayı Düzenleyen Birim: ${form.birim || '...'}
- Seri No: ${form.seriNo || '...'}
- Sıra No: ${form.siraNo || '...'}
- Araç Plakası: ${form.plaka || '...'}
- Ceza Tarihi: ${form.tarih || '...'}
- Ceza Saati: ${form.saat || '...'}
- İhlal Edilen Kanun Maddesi: ${form.ihlalMaddesi || '...'}
- Toplam Ceza Tutarı: ${form.cezaTutari || '...'}
- Tutanaktaki Notlar: ${form.not || '...'}
- İhlalin Yeri: ${form.ihlalYeri || '...'}
- İhlal Eden Ad Soyad: ${form.ihlalEdenAd || '...'}
- İhlal Eden T.C. No: ${form.ihlalEdenTc || '...'}
- Olay Akışı ve Ek Hususlar: ${form.olayAkisi || '...'}
- Ekler: ${form.ekler.length > 0 ? form.ekler.join(', ') : '...'}
`.trim()
}

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

app.post('/api/dilekce', async (req, res) => {
  if (!openai) {
    res.status(500).json({ error: 'OPENAI_API_KEY is not set' })
    return
  }

  const form = normalizeForm(req.body?.form)
  const input = buildDilekcePrompt(form)

  try {
    const model = process.env.OPENAI_MODEL?.trim() || 'gpt-4.1-mini'
    const completion = await openai.chat.completions.create({
      model,
      temperature: 0.3,
      messages: [
        {
          role: 'system',
          content:
            'Sen resmi dilekçe yazımında uzman bir hukuk asistanısın. Türkçe yazarsın ve yalnızca istenen dilekçe metnini üretirsin.',
        },
        { role: 'user', content: input },
      ],
    })

    const text = completion.choices[0]?.message?.content?.trim() ?? ''
    if (!text) {
      res.status(500).json({ error: 'Empty response from model' })
      return
    }

    res.json({ output: text })
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

