<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import L from 'leaflet'
import { useRoute, useRouter } from 'vue-router'
import { getHotspotData, getWilayah, countByProvince, CONFIDENCE, BASEMAP, formatDate, formatShortDate, slugify, downloadCsv } from '../services/hotspots'

const route = useRoute()
const router = useRouter()
const mapEl = ref(null)
const data = ref(null)
const loading = ref(true)
const error = ref('')
const province = ref('')
const confidence = ref('')
const day = ref('')
const query = ref('')
const searching = ref(false)
const searchMsg = ref('')
let searchMarker = null
let map = null
let layer = null
let currentRadius = null
const INDONESIA = L.latLngBounds([-11, 95], [6, 141])

const all = computed(() => data.value?.hotspots ?? [])
const wilayah = ref(null)
const counts = computed(() => Object.fromEntries(countByProvince(all.value).map((p) => [p.province, p.count])))
const provinces = computed(() => {
  const names = wilayah.value?.provinsi.map((p) => p.name) ?? Object.keys(counts.value)
  return [...names].sort((a, b) => a.localeCompare(b, 'id')).map((name) => ({ name, n: counts.value[name] ?? 0 }))
})

const dayOf = (iso) => new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' })
const days = computed(() => [...new Set(all.value.map((h) => dayOf(h.detectedAt)))].sort().reverse())

const filtered = computed(() =>
  all.value.filter((h) =>
    (!province.value || h.province === province.value) &&
    (!confidence.value || h.confidence === confidence.value) &&
    (!day.value || dayOf(h.detectedAt) === day.value)),
)

const ranking = computed(() => countByProvince(filtered.value))

const lastDetected = computed(() => all.value.reduce((m, h) => (h.detectedAt > m ? h.detectedAt : m), '') || null)

function radiusForZoom(z) {
  return z <= 5 ? 1.8 : z <= 6 ? 2.5 : z <= 8 ? 3.5 : 5
}

function popupHtml(h) {
  const c = CONFIDENCE[h.confidence]
  return `<strong>${h.province}</strong><br>Kepercayaan: ${c.label}<br>Satelit: ${h.satellite}<br>${formatDate(h.detectedAt)}`
}

function draw() {
  if (!map) return
  layer.clearLayers()
  currentRadius = radiusForZoom(map.getZoom())
  const order = { low: 0, nominal: 1, high: 2 }
  const sorted = [...filtered.value].sort((a, b) => order[a.confidence] - order[b.confidence])
  for (const h of sorted) {
    L.circleMarker([h.lat, h.lng], {
      radius: currentRadius, stroke: false, fillColor: CONFIDENCE[h.confidence].color, fillOpacity: 0.8, hotspot: h,
    }).addTo(layer)
  }
}

// Peta mengikuti provinsi yang dipilih, bukan filter lain. Jadi saat filter kepercayaan atau tanggal
// membuat titik kosong, peta tetap di provinsi itu.
function fitToData() {
  if (!map) return
  const pts = province.value ? all.value.filter((h) => h.province === province.value) : []
  if (!pts.length) return map.fitBounds(INDONESIA, { animate: false })
  map.fitBounds(L.latLngBounds(pts.map((h) => [h.lat, h.lng])).pad(0.2), { maxZoom: 8, animate: false })
}

