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
  high: { label: 'Tinggi', color: '#c2410c' },
  nominal: { label: 'Sedang', color: '#f0961a' },
  low: { label: 'Rendah', color: '#d6b54a' },
}

export function formatDate(iso) {
  return new Date(iso).toLocaleString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
    timeZone: 'Asia/Jakarta',
  }) + ' WIB'
}