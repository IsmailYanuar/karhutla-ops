<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import L from 'leaflet'
import { getHotspotData, CONFIDENCE, BASEMAP, formatDate } from '../services/hotspots'
import { getAirQuality, getAirQualityMany, distanceKm, direction, ISPU_CATEGORIES } from '../services/udara'
import { theme, cssColor } from '../composables/useTheme'
import { CITIES } from '../services/kota'

const RADII = [10, 25, 50]

const data = ref(null)
const place = ref(null)
const locating = ref(false)
const locError = ref('')
const air = ref(null)
const airError = ref('')
const airLoading = ref(false)
const query = ref('')
const results = ref([])
const searching = ref(false)
const searchError = ref('')
const mapEl = ref(null)
let map = null
let layer = null
let request = 0
const INDONESIA = L.latLngBounds([-11, 95], [6, 141])

const cityAir = ref(null)
const cityAirError = ref('')
const openCategory = ref(null)
const citiesByCategory = computed(() => {
  const groups = Object.fromEntries(ISPU_CATEGORIES.map((c) => [c.slug, []]))
  for (const c of cityAir.value ?? []) groups[c.category.slug].push(c)
  for (const list of Object.values(groups)) list.sort((a, b) => b.ispu - a.ispu)
  return groups
})
function toggleCategory(c) {
  openCategory.value = openCategory.value === c.slug ? null : c.slug
}
async function chooseCity(c) {
  await choose(CITIES.find((x) => x.name === c.name))
  document.getElementById('hasil-sekitar')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

onMounted(async () => {
  getAirQualityMany(CITIES)
    .then((list) => (cityAir.value = list.map((a, i) => a && { ...CITIES[i], ...a }).filter(Boolean)))
    .catch(() => (cityAirError.value = 'Data kualitas udara kota belum bisa dimuat.'))
  initMap()
  try { data.value = await getHotspotData() } catch { }
  if (!place.value) drawMap()
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
  if (within25 >= 10) return { level: 'tinggi', text: 'Banyak titik panas di sekitar Anda. Waspadai asap dan ikuti informasi dari BPBD setempat.', cls: 'border-red-400/40 bg-red-500/10 text-red-200' }
  if (within25 > 0) return { level: 'waspada', text: 'Ada titik panas di sekitar Anda. Pantau perkembangan dan kualitas udara.', cls: 'border-ember-400/40 bg-ember-400/10 text-flare' }
  return { level: 'aman', text: 'Tidak ada titik panas dalam radius 25 km selama 7 hari terakhir.', cls: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200' }
})

async function useLocation() {
  locError.value = ''
  if (!navigator.geolocation) {
    locError.value = 'Browser Anda tidak mendukung lokasi. Cari atau pilih kota.'
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
      locError.value = 'Izin lokasi ditolak atau tidak tersedia. Cari atau pilih kota.'
    },
    { enableHighAccuracy: false, timeout: 10000 },
  )
}

const PROVINCES = CITIES.map((c) => {
  const [, city, province] = c.name.match(/^(.*) \((.*)\)$/)
  return { ...c, city, province }
})

const ALIAS = {
  sumut: 'sumatera utara', sumbar: 'sumatera barat', sumsel: 'sumatera selatan', kepri: 'kepulauan riau', babel: 'bangka belitung',
  dki: 'dki jakarta', jabar: 'jawa barat', jateng: 'jawa tengah', jatim: 'jawa timur', diy: 'di yogyakarta', jogja: 'di yogyakarta',
  ntb: 'nusa tenggara barat', ntt: 'nusa tenggara timur', kalbar: 'kalimantan barat', kalteng: 'kalimantan tengah',
  kalsel: 'kalimantan selatan', kaltim: 'kalimantan timur', kaltara: 'kalimantan utara', sulut: 'sulawesi utara',
  sulteng: 'sulawesi tengah', sulbar: 'sulawesi barat', sulsel: 'sulawesi selatan', sultra: 'sulawesi tenggara', malut: 'maluku utara',
}
const norm = (t) => t.toLowerCase().replace(/^provinsi\s+/, '').replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim()

async function search() {
  const q = query.value.trim()
  if (q.length < 3) return
  searching.value = true
  searchError.value = ''
  const nq = ALIAS[norm(q)] ?? norm(q)
  const local = PROVINCES.filter((c) => norm(c.province).includes(nq)).map((c) => ({
    ...c,
    label: `Provinsi ${c.province}`,
    note: `ibu kota ${c.city}`,
  }))
  results.value = local
  try {
    const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=id&countryCode=ID`)
    const json = await res.json()
    const found = (json.results ?? []).map((r) => ({
      name: [r.name, r.admin2, r.admin1].filter((v, i, arr) => v && arr.indexOf(v) === i).join(', '),
      lat: r.latitude,
      lng: r.longitude,
    }))
    results.value = [...local, ...found.filter((f) => !local.some((l) => distanceKm(l.lat, l.lng, f.lat, f.lng) < 5))]
    if (!results.value.length) searchError.value = `Tempat "${q}" tidak ditemukan. Coba nama provinsi, kota, atau kabupaten lain.`
  } catch {
    if (!local.length) searchError.value = 'Pencarian gagal, coba lagi.'
  } finally {
    searching.value = false
  }
}

function pick(p) {
  results.value = []
  query.value = ''
  choose({ name: p.name, lat: p.lat, lng: p.lng })
}

async function placeName(lat, lng) {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=14&accept-language=id`)
    if (!res.ok) return null
    const a = (await res.json()).address ?? {}
    const parts = [a.village || a.suburb || a.town || a.city_district || a.municipality, a.city || a.county || a.regency, a.state]
    return [...new Set(parts.filter(Boolean))].join(', ') || null
  } catch { return null }
}

