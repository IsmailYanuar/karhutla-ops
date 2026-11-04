<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import L from 'leaflet'
import { getHotspotData, countByProvince, CONFIDENCE, formatDate, slugify, downloadCsv } from '../services/hotspots'

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
      radius: currentRadius, stroke: false, fillColor: CONFIDENCE[h.confidence].color, fillOpacity: 0.65, hotspot: h,
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
  map = L.map(mapEl.value, { scrollWheelZoom: false, preferCanvas: true, zoomSnap: 0.25, minZoom: 4, maxBounds: INDONESIA.pad(0.5) })
  map.fitBounds(INDONESIA, { animate: false })
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 18,
  }).addTo(map)

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
  <section class="mx-auto max-w-6xl px-4 py-8">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="font-display text-3xl font-extrabold">Peta Titik Panas</h1>
        <p class="mt-1 text-ash-500">
          Deteksi satelit 7 hari terakhir<span v-if="lastDetected"> · deteksi terakhir {{ formatDate(lastDetected) }}</span><span v-if="data"> · data diambil {{ formatDate(data.updatedAt) }}</span>
        </p>
      </div>
      <p v-if="data?.source?.startsWith('DATA CONTOH')" class="rounded bg-ember-50 px-2 py-1 text-xs font-medium text-ember-700">Masih memakai data contoh</p>
    </div>

    <div class="mt-6 flex flex-wrap items-end gap-3">
      <label class="flex flex-col gap-1 text-sm font-medium">
        Provinsi
        <select id="filter-province" v-model="province" class="rounded-md border border-ash-200 bg-white px-3 py-2">
          <option value="">Semua provinsi</option>
          <option v-for="p in provinces" :key="p" :value="p">{{ p }}</option>
        </select>
      </label>
      <label class="flex flex-col gap-1 text-sm font-medium">
        Tingkat kepercayaan
        <select id="filter-confidence" v-model="confidence" class="rounded-md border border-ash-200 bg-white px-3 py-2">
          <option value="">Semua</option>
          <option v-for="(c, key) in CONFIDENCE" :key="key" :value="key">{{ c.label }}</option>
        </select>
      </label>
      <button v-if="province || confidence" class="rounded-md px-3 py-2 text-sm font-medium text-ember-700 hover:bg-ember-50" @click="reset">Reset filter</button>
      <RouterLink v-if="province" :to="{ name: 'region', query: { p: slugify(province) } }" class="rounded-md px-3 py-2 text-sm font-semibold text-ember-700 hover:bg-ember-50">Lihat profil {{ province }}</RouterLink>
      <button class="ml-auto rounded-md border border-ash-200 bg-white px-4 py-2 text-sm font-semibold hover:bg-ash-100 disabled:opacity-50" :disabled="!filtered.length" @click="unduh">
        Unduh CSV ({{ filtered.length.toLocaleString('id-ID') }} titik)
      </button>
    </div>

    <div class="mt-6 grid gap-6 lg:grid-cols-[1fr_300px]">
      <div class="min-w-0">
        <div class="relative">
          <div ref="mapEl" class="h-[460px] w-full overflow-hidden rounded-lg border border-ash-200 md:h-[560px]"></div>
          <div v-if="loading" class="absolute inset-0 z-[500] grid place-items-center rounded-lg bg-ash-50/70 text-sm font-medium text-ash-700">
            Memuat data titik panas…
          </div>
        </div>
        <div class="mt-3 flex flex-wrap gap-4 text-sm text-ash-700">
          <span v-for="(c, key) in CONFIDENCE" :key="key" class="flex items-center gap-2">
            <span class="h-3 w-3 rounded-full" :style="{ background: c.color }"></span>Kepercayaan {{ c.label.toLowerCase() }}
          </span>
        </div>
        <p v-if="error" class="mt-3 text-sm text-red-700">{{ error }}. Pastikan file public/data/hotspots.json ada.</p>
      </div>

      <aside class="flex flex-col gap-4">
        <div class="rounded-lg border border-ash-200 bg-white p-5">
          <p class="text-xs font-semibold uppercase tracking-wider text-ash-500">Titik panas ditampilkan</p>
          <p class="mt-2 font-display text-4xl font-extrabold tabular-nums">{{ filtered.length.toLocaleString('id-ID') }}</p>
          <p class="text-sm text-ash-500">dari {{ all.length.toLocaleString('id-ID') }} titik</p>
        </div>
        <div class="rounded-lg border border-ash-200 bg-white p-5">
          <p class="text-xs font-semibold uppercase tracking-wider text-ash-500">Per provinsi</p>
          <ul class="mt-3 flex max-h-80 flex-col gap-2 overflow-y-auto pr-1 md:max-h-[380px]">
            <li v-for="r in ranking" :key="r.province">
              <button class="flex w-full justify-between rounded px-2 py-1 text-left text-sm hover:bg-ash-100" @click="province = r.province">
                <span>{{ r.province }}</span><span class="font-mono tabular-nums">{{ r.count.toLocaleString('id-ID') }}</span>
              </button>
            </li>
            <li v-if="!ranking.length && !loading" class="text-sm text-ash-500">Tidak ada titik panas untuk filter ini.</li>
          </ul>
        </div>
      </aside>
    </div>
  </section>
</template>