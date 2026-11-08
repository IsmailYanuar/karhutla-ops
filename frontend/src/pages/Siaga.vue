<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ISPU_CATEGORIES } from '../services/udara'

const route = useRoute()
const router = useRouter()

const active = computed(() => ISPU_CATEGORIES.find((c) => c.slug === route.query.ispu) ?? ISPU_CATEGORIES[2])
const fromNearby = computed(() => Boolean(route.query.ispu))
const pick = (c) => router.replace({ query: { ...route.query, ispu: c.slug } })
const range = (i) => (i === 0 ? '0' : ISPU_CATEGORIES[i - 1].max + 1) + (ISPU_CATEGORIES[i].max === Infinity ? '+' : `–${ISPU_CATEGORIES[i].max}`)

const dos = [
  'Pantau kualitas udara secara rutin, jangan hanya mengandalkan penglihatan.',
  'Kurangi aktivitas di luar ruangan saat kualitas udara memburuk.',
  'Gunakan masker yang pas dan terpasang rapat saat keluar rumah.',
  'Tutup pintu dan jendela rapat saat asap pekat di luar.',
  'Beri perhatian khusus pada anak, lansia, ibu hamil, dan penderita asma atau penyakit jantung.',
  'Simpan stok obat rutin yang cukup, terutama bagi yang punya penyakit bawaan.',
]
const donts = [
  'Berolahraga berat di luar saat udara tercemar. Napas terengah-engah membuat lebih banyak asap masuk ke paru-paru.',
  'Merokok di dalam rumah.',
  'Menganggap udara aman hanya karena asap tidak terlihat pekat.',
  'Menyebarkan informasi kualitas udara atau kebakaran yang belum terverifikasi.',
  'Membuka lahan dengan cara membakar. Api kecil bisa membesar bila terbawa angin.',
]

const warningSigns = ['Sesak napas', 'Batuk yang tidak kunjung berhenti', 'Nyeri dada', 'Iritasi mata yang berat', 'Pusing yang makin berat']

const eyeDo = [
  'Cuci tangan sebelum menyentuh area sekitar mata.',
  'Bilas mata dengan air bersih untuk membuang partikel asap.',
  'Air mata buatan membantu menjaga mata tetap lembap.',
  'Kompres dingin untuk meredakan rasa tidak nyaman.',
  'Pakai kacamata saat keluar rumah. Pengguna lensa kontak sebaiknya beralih ke kacamata sementara.',
]
const eyeDont = [
  'Mengucek mata, meskipun terasa gatal atau perih.',
  'Memakai obat tetes steroid atau antibiotik tanpa resep dokter.',
  'Memakai bahan tradisional seperti air sirih.',
]

const contacts = [
  { number: '112', name: 'Panggilan darurat', text: 'Satu nomor untuk semua keadaan darurat, gratis dari ponsel.' },
  { number: '113', name: 'Pemadam kebakaran', text: 'Laporkan api atau kebakaran lahan yang Anda lihat.' },
  { number: '119', name: 'Gawat darurat medis', text: 'Ambulans dan layanan gawat darurat kesehatan.' },
  { number: '1500-567', name: 'Halo Kemenkes', text: 'Informasi dan konsultasi kesehatan dari Kementerian Kesehatan.' },
]

const sources = [
  { name: 'Tips mitigasi dan adaptasi asap karhutla', org: 'Kementerian Lingkungan Hidup, 24 September 2026', url: 'https://www.kemenlh.go.id/news/detail/tips-mitigasi-dan-adaptasi-asap-karhutla-jaga-udara-lindungi-keluarga-kita' },
  { name: 'Menkes: pakai masker dan pantau kualitas udara', org: 'Kementerian Kesehatan, 21 Agustus 2026', url: 'https://kemkes.go.id/id/menkes-pakai-masker-dan-pantau-kualitas-udara-untuk-cegah-dampak-asap-karhutla' },
  { name: 'Cara menjaga kesehatan mata dari kabut asap', org: 'Kemenkes, RS M. Djamil Padang, 26 September 2026', url: 'https://keslan.kemkes.go.id/read/4345/rs-m-djamil-edukasi-cara-menjaga-kesehatan-mata-dari-paparan-kabut-asap' },
  { name: 'Penggunaan masker pada asap kebakaran hutan', org: 'Kementerian Kesehatan', url: 'https://www.kemkes.go.id/eng/penggunaan-masker-pada-asap-kebakaran-hutan' },
  { name: 'Cegah dan tangani dampak kesehatan akibat kabut asap', org: 'Kementerian Kesehatan', url: 'https://www.kemkes.go.id/id/cegah-dan-tangani-dampak-kesehatan-akibat-kabut-asap' },
  { name: 'Indeks Standar Pencemar Udara (PermenLHK P.14/2020)', org: 'Kementerian LHK', url: 'https://peraturan.go.id/files/bn774-2020.pdf' },
]
</script>

