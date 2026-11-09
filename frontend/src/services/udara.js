const PM25 = [
  [0, 50, 0, 15.5],
  [51, 100, 15.6, 55.4],
  [101, 200, 55.5, 150.4],
  [201, 300, 150.5, 250.4],
  [301, 500, 250.5, 500],
]

export const ISPU_CATEGORIES = [
  {
    max: 50, slug: 'baik', label: 'Baik', color: '#16a34a', text: '#ffffff',
    meaning: 'Kualitas udara sangat baik dan tidak berdampak buruk bagi kesehatan.',
    advice: [
      'Aman untuk beraktivitas di luar ruangan.',
      'Tetap pantau ISPU setiap hari, karena asap bisa datang cepat saat arah angin berubah.',
    ],
  },
  {
    max: 100, slug: 'sedang', label: 'Sedang', color: '#2563eb', text: '#ffffff',
    meaning: 'Kualitas udara masih dapat diterima, tapi bisa berdampak pada kelompok rentan.',
    advice: [
      'Anak, lansia, ibu hamil, dan penderita asma, penyakit paru, atau jantung sebaiknya mengurangi aktivitas berat di luar ruangan.',
      'Siapkan masker dan stok obat rutin, terutama bagi yang punya penyakit bawaan.',
    ],
  },
  {
    max: 200, slug: 'tidak-sehat', label: 'Tidak Sehat', color: '#eab308', text: '#1a1e19',
    meaning: 'Kualitas udara mulai merugikan kesehatan, terutama bagi kelompok rentan.',
    advice: [
      'Kurangi aktivitas di luar ruangan dan jangan berolahraga berat di luar.',
      'Gunakan masker yang pas dan terpasang rapat saat keluar rumah.',
      'Tutup pintu dan jendela saat asap pekat di luar.',
      'Kelompok rentan sebaiknya tetap di dalam ruangan.',
    ],
  },
  {
    max: 300, slug: 'sangat-tidak-sehat', label: 'Sangat Tidak Sehat', color: '#dc2626', text: '#ffffff',
    meaning: 'Risiko gangguan kesehatan meningkat bagi sebagian besar orang.',
    advice: [
      'Hindari aktivitas di luar ruangan. Jika tidak ada keperluan mendesak, tetap di rumah.',
      'Tutup pintu dan jendela rapat, dan jangan merokok di dalam rumah.',
      'Jika terpaksa keluar, gunakan masker yang rapat seperti N95.',
      'Perhatikan gejala sesak napas, batuk terus-menerus, atau nyeri dada.',
    ],
  },
  {
    max: Infinity, slug: 'berbahaya', label: 'Berbahaya', color: '#1a1e19', text: '#ffffff',
    meaning: 'Kualitas udara sangat berbahaya dan dapat menyebabkan dampak kesehatan serius.',
    advice: [
      'Tetap di dalam ruangan dengan pintu dan jendela tertutup.',
      'Ikuti arahan pemerintah daerah dan BPBD setempat.',
      'Segera ke puskesmas atau rumah sakit bila sesak napas, nyeri dada, atau pusing yang makin berat.',
    ],
  },
]

export function pm25ToIspu(x) {
  const row = PM25.find(([, , , xa]) => x <= xa) ?? PM25.at(-1)
  const [ib, ia, xb, xa] = row
  return Math.round(Math.min(500, ((ia - ib) / (xa - xb)) * (Math.max(x, xb) - xb) + ib))
}

export function ispuCategory(ispu) {
  return ISPU_CATEGORIES.find((c) => ispu <= c.max)
}

function ispuFromHourly(hourly) {
  const nowHour = new Date().toISOString().slice(0, 13) + ':00'
  const idx = hourly.time.indexOf(nowHour)
  const end = idx === -1 ? hourly.time.length - 1 : idx
  const last24 = hourly.pm2_5.slice(Math.max(0, end - 23), end + 1).filter((v) => v != null)
  if (last24.length < 18) return null

  const pm25 = last24.reduce((a, b) => a + b, 0) / last24.length
  const ispu = pm25ToIspu(pm25)
  return { pm25: Math.round(pm25 * 10) / 10, pm25Now: hourly.pm2_5[end], ispu, category: ispuCategory(ispu) }
}

const AQ_URL = 'https://air-quality-api.open-meteo.com/v1/air-quality'
const AQ_PARAMS = 'hourly=pm2_5&past_days=1&forecast_days=1&timezone=GMT'

export async function getAirQuality(lat, lng) {
  const res = await fetch(`${AQ_URL}?latitude=${lat}&longitude=${lng}&${AQ_PARAMS}`)
  if (!res.ok) throw new Error('Gagal memuat data kualitas udara')
  const result = ispuFromHourly((await res.json()).hourly)
  if (!result) throw new Error('Data kualitas udara di lokasi ini belum lengkap')
  return result
}

export async function getAirQualityMany(places) {
  const lat = places.map((p) => p.lat).join(',')
  const lng = places.map((p) => p.lng).join(',')
  try {
    const res = await fetch(`${AQ_URL}?latitude=${lat}&longitude=${lng}&${AQ_PARAMS}`)
    if (!res.ok) throw new Error()
    const json = await res.json()
    const list = Array.isArray(json) ? json : [json]
    return list.map((d) => (d?.hourly ? ispuFromHourly(d.hourly) : null))
  } catch {
    const settled = await Promise.allSettled(places.map((p) => getAirQuality(p.lat, p.lng)))
    if (settled.every((r) => r.status === 'rejected')) throw new Error('Gagal memuat data kualitas udara')
    return settled.map((r) => (r.status === 'fulfilled' ? r.value : null))
  }
}

export function distanceKm(lat1, lng1, lat2, lng2) {
  const rad = Math.PI / 180
  const dLat = (lat2 - lat1) * rad
  const dLng = (lng2 - lng1) * rad
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(a))
}

const DIRECTIONS = ['utara', 'timur laut', 'timur', 'tenggara', 'selatan', 'barat daya', 'barat', 'barat laut']
export function direction(lat1, lng1, lat2, lng2) {
  const rad = Math.PI / 180
  const y = Math.sin((lng2 - lng1) * rad) * Math.cos(lat2 * rad)
  const x = Math.cos(lat1 * rad) * Math.sin(lat2 * rad) - Math.sin(lat1 * rad) * Math.cos(lat2 * rad) * Math.cos((lng2 - lng1) * rad)
  const deg = (Math.atan2(y, x) / rad + 360) % 360
  return DIRECTIONS[Math.round(deg / 45) % 8]
}