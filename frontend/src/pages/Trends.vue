<script setup>
import { ref, computed, onMounted } from 'vue'
import StatCard from '../components/StatCard.vue'
import DailyChart from '../components/DailyChart.vue'
import { getHistory, getWilayah, addDays, sumRange, percentChange, formatShortDate, slugify } from '../services/hotspots'

const history = ref(null)
const wilayah = ref(null)
const error = ref('')
const range = ref(30)
const sortKey = ref('change')

onMounted(async () => {
  try {
    ;[history.value, wilayah.value] = await Promise.all([getHistory(), getWilayah()])
  } catch (e) {
    error.value = e.message
  }
})

const days = computed(() => history.value?.days ?? {})
const dates = computed(() => Object.keys(days.value).sort())
const lastDate = computed(() => dates.value.at(-1))
const firstDate = computed(() => dates.value[0])
const coveredDays = computed(() => dates.value.length)

const ranges = [
  { days: 30, label: '30 hari' },
  { days: 90, label: '90 hari' },
  { days: 365, label: '1 tahun' },
]

// Minggu ini = 7 hari terakhir yang ada datanya, dibanding 7 hari sebelumnya.
const weekNow = computed(() => lastDate.value && sumRange(days.value, addDays(lastDate.value, -6), lastDate.value))
const weekBefore = computed(() => lastDate.value && sumRange(days.value, addDays(lastDate.value, -13), addDays(lastDate.value, -7)))
const canCompare = computed(() => weekBefore.value?.covered === 7)
const weekChange = computed(() => (canCompare.value ? percentChange(weekNow.value.total, weekBefore.value.total) : null))

// Periode 30 hari yang sama tahun lalu.
const monthNow = computed(() => lastDate.value && sumRange(days.value, addDays(lastDate.value, -29), lastDate.value))
const monthLastYear = computed(() => lastDate.value && sumRange(days.value, addDays(lastDate.value, -29 - 364), addDays(lastDate.value, -364)))
const yearChange = computed(() => (monthLastYear.value?.covered >= 25 ? percentChange(monthNow.value.total, monthLastYear.value.total) : null))

const chartLabels = computed(() => {
  if (!lastDate.value) return []
  const out = []
  for (let i = range.value - 1; i >= 0; i--) out.push(addDays(lastDate.value, -i))
  return out
})
const chartSeries = computed(() => {
  const labels = chartLabels.value
  const series = [{ label: 'Titik panas per hari', color: '#c2410c', values: labels.map((d) => days.value[d]?.count ?? null) }]
  const lastYear = labels.map((d) => days.value[addDays(d, -364)]?.count ?? null)
  if (lastYear.filter((v) => v != null).length >= labels.length * 0.8) {
    series.push({ label: 'Periode sama tahun lalu', color: '#6b7468', dashed: true, values: lastYear })
  }
  return series
})

const provinceRows = computed(() => {
  if (!wilayah.value || !lastDate.value) return []
  const rows = wilayah.value.provinsi.map((p) => {
    const now = sumRange(days.value, addDays(lastDate.value, -6), lastDate.value, p.name).total
    const before = sumRange(days.value, addDays(lastDate.value, -13), addDays(lastDate.value, -7), p.name).total
    return {
      ...p,
      now,
      before,
      diff: now - before,
      change: weekBefore.value?.covered === 7 ? percentChange(now, before) : null,
      density: (now / p.areaKm2) * 1000,
    }
  })
  const by = {
    change: canCompare.value ? (a, b) => b.diff - a.diff : (a, b) => b.now - a.now,
    now: (a, b) => b.now - a.now,
    density: (a, b) => b.density - a.density,
  }[sortKey.value]
  return rows.sort(by)
})

const risers = computed(() => !canCompare.value ? [] : provinceRows.value.filter((r) => r.diff > 0).sort((a, b) => b.diff - a.diff).slice(0, 3))

function changeText(v) {
  if (v == null) return 'Belum cukup data'
  if (v === 0) return 'Sama dengan sebelumnya'
  return `${v > 0 ? 'Naik' : 'Turun'} ${Math.abs(v).toLocaleString('id-ID')}%`
}
</script>

