<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import L from 'leaflet'
import DailyChart from '../components/DailyChart.vue'
import StatCard from '../components/StatCard.vue'
import {
  getHotspotData, getHistory, getWilayah, getRingkasan,
  CONFIDENCE, BASEMAP, formatDate, formatShortDate, addDays, sumRange, percentChange, slugify, downloadCsv,
} from '../services/hotspots'
import { theme, cssColor } from '../composables/useTheme'

const route = useRoute()
const router = useRouter()

const data = ref(null)
const history = ref(null)
const wilayah = ref(null)
const ringkasan = ref(null)
const error = ref('')
const province = ref('')
const range = ref(30)
const shown = ref(8)
const copied = ref(false)
const mapEl = ref(null)
let map = null
let layer = null
let geo = null

const RANGES = [30, 90]
const PAGE_SIZE = 20
const INDONESIA = L.latLngBounds([-11, 95], [6, 141])
const GEO_ALIAS = { 'DI Yogyakarta': 'Daerah Istimewa Yogyakarta' }
const CHIP = {
  up: 'bg-ember-500/15 text-ember-400',
  down: 'bg-emerald-300/15 text-emerald-300',
  flat: 'bg-veil/5 text-mist',
}
const ARROW = { up: '▲', down: '▼', flat: '' }

const fmt = (n) => (n == null ? '–' : n.toLocaleString('id-ID'))
const fmtDecimal = (n) => n.toLocaleString('id-ID', { maximumFractionDigits: 1 })

onMounted(async () => {
  getRingkasan().then((r) => (ringkasan.value = r)).catch(() => {})
  try {
    const [d, h, w] = await Promise.all([getHotspotData(), getHistory(), getWilayah()])
    data.value = d
    history.value = h
    wilayah.value = w
  } catch (e) {
    error.value = e.message
    return
  }
  province.value = fromRoute() ?? rows.value[0]?.name ?? ''
  await nextTick()
  await initMap()
})

onBeforeUnmount(() => map?.remove())

const rows = computed(() => {
  if (!wilayah.value || !data.value || !history.value) return []
  const counts = {}
  for (const h of data.value.hotspots) counts[h.province] = (counts[h.province] || 0) + 1
  return wilayah.value.provinsi
    .map((p) => {
      const n = anchor.value ? sumRange(days.value, addDays(anchor.value, -6), anchor.value, p.name).total : counts[p.name] || 0
      return { name: p.name, area: p.areaKm2, n, density: (n / p.areaKm2) * 1000 }
    })
    .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name, 'id'))
})

const options = computed(() => [...rows.value].sort((a, b) => a.name.localeCompare(b.name, 'id')))
const me = computed(() => rows.value.find((r) => r.name === province.value) ?? null)
const rank = computed(() => (me.value ? 1 + rows.value.filter((r) => r.n > me.value.n).length : null))
const densityRank = computed(() => (me.value ? 1 + rows.value.filter((r) => r.density > me.value.density).length : null))

const mine = computed(() => (data.value?.hotspots ?? []).filter((h) => h.province === province.value))
const high = computed(() => mine.value.filter((h) => h.confidence === 'high').length)
const latest = computed(() => [...mine.value].sort((a, b) => b.detectedAt.localeCompare(a.detectedAt)))
const lastDetected = computed(() => latest.value[0]?.detectedAt ?? null)

const confidenceMix = computed(() =>
  Object.entries(CONFIDENCE).map(([key, c]) => {
    const n = mine.value.filter((h) => h.confidence === key).length
    return { key, label: c.label, color: c.color, n, pct: mine.value.length ? (n / mine.value.length) * 100 : 0 }
  }),
)

const days = computed(() => history.value?.days ?? {})
const dates = computed(() => Object.keys(days.value))
const firstDate = computed(() => dates.value[0])
const anchor = computed(() => dates.value.at(-2) ?? dates.value.at(-1))

