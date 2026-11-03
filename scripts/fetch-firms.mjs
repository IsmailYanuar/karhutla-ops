import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { loadProvinces, loadLand, findProvince, normConfidence, parseCsv, bpsMeta } from './lib/wilayah.mjs'

const DAY_RANGE = Number(process.env.FIRMS_DAY_RANGE || 7)
const SOURCE = process.env.FIRMS_SOURCE || 'VIIRS_SNPP_NRT'
const INDONESIA_BBOX = '94,-11.5,141.5,6.5'
const OUT_DIR = 'frontend/public/data'
const HISTORY_KEEP_DAYS = 800

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

function toIso(date, time) {
  const t = String(time).padStart(4, '0')
  return `${date}T${t.slice(0, 2)}:${t.slice(2)}:00Z`
}

const csv = await loadCsv()
const rows = parseCsv(csv)
const provinces = loadProvinces()
const land = loadLand()

let outside = 0
const hotspots = []
for (const r of rows) {
  const lat = Number(r.latitude)
  const lng = Number(r.longitude)
  const province = findProvince(lng, lat, provinces, land)
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
  const d = (byDateMap[date] ??= { date, count: 0, high: 0, byProvince: {} })
  d.count++
  if (h.confidence === 'high') d.high++
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
for (const d of byDate) history.days[d.date] = { count: d.count, high: d.high, byProvince: d.byProvince }
const dates = Object.keys(history.days).sort().slice(-HISTORY_KEEP_DAYS)
history.days = Object.fromEntries(dates.map((d) => [d, history.days[d]]))
history.source = `NASA FIRMS (${SOURCE})`
history.updatedAt = new Date().toISOString()
writeFileSync(historyFile, JSON.stringify(history))

writeFileSync(`${OUT_DIR}/wilayah.json`, JSON.stringify({
  batas: {
    sumber: 'Indonesia GeoJSON & TopoJSON Maps (38 Provinces), CC BY 4.0',
    url: 'https://github.com/denyherianto/indonesia-geojson-topojson-maps-with-38-provinces',
  },
  luas: bpsMeta() ?? { sumber: 'Dihitung dari batas wilayah (perkiraan)', url: null, tahun: null },
  provinsi: provinces
    .map(({ name, code, areaKm2, areaSource }) => ({ name, code, areaKm2, areaSource }))
    .sort((a, b) => a.name.localeCompare(b.name, 'id')),
}))

console.log(`Selesai: ${hotspots.length} titik panas di Indonesia (${outside} titik di luar Indonesia dibuang).`)
console.log(`Provinsi terbanyak: ${byProvince.slice(0, 3).map((p) => `${p.province} (${p.count})`).join(', ') || '-'}`)