<template>
  <section class="page">
    <p class="font-semibold text-flare">Siaga Asap</p>
    <h1 class="page-title mt-1">Apa yang harus dilakukan saat asap datang?</h1>
    <p class="lede">
      Panduan singkat melindungi diri dan keluarga dari asap kebakaran hutan dan lahan, disusun dari imbauan resmi Kementerian Kesehatan dan Kementerian Lingkungan Hidup.
    </p>
    <div class="mt-6 flex flex-wrap gap-3">
      <RouterLink to="/sekitar" class="btn-ember">Cek ISPU di lokasi saya</RouterLink>
      <a href="#darurat" class="btn-ghost">Nomor darurat</a>
    </div>

    <!-- Anjuran sesuai ISPU -->
    <div class="glass mt-10 p-5 md:p-7">
      <h2 class="font-display text-2xl font-bold">Lakukan sesuai kualitas udara</h2>
      <p class="mt-1 text-mist">
        {{ fromNearby ? 'Kategori ini sesuai ISPU di lokasi yang Anda cek.' : 'Pilih kategori ISPU. Nilai ISPU di lokasi Anda bisa dicek di halaman Cek Sekitar.' }}
      </p>
      <div class="mt-5 flex flex-wrap gap-2" role="tablist" aria-label="Kategori ISPU">
        <button
          v-for="(c, i) in ISPU_CATEGORIES" :key="c.slug"
          role="tab" :aria-selected="active === c"
          class="flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-semibold transition"
          :class="active === c ? 'border-transparent' : 'border-line text-mist hover:text-paper'"
          :style="active === c ? { background: c.color, color: c.text } : null"
          @click="pick(c)"
        >
          <span v-if="active !== c" class="h-2.5 w-2.5 rounded-full ring-1 ring-veil/30" :style="{ background: c.color }"></span>
          {{ c.label }} <span class="font-normal opacity-75">{{ range(i) }}</span>
        </button>
      </div>
      <Transition name="swap" mode="out-in">
        <div :key="active.slug" class="mt-6 grid gap-5 md:grid-cols-[260px_1fr]">
          <div class="rounded-2xl p-5" :style="{ background: active.color, color: active.text }">
            <p class="text-sm font-medium opacity-80">ISPU {{ range(ISPU_CATEGORIES.indexOf(active)) }}</p>
            <p class="font-display text-3xl font-extrabold leading-tight">{{ active.label }}</p>
            <p class="mt-2 text-sm opacity-90">{{ active.meaning }}</p>
          </div>
          <ol class="flex flex-col gap-3">
            <li v-for="(a, i) in active.advice" :key="a" class="glass-sm flex gap-4 p-4">
              <span class="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ember-400/15 font-display font-bold text-ember-400">{{ i + 1 }}</span>
              <span class="self-center">{{ a }}</span>
            </li>
          </ol>
        </div>
      </Transition>
    </div>

    <!-- Lakukan dan hindari -->
    <div class="mt-4 grid gap-4 md:grid-cols-2">
      <div class="glass p-5 md:p-6">
        <h2 class="flex items-center gap-3 font-display text-xl font-bold">
          <span class="grid h-8 w-8 place-items-center rounded-full bg-emerald-400/15 text-emerald-300">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7" /></svg>
          </span>
          Lakukan
        </h2>
        <ul class="mt-4 flex flex-col gap-3">
          <li v-for="d in dos" :key="d" class="flex gap-3"><span class="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-300"></span><span>{{ d }}</span></li>
        </ul>
      </div>
      <div class="glass p-5 md:p-6">
        <h2 class="flex items-center gap-3 font-display text-xl font-bold">
          <span class="grid h-8 w-8 place-items-center rounded-full bg-red-400/15 text-red-300">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </span>
          Hindari
        </h2>
        <ul class="mt-4 flex flex-col gap-3">
          <li v-for="d in donts" :key="d" class="flex gap-3"><span class="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-300"></span><span>{{ d }}</span></li>
        </ul>
      </div>
    </div>

    <!-- Kapan ke fasilitas kesehatan -->
    <div class="relative mt-4 overflow-hidden rounded-[1.25rem] border border-red-400/30 bg-red-500/10 p-5 md:p-7">
      <h2 class="font-display text-2xl font-bold">Segera ke puskesmas atau rumah sakit jika muncul</h2>
      <ul class="mt-4 flex flex-wrap gap-2">
        <li v-for="s in warningSigns" :key="s" class="rounded-full border border-red-400/30 bg-red-500/10 px-4 py-2 font-semibold text-red-200">{{ s }}</li>
      </ul>
      <p class="mt-4 max-w-3xl text-mist">
        Jangan anggap remeh gangguan napas ringan. Anak, lansia, ibu hamil, serta penderita asma atau penyakit paru lebih berisiko terkena infeksi saluran pernapasan akut (ISPA). Dalam keadaan gawat, hubungi <strong class="text-paper">119</strong>.
      </p>
    </div>

    <!-- Masker -->
    <div class="glass mt-4 p-5 md:p-7">
      <h2 class="font-display text-2xl font-bold">Memilih masker</h2>
      <div class="mt-5 grid gap-4 md:grid-cols-2">
        <div class="glass-sm p-5">
          <p class="font-display text-lg font-bold">Masker bedah</p>
          <p class="mt-2 text-mist">Menyaring partikel besar dengan baik, tetapi sebagian besar partikel halus asap masih bisa lolos ke saluran napas. Lebih baik daripada tidak memakai masker sama sekali.</p>
        </div>
        <div class="glass-sm p-5">
          <p class="font-display text-lg font-bold">Masker N95</p>
          <p class="mt-2 text-mist">Menyaring sekitar 95% partikel bila dipakai dengan benar dan menempel rapat di wajah. Sekali pakai, paling lama 8 jam. Dianjurkan bagi yang harus berada di luar saat asap pekat.</p>
        </div>
      </div>
      <p class="mt-4 text-sm text-mist">
        N95 membuat napas terasa lebih berat, sehingga Kemenkes tidak menganjurkannya untuk anak, ibu hamil, lansia, dan penderita penyakit jantung atau paru kronis. Bagi kelompok ini, perlindungan terbaik adalah tetap di dalam ruangan dan berkonsultasi dengan tenaga kesehatan.
      </p>
    </div>

    <!-- Pertolongan pertama mata -->
    <div class="glass mt-4 p-5 md:p-7">
      <h2 class="font-display text-2xl font-bold">Pertolongan pertama: mata perih karena asap</h2>
      <div class="mt-5 grid gap-6 md:grid-cols-2">
        <ol class="flex flex-col gap-3">
          <li v-for="(d, i) in eyeDo" :key="d" class="flex gap-3">
            <span class="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-ember-400/15 text-sm font-bold text-ember-400">{{ i + 1 }}</span>
            <span>{{ d }}</span>
          </li>
        </ol>
        <div>
          <p class="label">Jangan</p>
          <ul class="mt-2 flex flex-col gap-2">
            <li v-for="d in eyeDont" :key="d" class="flex gap-3"><span class="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-300"></span><span>{{ d }}</span></li>
          </ul>
          <p class="mt-5 text-sm text-mist">
            Periksakan ke dokter mata bila nyeri hebat, penglihatan menurun, mata sangat merah atau bernanah, sangat silau, atau keluhan tidak membaik dalam 24 sampai 48 jam.
          </p>
        </div>
      </div>
    </div>

    <!-- Melihat api dan nomor darurat -->
    <div id="darurat" class="glass mt-4 scroll-mt-24 p-5 md:p-7">
      <h2 class="font-display text-2xl font-bold">Melihat api atau asap dari lahan?</h2>
      <p class="mt-1 max-w-3xl text-mist">
        Utamakan keselamatan dan jauhi api serta asap pekat. Laporkan sedini mungkin, karena api kecil lebih mudah dipadamkan sebelum membesar.
      </p>
      <ul class="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <li v-for="c in contacts" :key="c.number">
          <a :href="`tel:${c.number.replace('-', '')}`" class="glass-sm lift block h-full p-4">
            <p class="font-display text-3xl font-extrabold text-flare">{{ c.number }}</p>
            <p class="mt-1 font-semibold">{{ c.name }}</p>
            <p class="mt-1 text-sm text-mist">{{ c.text }}</p>
          </a>
        </li>
      </ul>
      <div class="mt-4 flex flex-col gap-3 rounded-2xl border border-ember-400/30 bg-ember-400/10 p-5 sm:flex-row sm:items-center sm:justify-between">
        <p>Untuk laporan dan aduan ke pemerintah, termasuk pembakaran lahan, gunakan SP4N-LAPOR!. Lembaga penanggung jawab di tiap provinsi ada di halaman Profil Daerah.</p>
        <div class="flex shrink-0 gap-2">
          <RouterLink to="/daerah" class="btn-ghost">Profil Daerah</RouterLink>
          <a href="https://www.lapor.go.id/" target="_blank" rel="noopener" class="btn-ember">Buka LAPOR!</a>
        </div>
      </div>
    </div>

    <!-- Sumber -->
    <div class="mt-10">
      <h2 class="font-display text-xl font-bold">Sumber</h2>
      <p class="mt-1 text-sm text-mist">Panduan ini bersifat umum dan tidak menggantikan pemeriksaan tenaga kesehatan.</p>
      <ul class="mt-4 grid gap-3 md:grid-cols-2">
        <li v-for="s in sources" :key="s.url">
          <a :href="s.url" target="_blank" rel="noopener" class="glass-sm lift block p-4">
            <p class="font-semibold text-flare">{{ s.name }}</p>
            <p class="text-sm text-mist">{{ s.org }}</p>
          </a>
        </li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
.swap-enter-active, .swap-leave-active { transition: opacity 0.2s ease, transform 0.2s ease; }
.swap-enter-from { opacity: 0; transform: translateY(6px); }
.swap-leave-to { opacity: 0; }
</style>