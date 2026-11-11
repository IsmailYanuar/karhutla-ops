<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import StatCard from '../components/StatCard.vue'
import HotspotSky from '../components/HotspotSky.vue'
import { getHotspotData, countByProvince, formatDate, getRingkasan } from '../services/hotspots'

const data = ref(null)
const error = ref('')
const ringkasan = ref(null)

const now = ref(Date.now())
let clock
onMounted(() => { clock = setInterval(() => (now.value = Date.now()), 60000) })
onBeforeUnmount(() => clearInterval(clock))
const freshness = computed(() => {
  const at = data.value?.updatedAt
  if (!at) return null
  const mins = Math.max(0, Math.round((now.value - new Date(at).getTime()) / 60000))
  const text = mins < 60 ? `${mins} menit lalu` : mins < 48 * 60 ? `${Math.round(mins / 60)} jam lalu` : `${Math.round(mins / 1440)} hari lalu`
  return { text, fresh: mins <= 12 * 60, at: formatDate(at) }
})

onMounted(async () => {
  getRingkasan().then((r) => (ringkasan.value = r)).catch(() => {})
  try { data.value = await getHotspotData() } catch (e) { error.value = e.message }
})

const tgl = (s, year = false) => new Date(`${s}T00:00:00Z`).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', ...(year && { year: 'numeric' }), timeZone: 'UTC' })
function periode(p) {
  const [a, b] = p.split(' s.d. ')
  return `${tgl(a)} sampai ${tgl(b, true)}`
}

const hotspots = computed(() => data.value?.hotspots ?? [])
const ranking = computed(() => countByProvince(hotspots.value))
const highConf = computed(() => hotspots.value.filter((h) => h.confidence === 'high').length)
const maxCount = computed(() => ranking.value[0]?.count || 1)
const range = computed(() => {
  const d = data.value?.summary?.byDate
  return d?.length ? `${tgl(d[0].date)} sampai ${tgl(d.at(-1).date, true)}` : ''
})

const steps = [
  { title: 'Satelit memotret panas', text: 'Sensor VIIRS di satelit Suomi NPP, NOAA-20, dan NOAA-21 menangkap titik yang jauh lebih panas dari sekitarnya, siang dan malam.' },
  { title: 'Diolah otomatis', text: 'Setiap 3 jam, data NASA FIRMS ditarik, dicocokkan ke 38 provinsi, dan dihitung kepadatannya dengan luas resmi BIG.' },
  { title: 'Siap dibaca publik', text: 'Hasilnya tampil sebagai peta, ringkasan, dan cek lokasi yang bisa dipahami siapa saja tanpa membaca tabel mentah.' },
]
</script>

