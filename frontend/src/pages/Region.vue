<!-- <template>
  <section class="page">
    <h1 class="page-title">Profil daerah</h1>
    <p class="lede">Ringkasan kondisi karhutla per provinsi, lengkap dengan tren dan wilayah paling rawan.</p>
    <div class="glass mt-8 grid min-h-64 place-items-center p-10 text-center text-mist">Halaman ini sedang dikembangkan.</div>
  </section>
</template> -->

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import L from 'leaflet'
import StatCard from '../components/StatCard.vue'
import DailyChart from '../components/DailyChart.vue'
import {
  getHotspotData, getHistory, getWilayah, CONFIDENCE, BASEMAP, addDays, sumRange, percentChange, formatShortDate, slugify,
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
const dates = computed(() => Object.keys(days.value).sort())
// Hari paling baru biasanya belum lengkap, jadi dipakai hari lengkap terakhir.
const refDate = computed(() => dates.value.at(-2) ?? dates.value.at(-1))
const provinces = computed(() => wilayah.value?.provinsi ?? [])

// Kepadatan 7 hari semua provinsi, untuk peringkat nasional.
const ranked = computed(() => {
  if (!refDate.value) return []
  return provinces.value
    .map((p) => {
      const now = sumRange(days.value, addDays(refDate.value, -6), refDate.value, p.name).total
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
  selected.value ? sumRange(days.value, addDays(refDate.value, -13), addDays(refDate.value, -7), selected.value.name) : null,
)
const change = computed(() => (before.value?.covered >= 6 ? percentChange(selected.value.now, before.value.total) : null))

const points = computed(() => (hotspotData.value?.hotspots ?? []).filter((h) => h.province === selected.value?.name))
const highCount = computed(() => points.value.filter((h) => h.confidence === 'high').length)

const chartLabels = computed(() => {
  const last = dates.value.at(-1)
  return last ? Array.from({ length: 30 }, (_, i) => addDays(last, i - 29)) : []
})
const chartSeries = computed(() => [
  {
    label: `Titik panas per hari di ${selected.value?.name ?? ''}`,
    color: '#ff7a2f',
    values: chartLabels.value.map((d) => (days.value[d] ? days.value[d].byProvince?.[selected.value?.name] || 0 : null)),
  },
])

function choose(name) {
  router.replace({ query: { p: slugify(name) } })
}

async function drawMap() {
  if (!selected.value || !mapEl.value) return
  if (!map) {
    map = L.map(mapEl.value, { scrollWheelZoom: true, wheelPxPerZoomLevel: 120, wheelDebounceTime: 20, preferCanvas: true, zoomSnap: 0.25 })
    L.tileLayer(BASEMAP.url, BASEMAP.options).addTo(map)
    layer = L.featureGroup().addTo(map)
  }
  if (!boundaries) {
    const res = await fetch('/data/batas-provinsi.geojson')
    boundaries = res.ok ? await res.json() : { features: [] }
  }
  layer.clearLayers()
  const name = selected.value.name
  const feature = boundaries.features.find((f) => (f.properties.PROVINSI === 'Daerah Istimewa Yogyakarta' ? 'DI Yogyakarta' : f.properties.PROVINSI) === name)
  const outline = feature && L.geoJSON(feature, { style: { color: '#ffc27a', weight: 1.5, opacity: 0.8, fill: true, fillColor: '#ffc27a', fillOpacity: 0.05 } }).addTo(layer)
  for (const h of points.value) {
    L.circleMarker([h.lat, h.lng], { radius: 3.5, stroke: false, fillColor: CONFIDENCE[h.confidence].color, fillOpacity: 0.85 }).addTo(layer)
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
  <section class="page">
    <div class="flex flex-wrap items-end justify-between gap-6">
      <div>
        <p class="text-mist">Profil daerah</p>
        <h1 class="page-title mt-1">{{ selected?.name ?? 'Memuat…' }}</h1>
        <p v-if="refDate" class="mt-2 text-sm text-mist">7 hari sampai {{ formatShortDate(refDate) }} {{ refDate.slice(0, 4) }}</p>
      </div>
      <div class="flex flex-wrap items-end gap-2">
        <label class="flex flex-col gap-1.5">
          <span class="label">Pilih provinsi</span>
          <select :value="selected?.name" class="field" @change="choose($event.target.value)">
            <option v-for="p in provinces" :key="p.name" :value="p.name">{{ p.name }}</option>
          </select>
        </label>
        <button v-if="selected" class="btn-ghost !py-2.5" @click="share">{{ copied ? 'Tautan disalin' : 'Bagikan' }}</button>
      </div>
    </div>
    <p v-if="error" class="mt-4 text-red-300">{{ error }}</p>

    <template v-if="selected">
      <div class="mt-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Titik panas" :value="selected.now" :note="`${highCount.toLocaleString('id-ID')} berkepercayaan tinggi`" />
        <StatCard
          label="Dibanding minggu lalu"
          :value="change == null ? '–' : (change > 0 ? '+' : '') + change + '%'"
          :note="before?.covered >= 6 ? `Minggu lalu ${before.total.toLocaleString('id-ID')} titik` : 'Riwayat belum cukup'"
        />
        <StatCard label="Per 1.000 km²" :value="selected.density.toLocaleString('id-ID', { maximumFractionDigits: 1 })" :note="`Luas resmi ${Math.round(selected.areaKm2).toLocaleString('id-ID')} km²`" />
        <StatCard label="Peringkat kepadatan" :value="`${rank} dari ${ranked.length}`" note="1 berarti paling padat titik panas" />
      </div>

      <div class="mt-4 grid gap-4 lg:grid-cols-2">
        <div class="glass p-5">
          <h2 class="font-display text-2xl font-bold">Sebaran 7 hari terakhir</h2>
          <div ref="mapEl" class="mt-4 h-[340px] w-full overflow-hidden rounded-xl"></div>
          <div class="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-mist">
            <span v-for="(c, key) in CONFIDENCE" :key="key" class="flex items-center gap-2">
              <span class="h-2.5 w-2.5 rounded-full" :style="{ background: c.color, boxShadow: `0 0 8px ${c.color}` }"></span>{{ c.label }}
            </span>
            <RouterLink to="/peta" class="ml-auto font-semibold text-flare hover:underline">Buka peta lengkap</RouterLink>
          </div>
        </div>
        <div class="glass p-5">
          <h2 class="font-display text-2xl font-bold">Titik panas harian, 30 hari</h2>
          <DailyChart class="mt-4" :labels="chartLabels.map(formatShortDate)" :series="chartSeries" :height="340" />
        </div>
      </div>

      <!-- Akuntabilitas: siapa yang bertanggung jawab -->
      <div class="glass mt-4 p-5 md:p-6">
        <h2 class="font-display text-2xl font-bold">Siapa yang menangani?</h2>
        <p class="mt-1 text-mist">Lembaga yang bertanggung jawab atas pencegahan dan pemadaman karhutla di provinsi ini.</p>
        <ul class="mt-5 grid gap-3 md:grid-cols-3">
          <li v-for="r in responders" :key="r.name" class="glass-sm p-4">
            <p class="font-semibold">{{ r.name }}</p>
            <p class="mt-1 text-sm text-mist">{{ r.text }}</p>
          </li>
        </ul>
        <div class="relative mt-5 flex flex-col gap-4 overflow-hidden rounded-2xl border border-ember-400/30 bg-ember-400/10 p-5 sm:flex-row sm:items-center sm:justify-between">
          <p class="text-paper">
            Melihat api atau asap? Hubungi <strong class="text-flare">112</strong> (darurat) atau <strong class="text-flare">113</strong> (pemadam kebakaran). Untuk laporan dan aduan ke pemerintah, gunakan SP4N-LAPOR!.
          </p>
          <a href="https://www.lapor.go.id/" target="_blank" rel="noopener" class="btn-ember shrink-0">Buka LAPOR!</a>
        </div>
      </div>
    </template>
  </section>
</template>