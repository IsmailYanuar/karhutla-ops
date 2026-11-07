<!-- <template>
  <section class="page">
    <h1 class="page-title">Tren titik panas</h1>
    <p class="lede">Grafik jumlah titik panas per hari dan perbandingan dengan tahun sebelumnya.</p>
    <div class="glass mt-8 grid min-h-64 place-items-center p-10 text-center text-mist">Halaman ini sedang dikembangkan.</div>
  </section>
</template> -->

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
// Hari paling baru biasanya belum lengkap (data satelit masih masuk), jadi perbandingan
// memakai hari lengkap terakhir.
const refDate = computed(() => dates.value.at(-2) ?? dates.value.at(-1))
const coveredDays = computed(() => dates.value.length)

const ranges = [
  { days: 30, label: '30 hari' },
  { days: 90, label: '90 hari' },
  { days: 365, label: '1 tahun' },
]

const weekNow = computed(() => refDate.value && sumRange(days.value, addDays(refDate.value, -6), refDate.value))
const weekBefore = computed(() => refDate.value && sumRange(days.value, addDays(refDate.value, -13), addDays(refDate.value, -7)))
const canCompare = computed(() => weekBefore.value?.covered >= 6 && weekNow.value?.covered >= 6)
const weekChange = computed(() => (canCompare.value ? percentChange(weekNow.value.total, weekBefore.value.total) : null))

// 30 hari terakhir dibanding periode yang sama tahun lalu (364 hari = tepat 52 minggu).
const monthNow = computed(() => refDate.value && sumRange(days.value, addDays(refDate.value, -29), refDate.value))
const monthLastYear = computed(() => refDate.value && sumRange(days.value, addDays(refDate.value, -29 - 364), addDays(refDate.value, -364)))
const yearChange = computed(() => (monthLastYear.value?.covered >= 25 ? percentChange(monthNow.value.total, monthLastYear.value.total) : null))

const fmtPct = (v) => (v == null ? '–' : `${v > 0 ? '+' : ''}${v}%`)

const chartLabels = computed(() => {
  if (!refDate.value) return []
  return Array.from({ length: range.value }, (_, i) => addDays(dates.value.at(-1), i - range.value + 1))
})
const chartSeries = computed(() => {
  const labels = chartLabels.value
  const series = [{ label: 'Titik panas per hari', color: '#ff7a2f', values: labels.map((d) => days.value[d]?.count ?? null) }]
  const lastYear = labels.map((d) => days.value[addDays(d, -364)]?.count ?? null)
  if (lastYear.filter((v) => v != null).length >= labels.length * 0.8) {
    series.push({ label: 'Periode sama tahun lalu', color: '#9fb0a6', dashed: true, values: lastYear })
  }
  return series
})

const provinceRows = computed(() => {
  if (!wilayah.value || !refDate.value) return []
  const rows = wilayah.value.provinsi.map((p) => {
    const now = sumRange(days.value, addDays(refDate.value, -6), refDate.value, p.name).total
    const before = sumRange(days.value, addDays(refDate.value, -13), addDays(refDate.value, -7), p.name).total
    return { ...p, now, before, diff: now - before, density: (now / p.areaKm2) * 1000 }
  })
  const by = {
    change: canCompare.value ? (a, b) => b.diff - a.diff : (a, b) => b.now - a.now,
    now: (a, b) => b.now - a.now,
    density: (a, b) => b.density - a.density,
  }[sortKey.value]
  return rows.sort(by)
})
const maxDensity = computed(() => Math.max(1, ...provinceRows.value.map((r) => r.density)))

const risers = computed(() => (canCompare.value ? [...provinceRows.value].filter((r) => r.diff > 0).sort((a, b) => b.diff - a.diff).slice(0, 3) : []))
</script>

