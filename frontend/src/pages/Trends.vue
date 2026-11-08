<script setup>
import { ref, computed, onMounted } from 'vue'
import DailyChart from '../components/DailyChart.vue'
import { getHistory, addDays, sumRange, percentChange, formatShortDate, formatDate } from '../services/hotspots.js'

const history = ref(null)
const error = ref('')
const range = ref(30)
const sortKey = ref('w')
const sortDir = ref('desc')
const query = ref('')

const RANGES = [30, 90, 365]

const TONE = { up: 'text-ember-400', down: 'text-[#6fd3a8]', flat: 'text-mist', na: 'text-mist' }
const CHIP = {
  up: 'bg-ember-500/15 text-ember-400',
  down: 'bg-[#6fd3a8]/15 text-[#6fd3a8]',
  flat: 'bg-white/5 text-mist',
  na: 'bg-white/5 text-mist',
}
const ARROW = { up: '▲', down: '▼', flat: '', na: '' }
const BAR = 'linear-gradient(90deg, #e0531a, #ffc27a)'

onMounted(async () => {
  try {
    history.value = await getHistory()
  } catch (e) {
    error.value = e.message
  }
})

const days = computed(() => history.value?.days ?? {})
const dates = computed(() => Object.keys(days.value))
const firstDate = computed(() => dates.value[0])
const anchor = computed(() => dates.value[dates.value.length - 1])

const win = (end, n) => ({ from: addDays(end, -(n - 1)), to: end })
const total = (r, province) => sumRange(days.value, r.from, r.to, province).total
const fmt = (n) => (n == null ? '–' : n.toLocaleString('id-ID'))

function change(now, before) {
  if (before == null) return { text: '–', dir: 'na' }
  if (before === 0) return now === 0 ? { text: '0%', dir: 'flat' } : { text: 'Baru', dir: 'up' }
  const p = percentChange(now, before)
  return {
    text: `${p > 0 ? '+' : ''}${p.toLocaleString('id-ID')}%`,
    dir: p > 0 ? 'up' : p < 0 ? 'down' : 'flat',
  }
}

function dayValue(date) {
  if (date < firstDate.value) return null
  return days.value[date]?.count ?? 0
}

const cur7 = computed(() => win(anchor.value, 7))
const prev7 = computed(() => win(addDays(anchor.value, -7), 7))
const year7 = computed(() => win(addDays(anchor.value, -365), 7))
const hasYear7 = computed(() => year7.value.from >= firstDate.value)

const now7 = computed(() => total(cur7.value))
const prevWeek = computed(() => total(prev7.value))
const lastYear = computed(() => (hasYear7.value ? total(year7.value) : null))

const rangeText = (r) => `${formatShortDate(r.from)} – ${formatShortDate(r.to)}`

const cards = computed(() => {
  const wk = change(now7.value, prevWeek.value)
  const yr = change(now7.value, lastYear.value)
  return [
    {
      label: '7 hari terakhir',
      big: fmt(now7.value),
      unit: 'titik panas',
      dir: 'flat',
      tone: 'text-paper',
      note: rangeText(cur7.value),
      hero: true,
    },
    {
      label: 'Dibanding minggu lalu',
      big: wk.text,
      dir: wk.dir,
      tone: TONE[wk.dir],
      note: `${fmt(prevWeek.value)} → ${fmt(now7.value)} titik · ${rangeText(prev7.value)}`,
    },
    {
      label: 'Dibanding tahun lalu',
      big: yr.text,
      dir: yr.dir,
      tone: TONE[yr.dir],
      note:
        lastYear.value == null
          ? 'Riwayat data belum mencakup setahun lalu'
          : `${fmt(lastYear.value)} → ${fmt(now7.value)} titik · ${rangeText(year7.value)}`,
    },
  ]
})

const rangeDates = computed(() =>
  Array.from({ length: range.value }, (_, i) => addDays(anchor.value, -(range.value - 1 - i))),
)
const label = (d) => (range.value > 90 ? `${formatShortDate(d)} ${d.slice(2, 4)}` : formatShortDate(d))
const chartLabels = computed(() => rangeDates.value.map(label))
const currentValues = computed(() => rangeDates.value.map(dayValue))

const hasPrior = computed(
  () => range.value <= 90 && addDays(rangeDates.value[0], -365) >= firstDate.value,
)

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
  const max = Math.max(...vals)
  return {
    sum,
    avg: Math.round(sum / vals.length),
    max,
    maxDate: max > 0 ? rangeDates.value[vals.indexOf(max)] : null,
  }
})

const provinces = computed(() => {
  const set = new Set()
  for (const d of Object.values(days.value)) for (const p of Object.keys(d.byProvince || {})) set.add(p)
  return [...set]
})

