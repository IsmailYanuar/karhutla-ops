<script setup>
import { ref } from 'vue'

const sources = [
  { name: 'NASA FIRMS', url: 'https://firms.modaps.eosdis.nasa.gov/', text: 'Fire Information for Resource Management System. Menyediakan data titik panas dari sensor VIIRS di tiga satelit (Suomi NPP, NOAA-20, NOAA-21), diperbarui beberapa kali sehari. Ini sumber data utama website ini. Setiap hari dipakai satu satelit, dengan Suomi NPP sebagai utama, dan satelit cadangan dipakai otomatis jika data Suomi NPP tidak lengkap.' },
  { name: 'Batas 38 provinsi', url: 'https://github.com/denyherianto/indonesia-geojson-topojson-maps-with-38-provinces', text: 'Peta batas wilayah 38 provinsi, termasuk empat provinsi baru di Papua hasil pemekaran 2022 (lisensi CC BY 4.0). Dipakai untuk menentukan provinsi setiap titik panas dan menghitung luas wilayah. Garis pantai yang lebih rinci dari geoBoundaries dipakai untuk memastikan titik di pulau kecil tetap terhitung.' },
  { name: 'Kualitas udara (Open-Meteo, Copernicus CAMS)', url: 'https://open-meteo.com/en/docs/air-quality-api', text: 'Perkiraan konsentrasi PM2.5 per jam dari model atmosfer Copernicus CAMS (Uni Eropa), diakses lewat Open-Meteo. Dipakai di halaman Cek Sekitar Saya. Angkanya hasil model, bukan stasiun pemantau resmi.' },
  { name: 'ISPU (PermenLHK P.14/2020)', url: 'https://peraturan.go.id/files/bn774-2020.pdf', text: 'Peraturan Menteri Lingkungan Hidup dan Kehutanan tentang Indeks Standar Pencemar Udara. Rumus konversi PM2.5 rata-rata 24 jam ke nilai ISPU dan lima kategorinya (Baik, Sedang, Tidak Sehat, Sangat Tidak Sehat, Berbahaya) mengikuti peraturan ini.' },
  { name: 'Luas wilayah (BIG, Kepmendagri 300.2.2-2430/2025)', url: 'https://github.com/cahyadsn/wilayah', text: 'Luas resmi 38 provinsi dari Badan Informasi Geospasial, dimuat dalam Keputusan Menteri Dalam Negeri No. 300.2.2-2430 Tahun 2025 tentang kode dan data wilayah. Dipakai untuk menghitung kepadatan titik panas per 1.000 km².' },
  { name: 'SiPongi KLHK', url: 'https://sipongi.menlhk.go.id/', text: 'Sistem pemantauan karhutla resmi Kementerian Lingkungan Hidup dan Kehutanan, berisi rekap titik panas dan luas area terbakar. Dipakai sebagai rujukan pembanding, belum diolah langsung di website ini.' },
]
const terms = [
  { term: 'Titik panas (hotspot)', text: 'Lokasi yang suhunya terdeteksi jauh lebih tinggi dari sekitarnya oleh satelit. Tidak semua titik panas adalah kebakaran, tapi menjadi tanda awal yang perlu dicek.' },
  { term: 'Tingkat kepercayaan', text: 'Seberapa yakin sistem bahwa titik panas tersebut benar-benar api. Kepercayaan tinggi berarti kemungkinan besar kebakaran nyata.' },
  { term: 'VIIRS', text: 'Sensor satelit yang datanya dipakai di website ini. Resolusinya 375 m, sehingga titik api yang kecil pun bisa terdeteksi.' },
  { term: 'Pembagian provinsi', text: 'Provinsi ditentukan dengan mencocokkan koordinat titik panas dengan peta batas 38 provinsi. Wilayah Papua sudah dipisah menjadi Papua, Papua Tengah, Papua Pegunungan, Papua Selatan, Papua Barat, dan Papua Barat Daya.' },
  { term: 'Kepadatan per 1.000 km²', text: 'Jumlah titik panas dibagi luas resmi provinsi (data Badan Informasi Geospasial), dikali 1.000. Angka ini membuat provinsi kecil dan besar bisa dibandingkan secara adil.' },
  { term: 'ISPU', text: 'Indeks Standar Pencemar Udara, ukuran resmi pemerintah untuk kualitas udara. Di website ini ISPU dihitung dari rata-rata PM2.5 24 jam terakhir, karena partikel halus PM2.5 adalah komponen utama asap karhutla.' },
  { term: 'Perbandingan mingguan', text: '7 hari terakhir dibanding 7 hari sebelumnya. Riwayat harian disimpan setiap kali data diperbarui, sehingga perbandingan dengan tahun lalu juga bisa dilihat di halaman Tren.' },
]

