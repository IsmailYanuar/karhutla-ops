<script setup>
import { ref, computed, onMounted } from 'vue'
import StatCard from '../components/StatCard.vue'
import { getHotspotData, countByProvince, formatDate, getRingkasan } from '../services/hotspots'

const data = ref(null)
const error = ref('')
const ringkasan = ref(null)

onMounted(async () => {
  getRingkasan().then((r) => (ringkasan.value = r)).catch(() => {})
  try { data.value = await getHotspotData() } catch (e) { error.value = e.message }
})

function periode(p) {
  const f = (s) => new Date(`${s}T00:00:00Z`).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', timeZone: 'UTC' })
  const [a, b] = p.split(' s.d. ')
  return `${f(a)} sampai ${f(b)}`
}

const hotspots = computed(() => data.value?.hotspots ?? [])
const ranking = computed(() => countByProvince(hotspots.value))
const highConf = computed(() => hotspots.value.filter((h) => h.confidence === 'high').length)
const maxCount = computed(() => ranking.value[0]?.count || 1)

const steps = [
  { title: 'Data satelit dikumpulkan', text: 'Titik panas dideteksi sensor VIIRS di satelit Suomi NPP, lalu dipublikasikan NASA FIRMS beberapa kali sehari.' },
  { title: 'Diolah otomatis', text: 'Script terjadwal menarik data terbaru, mengelompokkan per provinsi, dan menghitung tren.' },
  { title: 'Tampil untuk publik', text: 'Hasilnya disajikan dalam peta dan grafik yang bisa dipahami siapa saja, tanpa membaca tabel mentah.' },
]
</script>

