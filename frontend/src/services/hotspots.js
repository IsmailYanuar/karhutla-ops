let cache = null

export async function getHotspotData() {
  if (cache) return cache
  const res = await fetch('/data/hotspots.json')
  if (!res.ok) throw new Error('Gagal memuat data titik panas')
  cache = await res.json()
  return cache
}

export function countByProvince(hotspots) {
  const map = {}
  for (const h of hotspots) map[h.province] = (map[h.province] || 0) + 1
  return Object.entries(map)
    .map(([province, count]) => ({ province, count }))
    .sort((a, b) => b.count - a.count)
}

export const CONFIDENCE = {
  high: { label: 'Tinggi', color: '#ff5a1f' },
  nominal: { label: 'Sedang', color: '#ffa640' },
  low: { label: 'Rendah', color: '#8e9a92' },
}

export const BASEMAP = {
  url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  options: {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  },
}

export function formatDate(iso) {
  return new Date(iso).toLocaleString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
    timeZone: 'Asia/Jakarta',
  }) + ' WIB'
}

const jsonCache = {}
async function getJson(name) {
  if (!jsonCache[name]) {
    jsonCache[name] = fetch(`/data/${name}.json`).then((res) => {
      if (!res.ok) throw new Error(`Gagal memuat data ${name}`)
      return res.json()
    })
  }
  return jsonCache[name]
}

export const getHistory = () => getJson('history')
export const getWilayah = () => getJson('wilayah')

export const getRingkasan = () => getJson('ringkasan')

export function downloadCsv(hotspots, filename) {
  const header = ['latitude', 'longitude', 'provinsi', 'kepercayaan', 'satelit', 'waktu_deteksi_utc', 'frp_mw']
  const esc = (v) => (v == null ? '' : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v))
  const rows = hotspots.map((h) => [h.lat, h.lng, h.province, h.confidence, h.satellite, h.detectedAt, h.frp].map(esc).join(','))
  
  const blob = new Blob(['\ufeff' + [header.join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = Object.assign(document.createElement('a'), { href: url, download: filename })
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function addDays(dateStr, n) {
  const d = new Date(`${dateStr}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

export function sumRange(days, from, to, province) {
  let total = 0
  let covered = 0
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const day = days[d]
    if (!day) continue
    covered++
    total += province ? day.byProvince?.[province] || 0 : day.count
  }
  return { total, covered }
}

export function percentChange(now, before) {
  if (!before) return null
  return Math.round(((now - before) / before) * 100)
}

export function formatShortDate(dateStr) {
  return new Date(`${dateStr}T00:00:00Z`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', timeZone: 'UTC' })
}

export function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}