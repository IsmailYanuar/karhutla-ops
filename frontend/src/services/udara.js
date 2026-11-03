const PM25 = [
  [0, 50, 0, 15.5],
  [51, 100, 15.6, 55.4],
  [101, 200, 55.5, 150.4],
  [201, 300, 150.5, 250.4],
  [301, 500, 250.5, 500],
]

export const ISPU_CATEGORIES = [
  {
    max: 50, label: 'Baik', color: '#16a34a', text: '#ffffff',
    meaning: 'Kualitas udara sangat baik dan tidak berdampak buruk bagi kesehatan.',
    advice: ['Aman untuk beraktivitas di luar ruangan.'],
  },
  {
    max: 100, label: 'Sedang', color: '#2563eb', text: '#ffffff',
    meaning: 'Kualitas udara masih dapat diterima, tapi bisa berdampak pada kelompok rentan.',
    advice: ['Anak, lansia, ibu hamil, dan penderita gangguan pernapasan sebaiknya mengurangi aktivitas berat di luar ruangan.'],
  },
  {
    max: 200, label: 'Tidak Sehat', color: '#eab308', text: '#1a1e19',
    meaning: 'Kualitas udara mulai merugikan kesehatan, terutama bagi kelompok rentan.',
    advice: ['Kurangi aktivitas di luar ruangan.', 'Gunakan masker saat keluar rumah.', 'Kelompok rentan sebaiknya tetap di dalam ruangan.'],
  },
  {
    max: 300, label: 'Sangat Tidak Sehat', color: '#dc2626', text: '#ffffff',
    meaning: 'Risiko gangguan kesehatan meningkat bagi sebagian besar orang.',
    advice: ['Hindari aktivitas di luar ruangan.', 'Tutup jendela dan pintu.', 'Gunakan masker yang rapat (misalnya N95) bila harus keluar.'],
  },
  {
    max: Infinity, label: 'Berbahaya', color: '#1a1e19', text: '#ffffff',
    meaning: 'Kualitas udara sangat berbahaya dan dapat menyebabkan dampak kesehatan serius.',
    advice: ['Tetap di dalam ruangan.', 'Ikuti arahan pemerintah daerah dan BPBD.', 'Segera ke fasilitas kesehatan bila sesak napas.'],
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

export async function getAirQuality(lat, lng) {
  const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lng}&hourly=pm2_5&past_days=1&forecast_days=1&timezone=GMT`
  const res = await fetch(url)
  if (!res.ok) throw new Error('Gagal memuat data kualitas udara')
  const { hourly } = await res.json()

  const nowHour = new Date().toISOString().slice(0, 13) + ':00'
  const idx = hourly.time.indexOf(nowHour)
  const end = idx === -1 ? hourly.time.length - 1 : idx
  const last24 = hourly.pm2_5.slice(Math.max(0, end - 23), end + 1).filter((v) => v != null)

  if (last24.length < 18) throw new Error('Data kualitas udara di lokasi ini belum lengkap')

  const pm25 = last24.reduce((a, b) => a + b, 0) / last24.length
  const ispu = pm25ToIspu(pm25)
  return { pm25: Math.round(pm25 * 10) / 10, pm25Now: hourly.pm2_5[end], ispu, category: ispuCategory(ispu) }
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