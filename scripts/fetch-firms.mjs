import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'

const DAY_RANGE = Number(process.env.FIRMS_DAY_RANGE || 7) 
const SOURCE = process.env.FIRMS_SOURCE || 'VIIRS_SNPP_NRT'
const INDONESIA_BBOX = '94,-11.5,141.5,6.5' 
const OUT_DIR = 'frontend/public/data'
const PROVINCE_FILE = 'scripts/data/provinsi-indonesia.geojson'
const HISTORY_KEEP_DAYS = 800

const PROVINCE_NAMES = {
  'Aceh': 'Aceh', 'Bali': 'Bali', 'Bangka-Belitung Islands': 'Kepulauan Bangka Belitung',
  'Banten': 'Banten', 'Bengkulu': 'Bengkulu', 'Central Java': 'Jawa Tengah',
  'Central Kalimantan': 'Kalimantan Tengah', 'Central Sulawesi': 'Sulawesi Tengah',
  'East Java': 'Jawa Timur', 'East Kalimantan': 'Kalimantan Timur',
  'East Nusa Tenggara': 'Nusa Tenggara Timur', 'Gorontalo': 'Gorontalo',
  'Jakarta Special Capital Region': 'DKI Jakarta', 'Jambi': 'Jambi', 'Lampung': 'Lampung',
  'Maluku': 'Maluku', 'North Kalimantan': 'Kalimantan Utara', 'North Maluku': 'Maluku Utara',
  'North Sulawesi': 'Sulawesi Utara', 'North Sumatra': 'Sumatera Utara', 'Papua': 'Papua',
  'Riau': 'Riau', 'Riau Islands': 'Kepulauan Riau', 'South Kalimantan': 'Kalimantan Selatan',
  'South Sulawesi': 'Sulawesi Selatan', 'South Sumatra': 'Sumatera Selatan',
  'Southeast Sulawesi': 'Sulawesi Tenggara', 'Special Region of Yogyakarta': 'DI Yogyakarta',
  'West Java': 'Jawa Barat', 'West Kalimantan': 'Kalimantan Barat',
  'West Nusa Tenggara': 'Nusa Tenggara Barat', 'West Papua': 'Papua Barat',
  'West Sulawesi': 'Sulawesi Barat', 'West Sumatra': 'Sumatera Barat',
}

const SATELLITES = { N: 'S-NPP', N20: 'NOAA-20', 1: 'NOAA-20', N21: 'NOAA-21', 2: 'NOAA-21', T: 'Terra', A: 'Aqua' }