<template>
  <section class="mx-auto max-w-6xl px-4 py-10">
    <h1 class="font-display text-3xl font-extrabold">Tren Titik Panas</h1>
    <p class="mt-2 max-w-2xl text-ash-500">
      Apakah kondisi membaik atau memburuk? Halaman ini membandingkan jumlah titik panas dari waktu ke waktu, nasional dan per provinsi.
      <span v-if="lastDate">Data per {{ formatShortDate(lastDate) }} {{ lastDate.slice(0, 4) }}.</span>
    </p>
    <p v-if="error" class="mt-4 text-sm text-red-700">{{ error }}</p>

    <div class="mt-8 grid gap-4 sm:grid-cols-3">
      <StatCard label="7 hari terakhir" :value="weekNow?.total ?? '…'" note="titik panas di seluruh Indonesia" />
      <StatCard label="Dibanding minggu lalu" :value="weekChange == null ? '–' : (weekChange > 0 ? '+' : '') + weekChange + '%'" :note="changeText(weekChange)" />
      <StatCard
        label="Dibanding tahun lalu"
        :value="yearChange == null ? '–' : (yearChange > 0 ? '+' : '') + yearChange + '%'"
        :note="yearChange == null ? `Riwayat baru tersedia sejak ${firstDate ? formatShortDate(firstDate) + ' ' + firstDate.slice(0, 4) : '…'}` : '30 hari terakhir vs periode sama tahun lalu'"
      />
    </div>

    <div v-if="risers.length" class="mt-6 rounded-lg border border-ember-100 bg-ember-50 p-5">
      <p class="text-sm font-semibold text-ember-700">Perlu perhatian minggu ini</p>
      <p class="mt-1 text-ash-700">
        Kenaikan terbesar dibanding minggu lalu:
        <template v-for="(r, i) in risers" :key="r.name">
          <RouterLink :to="{ name: 'region', query: { p: slugify(r.name) } }" class="font-semibold text-ash-900 underline decoration-ember-500 underline-offset-2">{{ r.name }}</RouterLink>
          (+{{ r.diff.toLocaleString('id-ID') }} titik){{ i < risers.length - 1 ? ', ' : '.' }}
        </template>
      </p>
    </div>

    <div class="mt-8 rounded-lg border border-ash-200 bg-white p-5">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h2 class="font-display text-xl font-extrabold">Titik panas harian</h2>
        <div class="flex gap-1 rounded-md bg-ash-100 p-1 text-sm">
          <button
            v-for="r in ranges" :key="r.days"
            class="rounded px-3 py-1 font-medium"
            :class="range === r.days ? 'bg-white text-ash-900 shadow-sm' : 'text-ash-500 hover:text-ash-900'"
            @click="range = r.days"
          >{{ r.label }}</button>
        </div>
      </div>
      <DailyChart v-if="chartLabels.length" class="mt-4" :labels="chartLabels.map(formatShortDate)" :series="chartSeries" />
      <p v-if="coveredDays && coveredDays < range" class="mt-3 text-sm text-ash-500">
        Riwayat yang tersedia baru {{ coveredDays }} hari, bagian grafik tanpa data dibiarkan kosong.
      </p>
    </div>

    <div class="mt-8 rounded-lg border border-ash-200 bg-white p-5">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h2 class="font-display text-xl font-extrabold">Perbandingan per provinsi</h2>
        <label class="flex items-center gap-2 text-sm font-medium">
          Urutkan
          <select v-model="sortKey" class="rounded-md border border-ash-200 bg-white px-3 py-1.5">
            <option value="change">Kenaikan terbesar</option>
            <option value="now">Jumlah terbanyak</option>
            <option value="density">Kepadatan tertinggi</option>
          </select>
        </label>
      </div>
      <p v-if="!canCompare" class="mt-1 text-sm text-ash-500">Perbandingan dengan minggu lalu muncul setelah riwayat 14 hari tersedia.</p>
      <p class="mt-1 text-sm text-ash-500">Kepadatan = titik panas per 1.000 km² luas provinsi, supaya provinsi kecil dan besar bisa dibandingkan adil.</p>
      <div class="mt-4 overflow-x-auto">
        <table class="w-full min-w-[560px] text-sm">
          <thead>
            <tr class="border-b border-ash-200 text-left text-xs uppercase tracking-wider text-ash-500">
              <th class="py-2 pr-3 font-semibold">Provinsi</th>
              <th class="py-2 pr-3 text-right font-semibold">7 hari ini</th>
              <th class="py-2 pr-3 text-right font-semibold">7 hari sebelumnya</th>
              <th class="py-2 pr-3 text-right font-semibold">Perubahan</th>
              <th class="py-2 text-right font-semibold">Per 1.000 km²</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in provinceRows" :key="r.name" class="border-b border-ash-100 last:border-0">
              <td class="py-2 pr-3">
                <RouterLink :to="{ name: 'region', query: { p: slugify(r.name) } }" class="hover:text-ember-700 hover:underline">{{ r.name }}</RouterLink>
              </td>
              <td class="py-2 pr-3 text-right font-mono tabular-nums">{{ r.now.toLocaleString('id-ID') }}</td>
              <td class="py-2 pr-3 text-right font-mono tabular-nums text-ash-500">{{ canCompare ? r.before.toLocaleString('id-ID') : '–' }}</td>
              <td v-if="canCompare" class="py-2 pr-3 text-right font-mono tabular-nums" :class="r.diff > 0 ? 'text-ember-700' : 'text-ash-500'">
                {{ r.diff > 0 ? '▲ +' : r.diff < 0 ? '▼ ' : '' }}{{ r.diff.toLocaleString('id-ID') }}
              </td>
              <td v-else class="py-2 pr-3 text-right font-mono text-ash-500">–</td>
              <td class="py-2 text-right font-mono tabular-nums">{{ r.density.toLocaleString('id-ID', { maximumFractionDigits: 1 }) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</template>