import { mkdirSync, writeFileSync } from 'node:fs'

let seed = 7
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
const gauss = () => Math.sqrt(-2 * Math.log(rand())) * Math.cos(2 * Math.PI * rand())
const pick = (arr) => arr[Math.floor(rand() * arr.length)]

const PROVINCES = [
  ['Riau', 0.5, 101.8, 1.0, 40],
  ['Jambi', -1.7, 103.3, 0.8, 30],
  ['Sumatera Selatan', -3.2, 104.8, 0.9, 55],
  ['Kalimantan Barat', -0.3, 110.5, 1.2, 45],
  ['Kalimantan Tengah', -2.2, 113.4, 1.1, 60],
  ['Kalimantan Selatan', -2.9, 115.3, 0.5, 20],
  ['Kalimantan Timur', 0.3, 116.6, 0.8, 15],
  ['Papua Selatan', -7.5, 139.8, 0.9, 18],
  ['Nusa Tenggara Timur', -9.6, 120.5, 0.7, 12],
]
const CONF = ['high', 'high', 'high', 'nominal', 'nominal', 'nominal', 'nominal', 'nominal', 'low', 'low']

const hotspots = []
let id = 1
for (const [province, lat, lng, spread, n] of PROVINCES) {
  for (let i = 0; i < n; i++) {
    const day = 25 + Math.floor(rand() * 7)
    const hour = String(pick([1, 5, 6, 13, 17, 18])).padStart(2, '0')
    hotspots.push({
      id: id++,
      lat: +(lat + gauss() * spread * 0.5).toFixed(4),
      lng: +(lng + gauss() * spread * 0.6).toFixed(4),
      confidence: pick(CONF),
      satellite: pick(['VIIRS', 'MODIS']),
      detectedAt: `2026-10-${day}T${hour}:30:00Z`,
      province,
    })
  }
}

mkdirSync('frontend/public/data', { recursive: true })
writeFileSync(
  'frontend/public/data/hotspots.json',
  JSON.stringify({
    source: 'DATA CONTOH (bukan data asli). Ganti dengan unduhan NASA FIRMS.',
    updatedAt: new Date().toISOString(),
    hotspots,
  }),
)
console.log(`Selesai: ${hotspots.length} titik contoh ditulis ke frontend/public/data/hotspots.json`)