<template>
  <section class="relative overflow-hidden bg-ash-900 text-white">
    <div class="pointer-events-none absolute inset-0 opacity-60" style="background: radial-gradient(60% 80% at 85% 20%, rgba(240,102,26,.45), transparent 60%), radial-gradient(40% 60% at 10% 100%, rgba(194,65,12,.35), transparent 60%)"></div>
    <div class="relative mx-auto grid max-w-6xl gap-10 px-4 py-16 md:grid-cols-[1.2fr_1fr] md:py-24">
      <div>
        <p class="text-sm font-semibold uppercase tracking-widest text-ember-500">Transparansi data karhutla</p>
        <h1 class="mt-4 font-display text-4xl font-extrabold leading-tight text-balance md:text-6xl">
          Lihat di mana hutan dan lahan Indonesia sedang terbakar.
        </h1>
        <p class="mt-5 max-w-xl text-lg text-ash-200">
          KarhutlaTracker mengolah data titik panas dari satelit menjadi peta dan statistik yang mudah dipahami, supaya masyarakat bisa ikut memantau dan menuntut penanganan yang cepat.
        </p>
        <div class="mt-8 flex flex-wrap gap-3">
          <RouterLink to="/peta" class="rounded-md bg-ember-600 px-5 py-3 font-semibold text-white hover:bg-ember-700">Buka Peta Titik Panas</RouterLink>
          <RouterLink to="/tentang-data" class="rounded-md border border-white/30 px-5 py-3 font-semibold text-white hover:bg-white/10">Dari mana datanya?</RouterLink>
        </div>
      </div>

      <div class="self-end rounded-xl border border-white/15 bg-white/5 p-5 backdrop-blur">
        <p class="text-xs font-semibold uppercase tracking-wider text-ash-200">Provinsi dengan titik panas terbanyak</p>
        <p class="mt-1 text-xs text-ash-200/70">7 hari terakhir</p>
        <ul class="mt-4 flex flex-col gap-3">
          <li v-for="r in ranking.slice(0, 5)" :key="r.province">
            <div class="flex justify-between text-sm"><span>{{ r.province }}</span><span class="font-mono tabular-nums">{{ r.count.toLocaleString('id-ID') }}</span></div>
            <div class="mt-1 h-1.5 rounded-full bg-white/10"><div class="h-full rounded-full bg-ember-500" :style="{ width: (r.count / maxCount) * 100 + '%' }"></div></div>
          </li>
          <li v-if="!ranking.length" class="text-sm text-ash-200">{{ error || 'Memuat data…' }}</li>
        </ul>
      </div>
    </div>
  </section>

  <section v-if="ringkasan" class="mx-auto max-w-6xl px-4 pt-12">
    <div class="rounded-xl border border-ash-200 bg-white p-6 md:p-8">
      <div class="flex flex-wrap items-center gap-2">
        <h2 class="font-display text-xl font-extrabold">Ringkasan terbaru</h2>
        <span v-if="ringkasan.ai" class="rounded-full bg-ember-50 px-2.5 py-0.5 text-xs font-semibold text-ember-700">Dibuat AI</span>
      </div>
      <p class="mt-1 text-sm text-ash-500">{{ periode(ringkasan.facts.periode) }}</p>
      <p class="mt-4 max-w-3xl text-lg leading-relaxed text-ash-900">{{ ringkasan.text }}</p>
      <p class="mt-4 text-xs text-ash-500">
        <template v-if="ringkasan.ai">Kalimat disusun otomatis oleh AI ({{ ringkasan.model }}) dari angka data NASA FIRMS di website ini, lalu diperbarui setiap 6 jam. Angka dihitung oleh sistem, bukan oleh AI.</template>
        <template v-else>Disusun otomatis dari data NASA FIRMS di website ini, diperbarui setiap 6 jam.</template>
      </p>
    </div>
  </section>

  <section class="mx-auto max-w-6xl px-4 py-12">
    <div class="flex flex-wrap items-baseline justify-between gap-2">
      <h2 class="font-display text-2xl font-extrabold">Ringkasan 7 hari terakhir</h2>
      <p v-if="data" class="text-sm text-ash-500">Diperbarui {{ formatDate(data.updatedAt) }}</p>
    </div>
    <p v-if="data?.source?.startsWith('DATA CONTOH')" class="mt-2 inline-block rounded bg-ember-50 px-2 py-1 text-xs font-medium text-ember-700">Masih memakai data contoh</p>
    <div class="mt-6 grid gap-4 sm:grid-cols-3">
      <StatCard label="Total titik panas" :value="hotspots.length" note="Seluruh Indonesia" />
      <StatCard label="Kepercayaan tinggi" :value="highConf" note="Kemungkinan besar kebakaran nyata" />
      <StatCard label="Provinsi terdampak" :value="ranking.length" :note="ranking[0] ? `Terbanyak: ${ranking[0].province}` : ''" />
    </div>
  </section>

  <section class="border-y border-ash-200 bg-white">
    <div class="mx-auto max-w-6xl px-4 py-12">
      <h2 class="font-display text-2xl font-extrabold">Bagaimana data sampai ke layar Anda</h2>
      <ol class="mt-8 grid gap-6 md:grid-cols-3">
        <li v-for="(s, i) in steps" :key="s.title" class="flex gap-4">
          <span class="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ember-50 font-mono font-medium text-ember-700">{{ i + 1 }}</span>
          <div>
            <h3 class="font-semibold">{{ s.title }}</h3>
            <p class="mt-1 text-ash-500">{{ s.text }}</p>
          </div>
        </li>
      </ol>
    </div>
  </section>

  <section class="mx-auto max-w-6xl px-4 py-12">
    <div class="flex flex-col items-start gap-4 rounded-xl bg-ember-50 p-8 md:flex-row md:items-center md:justify-between">
      <div>
        <h2 class="font-display text-2xl font-extrabold">Cek kondisi daerah Anda</h2>
          <p class="mt-1 text-ash-700">Cari titik panas terdekat dari lokasi Anda dan cek kualitas udara hari ini.</p>
      </div>
      <RouterLink to="/sekitar" class="rounded-md bg-ember-600 px-5 py-3 font-semibold text-white hover:bg-ember-700">Cek Sekitar Saya</RouterLink>
    </div>
  </section>
</template>