function dayValue(date) {
  if (!firstDate.value || date < firstDate.value) return null
  const day = days.value[date]
  return day ? day.byProvince?.[province.value] || 0 : null
}

const rangeDates = computed(() =>
  anchor.value ? Array.from({ length: range.value }, (_, i) => addDays(anchor.value, -(range.value - 1 - i))) : [],
)
const chartLabels = computed(() => rangeDates.value.map(formatShortDate))
const currentValues = computed(() => rangeDates.value.map(dayValue))
const hasPrior = computed(() => rangeDates.value.length > 0 && addDays(rangeDates.value[0], -365) >= firstDate.value)

const chartSeries = computed(() => {
  const s = [{ label: `${range.value} hari terakhir`, values: currentValues.value, color: '#ff5a1f' }]
  if (hasPrior.value) {
    s.push({
      label: 'Periode sama tahun lalu',
      values: rangeDates.value.map((d) => dayValue(addDays(d, -365))),
      color: '#9fb0a6',
      dashed: true,
    })
  }
  return s
})

const rangeStats = computed(() => {
  const vals = currentValues.value.map((v) => v ?? 0)
  const sum = vals.reduce((a, b) => a + b, 0)
  const max = Math.max(0, ...vals)
  return {
    sum,
    avg: vals.length ? Math.round(sum / vals.length) : 0,
    max,
    maxDate: max > 0 ? rangeDates.value[vals.indexOf(max)] : null,
  }
})

const week = computed(() => {
  if (!anchor.value || !province.value) return null
  const now = sumRange(days.value, addDays(anchor.value, -6), anchor.value, province.value).total
  const before = sumRange(days.value, addDays(anchor.value, -13), addDays(anchor.value, -7), province.value).total
  if (!before) return now ? { text: 'Baru', dir: 'up', before } : { text: '0%', dir: 'flat', before }
  const p = percentChange(now, before)
  return { text: `${p > 0 ? '+' : ''}${p.toLocaleString('id-ID')}%`, dir: p > 0 ? 'up' : p < 0 ? 'down' : 'flat', before }
})

const ready = computed(() => {
  const r = ringkasan.value
  if (!r?.provinsi || r.provinsiSampai !== anchor.value) return null
  const p = r.provinsi[province.value]
  return p?.text ? p : null
})

const summary = computed(() => {
  if (ready.value) return ready.value.text
  if (!me.value) return ''
  const n = me.value.n
  if (!n) return `Tidak ada titik panas terdeteksi di ${province.value} dalam 7 hari terakhir.`
  let text = `Dalam 7 hari terakhir terdeteksi ${fmt(n)} titik panas di ${province.value}, peringkat ${rank.value} dari ${rows.value.length} provinsi.`
  if (week.value) {
    const { dir, before } = week.value
    if (dir === 'up') text += before ? ` Jumlahnya naik ${week.value.text.replace('+', '')} dibanding 7 hari sebelumnya.` : ' Pada 7 hari sebelumnya belum ada titik panas.'
    else if (dir === 'down') text += ` Jumlahnya turun ${week.value.text.replace('-', '')} dibanding 7 hari sebelumnya.`
    else text += ' Jumlahnya sama dengan 7 hari sebelumnya.'
  }
  return text + ` Kepadatannya ${fmtDecimal(me.value.density)} titik per 1.000 km², peringkat ${densityRank.value}.`
})

const agencies = computed(() => [
  { name: `BPBD Provinsi ${province.value}`, text: 'Mengoordinasikan penanganan bencana, termasuk karhutla dan asap, di tingkat provinsi.' },
  { name: 'Dinas lingkungan hidup dan kehutanan', text: 'Mengawasi dan mengendalikan kebakaran di kawasan hutan dan lahan di wilayah provinsi.' },
  { name: 'Manggala Agni', text: 'Brigade pengendalian kebakaran hutan dan lahan yang bersiaga di daerah rawan.' },
])
const channels = [
  { number: '112', name: 'Darurat', text: 'Gratis dari ponsel.' },
  { number: '113', name: 'Pemadam kebakaran', text: 'Laporkan api yang terlihat.' },
]

