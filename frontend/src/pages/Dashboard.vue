<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import L from 'leaflet'
import { getHotspotData, countByProvince, CONFIDENCE, BASEMAP, formatDate, slugify, downloadCsv } from '../services/hotspots'

const mapEl = ref(null)
const data = ref(null)
const loading = ref(true)
const error = ref('')
const province = ref('')
const confidence = ref('')
let map = null
let layer = null
let currentRadius = null
const INDONESIA = L.latLngBounds([-11, 95], [6, 141])

const all = computed(() => data.value?.hotspots ?? [])
const provinces = computed(() => countByProvince(all.value).map((p) => p.province).sort())
const filtered = computed(() =>
  all.value.filter((h) => (!province.value || h.province === province.value) && (!confidence.value || h.confidence === confidence.value)),
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

function fitToData() {
  if (!province.value) {
    map.fitBounds(INDONESIA, { animate: false })
    return
  }
  if (!filtered.value.length) return
  map.fitBounds(L.latLngBounds(filtered.value.map((h) => [h.lat, h.lng])).pad(0.2), { maxZoom: 8, animate: false })
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

  try {
    data.value = await getHotspotData()
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
})

watch(filtered, () => {
  if (!map) return
  fitToData()
  draw()
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

    <div class="glass mt-6 flex flex-wrap items-end gap-3 p-4">
      <label class="flex flex-col gap-1.5">
        <span class="label">Provinsi</span>
        <select id="filter-province" v-model="province" class="field">
          <option value="">Semua provinsi</option>
          <option v-for="p in provinces" :key="p" :value="p">{{ p }}</option>
        </select>
      </label>
      <label class="flex flex-col gap-1.5">
        <span class="label">Tingkat kepercayaan</span>
        <select id="filter-confidence" v-model="confidence" class="field">
          <option value="">Semua</option>
          <option v-for="(c, key) in CONFIDENCE" :key="key" :value="key">{{ c.label }}</option>
        </select>
      </label>
      <button v-if="province || confidence" class="rounded-full px-4 py-2.5 text-sm font-semibold text-flare hover:bg-white/5" @click="reset">Reset filter</button>
      <RouterLink v-if="province" :to="{ name: 'region', query: { p: slugify(province) } }" class="rounded-full px-4 py-2.5 text-sm font-semibold text-flare hover:bg-white/5">Lihat profil {{ province }}</RouterLink>
      <button class="btn-ghost ml-auto !py-2.5 text-sm" :disabled="!filtered.length" @click="unduh">
        Unduh CSV ({{ filtered.length.toLocaleString('id-ID') }} titik)
      </button>
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
              <button class="flex w-full justify-between rounded-lg px-2.5 py-1.5 text-left text-sm transition hover:bg-white/5" :class="province === r.province && 'bg-ember-400/10 text-flare'" @click="province = r.province">
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