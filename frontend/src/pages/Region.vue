<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import L from 'leaflet'
import StatCard from '../components/StatCard.vue'
import DailyChart from '../components/DailyChart.vue'
import {
  getHotspotData, getHistory, getWilayah, CONFIDENCE, addDays, sumRange, percentChange, formatShortDate, slugify,
} from '../services/hotspots'

const route = useRoute()
const router = useRouter()
const hotspotData = ref(null)
const history = ref(null)
const wilayah = ref(null)
const error = ref('')
const copied = ref(false)
const mapEl = ref(null)
let map = null
let layer = null
let boundaries = null

onMounted(async () => {
  try {
    ;[hotspotData.value, history.value, wilayah.value] = await Promise.all([getHotspotData(), getHistory(), getWilayah()])
  } catch (e) {
    error.value = e.message
  }
})

const days = computed(() => history.value?.days ?? {})
const lastDate = computed(() => Object.keys(days.value).sort().at(-1))
const provinces = computed(() => wilayah.value?.provinsi ?? [])

// Kepadatan 7 hari semua provinsi, untuk peringkat nasional.
const ranked = computed(() => {
  if (!lastDate.value) return []
  return provinces.value
    .map((p) => {
      const now = sumRange(days.value, addDays(lastDate.value, -6), lastDate.value, p.name).total
      return { ...p, now, density: (now / p.areaKm2) * 1000 }
    })
    .sort((a, b) => b.density - a.density)
})

const selected = computed(() => {
  const slug = route.query.p
  return ranked.value.find((p) => slugify(p.name) === slug) ?? ranked.value[0] ?? null
})
const rank = computed(() => ranked.value.indexOf(selected.value) + 1)

const before = computed(() =>
  selected.value ? sumRange(days.value, addDays(lastDate.value, -13), addDays(lastDate.value, -7), selected.value.name) : null,
)
const change = computed(() => (before.value?.covered === 7 ? percentChange(selected.value.now, before.value.total) : null))

const points = computed(() => (hotspotData.value?.hotspots ?? []).filter((h) => h.province === selected.value?.name))
const highCount = computed(() => points.value.filter((h) => h.confidence === 'high').length)

const chartLabels = computed(() => {
  if (!lastDate.value) return []
  return Array.from({ length: 30 }, (_, i) => addDays(lastDate.value, i - 29))
})
const chartSeries = computed(() => [
  {
    label: `Titik panas per hari di ${selected.value?.name ?? ''}`,
    color: '#c2410c',
    values: chartLabels.value.map((d) => (days.value[d] ? days.value[d].byProvince?.[selected.value?.name] || 0 : null)),
  },
])

function choose(name) {
  router.replace({ query: { p: slugify(name) } })
}

async function drawMap() {
  if (!selected.value || !mapEl.value) return
  if (!map) {
    map = L.map(mapEl.value, { scrollWheelZoom: false, preferCanvas: true, zoomSnap: 0.25 })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap contributors', maxZoom: 18 }).addTo(map)
    layer = L.featureGroup().addTo(map)
  }
  if (!boundaries) {
    const res = await fetch('/data/batas-provinsi.geojson')
    boundaries = res.ok ? await res.json() : { features: [] }
  }
  layer.clearLayers()
  const name = selected.value.name
  const feature = boundaries.features.find((f) => (f.properties.PROVINSI === 'Daerah Istimewa Yogyakarta' ? 'DI Yogyakarta' : f.properties.PROVINSI) === name)
  const outline = feature && L.geoJSON(feature, { style: { color: '#3a4139', weight: 1.5, fill: true, fillColor: '#3a4139', fillOpacity: 0.04 } }).addTo(layer)
  for (const h of points.value) {
    L.circleMarker([h.lat, h.lng], { radius: 3, stroke: false, fillColor: CONFIDENCE[h.confidence].color, fillOpacity: 0.7 }).addTo(layer)
  }
  const bounds = outline?.getBounds() ?? (points.value.length ? L.latLngBounds(points.value.map((h) => [h.lat, h.lng])) : null)
  if (bounds) map.fitBounds(bounds.pad(0.05), { animate: false })
}

watch([selected, points], async () => {
  await nextTick()
  drawMap()
})
onBeforeUnmount(() => map?.remove())

async function share() {
  const text = `${selected.value.name}: ${selected.value.now.toLocaleString('id-ID')} titik panas dalam 7 hari terakhir (peringkat ${rank.value} dari 38 provinsi menurut kepadatan). Sumber: KarhutlaTracker`
  try {
    if (navigator.share) await navigator.share({ title: 'KarhutlaTracker', text, url: location.href })
    else {
      await navigator.clipboard.writeText(`${text} ${location.href}`)
      copied.value = true
      setTimeout(() => (copied.value = false), 2500)
    }
  } catch { }
}