function timeAgo(iso) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return 'baru saja'
  if (m < 60) return `${m} menit lalu`
  const h = Math.round(m / 60)
  return h < 24 ? `${h} jam lalu` : `${Math.round(h / 24)} hari lalu`
}

const coordText = (lat, lng) => `${Math.abs(lat).toFixed(3)}° ${lat < 0 ? 'LS' : 'LU'}, ${lng.toFixed(3)}° BT`

function onListScroll(e) {
  const el = e.target
  if (shown.value < latest.value.length && el.scrollTop + el.clientHeight >= el.scrollHeight - 120) shown.value += PAGE_SIZE
}

function unduh() {
  const date = new Date().toISOString().slice(0, 10)
  downloadCsv(latest.value, `karhutlatracker-titik-panas-${slugify(province.value)}-${date}.csv`)
}

async function share() {
  if (!me.value) return
  const parts = [`${province.value}: ${fmt(me.value.n)} titik panas dalam 7 hari sampai ${formatShortDate(anchor.value)}`]
  if (week.value && week.value.dir !== 'flat') parts.push(`${week.value.text} dibanding minggu sebelumnya`)
  parts.push(`peringkat ${rank.value} dari ${rows.value.length} provinsi`)
  const text = `${parts.join(', ')}. Sumber: KarhutlaTracker (data satelit NASA FIRMS)`
  const url = location.href
  try {
    if (navigator.share) {
      await navigator.share({ title: `Profil ${province.value} · KarhutlaTracker`, text, url })
    } else {
      await navigator.clipboard.writeText(`${text}\n${url}`)
      copied.value = true
      setTimeout(() => (copied.value = false), 2500)
    }
  } catch { }
}

function fromRoute() {
  return options.value.find((r) => slugify(r.name) === route.query.p)?.name
}

watch(() => route.query.p, () => {
  const name = fromRoute()
  if (name && name !== province.value) province.value = name
})

watch(province, (name) => {
  if (!name) return
  shown.value = PAGE_SIZE
  if (slugify(name) !== route.query.p) router.replace({ query: { p: slugify(name) } })
  drawMap()
})

watch(theme, drawMap)

async function loadGeo() {
  if (geo) return geo
  try {
    const res = await fetch('/data/batas-provinsi.geojson')
    geo = res.ok ? await res.json() : { features: [] }
  } catch {
    geo = { features: [] }
  }
  return geo
}

async function initMap() {
  if (!mapEl.value) return
  map = L.map(mapEl.value, { scrollWheelZoom: false, preferCanvas: true, zoomSnap: 0.25, minZoom: 4, maxBounds: INDONESIA.pad(0.5) })
  map.fitBounds(INDONESIA, { animate: false })
  L.tileLayer(BASEMAP.url, BASEMAP.options).addTo(map)
  layer = L.featureGroup().addTo(map)
  await loadGeo()
  drawMap()
}

function drawMap() {
  if (!map || !geo || !province.value) return
  layer.clearLayers()
  const name = GEO_ALIAS[province.value] ?? province.value
  const features = geo.features.filter((f) => f.properties.PROVINSI === name)
  let bounds = null
  if (features.length) {
    const flare = cssColor('--color-flare')
    const border = L.geoJSON({ type: 'FeatureCollection', features }, {
      style: { color: flare, weight: 1.5, opacity: 0.8, fillColor: flare, fillOpacity: 0.06 },
      interactive: false,
    }).addTo(layer)
    bounds = border.getBounds()
  }
  const order = { low: 0, nominal: 1, high: 2 }
  for (const h of [...mine.value].sort((a, b) => order[a.confidence] - order[b.confidence])) {
    L.circleMarker([h.lat, h.lng], { radius: 4, stroke: false, fillColor: CONFIDENCE[h.confidence].color, fillOpacity: 0.85 })
      .bindPopup(`<strong>${h.province}</strong><br>Kepercayaan: ${CONFIDENCE[h.confidence].label}<br>Satelit: ${h.satellite}<br>${formatDate(h.detectedAt)}`)
      .addTo(layer)
  }
  if (!bounds && mine.value.length) bounds = L.latLngBounds(mine.value.map((h) => [h.lat, h.lng]))
  map.invalidateSize()
  map.fitBounds((bounds ?? INDONESIA).pad(0.08), { animate: false, maxZoom: 9 })
}
</script>

