import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { loadProvinces, loadLand, findProvince, normConfidence, parseCsv } from './lib/wilayah.mjs'

const DAYS = Number(process.env.BACKFILL_DAYS || 400)
const BBOX = '94,-11.5,141.5,6.5'
const HISTORY_FILE = 'frontend/public/data/history.json'
const CHUNK = 5 

try { process.loadEnvFile('.env') } catch { }
const key = process.env.FIRMS_MAP_KEY?.trim()
if (!key) throw new Error('FIRMS_MAP_KEY belum diatur. Isi di file .env atau GitHub Secrets.')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const iso = (d) => d.toISOString().slice(0, 10)
const addDays = (d, n) => new Date(d.getTime() + n * 86400000)

async function spMaxDate() {
  const res = await fetch(`https://firms.modaps.eosdis.nasa.gov/api/data_availability/csv/${key}/VIIRS_SNPP_SP`)
  const rows = parseCsv(await res.text())
  return rows[0]?.max_date ?? '1970-01-01'
}

const provinces = loadProvinces()
const land = loadLand()
const spMax = await spMaxDate()
console.log(`Arsip VIIRS_SNPP_SP tersedia sampai ${spMax}`)

const history = existsSync(HISTORY_FILE) ? JSON.parse(readFileSync(HISTORY_FILE, 'utf8')) : { days: {} }
const today = new Date()
const days = {}

for (let start = addDays(today, -DAYS); start < today; start = addDays(start, CHUNK)) {
  const range = Math.min(CHUNK, Math.ceil((today - start) / 86400000))
  const end = iso(addDays(start, range - 1))
  const source = end <= spMax ? 'VIIRS_SNPP_SP' : 'VIIRS_SNPP_NRT'
  const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${key}/${source}/${BBOX}/${range}/${iso(start)}`
  const res = await fetch(url)
  const text = await res.text()
  if (!res.ok || !text.startsWith('latitude')) {
    console.warn(`Lewati ${iso(start)} (${source}): ${text.slice(0, 120)}`)
    continue
  }
 
  let n = 0
  for (const r of parseCsv(text)) {
    const province = findProvince(Number(r.longitude), Number(r.latitude), provinces, land)
    if (!province) continue
    const d = (days[r.acq_date] ??= { count: 0, high: 0, byProvince: {} })
    d.count++
    if (normConfidence(r.confidence) === 'high') d.high++
    d.byProvince[province] = (d.byProvince[province] || 0) + 1
    n++
  }
  console.log(`${iso(start)} s.d. ${end} (${source}): ${n} titik`)
  await sleep(1500)
}

for (const date of Object.keys(history.days)) if (history.days[date].count === 0 && !days[date]) delete history.days[date]
for (const [date, d] of Object.entries(days)) history.days[date] = d
history.days = Object.fromEntries(Object.keys(history.days).sort().map((k) => [k, history.days[k]]))
history.source = 'NASA FIRMS (VIIRS_SNPP_SP untuk arsip, VIIRS_SNPP_NRT untuk data terbaru)'
history.updatedAt = new Date().toISOString()
writeFileSync(HISTORY_FILE, JSON.stringify(history))
console.log(`Selesai: history berisi ${Object.keys(history.days).length} hari.`)