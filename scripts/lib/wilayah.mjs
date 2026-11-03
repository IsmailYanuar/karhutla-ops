import { readFileSync, existsSync } from 'node:fs'

export const PROVINCE_FILE = 'scripts/data/provinsi-indonesia.geojson'
export const LAND_FILE = 'scripts/data/indonesia-garis-pantai.geojson'
export const BPS_AREA_FILE = 'scripts/data/luas-resmi.json'

const RENAME = { 'Daerah Istimewa Yogyakarta': 'DI Yogyakarta' }
const EARTH_RADIUS_KM = 6371.0088

function ringArea(ring) {
  let sum = 0
  const rad = Math.PI / 180
  for (let i = 0; i < ring.length - 1; i++) {
    const [x1, y1] = ring[i]
    const [x2, y2] = ring[i + 1]
    sum += (x2 - x1) * rad * (2 + Math.sin(y1 * rad) + Math.sin(y2 * rad))
  }
  return Math.abs((sum * EARTH_RADIUS_KM * EARTH_RADIUS_KM) / 2)
}

function polygonArea(poly) {
  return poly.reduce((total, ring, i) => total + (i === 0 ? ringArea(ring) : -ringArea(ring)), 0)
}

export function loadProvinces() {
  const geo = JSON.parse(readFileSync(PROVINCE_FILE, 'utf8'))
  const bps = existsSync(BPS_AREA_FILE) ? JSON.parse(readFileSync(BPS_AREA_FILE, 'utf8')) : null

  return geo.features.map((f) => {
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates
    const raw = f.properties.PROVINSI
    const name = RENAME[raw] || raw
    const computed = Math.round(polys.reduce((t, p) => t + polygonArea(p), 0))
    const official = bps?.luas?.[name]
    return {
      name,
      code: f.properties.KODE_PROV,
      polys,
      bbox: bboxOf(polys),
      areaKm2: official ?? computed,
      areaSource: official ? 'resmi' : 'hitung',
    }
  })
}

export function bpsMeta() {
  if (!existsSync(BPS_AREA_FILE)) return null
  const { sumber, url, tahun } = JSON.parse(readFileSync(BPS_AREA_FILE, 'utf8'))
  return { sumber, url, tahun }
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

function bboxOf(polys) {
  let [minX, minY, maxX, maxY] = [180, 90, -180, -90]
  for (const poly of polys) for (const [x, y] of poly[0]) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y)
  }
  return [minX, minY, maxX, maxY]
}

export function loadLand() {
  const geo = JSON.parse(readFileSync(LAND_FILE, 'utf8'))
  return geo.features.map((f) => {
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates
    return { polys, bbox: bboxOf(polys) }
  })
}

function inside(lng, lat, area) {
  const [a, b, c, d] = area.bbox
  if (lng < a || lng > c || lat < b || lat > d) return false
  return area.polys.some((poly) => inPolygon(lng, lat, poly))
}

function nearest(lng, lat, areas, maxDist) {
  let best = null
  let bestDist = maxDist
  for (const p of areas) {
    const [a, b, c, d] = p.bbox
    if (lng < a - bestDist || lng > c + bestDist || lat < b - bestDist || lat > d + bestDist) continue
    for (const poly of p.polys) for (const [x, y] of poly[0]) {
      const dist = Math.hypot(x - lng, y - lat)
      if (dist < bestDist) { bestDist = dist; best = p }
    }
  }
  return best
}

const COAST_TOLERANCE = 0.03
const ISLAND_TOLERANCE = 1

export function findProvince(lng, lat, provinces, land) {
  const exact = provinces.find((p) => inside(lng, lat, p))
  if (exact) return exact.name
  const onLand = land.some((l) => inside(lng, lat, l)) || nearest(lng, lat, land, COAST_TOLERANCE)
  if (!onLand) return null
  return nearest(lng, lat, provinces, ISLAND_TOLERANCE)?.name ?? null
}

export function normConfidence(c) {
  if (c === 'h' || c === 'high') return 'high'
  if (c === 'n' || c === 'nominal') return 'nominal'
  if (c === 'l' || c === 'low') return 'low'
  const n = Number(c) 
  if (Number.isNaN(n)) return 'nominal'
  return n >= 80 ? 'high' : n >= 30 ? 'nominal' : 'low'
}

export function parseCsv(text) {
  const [header, ...lines] = text.trim().split(/\r?\n/)
  const cols = header.split(',')
  return lines.filter(Boolean).map((line) => {
    const v = line.split(',')
    return Object.fromEntries(cols.map((c, i) => [c, v[i]]))
  })
}