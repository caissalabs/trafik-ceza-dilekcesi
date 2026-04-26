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
  ihlalEdenAd: string
  ihlalEdenTc: string
  olayAkisi: string
  ekler: string[]
}

export type DilekceResponse = {
  output?: string
  error?: string
}

export type DilekceRouteState = {
  content: string
}