const faqs = [
  { q: 'Apakah setiap titik panas berarti ada kebakaran?', a: 'Belum tentu. Satelit mendeteksi tempat yang jauh lebih panas dari sekitarnya. Selain kebakaran hutan dan lahan, panas bisa berasal dari pembakaran sampah, cerobong industri, atau suar gas. Karena itu setiap titik diberi tingkat kepercayaan, dan titik berkepercayaan tinggi paling mungkin merupakan api nyata.' },
  { q: 'Seberapa sering data diperbarui?', a: 'Sistem mengambil data NASA FIRMS secara otomatis kurang lebih setiap 3 jam. Waktu pengambilan terakhir tampil di Beranda dan di halaman Peta. Jadwal otomatis ini kadang terlambat beberapa jam; jika lebih dari 12 jam belum diperbarui, Beranda menampilkan tanda "Pembaruan tertunda".' },
  { q: 'Kenapa angka hari ini terlihat lebih sedikit?', a: 'Satelit melintas beberapa kali sehari, jadi data untuk hari yang sedang berjalan belum lengkap. Karena itu perbandingan di halaman Tren dan Profil Daerah memakai hari lengkap terakhir, bukan hari ini.' },
  { q: 'Kenapa jumlahnya bisa berbeda dengan SiPongi atau BMKG?', a: 'Setiap lembaga bisa memakai satelit, ambang kepercayaan, dan cara menghitung yang berbeda. KarhutlaTracker memakai satu satelit VIIRS per hari agar titik yang sama tidak terhitung dua kali. Untuk keperluan resmi, rujuk data SiPongi KLHK.' },
  { q: 'Apakah nilai ISPU di Cek Sekitar adalah data resmi pemerintah?', a: 'Bukan. Rumus dan kategori ISPU mengikuti PermenLHK P.14/2020, tetapi angka PM2.5-nya adalah perkiraan model Copernicus CAMS, bukan hasil stasiun pemantau KLHK. Gunakan sebagai gambaran awal.' },
  { q: 'Apakah AI yang menghitung angka di website ini?', a: 'Tidak. Semua angka dihitung oleh sistem dari data satelit dan luas resmi provinsi. AI (Google Gemini) hanya menyusun kalimat ringkasan dari angka yang sudah jadi. Jika AI gagal, ringkasan disusun otomatis dengan templat.' },
  { q: 'Apakah lokasi saya disimpan?', a: 'Tidak. KarhutlaTracker tidak menyimpan lokasi Anda. Koordinat hanya dikirim ke Open-Meteo untuk mengambil kualitas udara dan ke OpenStreetMap untuk mencari nama tempat.' },
  { q: 'Saya melihat api atau asap. Harus lapor ke mana?', a: 'Utamakan keselamatan dan jauhi api. Hubungi 112 (darurat) atau 113 (pemadam kebakaran). Untuk aduan ke pemerintah, gunakan SP4N-LAPOR!. Panduan lengkapnya ada di halaman Siaga Asap.' },
  { q: 'Bisakah saya mengunduh datanya?', a: 'Bisa. Halaman Peta menyediakan unduhan CSV titik panas sesuai filter provinsi dan tingkat kepercayaan, dan halaman Tren menyediakan unduhan data harian serta tabel 38 provinsi.' },
  { q: 'Kenapa jumlah titik di Peta berbeda dengan Tren dan Profil Daerah?', a: 'Peta menampilkan deteksi langsung 7 hari terakhir sampai saat ini, termasuk hari ini yang datanya belum lengkap. Tren dan Profil Daerah memakai 7 hari yang sudah lengkap (sampai kemarin lusa) supaya perbandingan antarminggu adil. Karena rentangnya berbeda, angkanya bisa selisih sedikit.' },
]
const openFaq = ref(0)
</script>

<template>
  <section class="page max-w-4xl">
    <h1 class="page-title">Tentang data</h1>
    <p class="lede">Semua angka di KarhutlaTracker berasal dari data publik. Halaman ini menjelaskan sumbernya dan cara membacanya.</p>

    <h2 class="mt-12 font-display text-2xl font-bold">Sumber data</h2>
    <ul class="mt-4 grid gap-4 md:grid-cols-2">
      <li v-for="s in sources" :key="s.name" class="glass p-5">
        <a :href="s.url" target="_blank" rel="noopener" class="font-display text-lg font-bold text-flare hover:underline">{{ s.name }}</a>
        <p class="mt-2 text-mist">{{ s.text }}</p>
      </li>
    </ul>

    <h2 class="mt-12 font-display text-2xl font-bold">Cara membaca data</h2>
    <dl class="glass mt-4 divide-y divide-veil/5">
      <div v-for="t in terms" :key="t.term" class="grid gap-1 p-5 md:grid-cols-[220px_1fr] md:gap-6">
        <dt class="font-semibold">{{ t.term }}</dt>
        <dd class="text-mist">{{ t.text }}</dd>
      </div>
    </dl>

    <h2 id="faq" class="mt-12 scroll-mt-24 font-display text-2xl font-bold">Pertanyaan yang sering diajukan</h2>
    <div class="glass mt-4 divide-y divide-veil/5">
      <div v-for="(f, i) in faqs" :key="f.q">
        <button
          class="flex w-full items-center justify-between gap-4 p-5 text-left font-semibold transition hover:text-flare"
          :aria-expanded="openFaq === i"
          :aria-controls="`faq-${i}`"
          @click="openFaq = openFaq === i ? null : i"
        >
          {{ f.q }}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" class="shrink-0 text-mist transition-transform duration-300" :class="openFaq === i && 'rotate-45'"><path d="M12 5v14M5 12h14" /></svg>
        </button>
        <div :id="`faq-${i}`" class="faq-body" :class="openFaq === i && 'faq-open'">
          <div class="overflow-hidden">
            <p class="px-5 pb-5 text-mist">{{ f.a }}</p>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.faq-body { display: grid; grid-template-rows: 0fr; transition: grid-template-rows 0.3s ease; }
.faq-open { grid-template-rows: 1fr; }
</style>