<template>
  <section class="page">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div class="min-w-0">
        <p class="font-semibold text-flare">Profil Daerah</p>
        <h1 class="page-title mt-1">{{ province ? `Profil ${province}` : 'Profil daerah' }}</h1>
        <p class="lede !mt-2 text-base">Ringkasan kondisi karhutla per provinsi, lengkap dengan tren dan titik panas terbaru.</p>
      </div>
      <div class="flex w-full flex-wrap items-end gap-2 sm:w-auto">
        <label class="flex min-w-0 flex-1 flex-col gap-1.5 sm:flex-none">
          <span class="label">Pilih provinsi</span>
          <select v-model="province" class="field sm:min-w-64" :disabled="!options.length">
            <option value="" disabled>Pilih provinsi</option>
            <option v-for="r in options" :key="r.name" :value="r.name">{{ r.name }} ({{ fmt(r.n) }})</option>
          </select>
        </label>
        <button type="button" class="btn-ghost !px-4 !py-2.5" :disabled="!me" @click="share">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" /></svg>
          {{ copied ? 'Tautan disalin' : 'Bagikan' }}
        </button>
      </div>
    </div>

    <div v-if="error" class="glass mt-8 grid min-h-64 place-items-center p-10 text-center text-mist">{{ error }}</div>
    <div v-else-if="!me" class="glass mt-8 grid min-h-64 place-items-center p-10 text-center text-mist">Memuat profil daerah…</div>

    <template v-else>
      <article class="glass relative mt-8 overflow-hidden p-6 md:p-8">
        <div class="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-ember-500/20 blur-3xl"></div>
        <div class="relative">
          <h2 class="font-display text-2xl font-bold">Ringkasan {{ province }}</h2>
          <p class="mt-1 text-sm text-mist">
            7 hari sampai {{ formatShortDate(anchor) }}<template v-if="lastDetected">, deteksi terakhir {{ formatDate(lastDetected) }}</template>
          </p>
          <p class="mt-5 max-w-[62ch] text-xl leading-relaxed text-paper">{{ summary }}</p>
          <p class="mt-2 text-xs text-mist">{{ ready?.ai ? 'Kalimat disusun AI (Google Gemini) dari angka di halaman ini. Angkanya dihitung sistem.' : 'Disusun otomatis dari angka di halaman ini.' }}</p>
          <div class="mt-5 flex flex-wrap gap-2 text-sm">
            <span class="glass-sm px-3 py-1.5"><span class="font-semibold tabular-nums">{{ fmtDecimal(me.density) }}</span> <span class="text-mist">titik per 1.000 km²</span></span>
            <span class="glass-sm px-3 py-1.5"><span class="text-mist">Peringkat kepadatan</span> <span class="font-semibold tabular-nums">#{{ densityRank }}</span></span>
            <span class="glass-sm px-3 py-1.5"><span class="text-mist">Luas</span> <span class="font-semibold tabular-nums">{{ fmt(Math.round(me.area)) }} km²</span></span>
            <span v-if="week" class="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-semibold tabular-nums" :class="CHIP[week.dir]">
              <span v-if="ARROW[week.dir]" class="text-xs">{{ ARROW[week.dir] }}</span>{{ week.text }}
              <span class="font-medium text-mist">vs minggu lalu</span>
            </span>
          </div>
        </div>
      </article>

      <div class="mt-4 grid gap-4 md:grid-cols-3">
        <StatCard label="Total titik panas" :value="me.n" :note="`7 hari sampai ${formatShortDate(anchor)}`" />
        <StatCard
          label="Peringkat"
          :value="me.n ? `#${rank}` : '–'"
          :note="me.n ? `dari ${rows.length} provinsi menurut jumlah titik` : 'Tidak ada titik panas terdeteksi'"
        />
        <StatCard label="Kepercayaan tinggi" :value="high" :note="mine.length ? `${fmtDecimal((high / mine.length) * 100)}% dari deteksi terbaru` : 'Deteksi satelit terbaru'" />
      </div>

      <!-- Tren harian -->
      <div class="glass mt-6 p-5 md:p-6">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 class="font-display text-xl font-bold tracking-tight">Tren harian {{ province }}</h2>
            <p class="label">Data sampai {{ formatShortDate(anchor) }}</p>
          </div>
          <div class="glass-sm inline-flex gap-1 rounded-full p-1" role="group" aria-label="Rentang waktu">
            <button
              v-for="r in RANGES"
              :key="r"
              type="button"
              class="rounded-full px-4 py-1.5 text-sm font-semibold transition"
              :class="range === r ? 'bg-ember-500 text-night' : 'text-mist hover:text-paper'"
              :aria-pressed="range === r"
              @click="range = r"
            >{{ r }} hari</button>
          </div>
        </div>

        <div class="mt-5">
          <DailyChart :labels="chartLabels" :series="chartSeries" :height="300" />
        </div>

        <div class="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div class="glass-sm p-4">
            <p class="label">Total {{ range }} hari</p>
            <p class="mt-1 font-display text-2xl font-bold tabular-nums">{{ fmt(rangeStats.sum) }}</p>
          </div>
          <div class="glass-sm p-4">
            <p class="label">Rata-rata per hari</p>
            <p class="mt-1 font-display text-2xl font-bold tabular-nums">{{ fmt(rangeStats.avg) }}</p>
          </div>
          <div class="glass-sm p-4">
            <p class="label">Puncak harian</p>
            <p class="mt-1 font-display text-2xl font-bold tabular-nums">
              {{ fmt(rangeStats.max) }}
              <span v-if="rangeStats.maxDate" class="font-sans text-sm font-medium text-flare">{{ formatShortDate(rangeStats.maxDate) }}</span>
            </p>
          </div>
        </div>
        <p v-if="!hasPrior" class="mt-4 text-xs text-mist">Garis tahun lalu belum bisa ditampilkan karena riwayat data belum cukup panjang.</p>
      </div>

      <div class="mt-6 grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <div class="glass min-w-0 p-5 md:p-6">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 class="font-display text-xl font-bold tracking-tight">Titik panas terbaru</h2>
              <p class="label">{{ fmt(latest.length) }} titik, data langsung sampai {{ formatDate(lastDetected) }}</p>
            </div>
            <button type="button" class="btn-ghost !px-4 !py-2 text-sm" :disabled="!latest.length" @click="unduh">Unduh CSV</button>
          </div>

          <div v-if="latest.length" class="mt-5">
            <div class="flex h-2 overflow-hidden rounded-full bg-veil/10" role="img" :aria-label="confidenceMix.map((c) => `${c.label} ${c.n}`).join(', ')">
              <span v-for="c in confidenceMix" :key="c.key" class="h-full" :style="{ width: c.pct + '%', background: c.color }"></span>
            </div>
            <ul class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-mist">
              <li v-for="c in confidenceMix" :key="c.key" class="flex items-center gap-1.5">
                <span class="h-2.5 w-2.5 rounded-full" :style="{ background: c.color }"></span>{{ c.label }} <span class="font-semibold tabular-nums text-paper">{{ fmt(c.n) }}</span>
              </li>
            </ul>

            <ul class="mt-4 max-h-[30rem] divide-y divide-line/60 overflow-y-auto pr-3" @scroll="onListScroll">
              <li v-for="h in latest.slice(0, shown)" :key="h.id" class="flex items-center gap-3 py-3">
                <span class="h-3 w-3 shrink-0 rounded-full ring-1 ring-veil/20" :style="{ background: CONFIDENCE[h.confidence].color }" :title="`Kepercayaan ${CONFIDENCE[h.confidence].label.toLowerCase()}`"></span>
                <div class="min-w-0 flex-1">
                  <p class="truncate font-semibold tabular-nums">{{ coordText(h.lat, h.lng) }}</p>
                  <p class="truncate text-xs text-mist">{{ h.satellite }} · {{ formatDate(h.detectedAt) }}</p>
                </div>
                <div class="shrink-0 text-right">
                  <p class="text-sm font-semibold text-flare">{{ timeAgo(h.detectedAt) }}</p>
                  <p class="text-xs text-mist">{{ CONFIDENCE[h.confidence].label }}</p>
                </div>
              </li>
            </ul>
          </div>
          <p v-else class="mt-5 text-sm text-mist">Tidak ada titik panas terdeteksi di {{ province }} dalam 7 hari terakhir.</p>
        </div>

        <div class="glass flex min-w-0 flex-col p-5 md:p-6">
          <h2 class="font-display text-xl font-bold tracking-tight">Sebaran titik panas</h2>
          <p class="label">Garis oranye menandai batas {{ province }}.</p>
          <div ref="mapEl" class="mt-4 h-[280px] w-full overflow-hidden rounded-xl md:h-[320px] lg:h-auto lg:min-h-[280px] lg:flex-1"></div>
          <div class="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p class="text-sm text-mist">Saring per tingkat kepercayaan dan lihat setiap titik di halaman Peta.</p>
            <RouterLink :to="{ name: 'dashboard', query: { p: slugify(province) } }" class="btn-ghost !px-4 !py-2 text-sm">Lihat semua titik di Peta →</RouterLink>
          </div>
        </div>
      </div>

      <div class="glass mt-6 p-5 md:p-7">
        <h2 class="font-display text-2xl font-bold">Lembaga dan kanal pelaporan</h2>
        <p class="mt-1 text-mist">Siapa yang bertanggung jawab di {{ province }} dan ke mana melapor saat melihat api atau asap.</p>

        <div class="mt-5 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <ul class="flex flex-col gap-3">
            <li v-for="a in agencies" :key="a.name" class="glass-sm p-4">
              <p class="font-semibold">{{ a.name }}</p>
              <p class="mt-1 text-sm text-mist">{{ a.text }}</p>
            </li>
          </ul>
          <div class="flex flex-col gap-3">
            <div class="grid grid-cols-2 gap-3">
              <div v-for="c in channels" :key="c.number" class="glass-sm p-4">
                <p class="font-display text-3xl font-extrabold tabular-nums text-flare">{{ c.number }}</p>
                <p class="mt-1 text-sm font-semibold">{{ c.name }}</p>
                <p class="text-xs text-mist">{{ c.text }}</p>
              </div>
            </div>
            <div class="glass-sm p-4">
              <p class="font-semibold">SP4N-LAPOR!</p>
              <p class="mt-1 text-sm text-mist">Aduan resmi ke pemerintah, termasuk dugaan pembakaran lahan.</p>
              <div class="mt-3 flex flex-wrap gap-2">
                <a href="https://www.lapor.go.id/" target="_blank" rel="noopener" class="btn-ember !px-4 !py-2 text-sm">Buka LAPOR!</a>          
              </div>
            </div>
          </div>
        </div>
        <p class="mt-4 text-xs text-mist">Nama instansi dan nomor kontak berbeda di tiap daerah. Cek kanal resmi pemerintah provinsi untuk kontak terbaru.</p>
      </div>

      <p class="mt-6 text-xs text-mist">
        Diperbarui {{ formatDate(data.updatedAt) }} · Sumber: {{ data.source }} · Luas wilayah: {{ wilayah.luas.sumber }}
      </p>
    </template>
  </section>
</template>