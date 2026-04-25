# trafik-ceza-dilekcesi

Bu repo iki parçadan oluşur:

- **Web (frontend)**: Kökte `Vite + React + TypeScript (TSX)`
- **API (backend)**: `api-server/` altında `Node.js + TypeScript (Express)`

## Geliştirme (local)

Önce web ve API bağımlılıklarını kur:

```bash
npm install
cd api-server && npm install
```

### API'yi çalıştır

```bash
cd api-server
npm run dev
```

API endpointleri:

- `GET /health`
- `GET /api/ping`

### Web'i çalıştır

Kökte:

```bash
npm run dev
```

Web tarafı API adresini `.env` üzerinden alır. Şablon için `.env.example` dosyasını kullan:

```bash
copy .env.example .env
```

## Railway Deploy (aynı repodan 2 servis)

Railway’de aynı GitHub repo üzerinden **iki ayrı service** oluştur:

### 1) API servisi

- **Root Directory**: `api-server`
- **Build Command**: `npm ci && npm run build`
- **Start Command**: `npm start`
- **Variables**:
  - `PORT` (Railway otomatik verir; elle set etmen gerekmez)

### 2) Web servisi

- **Root Directory**: `/` (repo kökü)
- **Build Command**: `npm ci && npm run build`
- **Start Command**:

```bash
npm run preview -- --host 0.0.0.0 --port $PORT
```

- **Variables**:
  - `VITE_API_BASE_URL`: API servisinin Railway URL’i (ör. `https://<api-servisi>.up.railway.app`)