onMounted(async () => {
  map = L.map(mapEl.value, {
  scrollWheelZoom: true,     
  wheelPxPerZoomLevel: 120,  
  wheelDebounceTime: 20,
  preferCanvas: true,
  zoomSnap: 0.25,
  minZoom: 4,
  maxBounds: INDONESIA.pad(0.5),
})
  map.fitBounds(INDONESIA, { animate: false })
  L.tileLayer(BASEMAP.url, BASEMAP.options).addTo(map)

  layer = L.featureGroup().addTo(map)
  layer.on('click', (e) => {
    L.popup().setLatLng(e.latlng).setContent(popupHtml(e.layer.options.hotspot)).openOn(map)
  })

  map.on('zoomend', () => {
    if (radiusForZoom(map.getZoom()) !== currentRadius) draw()
  })

  getWilayah().then((w) => (wilayah.value = w)).catch(() => {})

  try {
    data.value = await getHotspotData()
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
})

watch(filtered, () => draw())
watch([province, () => all.value.length], () => fitToData())

watch([provinces, () => route.query.p], () => {
  const name = provinces.value.find((p) => slugify(p.name) === route.query.p)?.name
  if (name && name !== province.value) province.value = name
}, { immediate: true })

watch(province, (name) => {
  const p = name ? slugify(name) : undefined
  if (p !== route.query.p) router.replace({ query: p ? { p } : {} })
})

onBeforeUnmount(() => map?.remove())

function unduh() {
  const date = new Date().toISOString().slice(0, 10)
  const name = province.value ? slugify(province.value) : 'indonesia'
  downloadCsv(filtered.value, `karhutlatracker-titik-panas-${name}-${date}.csv`)
}

function reset() {
  province.value = ''
  confidence.value = ''
  day.value = ''
  query.value = ''
  searchMsg.value = ''
  searchMarker?.remove()
  searchMarker = null
}

// Cari lokasi: nama provinsi langsung menyaring peta, nama kota atau kabupaten memindahkan peta ke lokasinya.
async function search() {
  const q = query.value.trim()
  if (q.length < 3 || !map) return
  searchMsg.value = ''
  const norm = (t) => t.toLowerCase().replace(/^provinsi\s+/, '').trim()
  const prov = provinces.value.find((p) => norm(p.name).includes(norm(q)))
  if (prov) {
    province.value = prov.name
    return
  }
  searching.value = true
  try {
    const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1&language=id&countryCode=ID`)
    const r = (await res.json()).results?.[0]
    if (!r) {
      searchMsg.value = `Lokasi "${q}" tidak ditemukan.`
      return
    }
    if (province.value) {
      province.value = ''
      await nextTick()
    }
    searchMarker?.remove()
    searchMarker = L.circleMarker([r.latitude, r.longitude], { radius: 9, color: '#2563eb', weight: 3, fillColor: '#ffffff', fillOpacity: 1 }).addTo(map).bindPopup(`<strong>${r.name}</strong>${r.admin1 ? `<br>${r.admin1}` : ''}`).openPopup()
    map.flyTo([r.latitude, r.longitude], 9, { duration: 0.8 })
  } catch {
    searchMsg.value = 'Pencarian gagal, coba lagi.'
  } finally {
    searching.value = false
  }
}

</script>

<template>
  <section class="page">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="page-title">Peta titik panas</h1>
        <p class="lede !mt-2 text-base">
          Deteksi satelit 7 hari terakhir.
          <template v-if="lastDetected">Deteksi terakhir {{ formatDate(lastDetected) }}.</template>
        </p>
      </div>
      <p v-if="data?.source?.startsWith('DATA CONTOH')" class="rounded-full bg-ember-400/15 px-3 py-1 text-xs font-medium text-flare">Masih memakai data contoh</p>
    </div>

    <div class="glass mt-6 p-4">
      <div class="flex flex-wrap items-end gap-3">
        <label class="flex flex-col gap-1.5">
          <span class="label">Provinsi</span>
          <select id="filter-province" v-model="province" class="field h-11 w-56 !py-0">
            <option value="">Semua provinsi</option>
            <option v-for="p in provinces" :key="p.name" :value="p.name">{{ p.name }} ({{ p.n.toLocaleString('id-ID') }})</option>
          </select>
        </label>
        <label class="flex flex-col gap-1.5">
          <span class="label">Tingkat kepercayaan</span>
          <select id="filter-confidence" v-model="confidence" class="field h-11 !py-0">
            <option value="">Semua</option>
            <option v-for="(c, key) in CONFIDENCE" :key="key" :value="key">{{ c.label }}</option>
          </select>
        </label>
        <label class="flex flex-col gap-1.5">
          <span class="label">Tanggal</span>
          <select id="filter-day" v-model="day" class="field h-11 !py-0">
            <option value="">7 hari terakhir</option>
            <option v-for="d in days" :key="d" :value="d">{{ formatShortDate(d) }}</option>
          </select>
        </label>
        <form class="flex flex-col gap-1.5" @submit.prevent="search">
          <label for="cari-peta" class="label">Cari lokasi</label>
          <div class="flex gap-2">
            <input id="cari-peta" v-model="query" type="search" class="field h-11 w-48 !py-0" placeholder="provinsi atau kota" />
            <button type="submit" class="btn-ghost h-11 !px-4 !py-0 text-sm" :disabled="searching">{{ searching ? '…' : 'Cari' }}</button>
          </div>
        </form>
        <button class="btn-ghost h-11 !py-0 text-sm lg:ml-auto" :disabled="!filtered.length" @click="unduh">
          Unduh CSV ({{ filtered.length.toLocaleString('id-ID') }} titik)
        </button>
      </div>
      <div v-if="province || confidence || day || query" class="mt-3 flex flex-wrap gap-2">
        <button class="rounded-full px-4 py-2 text-sm font-semibold text-flare hover:bg-veil/5" @click="reset">Reset filter</button>
        <RouterLink v-if="province" :to="{ name: 'region', query: { p: slugify(province) } }" class="rounded-full px-4 py-2 text-sm font-semibold text-flare hover:bg-veil/5">Lihat profil {{ province }} →</RouterLink>
      </div>
    </div>

    <div class="mt-4 grid gap-4 lg:grid-cols-[1fr_320px]">
      <div class="min-w-0">
        <div class="glass relative overflow-hidden p-1.5">
          <div ref="mapEl" class="h-[460px] w-full overflow-hidden rounded-[1rem] md:h-[600px]"></div>
          <div v-if="loading" class="absolute inset-0 z-[500] grid place-items-center bg-night/70 text-mist">
            Memuat data titik panas…
          </div>
        </div>
        <div class="mt-3 flex flex-wrap gap-x-5 gap-y-2 px-1 text-sm text-mist">
          <span v-for="(c, key) in CONFIDENCE" :key="key" class="flex items-center gap-2">
            <span class="h-2.5 w-2.5 rounded-full" :style="{ background: c.color, boxShadow: `0 0 8px ${c.color}` }"></span>Kepercayaan {{ c.label.toLowerCase() }}
          </span>
          <span v-if="data" class="sm:ml-auto">Data diambil {{ formatDate(data.updatedAt) }}</span>
        </div>
        <p v-if="searchMsg" class="mt-3 text-sm text-flare">{{ searchMsg }}</p>
        <p v-if="error" class="mt-3 text-sm text-red-300">{{ error }}. Pastikan file public/data/hotspots.json ada.</p>
      </div>

      <aside class="flex flex-col gap-4">
        <div class="glass p-5">
          <p class="label">Titik panas ditampilkan</p>
          <p class="mt-1 font-display text-5xl font-extrabold tabular-nums tracking-tight">{{ filtered.length.toLocaleString('id-ID') }}</p>
          <p class="text-sm text-mist">dari {{ all.length.toLocaleString('id-ID') }} titik</p>
        </div>
        <div class="glass p-5">
          <p class="label">Per provinsi, klik untuk menyaring</p>
          <ul class="mt-3 flex max-h-80 flex-col gap-0.5 overflow-y-auto pr-1 md:max-h-[420px]">
            <li v-for="r in ranking" :key="r.province">
              <button class="flex w-full justify-between rounded-lg px-2.5 py-1.5 text-left text-sm transition hover:bg-veil/5" :class="province === r.province && 'bg-ember-400/10 text-flare'" @click="province = r.province">
                <span>{{ r.province }}</span><span class="font-semibold tabular-nums">{{ r.count.toLocaleString('id-ID') }}</span>
              </button>
            </li>
            <li v-if="!ranking.length && !loading" class="text-sm text-mist">Tidak ada titik panas untuk filter ini.</li>
          </ul>
        </div>
      </aside>
    </div>
  </section>
</template>