async function loadCsv() {
  const i = process.argv.indexOf('--csv')
  if (i !== -1) {
    const file = process.argv[i + 1]
    console.log(`Membaca CSV lokal: ${file}`)
    return readFileSync(file, 'utf8')
  }

  try { process.loadEnvFile('.env') } catch { }
  const key = process.env.FIRMS_MAP_KEY?.trim()
  if (!key) throw new Error('FIRMS_MAP_KEY belum diatur. Isi di file .env atau GitHub Secrets.')

  const MAX_PER_REQUEST = 5
  const today = new Date()
  const dayStr = (offset) => new Date(today.getTime() - offset * 86400000).toISOString().slice(0, 10)

  let header = ''
  const lines = new Set() 
  for (let done = 0; done < DAY_RANGE; done += MAX_PER_REQUEST) {
    const range = Math.min(MAX_PER_REQUEST, DAY_RANGE - done)
    const startDate = dayStr(done + range - 1) 
    const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${key}/${SOURCE}/${INDONESIA_BBOX}/${range}/${startDate}`
    console.log(`Mengunduh ${SOURCE}: ${range} hari mulai ${startDate}...`)
    const res = await fetch(url)
    const text = await res.text()
    if (!res.ok || !text.startsWith('latitude')) {
      throw new Error(`Gagal mengambil data FIRMS (HTTP ${res.status}): ${text.slice(0, 200)}`)
    }
    const [h, ...rest] = text.trim().split(/\r?\n/)
    header = h
    for (const line of rest) if (line) lines.add(line)
  }
  return [header, ...lines].join('\n')
}

function parseCsv(text) {
  const [header, ...lines] = text.trim().split(/\r?\n/)
  const cols = header.split(',')
  return lines.filter(Boolean).map((line) => {
    const v = line.split(',')
    return Object.fromEntries(cols.map((c, i) => [c, v[i]]))
  })
}

const PROVINCE_URL =
  'https://media.githubusercontent.com/media/wmgeolab/geoBoundaries/main/releaseData/gbOpen/IDN/ADM1/geoBoundaries-IDN-ADM1_simplified.geojson'

async function loadProvinces() {
  if (!existsSync(PROVINCE_FILE)) {
    console.log('Mengunduh batas provinsi Indonesia (sekali saja)...')
    const res = await fetch(PROVINCE_URL)
    if (!res.ok) throw new Error(`Gagal mengunduh batas provinsi (HTTP ${res.status})`)
    mkdirSync('scripts/data', { recursive: true })
    writeFileSync(PROVINCE_FILE, await res.text())
  }
  const geo = JSON.parse(readFileSync(PROVINCE_FILE, 'utf8'))
  return geo.features.map((f) => {
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates
    let [minX, minY, maxX, maxY] = [180, 90, -180, -90]
    for (const poly of polys) for (const [x, y] of poly[0]) {
      minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y)
    }
    const raw = f.properties.shapeName
    return { name: PROVINCE_NAMES[raw] || raw, polys, bbox: [minX, minY, maxX, maxY] }
  })
}

function inRing(x, y, ring) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

function inPolygon(x, y, poly) {
  if (!inRing(x, y, poly[0])) return false
  for (let h = 1; h < poly.length; h++) if (inRing(x, y, poly[h])) return false // lubang
  return true
}

const COAST_TOLERANCE = 0.03

function findProvince(lng, lat, provinces) {
  for (const p of provinces) {
    const [a, b, c, d] = p.bbox
    if (lng < a || lng > c || lat < b || lat > d) continue
    if (p.polys.some((poly) => inPolygon(lng, lat, poly))) return p.name
  }
  let best = null
  let bestDist = COAST_TOLERANCE
  for (const p of provinces) {
    const [a, b, c, d] = p.bbox
    if (lng < a - bestDist || lng > c + bestDist || lat < b - bestDist || lat > d + bestDist) continue
    for (const poly of p.polys) for (const [x, y] of poly[0]) {
      const dist = Math.hypot(x - lng, y - lat)
      if (dist < bestDist) { bestDist = dist; best = p.name }
    }
  }
  return best
}

function normConfidence(c) {
  if (c === 'h' || c === 'high') return 'high'
  if (c === 'n' || c === 'nominal') return 'nominal'
  if (c === 'l' || c === 'low') return 'low'
  const n = Number(c) 
  if (Number.isNaN(n)) return 'nominal'
  return n >= 80 ? 'high' : n >= 30 ? 'nominal' : 'low'
}

function toIso(date, time) {
  const t = String(time).padStart(4, '0')
  return `${date}T${t.slice(0, 2)}:${t.slice(2)}:00Z`
}

const csv = await loadCsv()
const rows = parseCsv(csv)
const provinces = await loadProvinces()

let outside = 0
const hotspots = []
for (const r of rows) {
  const lat = Number(r.latitude)
  const lng = Number(r.longitude)
  const province = findProvince(lng, lat, provinces)
  if (!province) { outside++; continue } 
  hotspots.push({
    id: hotspots.length + 1,
    lat: +lat.toFixed(4),
    lng: +lng.toFixed(4),
    confidence: normConfidence(r.confidence),
    satellite: `${r.instrument || 'VIIRS'} ${SATELLITES[r.satellite] || r.satellite || ''}`.trim(),
    detectedAt: toIso(r.acq_date, r.acq_time),
    province,
    frp: r.frp ? Number(r.frp) : null,
  })
}
hotspots.sort((a, b) => b.detectedAt.localeCompare(a.detectedAt))

const byProvinceMap = {}
const byDateMap = {}
for (const h of hotspots) {
  const p = (byProvinceMap[h.province] ??= { province: h.province, count: 0, high: 0 })
  p.count++
  if (h.confidence === 'high') p.high++
  const date = h.detectedAt.slice(0, 10)
  const d = (byDateMap[date] ??= { date, count: 0, byProvince: {} })
  d.count++
  d.byProvince[h.province] = (d.byProvince[h.province] || 0) + 1
}
const byProvince = Object.values(byProvinceMap).sort((a, b) => b.count - a.count)
const byDate = Object.values(byDateMap).sort((a, b) => a.date.localeCompare(b.date))


mkdirSync(OUT_DIR, { recursive: true })
writeFileSync(`${OUT_DIR}/hotspots.json`, JSON.stringify({
  source: `NASA FIRMS (${SOURCE})`,
  sourceUrl: 'https://firms.modaps.eosdis.nasa.gov/',
  updatedAt: new Date().toISOString(),
  dayRange: DAY_RANGE,
  hotspots,
  summary: {
    total: hotspots.length,
    high: hotspots.filter((h) => h.confidence === 'high').length,
    byProvince,
    byDate: byDate.map(({ date, count }) => ({ date, count })),
  },
}))

const historyFile = `${OUT_DIR}/history.json`
const history = existsSync(historyFile) ? JSON.parse(readFileSync(historyFile, 'utf8')) : { days: {} }
for (const d of byDate) history.days[d.date] = { count: d.count, byProvince: d.byProvince }
const dates = Object.keys(history.days).sort().slice(-HISTORY_KEEP_DAYS)
history.days = Object.fromEntries(dates.map((d) => [d, history.days[d]]))
history.source = `NASA FIRMS (${SOURCE})`
history.updatedAt = new Date().toISOString()
writeFileSync(historyFile, JSON.stringify(history))

console.log(`Selesai: ${hotspots.length} titik panas di Indonesia (${outside} titik di luar Indonesia dibuang).`)
console.log(`Provinsi terbanyak: ${byProvince.slice(0, 3).map((p) => `${p.province} (${p.count})`).join(', ') || '-'}`)