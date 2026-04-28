import cors from 'cors'
import express from 'express'
import OpenAI from 'openai'
import pg from 'pg'

const app = express()

app.use(cors())
app.use(express.json({ limit: '1mb' }))

const openaiApiKey = process.env.OPENAI_API_KEY?.trim()
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

// 3 fields the model generates
type ModelResponse = {
  konu: string
  aciklamalar: string
  sonucVeIstem: string
}

// Full output returned to frontend (remaining fields filled by backend)
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
  const inputQuality = (form.olayAkisi.split(' ').filter(Boolean).length) < 5 ? 'low' : 'normal'

  return `
Sadece geçerli JSON üret. Markdown, açıklama, code block yazma.

JSON şeması:
{
  "konu": "string",
  "aciklamalar": "string",
  "sonucVeIstem": "string"
}

Kurallar:
- "konu": Ceza bilgileri temel alınarak tek cümlelik resmi konu özeti.
- "aciklamalar": Kullanıcının olay akışı metnini resmi dilekçe diline dönüştür. Yeni olay, yeni iddia veya hukuki yorum EKLEME.
- "sonucVeIstem": Resmi talep paragrafı. Cezanın iptali istenir, kısa ve net.
- Input kalitesi: ${inputQuality}

CEZA BİLGİLERİ:
- Cezayı Düzenleyen Birim: ${form.birim || '...'}
- Araç Plakası: ${form.plaka || '...'}
- Ceza Tarihi: ${form.tarih || '...'}
- Ceza Saati: ${form.saat || '...'}
- İhlal Edilen Kanun Maddesi: ${form.ihlalMaddesi || '...'}
- Toplam Ceza Tutarı: ${form.cezaTutari || '...'}
- İhlalin Adresi: ${form.ihlalAdresi || '...'}, ${form.ihlalIlce || '...'}/${form.ihlalIl || '...'}
- İhlal Eden Ad Soyad: ${form.ihlalEdenAd || '...'}

KULLANICI AÇIKLAMASI:
${form.olayAkisi || '(kullanıcı açıklama girmedi)'}
`.trim()
}

function deriveKararinaItirazEdilen(birim: string): string {
  const upper = birim.toLocaleUpperCase('tr-TR')
  if (upper.includes('JANDARMA')) return 'İLGİLİ İL JANDARMA KOMUTANLIĞI'
  if (upper.includes('EMNİYET') || upper.includes('POLİS') || upper.includes('TRAFİK'))
    return 'İLGİLİ İL EMNİYET MÜDÜRLÜĞÜ'
  if (upper.includes('BELEDİYE')) return 'İLGİLİ BELEDİYE BAŞKANLIĞI'
  if (birim.trim()) return birim.trim().toLocaleUpperCase('tr-TR')
  return 'İLGİLİ İDARE'
}

function deriveHukukiNedenler(ihlalMaddesi: string): string {
  const base =
    '2918 Sayılı Karayolları Trafik Kanunu ve ilgili yönetmelik hükümleri uyarınca itiraz hakkı kullanılmaktadır.'
  const madde = ihlalMaddesi.trim()
  if (madde) {
    return `${base} İtiraz konusu ceza, KTK ${madde} maddesi kapsamında uygulanmıştır.`
  }
  return base
}

function deriveHukukiDeliller(form: DilekceForm): string[] {
  const deliller = ['Trafik ceza tutanağı', 'Araç tescil belgesi']
  if (form.ekler.length > 0) {
    deliller.push(...form.ekler)
  } else {
    deliller.push('Sair deliller')
  }
  return deliller
}

function parseModelOutput(text: string, form: DilekceForm): ModelResponse {
  const fallbackKonu = form.ihlalMaddesi
    ? `${form.tarih || '...'} tarihinde ${form.ihlalIl || '...'} ilinde düzenlenen KTK ${form.ihlalMaddesi} maddesi kapsamındaki trafik cezasına itiraz.`
    : 'Trafik cezasına itiraz.'

  const fallback: ModelResponse = {
    konu: fallbackKonu,
    aciklamalar:
      form.olayAkisi.trim() ||
      'Tarafıma kesilen trafik cezasının hukuka aykırı olduğu değerlendirilmektedir.',
    sonucVeIstem:
      'Yukarıda arz edilen nedenlerle, hakkımda düzenlenen trafik cezasının iptaline karar verilmesini saygılarımla arz ve talep ederim.',
  }

  try {
    const parsed = JSON.parse(text) as Partial<ModelResponse>
    return {
      konu: cleanText(parsed.konu) || fallback.konu,
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
    const model = process.env.OPENAI_MODEL?.trim() || 'gpt-5.3-chat-latest'
    const completion = await openai.chat.completions.create({
      model,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `Sen bir hukuk asistanı değilsin. Kullanıcılara hukuki tavsiye vermezsin.

Görevin:
- Kullanıcının verdiği trafik cezası bilgilerini al
- Açıklama kısmındaki metni temel alarak resmi ve düzenli bir dilekçe dili oluştur

Davranış kuralları:
- Kullanıcının yazdığı metni KORU ancak dilbilgisi, anlatım ve akış açısından düzenle
- Kullanıcı metni eksik, dağınık veya yetersiz ise:
  → SADECE verilen bilgilerden çıkarım yaparak metni anlaşılır hale getir
  → Yeni olay, yeni iddia veya yeni hukuki gerekçe EKLEME
- Kullanıcının kastettiği durumu açık ve düzgün bir dille ifade et
- Hukuki analiz, yorum veya yönlendirme yapma
- Abartı, kesinlik içeren iddialar veya gerçek dışı savunmalar ekleme

Güvenlik kuralları:
- Eğer kullanıcı metni tamamen anlamsızsa:
  → Nötr ve genel bir açıklama metni oluştur
- Eğer metin çok kısa ise:
  → Mevcut bilgilerden minimum anlamlı bir paragraf oluştur
- Asla uydurma detay ekleme

Output kuralları:
- SADECE JSON döndür
- Format dışına çıkma
- Tüm alanları doldur
- Türkçe yaz`,
        },
        { role: 'user', content: input },
      ],
    })

    const text = completion.choices[0]?.message?.content?.trim() ?? ''
    if (!text) {
      res.status(500).json({ error: 'Empty response from model' })
      return
    }

    const modelResponse = parseModelOutput(text, form)
    const mahkemeFromDb = await resolveMahkemeFromDatabase(form)

    const generated: DilekceModelOutput = {
      mahkeme: mahkemeFromDb || "... NÖBETÇİ SULH CEZA HÂKİMLİĞİ'NE",
      kararinaItirazEdilen: deriveKararinaItirazEdilen(form.birim),
      konu: modelResponse.konu,
      hukukiNedenler: deriveHukukiNedenler(form.ihlalMaddesi),
      hukukiDeliller: deriveHukukiDeliller(form),
      aciklamalar: modelResponse.aciklamalar,
      sonucVeIstem: modelResponse.sonucVeIstem,
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