const responders = computed(() => [
  { name: `BPBD Provinsi ${selected.value?.name ?? ''}`, text: 'Badan Penanggulangan Bencana Daerah, mengoordinasikan tanggap darurat bencana di tingkat provinsi.' },
  { name: 'Dinas Lingkungan Hidup dan Kehutanan provinsi', text: 'Dinas yang membidangi lingkungan hidup dan kehutanan, bertanggung jawab atas pencegahan karhutla di wilayahnya.' },
  { name: 'Manggala Agni', text: 'Brigade pengendalian kebakaran hutan dan lahan milik Kementerian Kehutanan.' },
])
</script>

<template>
  <section class="mx-auto max-w-6xl px-4 py-10">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p class="text-sm font-semibold uppercase tracking-widest text-ember-600">Profil daerah</p>
        <h1 class="mt-1 font-display text-3xl font-extrabold md:text-4xl">{{ selected?.name ?? 'Memuat…' }}</h1>
        <p class="mt-1 text-ash-500">7 hari terakhir<span v-if="lastDate">, data per {{ formatShortDate(lastDate) }} {{ lastDate.slice(0, 4) }}</span></p>
      </div>
      <div class="flex flex-wrap items-end gap-2">
        <label class="flex flex-col gap-1 text-sm font-medium">
          Pilih provinsi
          <select :value="selected?.name" class="rounded-md border border-ash-200 bg-white px-3 py-2" @change="choose($event.target.value)">
            <option v-for="p in provinces" :key="p.name" :value="p.name">{{ p.name }}</option>
          </select>
        </label>
        <button v-if="selected" class="rounded-md border border-ash-200 bg-white px-3 py-2 text-sm font-medium hover:bg-ash-100" @click="share">
          {{ copied ? 'Tautan disalin' : 'Bagikan' }}
        </button>
      </div>
    </div>
    <p v-if="error" class="mt-4 text-sm text-red-700">{{ error }}</p>

    <template v-if="selected">
      <div class="mt-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Titik panas" :value="selected.now" :note="`${highCount.toLocaleString('id-ID')} berkepercayaan tinggi`" />
        <StatCard
          label="Dibanding minggu lalu"
          :value="change == null ? '–' : (change > 0 ? '+' : '') + change + '%'"
          :note="before?.covered === 7 ? `minggu lalu ${before.total.toLocaleString('id-ID')} titik` : 'Belum cukup data'"
        />
        <StatCard label="Per 1.000 km²" :value="selected.density.toLocaleString('id-ID', { maximumFractionDigits: 1 })" :note="`luas ${selected.areaKm2.toLocaleString('id-ID')} km²`" />
        <StatCard label="Peringkat kepadatan" :value="`${rank} / ${ranked.length}`" note="1 = paling padat titik panas" />
      </div>

      <div class="mt-8 grid gap-6 lg:grid-cols-2">
        <div class="rounded-lg border border-ash-200 bg-white p-5">
          <h2 class="font-display text-xl font-extrabold">Sebaran 7 hari terakhir</h2>
          <div ref="mapEl" class="mt-4 h-[320px] w-full overflow-hidden rounded-md border border-ash-200"></div>
          <div class="mt-3 flex flex-wrap gap-4 text-sm text-ash-700">
            <span v-for="(c, key) in CONFIDENCE" :key="key" class="flex items-center gap-2">
              <span class="h-3 w-3 rounded-full" :style="{ background: c.color }"></span>{{ c.label }}
            </span>
          </div>
          <RouterLink to="/peta" class="mt-3 inline-block text-sm font-semibold text-ember-700 hover:underline">Buka peta lengkap</RouterLink>
        </div>
        <div class="rounded-lg border border-ash-200 bg-white p-5">
          <h2 class="font-display text-xl font-extrabold">Titik panas harian, 30 hari</h2>
          <DailyChart class="mt-4" :labels="chartLabels.map(formatShortDate)" :series="chartSeries" :height="320" />
        </div>
      </div>

      <div class="mt-8 rounded-lg border border-ash-200 bg-white p-5">
        <h2 class="font-display text-xl font-extrabold">Siapa yang menangani?</h2>
        <p class="mt-1 text-ash-500">Lembaga yang bertanggung jawab atas pencegahan dan pemadaman karhutla di provinsi ini.</p>
        <ul class="mt-4 grid gap-4 md:grid-cols-3">
          <li v-for="r in responders" :key="r.name" class="rounded-md bg-ash-50 p-4">
            <p class="font-semibold">{{ r.name }}</p>
            <p class="mt-1 text-sm text-ash-700">{{ r.text }}</p>
          </li>
        </ul>
        <div class="mt-5 flex flex-col gap-3 rounded-md border border-ember-100 bg-ember-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p class="text-sm text-ash-700">
            Melihat api atau asap? Hubungi <strong>112</strong> (darurat) atau <strong>113</strong> (pemadam kebakaran). Untuk laporan dan aduan ke pemerintah, gunakan SP4N-LAPOR!.
          </p>
          <a href="https://www.lapor.go.id/" target="_blank" rel="noopener" class="shrink-0 rounded-md bg-ember-600 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-ember-700">Buka LAPOR!</a>
        </div>
      </div>
    </template>
  </section>
</template>