<template>
  <section class="page">
    <h1 class="page-title">Tren titik panas</h1>
    <p class="lede">
      Apakah kondisi membaik atau memburuk? Halaman ini membandingkan jumlah titik panas dari waktu ke waktu, nasional dan per provinsi.
    </p>
    <p v-if="refDate" class="mt-2 text-sm text-mist">Dihitung sampai {{ formatShortDate(refDate) }} {{ refDate.slice(0, 4) }}. Hari terakhir belum dihitung karena data satelitnya masih masuk.</p>
    <p v-if="error" class="mt-4 text-red-300">{{ error }}</p>

    <div class="mt-8 grid gap-4 sm:grid-cols-3">
      <StatCard label="7 hari terakhir" :value="weekNow?.total ?? 0" note="Titik panas di seluruh Indonesia" />
      <StatCard label="Dibanding minggu sebelumnya" :value="fmtPct(weekChange)" :note="weekChange == null ? 'Riwayat belum cukup' : weekChange > 0 ? 'Naik dari minggu lalu' : weekChange < 0 ? 'Turun dari minggu lalu' : 'Sama dengan minggu lalu'" />
      <StatCard label="Dibanding tahun lalu" :value="fmtPct(yearChange)" :note="yearChange == null ? 'Riwayat tahun lalu belum cukup' : '30 hari terakhir vs periode yang sama tahun lalu'" />
    </div>

    <!-- Akuntabilitas: provinsi dengan kenaikan terbesar -->
    <div v-if="risers.length" class="glass relative mt-4 overflow-hidden p-6">
      <div class="pointer-events-none absolute -left-20 -top-20 h-56 w-56 rounded-full bg-ember-500/20 blur-3xl"></div>
      <div class="relative">
        <h2 class="font-display text-xl font-bold text-flare">Perlu perhatian minggu ini</h2>
        <p class="mt-1 text-mist">Provinsi dengan kenaikan titik panas terbesar dibanding minggu sebelumnya.</p>
        <ul class="mt-4 grid gap-3 md:grid-cols-3">
          <li v-for="r in risers" :key="r.name">
            <RouterLink :to="{ name: 'region', query: { p: slugify(r.name) } }" class="glass-sm block p-4 transition hover:bg-white/5">
              <p class="font-semibold">{{ r.name }}</p>
              <p class="mt-1 font-display text-2xl font-extrabold text-ember-400">+{{ r.diff.toLocaleString('id-ID') }} titik</p>
              <p class="text-sm text-mist">dari {{ r.before.toLocaleString('id-ID') }} menjadi {{ r.now.toLocaleString('id-ID') }}</p>
            </RouterLink>
          </li>
        </ul>
      </div>
    </div>

    <div class="glass mt-4 p-5 md:p-6">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h2 class="font-display text-2xl font-bold">Titik panas harian</h2>
        <div class="flex rounded-full border border-line bg-night/60 p-1 text-sm" role="group" aria-label="Rentang waktu">
          <button
            v-for="r in ranges" :key="r.days"
            class="rounded-full px-4 py-1.5 font-medium transition"
            :class="range === r.days ? 'bg-ember-400 text-night' : 'text-mist hover:text-paper'"
            :aria-pressed="range === r.days"
            @click="range = r.days"
          >{{ r.label }}</button>
        </div>
      </div>
      <DailyChart v-if="chartLabels.length" class="mt-5" :labels="chartLabels.map(formatShortDate)" :series="chartSeries" :height="320" />
      <p v-if="coveredDays && coveredDays < range" class="mt-3 text-sm text-mist">Riwayat yang tersedia baru {{ coveredDays }} hari, bagian tanpa data dibiarkan kosong.</p>
    </div>

    <div class="glass mt-4 p-5 md:p-6">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 class="font-display text-2xl font-bold">Perbandingan 38 provinsi</h2>
          <p class="mt-1 text-sm text-mist">Kepadatan adalah titik panas per 1.000 km² luas resmi provinsi (BIG), supaya provinsi kecil dan besar bisa dibandingkan adil.</p>
        </div>
        <label class="flex items-center gap-2">
          <span class="label">Urutkan</span>
          <select v-model="sortKey" class="field !py-2">
            <option value="change">Kenaikan terbesar</option>
            <option value="now">Jumlah terbanyak</option>
            <option value="density">Kepadatan tertinggi</option>
          </select>
        </label>
      </div>

      <div class="mt-5 overflow-x-auto">
        <table class="w-full min-w-[640px] text-sm">
          <thead>
            <tr class="border-b border-line text-left text-mist">
              <th class="py-2.5 pr-3 font-medium">Provinsi</th>
              <th class="py-2.5 pr-3 text-right font-medium">7 hari ini</th>
              <th class="py-2.5 pr-3 text-right font-medium">7 hari sebelumnya</th>
              <th class="py-2.5 pr-3 text-right font-medium">Perubahan</th>
              <th class="py-2.5 pl-3 font-medium">Per 1.000 km²</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in provinceRows" :key="r.name" class="border-b border-white/5 last:border-0">
              <td class="py-2.5 pr-3">
                <RouterLink :to="{ name: 'region', query: { p: slugify(r.name) } }" class="hover:text-flare">{{ r.name }}</RouterLink>
              </td>
              <td class="py-2.5 pr-3 text-right font-semibold tabular-nums">{{ r.now.toLocaleString('id-ID') }}</td>
              <td class="py-2.5 pr-3 text-right tabular-nums text-mist">{{ canCompare ? r.before.toLocaleString('id-ID') : '–' }}</td>
              <td class="py-2.5 pr-3 text-right tabular-nums" :class="!canCompare ? 'text-mist' : r.diff > 0 ? 'text-ember-400' : r.diff < 0 ? 'text-emerald-300' : 'text-mist'">
                <template v-if="canCompare">{{ r.diff > 0 ? '▲ +' : r.diff < 0 ? '▼ ' : '' }}{{ r.diff.toLocaleString('id-ID') }}</template>
                <template v-else>–</template>
              </td>
              <td class="py-2.5 pl-3">
                <div class="flex items-center gap-3">
                  <div class="h-1.5 w-24 overflow-hidden rounded-full bg-white/10">
                    <div class="h-full rounded-full bg-gradient-to-r from-ember-600 to-flare" :style="{ width: (r.density / maxDensity) * 100 + '%' }"></div>
                  </div>
                  <span class="tabular-nums">{{ r.density.toLocaleString('id-ID', { maximumFractionDigits: 1 }) }}</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</template>