const coordText = (lat, lng) => `${Math.abs(lat).toFixed(3)}° ${lat < 0 ? 'LS' : 'LU'}, ${lng.toFixed(3)}° BT`

function pickOnMap(lat, lng) {
  choose({ name: 'Mencari nama tempat…', lat, lng }, false)
  const id = request
  placeName(lat, lng).then((name) => {
    if (id === request) place.value = { ...place.value, name: name ?? `Titik pilihan (${coordText(lat, lng)})` }
  })
}

async function choose(p, fit = true) {
  const id = ++request
  place.value = p
  await nextTick()
  drawMap(fit)
  air.value = null
  airError.value = ''
  airLoading.value = true
  try {
    const result = await getAirQuality(p.lat, p.lng)
    if (id === request) air.value = result
  } catch (e) {
    if (id === request) airError.value = e.message
  } finally {
    if (id === request) airLoading.value = false
  }
}

function initMap() {
  map = L.map(mapEl.value, { scrollWheelZoom: true, wheelPxPerZoomLevel: 120, wheelDebounceTime: 20, preferCanvas: true, zoomSnap: 0.25, minZoom: 4 })
  L.tileLayer(BASEMAP.url, BASEMAP.options).addTo(map)
  layer = L.featureGroup().addTo(map)
  map.fitBounds(INDONESIA, { animate: false })
  map.on('click', (e) => pickOnMap(e.latlng.lat, e.latlng.lng))
}

const PIN = L.divIcon({
  className: '',
  html: '<span style="display:block;width:18px;height:18px;border-radius:50%;background:#3b82f6;border:3px solid #fff;box-shadow:0 0 0 6px rgba(59,130,246,.25),0 2px 6px rgba(0,0,0,.4);cursor:grab"></span>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
})