<template>
  <div>
    <section class="relative">
      <div class="mx-auto max-w-6xl px-4 pt-8 md:pt-16">
        <div class="grid items-end gap-8 md:grid-cols-[1.25fr_1fr]">
          <h1 class="font-display text-5xl font-extrabold leading-[0.95] tracking-tight md:text-7xl">
            Titik api Indonesia, terpantau dari orbit.
          </h1>
          <div>
            <p class="text-lg text-mist">
              Setiap titik oranye pada peta di bawah adalah panas yang ditangkap satelit dalam 7 hari terakhir. KarhutlaTracker mengubahnya jadi peta, tren, dan peringatan yang bisa dibaca siapa saja.
            </p>
            <div class="mt-6 flex flex-wrap gap-3">
              <RouterLink to="/peta" class="btn-ember">Buka peta titik panas</RouterLink>
              <RouterLink to="/sekitar" class="btn-ghost">Cek sekitar saya</RouterLink>
            </div>
            <p class="mt-5 text-sm text-mist">
              Bukan sekadar peta: ada <RouterLink to="/tren" class="font-semibold text-flare hover:underline">rapor mingguan 38 provinsi</RouterLink>
              dan <RouterLink to="/daerah" class="font-semibold text-flare hover:underline">kepadatan titik per 1.000 km²</RouterLink>
              agar provinsi besar dan kecil bisa dibandingkan secara adil.
            </p>
          </div>
        </div>
      </div>

      <div class="mx-auto mt-6 md:mt-10 flex max-w-6xl flex-wrap items-center gap-2 px-4">
        <p v-if="freshness" class="glass-sm inline-flex items-center gap-2 px-3 py-1.5 text-xs sm:text-sm" :title="`Data diambil ${freshness.at}`">
          <span class="relative flex h-2.5 w-2.5 shrink-0">
            <span v-if="freshness.fresh" class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
            <span class="relative inline-flex h-2.5 w-2.5 rounded-full" :class="freshness.fresh ? 'bg-emerald-500' : 'bg-amber-500'"></span>
          </span>
          <span class="font-semibold text-paper">{{ freshness.fresh ? 'Data langsung' : 'Pembaruan tertunda' }}</span>
          <span class="text-mist">diperbarui {{ freshness.text }} dari NASA FIRMS</span>
        </p>
        <p class="glass-sm inline-block px-3 py-1.5 text-xs text-mist sm:text-sm">
          <template v-if="range"><span class="font-semibold text-paper">{{ hotspots.length.toLocaleString('id-ID') }} titik panas</span>, {{ range }}</template>
          <template v-else>{{ error || 'Memuat data satelit…' }}</template>
        </p>
      </div>

      <div class="relative mx-auto mt-2 aspect-[2/1] max-w-6xl px-4 md:aspect-[21/9]">
        <HotspotSky :hotspots="hotspots" />
        <p v-if="!hotspots.length" class="absolute inset-0 grid place-items-center text-sm text-mist">{{ error ? 'Peta belum bisa dimuat.' : 'Memuat peta titik panas dari satelit…' }}</p>
      </div>

      <div class="relative mx-auto mt-4 grid max-w-6xl gap-4 px-4 sm:grid-cols-3 md:mt-2">
        <StatCard label="Total titik panas" :value="hotspots.length" note="Seluruh Indonesia, 7 hari terakhir" />
        <StatCard label="Kepercayaan tinggi" :value="highConf" note="Hampir pasti kebakaran nyata" />
        <StatCard label="Provinsi terdampak" :value="ranking.length" :note="ranking[0] ? `Terbanyak di ${ranking[0].province}` : ''" />
      </div>
    </section>

    <section class="mx-auto mt-10 grid max-w-6xl gap-4 px-4 lg:grid-cols-[1.4fr_1fr]">
      <article v-if="ringkasan" class="glass relative overflow-hidden p-6 md:p-8">
        <div class="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-ember-500/20 blur-3xl"></div>
        <div class="relative">
          <div class="flex flex-wrap items-center gap-3">
            <h2 class="font-display text-2xl font-bold">Ringkasan terbaru</h2>
            <!-- <span v-if="ringkasan.ai" class="rounded-full border border-ember-400/40 bg-ember-400/10 px-2.5 py-0.5 text-xs font-semibold text-flare">Dibuat AI</span> -->
          </div>
          <p class="mt-1 text-sm text-mist">{{ periode(ringkasan.facts.periode) }}</p>
          <p class="mt-5 max-w-[62ch] text-xl leading-relaxed text-paper">{{ ringkasan.text }}</p>
          <p class="mt-5 text-xs text-mist">
            <template v-if="ringkasan.ai">Kalimat disusun AI ({{ ringkasan.model }}) dari angka data NASA FIRMS dan diperbarui setiap 3 jam. Semua angka dihitung sistem, bukan AI.</template>
            <template v-else>Disusun otomatis dari data NASA FIRMS dan diperbarui setiap 3 jam.</template>
          </p>
        </div>
      </article>

      <aside class="glass p-6 md:p-8">
        <h2 class="font-display text-2xl font-bold">Provinsi terbanyak</h2>
        <p v-if="data" class="mt-1 text-sm text-mist">Data diambil {{ formatDate(data.updatedAt) }}</p>
        <ol class="mt-5 flex flex-col gap-4">
          <li v-for="r in ranking.slice(0, 5)" :key="r.province">
            <div class="flex justify-between gap-3">
              <span>{{ r.province }}</span>
              <span class="font-display font-bold tabular-nums">{{ r.count.toLocaleString('id-ID') }}</span>
            </div>
            <div class="mt-2 h-1.5 overflow-hidden rounded-full bg-veil/10">
              <div class="bar h-full rounded-full" :style="{ width: (r.count / maxCount) * 100 + '%' }"></div>
            </div>
          </li>
          <li v-if="!ranking.length" class="text-mist">{{ error || 'Memuat data…' }}</li>
        </ol>
        <RouterLink to="/peta" class="mt-6 inline-block font-semibold text-flare hover:underline">Lihat semua provinsi di peta</RouterLink>
      </aside>
    </section>

    <section class="mx-auto mt-20 max-w-6xl px-4">
      <h2 class="font-display text-3xl font-extrabold tracking-tight md:text-4xl">Dari orbit ke layar Anda</h2>
      <ol class="mt-8 grid gap-4 md:grid-cols-3">
        <li v-for="(s, i) in steps" :key="s.title" class="glass p-6">
          <span class="font-display text-5xl font-extrabold text-ember-400/80">{{ i + 1 }}</span>
          <h3 class="mt-3 font-display text-xl font-bold">{{ s.title }}</h3>
          <p class="mt-2 text-mist">{{ s.text }}</p>
        </li>
      </ol>
    </section>

    <section class="mx-auto mt-20 max-w-6xl px-4">
      <div class="glass relative overflow-hidden p-8 md:p-12">
        <div class="pointer-events-none absolute -bottom-32 left-1/3 h-72 w-[36rem] rounded-full bg-ember-500/25 blur-3xl"></div>
        <div class="relative flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 class="font-display text-3xl font-extrabold tracking-tight md:text-4xl">Ada titik panas di dekat Anda?</h2>
            <p class="mt-2 max-w-xl text-lg text-mist">Cek titik panas dalam radius 50 km dan kualitas udara hari ini menurut standar ISPU.</p>
          </div>
          <RouterLink to="/sekitar" class="btn-ember shrink-0">Cek sekitar saya</RouterLink>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.bar {
  background: linear-gradient(90deg, #e0531a, #ffb26b);
  transform-origin: left;
  animation: grow 1.2s cubic-bezier(0.2, 0.8, 0.2, 1) both;
}
@keyframes grow { from { transform: scaleX(0); } }
</style>