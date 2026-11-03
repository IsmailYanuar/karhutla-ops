<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import L from 'leaflet'
import { getHotspotData, CONFIDENCE, formatDate } from '../services/hotspots'
import { getAirQuality, distanceKm, direction, ISPU_CATEGORIES } from '../services/udara'

// Kota contoh, untuk dicoba jika izin lokasi ditolak atau saat demo.
const CITIES = [
  { name: 'Pekanbaru', lat: 0.507, lng: 101.448 },
  { name: 'Jambi', lat: -1.61, lng: 103.613 },
  { name: 'Palembang', lat: -2.976, lng: 104.775 },
  { name: 'Pontianak', lat: -0.026, lng: 109.342 },
  { name: 'Palangka Raya', lat: -2.208, lng: 113.917 },
  { name: 'Banjarmasin', lat: -3.319, lng: 114.59 },
  { name: 'Samarinda', lat: -0.502, lng: 117.153 },
  { name: 'Kendari', lat: -3.997, lng: 122.513 },
  { name: 'Kupang', lat: -10.178, lng: 123.607 },
  { name: 'Merauke', lat: -8.493, lng: 140.401 },
  { name: 'Jakarta', lat: -6.2, lng: 106.817 },
]
const RADII = [10, 25, 50]

const data = ref(null)
const place = ref(null) // { name, lat, lng }
const locating = ref(false)
const locError = ref('')
const air = ref(null)
const airError = ref('')
const airLoading = ref(false)
const mapEl = ref(null)
let map = null
let layer = null

onMounted(async () => {
  try { data.value = await getHotspotData() } catch { }
})
onBeforeUnmount(() => map?.remove())

const nearby = computed(() => {
  if (!place.value || !data.value) return []
  const { lat, lng } = place.value
  return data.value.hotspots
    .map((h) => ({ ...h, km: distanceKm(lat, lng, h.lat, h.lng) }))
    .filter((h) => h.km <= RADII.at(-1))
    .sort((a, b) => a.km - b.km)
})
const counts = computed(() => RADII.map((r) => ({ r, n: nearby.value.filter((h) => h.km <= r).length })))
const nearest = computed(() => nearby.value[0] ?? null)

const status = computed(() => {
  const within25 = counts.value[1]?.n ?? 0
  if (!place.value || !data.value) return null
  if (within25 >= 10) return { level: 'tinggi', text: 'Banyak titik panas di sekitar Anda. Waspadai asap dan ikuti informasi dari BPBD setempat.', cls: 'border-red-200 bg-red-50 text-red-800' }
  if (within25 > 0) return { level: 'waspada', text: 'Ada titik panas di sekitar Anda. Pantau perkembangan dan kualitas udara.', cls: 'border-ember-100 bg-ember-50 text-ember-700' }
  return { level: 'aman', text: 'Tidak ada titik panas dalam radius 25 km selama 7 hari terakhir.', cls: 'border-green-200 bg-green-50 text-green-800' }
})

async function useLocation() {
  locError.value = ''
  if (!navigator.geolocation) {
    locError.value = 'Browser Anda tidak mendukung lokasi. Pilih kota di bawah.'
    return
  }
  locating.value = true
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      locating.value = false
      choose({ name: 'Lokasi Anda', lat: pos.coords.latitude, lng: pos.coords.longitude })
    },
    () => {
      locating.value = false
      locError.value = 'Izin lokasi ditolak atau tidak tersedia. Pilih kota di bawah.'
    },
    { enableHighAccuracy: false, timeout: 10000 },
  )
}

async function choose(p) {
  place.value = p
  await nextTick()
  drawMap()
  air.value = null
  airError.value = ''
  airLoading.value = true
  try {
    air.value = await getAirQuality(p.lat, p.lng)
  } catch (e) {
    airError.value = e.message
  } finally {
    airLoading.value = false
  }
}

function drawMap() {
  if (!mapEl.value) return
  if (!map) {
    map = L.map(mapEl.value, { scrollWheelZoom: false, preferCanvas: true })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap contributors', maxZoom: 18 }).addTo(map)
    layer = L.featureGroup().addTo(map)
  }
  layer.clearLayers()
  const { lat, lng } = place.value
  for (const r of [25, 50]) {
    L.circle([lat, lng], { radius: r * 1000, color: '#3a4139', weight: 1, dashArray: '4 4', fill: false }).addTo(layer)
  }
  for (const h of nearby.value) {
    L.circleMarker([h.lat, h.lng], { radius: 4, stroke: false, fillColor: CONFIDENCE[h.confidence].color, fillOpacity: 0.8 })
      .bindPopup(`${h.km.toFixed(1)} km ke ${direction(lat, lng, h.lat, h.lng)}<br>Kepercayaan: ${CONFIDENCE[h.confidence].label}<br>${formatDate(h.detectedAt)}`)
      .addTo(layer)
  }
  L.circleMarker([lat, lng], { radius: 7, color: '#ffffff', weight: 2, fillColor: '#2563eb', fillOpacity: 1 }).bindPopup(place.value.name).addTo(layer)
  map.fitBounds(L.latLng(lat, lng).toBounds(110000), { animate: false })
}

const fmtKm = (km) => km.toLocaleString('id-ID', { maximumFractionDigits: 1 })
</script>

