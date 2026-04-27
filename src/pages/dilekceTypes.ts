export interface DilekceFormPayload {
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

export interface GeneratedDilekceSections {
  mahkeme: string
  kararinaItirazEdilen: string
  konu: string
  hukukiNedenler: string
  hukukiDeliller: string[]
  aciklamalar: string
  sonucVeIstem: string
}

export type DilekceResponse = {
  output?: string
  generated?: GeneratedDilekceSections
  error?: string
}

export type DilekceRouteState = {
  content: string
  form: DilekceFormPayload
  generated: GeneratedDilekceSections
  pdfUrl?: string
}