const cur30 = computed(() => win(anchor.value, 30))
const year30 = computed(() => win(addDays(anchor.value, -365), 30))
const hasYear30 = computed(() => year30.value.from >= firstDate.value)

const rows = computed(() =>
  provinces.value.map((province) => {
    const w = total(cur7.value, province)
    const pw = total(prev7.value, province)
    const d30 = total(cur30.value, province)
    const y30 = hasYear30.value ? total(year30.value, province) : null
    return {
      province,
      w,
      pw,
      diff: w - pw,
      weekPct: percentChange(w, pw),
      weekChange: change(w, pw),
      d30,
      yearPct: y30 == null ? null : percentChange(d30, y30),
      yearChange: change(d30, y30),
    }
  }),
)

const topRising = computed(() =>
  rows.value
    .filter((r) => r.diff > 0)
    .sort((a, b) => b.diff - a.diff)
    .slice(0, 5),
)
const maxDiff = computed(() => topRising.value[0]?.diff || 1)
const maxWeek = computed(() => Math.max(1, ...rows.value.map((r) => r.w)))

const sortedRows = computed(() => {
  const k = sortKey.value
  const dir = sortDir.value === 'asc' ? 1 : -1
  return [...rows.value].sort((a, b) => {
    const va = a[k]
    const vb = b[k]
    if (va == null && vb == null) return 0
    if (va == null) return 1
    if (vb == null) return -1
    if (typeof va === 'string') return va.localeCompare(vb, 'id') * dir
    return (va - vb) * dir
  })
})

const filteredRows = computed(() => {
  const q = query.value.trim().toLowerCase()
  return q ? sortedRows.value.filter((r) => r.province.toLowerCase().includes(q)) : sortedRows.value
})

function sortBy(key) {
  if (sortKey.value === key) sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  else {
    sortKey.value = key
    sortDir.value = key === 'province' ? 'asc' : 'desc'
  }
}

const arrow = (key) => (sortKey.value === key ? (sortDir.value === 'asc' ? ' ▲' : ' ▼') : '')
const ariaSort = (key) =>
  sortKey.value === key ? (sortDir.value === 'asc' ? 'ascending' : 'descending') : 'none'

const COLUMNS = [
  { key: 'province', label: 'Provinsi', align: 'text-left' },
  { key: 'w', label: '7 hari', align: 'text-right' },
  { key: 'weekPct', label: 'vs minggu lalu', align: 'text-right' },
  { key: 'd30', label: '30 hari', align: 'text-right' },
  { key: 'yearPct', label: 'vs tahun lalu', align: 'text-right' },
]
</script>

