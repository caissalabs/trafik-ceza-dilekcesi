import cors from 'cors'
import express from 'express'
import OpenAI from 'openai'
import pg from 'pg'

const app = express()

app.use(cors())
app.use(express.json({ limit: '1mb' }))

const openaiApiKey = process.env.OPENAI_API_KEY
const openai =
  openaiApiKey && openaiApiKey.trim().length > 0
    ? new OpenAI({ apiKey: openaiApiKey })
    : null
const databaseUrl = process.env.DATABASE_URL?.trim() || ''
const dbPool =
  databaseUrl.length > 0
    ? new pg.Pool({
        connectionString: databaseUrl,
        ssl: process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: false },
      })
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
  ihlalAdresi: string
  ihlalIl: string
  ihlalIlce: string
  ihlalEdenAd: string
  ihlalEdenTc: string
  olayAkisi: string
  ekler: string[]
}

type DilekceModelOutput = {
  mahkeme: string
  kararinaItirazEdilen: string
  konu: string
  hukukiNedenler: string
  hukukiDeliller: string[]
  aciklamalar: string
  sonucVeIstem: string
}

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function quoteIdentifier(identifier: string): string {
  const cleaned = identifier.trim()
  if (!cleaned) return '""'
  return `"${cleaned.replace(/"/g, '""')}"`
}

function trUpper(value: string): string {
  return value.trim().toLocaleUpperCase('tr-TR')
}

function deriveMahkemeFromAdliye(adliyeRaw: string): string {
  const cleaned = adliyeRaw.trim().toLocaleUpperCase('tr-TR')
  if (!cleaned) return ''
  const base = cleaned
    .replace(/\s+ADLİYESİ$/u, '')
    .replace(/\s+ADLIYESI$/u, '')
    .trim()
  if (!base) return ''
  return `${base} SULH CEZA HÂKİMLİĞİ'NE`
}

async function resolveMahkemeFromDatabase(form: DilekceForm): Promise<string> {
  if (!dbPool) return ''
  const il = trUpper(form.ihlalIl)
  const ilce = trUpper(form.ihlalIlce)
  if (!il || !ilce) return ''

  const tableName = process.env.DB_KISILER_TABLE?.trim() || 'kisiler'
  const ilCol = process.env.DB_KISILER_IL_COLUMN?.trim() || 'IL'
  const ilceCol = process.env.DB_KISILER_ILCE_COLUMN?.trim() || 'ILCE'
  const adliyeCol = process.env.DB_KISILER_ADLIYE_COLUMN?.trim() || 'ADLIYE'

  const sql = `
    SELECT TRIM(${quoteIdentifier(adliyeCol)}) AS adliye
    FROM ${quoteIdentifier(tableName)}
    WHERE TRIM(${quoteIdentifier(ilCol)}) = $1
      AND TRIM(${quoteIdentifier(ilceCol)}) = $2
    LIMIT 1
  `
  try {
    const result = await dbPool.query<{ adliye: string | null }>(sql, [il, ilce])
    const adliye = cleanText(result.rows[0]?.adliye)
    return deriveMahkemeFromAdliye(adliye)
  } catch (err) {
    console.error('[db] adliye lookup failed', err)
    return ''
  }
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
    ihlalAdresi: cleanText(obj.ihlalAdresi),
    ihlalIl: cleanText(obj.ihlalIl),
    ihlalIlce: cleanText(obj.ihlalIlce),
    ihlalEdenAd: cleanText(obj.ihlalEdenAd),
    ihlalEdenTc: cleanText(obj.ihlalEdenTc),
    olayAkisi: cleanText(obj.olayAkisi),
    ekler,
  }
}

function buildDilekcePrompt(form: DilekceForm): string {
  return `
Sen Türkiye trafik hukuku uzmanı gibi davran.
Sadece geçerli JSON üret. Markdown, açıklama, code block yazma.

JSON şeması:
{
  "mahkeme": "string",
  "kararinaItirazEdilen": "string",
  "konu": "string",
  "hukukiNedenler": "string",
  "hukukiDeliller": ["string", "string"],
  "aciklamalar": "string",
  "sonucVeIstem": "string"
}

Kurallar:
- "mahkeme": örn "KARŞIYAKA NÖBETÇİ SULH CEZA HAKİMLİĞİ"
- "kararinaItirazEdilen": cezayı düzenleyen birime göre idareyi belirle.
- "konu": tek paragraf kısa resmi özet.
- "hukukiNedenler": kısa resmi metin.
- "hukukiDeliller": en az 2 maddelik dizi döndür (kısa).
- "aciklamalar": yalnızca açıklamalar paragrafı (uzun, resmi, tutarlı).
- "sonucVeIstem": yalnızca sonuç ve istem paragrafı (uzun, resmi, talep net).
- Bilinmeyen bilgi için "..." kullan.

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
- İhlalin Adresi: ${form.ihlalAdresi || '...'}
- İl: ${form.ihlalIl || '...'}
- İlçe: ${form.ihlalIlce || '...'}
- İhlal Eden Ad Soyad: ${form.ihlalEdenAd || '...'}
- İhlal Eden T.C. No: ${form.ihlalEdenTc || '...'}
- Olay Akışı ve Ek Hususlar: ${form.olayAkisi || '...'}
- Ekler: ${form.ekler.length > 0 ? form.ekler.join(', ') : '...'}
`.trim()
}

function parseModelOutput(text: string): DilekceModelOutput {
  const fallback: DilekceModelOutput = {
    mahkeme: '... NÖBETÇİ SULH CEZA HAKİMLİĞİ',
    kararinaItirazEdilen: '...',
    konu: '...',
    hukukiNedenler: '...',
    hukukiDeliller: ['...'],
    aciklamalar: '...',
    sonucVeIstem: '...',
  }

  try {
    const parsed = JSON.parse(text) as Partial<DilekceModelOutput>
    const hukukiDeliller = Array.isArray(parsed.hukukiDeliller)
      ? parsed.hukukiDeliller.map((x) => cleanText(x)).filter(Boolean)
      : []

    return {
      mahkeme: cleanText(parsed.mahkeme) || fallback.mahkeme,
      kararinaItirazEdilen:
        cleanText(parsed.kararinaItirazEdilen) || fallback.kararinaItirazEdilen,
      konu: cleanText(parsed.konu) || fallback.konu,
      hukukiNedenler: cleanText(parsed.hukukiNedenler) || fallback.hukukiNedenler,
      hukukiDeliller: hukukiDeliller.length > 0 ? hukukiDeliller : fallback.hukukiDeliller,
      aciklamalar: cleanText(parsed.aciklamalar) || fallback.aciklamalar,
      sonucVeIstem: cleanText(parsed.sonucVeIstem) || fallback.sonucVeIstem,
    }
  } catch {
    return fallback
  }
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
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'Sen resmi dilekçe yazımında uzman bir hukuk asistanısın. Sadece geçerli JSON üretirsin.',
        },
        { role: 'user', content: input },
      ],
    })

    const text = completion.choices[0]?.message?.content?.trim() ?? ''
    if (!text) {
      res.status(500).json({ error: 'Empty response from model' })
      return
    }

    const generated = parseModelOutput(text)
    const mahkemeFromDb = await resolveMahkemeFromDatabase(form)
    if (mahkemeFromDb) {
      generated.mahkeme = mahkemeFromDb
    }
    res.json({ output: text, generated })
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

