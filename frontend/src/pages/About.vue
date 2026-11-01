<script setup>
const sources = [
  { name: 'NASA FIRMS', url: 'https://firms.modaps.eosdis.nasa.gov/', text: 'Fire Information for Resource Management System. Menyediakan data titik panas dari satelit VIIRS dan MODIS, diperbarui beberapa kali sehari.' },
  { name: 'SiPongi KLHK', url: 'https://sipongi.menlhk.go.id/', text: 'Sistem pemantauan karhutla resmi Kementerian Lingkungan Hidup dan Kehutanan, berisi rekap titik panas dan luas area terbakar.' },
]
const terms = [
  { term: 'Titik panas (hotspot)', text: 'Lokasi yang suhunya terdeteksi jauh lebih tinggi dari sekitarnya oleh satelit. Tidak semua titik panas adalah kebakaran, tapi menjadi tanda awal yang perlu dicek.' },
  { term: 'Tingkat kepercayaan', text: 'Seberapa yakin sistem bahwa titik panas tersebut benar-benar api. Kepercayaan tinggi berarti kemungkinan besar kebakaran nyata.' },
  { term: 'VIIRS dan MODIS', text: 'Dua jenis sensor satelit. VIIRS lebih detail (resolusi 375 m), MODIS mencakup data lebih lama (resolusi 1 km).' },
  { term: 'Pembagian provinsi', text: 'Provinsi ditentukan dengan mencocokkan koordinat titik panas dengan peta batas wilayah (geoBoundaries, OpenStreetMap). Peta ini masih memakai 34 provinsi, sehingga wilayah Papua belum dipisah menjadi provinsi hasil pemekaran 2022.' },
]
</script>

<template>
  <section class="mx-auto max-w-3xl px-4 py-12">
    <h1 class="font-display text-3xl font-extrabold">Tentang Data</h1>
    <p class="mt-3 text-lg text-ash-700">Semua angka di KarhutlaTracker berasal dari data publik. Halaman ini menjelaskan sumbernya dan cara membacanya.</p>

    <h2 class="mt-10 font-display text-xl font-extrabold">Sumber data</h2>
    <ul class="mt-4 flex flex-col gap-4">
      <li v-for="s in sources" :key="s.name" class="rounded-lg border border-ash-200 bg-white p-5">
        <a :href="s.url" target="_blank" rel="noopener" class="font-semibold text-ember-700 hover:underline">{{ s.name }}</a>
        <p class="mt-1 text-ash-700">{{ s.text }}</p>
      </li>
    </ul>

    <h2 class="mt-10 font-display text-xl font-extrabold">Cara membaca data</h2>
    <dl class="mt-4 flex flex-col gap-4">
      <div v-for="t in terms" :key="t.term">
        <dt class="font-semibold">{{ t.term }}</dt>
        <dd class="mt-1 text-ash-700">{{ t.text }}</dd>
      </div>
    </dl>
  </section>
</template>