<template>
  <section class="mx-auto max-w-6xl px-4 py-10">
    <p class="text-sm font-semibold uppercase tracking-widest text-ember-600">Cek sekitar saya</p>
    <h1 class="mt-1 font-display text-3xl font-extrabold md:text-4xl">Seberapa dekat titik panas dari Anda?</h1>
    <p class="mt-2 max-w-2xl text-ash-500">Lihat titik panas dalam radius 50 km dari lokasi Anda selama 7 hari terakhir, beserta kualitas udara hari ini menurut kategori ISPU.</p>

    <div class="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end">
      <button class="rounded-md bg-ember-600 px-5 py-3 font-semibold text-white hover:bg-ember-700 disabled:opacity-60" :disabled="locating" @click="useLocation">
        {{ locating ? 'Mencari lokasi…' : 'Gunakan lokasi saya' }}
      </button>
      <label class="flex flex-col gap-1 text-sm font-medium">
        atau pilih kota
        <select class="rounded-md border border-ash-200 bg-white px-3 py-2.5" :value="CITIES.find((c) => c.name === place?.name)?.name ?? ''" @change="choose(CITIES.find((c) => c.name === $event.target.value))">
          <option value="" disabled>Pilih kota</option>
          <option v-for="c in CITIES" :key="c.name" :value="c.name">{{ c.name }}</option>
        </select>
      </label>
    </div>
    <p v-if="locError" class="mt-3 text-sm text-red-700">{{ locError }}</p>
    <p class="mt-2 text-xs text-ash-500">Lokasi hanya dipakai di browser Anda untuk menghitung jarak, tidak dikirim atau disimpan oleh KarhutlaTracker.</p>

    <template v-if="place">
      <div v-if="status" class="mt-8 rounded-lg border p-5" :class="status.cls">
        <p class="font-semibold">{{ place.name }}</p>
        <p class="mt-1">{{ status.text }}</p>
      </div>

      <div class="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div class="min-w-0 rounded-lg border border-ash-200 bg-white p-5">
          <h2 class="font-display text-xl font-extrabold">Titik panas di sekitar</h2>
          <div class="mt-4 grid grid-cols-3 gap-3">
            <div v-for="c in counts" :key="c.r" class="rounded-md bg-ash-50 p-3 text-center">
              <p class="font-display text-2xl font-extrabold tabular-nums">{{ c.n.toLocaleString('id-ID') }}</p>
              <p class="text-xs text-ash-500">dalam {{ c.r }} km</p>
            </div>
          </div>
          <p v-if="nearest" class="mt-4 text-sm text-ash-700">
            Terdekat: <strong>{{ fmtKm(nearest.km) }} km</strong> ke arah {{ direction(place.lat, place.lng, nearest.lat, nearest.lng) }},
            terdeteksi {{ formatDate(nearest.detectedAt) }}, kepercayaan {{ CONFIDENCE[nearest.confidence].label.toLowerCase() }}.
          </p>
          <div ref="mapEl" class="mt-4 h-[340px] w-full overflow-hidden rounded-md border border-ash-200"></div>
          <p class="mt-2 text-xs text-ash-500">Garis putus-putus menandai radius 25 km dan 50 km. Titik biru adalah lokasi yang dipilih.</p>
        </div>

        <div class="flex flex-col gap-4">
          <div class="rounded-lg border border-ash-200 bg-white p-5">
            <h2 class="font-display text-xl font-extrabold">Kualitas udara hari ini</h2>
            <p v-if="airLoading" class="mt-3 text-sm text-ash-500">Memuat kualitas udara…</p>
            <p v-else-if="airError" class="mt-3 text-sm text-red-700">{{ airError }}</p>
            <template v-else-if="air">
              <div class="mt-4 rounded-md p-4" :style="{ background: air.category.color, color: air.category.text }">
                <p class="text-xs font-semibold uppercase tracking-wider opacity-80">ISPU PM2.5</p>
                <p class="mt-1 font-display text-4xl font-extrabold tabular-nums">{{ air.ispu }}</p>
                <p class="font-semibold">{{ air.category.label }}</p>
              </div>
              <p class="mt-3 text-sm text-ash-700">{{ air.category.meaning }}</p>
              <ul class="mt-3 list-disc pl-5 text-sm text-ash-700">
                <li v-for="a in air.category.advice" :key="a">{{ a }}</li>
              </ul>
              <p class="mt-3 text-xs text-ash-500">
                PM2.5 rata-rata 24 jam: {{ air.pm25.toLocaleString('id-ID') }} µg/m³. Angka ini perkiraan model satelit (Copernicus CAMS via Open-Meteo), bukan stasiun pemantau resmi.
              </p>
            </template>
          </div>

          <div class="rounded-lg border border-ash-200 bg-white p-5">
            <p class="text-xs font-semibold uppercase tracking-wider text-ash-500">Kategori ISPU (PermenLHK P.14/2020)</p>
            <ul class="mt-3 flex flex-col gap-1.5 text-sm">
              <li v-for="(c, i) in ISPU_CATEGORIES" :key="c.label" class="flex items-center gap-2">
                <span class="h-3 w-3 rounded-sm" :style="{ background: c.color }"></span>
                <span class="flex-1">{{ c.label }}</span>
                <span class="font-mono text-ash-500">{{ i === 0 ? '0' : ISPU_CATEGORIES[i - 1].max + 1 }}{{ c.max === Infinity ? '+' : '–' + c.max }}</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </template>
  </section>
</template>