<template>
  <section class="page">
    <h1 class="page-title">Tren titik panas</h1>
    <p class="lede">Grafik jumlah titik panas per hari dan perbandingan dengan tahun sebelumnya.</p>

    <div v-if="error" class="glass mt-8 grid min-h-64 place-items-center p-10 text-center text-mist">{{ error }}</div>
    <div v-else-if="!history" class="glass mt-8 grid min-h-64 place-items-center p-10 text-center text-mist">Memuat data tren…</div>
    <div v-else-if="!anchor" class="glass mt-8 grid min-h-64 place-items-center p-10 text-center text-mist">
      Belum ada riwayat titik panas. Jalankan <code>backfill-history.mjs</code> terlebih dahulu.
    </div>

    <template v-else>
      <div class="mt-8 grid gap-4 md:grid-cols-3">
        <div
          v-for="c in cards"
          :key="c.label"
          class="glass p-5 md:p-6"
          :class="c.hero ? 'ring-1 ring-ember-400/30' : ''"
          :style="c.hero ? { boxShadow: '0 20px 50px -28px rgb(255 110 40 / 0.55), inset 0 1px 0 rgb(255 255 255 / 0.05)' } : null"
        >
          <p class="label">{{ c.label }}</p>
          <p class="mt-2 flex items-baseline gap-2 font-display text-4xl font-extrabold tabular-nums tracking-tight" :class="c.tone">
            <span v-if="ARROW[c.dir]" class="text-xl">{{ ARROW[c.dir] }}</span>
            <span>{{ c.big }}</span>
            <span v-if="c.unit" class="font-sans text-sm font-medium text-mist">{{ c.unit }}</span>
          </p>
          <p class="mt-2 text-sm text-mist">{{ c.note }}</p>
        </div>
      </div>

      <div class="glass mt-6 p-5 md:p-6">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 class="font-display text-xl font-bold tracking-tight">Titik panas per hari</h2>
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
            >
              {{ r }} hari
            </button>
          </div>
        </div>

        <div class="mt-5">
          <DailyChart :labels="chartLabels" :series="chartSeries" :height="340" />
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

        <p v-if="range === 365" class="mt-4 text-xs text-mist">
          Garis tahun lalu tidak ditampilkan untuk 365 hari karena riwayat belum mencakup dua tahun.
        </p>
        <p v-else-if="!hasPrior" class="mt-4 text-xs text-mist">
          Garis tahun lalu belum bisa ditampilkan karena riwayat data belum cukup panjang.
        </p>
      </div>

      
      <div class="glass mt-6 p-5 md:p-6">
        <h2 class="font-display text-xl font-bold tracking-tight">Provinsi dengan kenaikan terbesar</h2>
        <p class="label">7 hari terakhir dibanding 7 hari sebelumnya, diurutkan berdasarkan selisih titik.</p>

        <ol v-if="topRising.length" class="mt-5 space-y-4">
          <li v-for="(r, i) in topRising" :key="r.province" class="flex items-center gap-4">
            <span class="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ember-500/15 font-display text-base font-bold text-ember-400">
              {{ i + 1 }}
            </span>
            <div class="min-w-0 flex-1">
              <div class="flex items-baseline justify-between gap-3">
                <span class="truncate font-semibold">{{ r.province }}</span>
                <span class="shrink-0 font-display text-lg font-bold tabular-nums text-ember-400">+{{ fmt(r.diff) }}</span>
              </div>
              <div class="mt-1.5 h-2 overflow-hidden rounded-full bg-white/10">
                <div class="h-full rounded-full" :style="{ width: Math.max(4, (r.diff / maxDiff) * 100) + '%', background: BAR }"></div>
              </div>
              <div class="mt-1 flex justify-between text-xs text-mist">
                <span>{{ fmt(r.pw) }} → {{ fmt(r.w) }} titik</span>
                <span>{{ r.weekChange.text === 'Baru' ? 'naik dari 0' : r.weekChange.text }}</span>
              </div>
            </div>
          </li>
        </ol>
        <p v-else class="mt-5 text-sm text-mist">Tidak ada provinsi yang mengalami kenaikan minggu ini.</p>
      </div>

      <div class="glass mt-6 p-5 md:p-6">
        <div class="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 class="font-display text-xl font-bold tracking-tight">Semua provinsi</h2>
            <p class="label">{{ filteredRows.length }} dari {{ rows.length }} provinsi · klik judul kolom untuk mengurutkan</p>
          </div>
          <input
            v-model="query"
            type="search"
            class="field w-full sm:w-64"
            placeholder="Cari provinsi…"
            aria-label="Cari provinsi"
          />
        </div>

        <div class="mt-4 max-h-[34rem] overflow-auto rounded-xl border border-line">
          <table class="w-full min-w-[600px] text-sm">
            <thead class="sticky top-0 z-10 bg-smoke">
              <tr class="border-b border-line text-mist">
                <th
                  v-for="c in COLUMNS"
                  :key="c.key"
                  scope="col"
                  class="px-4 py-3 font-medium"
                  :class="c.align"
                  :aria-sort="ariaSort(c.key)"
                >
                  <button type="button" class="transition hover:text-paper" :class="sortKey === c.key ? 'text-paper' : ''" @click="sortBy(c.key)">
                    {{ c.label }}{{ arrow(c.key) }}
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in filteredRows" :key="r.province" class="border-b border-line/60 transition last:border-0 hover:bg-white/5">
                <td class="px-4 py-2.5 font-medium">{{ r.province }}</td>
                <td class="px-4 py-2.5">
                  <div class="flex items-center justify-end gap-3 tabular-nums">
                    <span class="hidden h-1.5 w-24 overflow-hidden rounded-full bg-white/10 sm:block">
                      <span class="block h-full rounded-full" :style="{ width: (r.w / maxWeek) * 100 + '%', background: BAR }"></span>
                    </span>
                    <span class="w-14 text-right">{{ fmt(r.w) }}</span>
                  </div>
                </td>
                <td class="px-4 py-2.5 text-right">
                  <span class="inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums" :class="CHIP[r.weekChange.dir]">
                    {{ r.weekChange.text }}
                  </span>
                </td>
                <td class="px-4 py-2.5 text-right tabular-nums">{{ fmt(r.d30) }}</td>
                <td class="px-4 py-2.5 text-right">
                  <span class="inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums" :class="CHIP[r.yearChange.dir]">
                    {{ r.yearChange.text }}
                  </span>
                </td>
              </tr>
              <tr v-if="!filteredRows.length">
                <td colspan="5" class="px-4 py-8 text-center text-mist">Provinsi tidak ditemukan.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <p class="mt-6 text-xs text-mist">
        Diperbarui {{ formatDate(history.updatedAt) }} · Sumber: {{ history.source }}
      </p>
    </template>
  </section>
</template>