function drawMap(fit = true) {
  if (!map) return
  layer.clearLayers()

  if (!place.value) {
    for (const h of data.value?.hotspots ?? []) {
      L.circleMarker([h.lat, h.lng], { radius: 2, stroke: false, fillColor: CONFIDENCE[h.confidence].color, fillOpacity: 0.7, interactive: false }).addTo(layer)
    }
    return
  }

  const { lat, lng } = place.value
  for (const r of [25, 50]) {
    L.circle([lat, lng], { radius: r * 1000, color: cssColor('--color-flare'), opacity: 0.6, weight: 1, dashArray: '4 6', fill: false, interactive: false }).addTo(layer)
  }
  for (const h of nearby.value) {
    L.circleMarker([h.lat, h.lng], { radius: 4, stroke: false, fillColor: CONFIDENCE[h.confidence].color, fillOpacity: 0.8 })
      .bindPopup(`${h.km.toFixed(1)} km ke ${direction(lat, lng, h.lat, h.lng)}<br>Kepercayaan: ${CONFIDENCE[h.confidence].label}<br>${formatDate(h.detectedAt)}`)
      .addTo(layer)
  }

  L.marker([lat, lng], { icon: PIN, draggable: true, autoPan: true, keyboard: false, title: 'Geser untuk memindahkan lokasi' })
    .on('dragend', (e) => { const p = e.target.getLatLng(); pickOnMap(p.lat, p.lng) })
    .addTo(layer)
  if (fit) map.fitBounds(L.latLng(lat, lng).toBounds(110000), { animate: false })
  else if (map.getZoom() < 8) map.setView([lat, lng], 9, { animate: true })
}

watch(theme, () => drawMap(false))
const tapWord = window.matchMedia?.('(hover: none)').matches ? 'Ketuk' : 'Klik'
const fmtKm = (km) => km.toLocaleString('id-ID', { maximumFractionDigits: 1 })
</script>

<template>
  <section class="page">
    <h1 class="page-title">Seberapa dekat titik panas dari Anda?</h1>
    <p class="lede">Lihat titik panas dalam radius 50 km dari lokasi Anda selama 7 hari terakhir, beserta kualitas udara hari ini menurut kategori ISPU.</p>

    <div class="glass mt-8 flex flex-col gap-4 p-4 md:flex-row md:items-end md:p-5">
      <button class="btn-ember" :disabled="locating" @click="useLocation">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></svg>
        {{ locating ? 'Mencari lokasi…' : 'Gunakan lokasi saya' }}
      </button>
      <form class="flex flex-1 flex-col gap-1.5 md:max-w-sm" @submit.prevent="search">
        <label for="cari-tempat" class="label">atau cari provinsi, kota, atau kabupaten</label>
        <div class="flex gap-2">
          <input id="cari-tempat" v-model="query" type="search" placeholder="contoh: Kalimantan Tengah" class="field min-w-0 flex-1" />
          <button type="submit" class="btn-ghost !px-4 !py-2.5" :disabled="searching">{{ searching ? '…' : 'Cari' }}</button>
        </div>
      </form>
      <label class="flex flex-col gap-1.5">
        <span class="label">atau pilih ibu kota provinsi</span>
        <select class="field" :value="CITIES.find((c) => c.name === place?.name)?.name ?? ''" @change="choose(CITIES.find((c) => c.name === $event.target.value))">
          <option value="" disabled>Pilih kota</option>
          <option v-for="c in CITIES" :key="c.name" :value="c.name">{{ c.name }}</option>
        </select>
      </label>
    </div>
    <ul v-if="results.length" class="glass-sm mt-3 flex max-w-xl flex-col divide-y divide-veil/5 overflow-hidden">
      <li v-for="r in results" :key="r.name + r.lat">
        <button class="flex w-full items-baseline justify-between gap-3 px-4 py-3 text-left text-sm hover:bg-veil/5" @click="pick(r)">
          <span><span v-if="r.label" class="font-semibold">{{ r.label }}</span><template v-else>{{ r.name }}</template></span>
          <span v-if="r.note" class="shrink-0 text-xs text-mist">{{ r.note }}</span>
        </button>
      </li>
    </ul>
    <p v-if="searchError" class="mt-3 text-sm text-red-300">{{ searchError }}</p>
    <p v-if="locError" class="mt-3 text-sm text-red-300">{{ locError }}</p>
    <p class="mt-3 text-xs text-mist">Lokasi tidak disimpan oleh KarhutlaTracker. Koordinat hanya dikirim ke Open-Meteo untuk kualitas udara dan ke OpenStreetMap untuk nama tempat.</p>
    <div id="hasil-sekitar" class="scroll-mt-24"></div>
    <div v-if="place && status" class="mt-8 rounded-2xl border p-5" :class="status.cls">
      <p class="font-display text-lg font-bold">{{ place.name }}</p>
      <p class="mt-1">{{ status.text }}</p>
    </div>

    <div class="mt-4 grid gap-4 lg:grid-cols-[1fr_360px]" :class="!place && 'mt-8'">
      <div class="glass min-w-0 p-5">
        <h2 class="font-display text-2xl font-bold">{{ place ? 'Titik panas di sekitar' : 'Atau pilih langsung di peta' }}</h2>
        <template v-if="place">
          <div class="mt-4 grid grid-cols-3 gap-3">
            <div v-for="c in counts" :key="c.r" class="glass-sm p-3 text-center">
              <p class="font-display text-3xl font-extrabold tabular-nums">{{ c.n.toLocaleString('id-ID') }}</p>
              <p class="text-xs text-mist">dalam {{ c.r }} km</p>
            </div>
          </div>
          <p v-if="nearest" class="mt-4 text-sm text-mist">
            Terdekat <strong class="text-paper">{{ fmtKm(nearest.km) }} km</strong> ke arah {{ direction(place.lat, place.lng, nearest.lat, nearest.lng) }},
            terdeteksi {{ formatDate(nearest.detectedAt) }}, kepercayaan {{ CONFIDENCE[nearest.confidence].label.toLowerCase() }}.
          </p>
        </template>
        <p v-else class="mt-1 text-sm text-mist">Titik oranye adalah titik panas 7 hari terakhir. Pilih lokasi mana saja untuk melihat kondisi di sekitarnya.</p>
        <div class="relative mt-4">
          <div ref="mapEl" class="h-[360px] w-full cursor-crosshair overflow-hidden rounded-xl md:h-[420px]"></div>
          <div class="pointer-events-none absolute inset-x-0 top-3 z-[500] flex justify-center px-14">
            <p class="map-hint flex items-center gap-2 rounded-full bg-night/85 px-3.5 py-2 text-xs font-semibold text-paper shadow-lg ring-1 ring-line backdrop-blur sm:px-4 sm:text-sm" :class="!place && 'map-hint-bounce'">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0 text-ember-400"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21Z" /><circle cx="12" cy="9.5" r="2.5" /></svg>
              {{ place ? `${tapWord} tempat lain atau geser titik biru` : `${tapWord} peta untuk memilih lokasi` }}
            </p>
          </div>
        </div>
        <p class="mt-2 text-xs text-mist">
          {{ place ? 'Garis putus-putus menandai radius 25 km dan 50 km dari lokasi yang dipilih.' : 'Gunakan scroll, cubit layar, atau tombol + dan − untuk memperbesar peta.' }}
        </p>
      </div>

      <div class="flex flex-col gap-4">
        <div class="glass p-5">
          <h2 class="font-display text-2xl font-bold">Kualitas udara hari ini</h2>
          <p v-if="!place" class="mt-3 text-sm text-mist">Pilih lokasi untuk melihat kualitas udara hari ini di tempat itu.</p>
          <p v-else-if="airLoading" class="mt-3 text-sm text-mist">Memuat kualitas udara…</p>
          <p v-else-if="airError" class="mt-3 text-sm text-red-300">{{ airError }}</p>
          <template v-else-if="air">
            <div class="mt-4 rounded-xl p-5" :style="{ background: air.category.color, color: air.category.text, boxShadow: `0 10px 40px -12px ${air.category.color}` }">
              <p class="text-sm font-medium opacity-80">ISPU PM2.5</p>
              <p class="font-display text-6xl font-extrabold tabular-nums leading-none">{{ air.ispu }}</p>
              <p class="mt-1 font-semibold">{{ air.category.label }}</p>
            </div>
            <p class="mt-4 text-sm">{{ air.category.meaning }}</p>
            <ul class="mt-3 list-disc pl-5 text-sm text-mist">
              <li v-for="a in air.category.advice" :key="a">{{ a }}</li>
            </ul>
            <RouterLink :to="{ name: 'siaga', query: { ispu: air.category.slug } }" class="btn-ghost mt-4 w-full !py-2.5 text-sm">
              Panduan Siaga Asap untuk kategori ini
            </RouterLink>
            <p class="mt-4 text-xs text-mist">
              PM2.5 rata-rata 24 jam {{ air.pm25.toLocaleString('id-ID') }} µg/m³. Angka ini perkiraan model (Copernicus CAMS via Open-Meteo), bukan stasiun pemantau resmi.
            </p>
          </template>
        </div>

        <div class="glass p-5">
          <p class="label">Kategori ISPU menurut PermenLHK P.14/2020</p>
          <p class="mt-1 text-xs text-mist">Klik kategori untuk melihat ibu kota provinsi yang masuk kategori itu hari ini.</p>
          <ul class="mt-3 flex flex-col gap-1 text-sm">
            <li v-for="(c, i) in ISPU_CATEGORIES" :key="c.label">
              <button
                class="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left transition hover:bg-veil/5"
                :class="openCategory === c.slug && 'bg-veil/5'"
                :aria-expanded="openCategory === c.slug"
                @click="toggleCategory(c)"
              >
                <span class="h-3 w-3 shrink-0 rounded-full ring-1 ring-veil/20" :style="{ background: c.color }"></span>
                <span class="flex-1">{{ c.label }}</span>
                <span class="tabular-nums text-mist">{{ i === 0 ? '0' : ISPU_CATEGORIES[i - 1].max + 1 }}{{ c.max === Infinity ? '+' : '–' + c.max }}</span>
                <span v-if="cityAir" class="min-w-[2.25rem] rounded-full bg-veil/10 px-2 py-0.5 text-center text-xs font-semibold tabular-nums">{{ citiesByCategory[c.slug].length }}</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" class="shrink-0 text-mist transition" :class="openCategory === c.slug && 'rotate-180'"><path d="M6 9l6 6 6-6" /></svg>
              </button>
              <div v-if="openCategory === c.slug" class="mb-2 ml-8 mt-1">
                <p v-if="cityAirError" class="text-xs text-red-300">{{ cityAirError }}</p>
                <p v-else-if="!cityAir" class="text-xs text-mist">Memuat data kota…</p>
                <p v-else-if="!citiesByCategory[c.slug].length" class="text-xs text-mist">Tidak ada ibu kota provinsi dalam kategori ini hari ini.</p>
                <ul v-else class="flex flex-col">
                  <li v-for="city in citiesByCategory[c.slug]" :key="city.name">
                    <button class="flex w-full items-center justify-between gap-3 rounded-md px-2 py-1 text-left text-xs transition hover:bg-veil/5 hover:text-flare" @click="chooseCity(city)">
                      <span>{{ city.name }}</span>
                      <span class="font-semibold tabular-nums">{{ city.ispu }}</span>
                    </button>
                  </li>
                </ul>
              </div>
            </li>
          </ul>
          <p v-if="cityAir" class="mt-3 text-xs text-mist">ISPU PM2.5 rata-rata 24 jam di {{ cityAir.length }} ibu kota provinsi, perkiraan model Copernicus CAMS.</p>
        </div>
      </div>
    </div>
  </section>
</template>


<style scoped>
.map-hint-bounce { animation: hint-bounce 2.4s ease-in-out infinite; }
@keyframes hint-bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(5px); }
}
</style>