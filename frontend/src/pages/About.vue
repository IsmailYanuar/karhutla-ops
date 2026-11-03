<script setup>
const sources = [
  { name: 'NASA FIRMS', url: 'https://firms.modaps.eosdis.nasa.gov/', text: 'Fire Information for Resource Management System. Menyediakan data titik panas dari sensor VIIRS (satelit Suomi NPP), diperbarui beberapa kali sehari. Ini sumber data utama website ini.' },
  { name: 'Batas 38 provinsi', url: 'https://github.com/denyherianto/indonesia-geojson-topojson-maps-with-38-provinces', text: 'Peta batas wilayah 38 provinsi, termasuk empat provinsi baru di Papua hasil pemekaran 2022 (lisensi CC BY 4.0). Dipakai untuk menentukan provinsi setiap titik panas dan menghitung luas wilayah. Garis pantai yang lebih rinci dari geoBoundaries dipakai untuk memastikan titik di pulau kecil tetap terhitung.' },
  { name: 'SiPongi KLHK', url: 'https://sipongi.menlhk.go.id/', text: 'Sistem pemantauan karhutla resmi Kementerian Lingkungan Hidup dan Kehutanan, berisi rekap titik panas dan luas area terbakar. Dipakai sebagai rujukan pembanding, belum diolah langsung di website ini.' },
]
const terms = [
  { term: 'Titik panas (hotspot)', text: 'Lokasi yang suhunya terdeteksi jauh lebih tinggi dari sekitarnya oleh satelit. Tidak semua titik panas adalah kebakaran, tapi menjadi tanda awal yang perlu dicek.' },
  { term: 'Tingkat kepercayaan', text: 'Seberapa yakin sistem bahwa titik panas tersebut benar-benar api. Kepercayaan tinggi berarti kemungkinan besar kebakaran nyata.' },
  { term: 'VIIRS', text: 'Sensor satelit yang datanya dipakai di website ini. Resolusinya 375 m, sehingga titik api yang kecil pun bisa terdeteksi.' },
  { term: 'Pembagian provinsi', text: 'Provinsi ditentukan dengan mencocokkan koordinat titik panas dengan peta batas 38 provinsi. Wilayah Papua sudah dipisah menjadi Papua, Papua Tengah, Papua Pegunungan, Papua Selatan, Papua Barat, dan Papua Barat Daya.' },
  { term: 'Kepadatan per 1.000 km²', text: 'Jumlah titik panas dibagi luas provinsi, dikali 1.000. Angka ini membuat provinsi kecil dan besar bisa dibandingkan secara adil. Luas wilayah saat ini dihitung dari peta batas, sehingga bisa sedikit berbeda dari angka resmi BPS.' },
  { term: 'Perbandingan mingguan', text: '7 hari terakhir dibanding 7 hari sebelumnya. Riwayat harian disimpan setiap kali data diperbarui, sehingga perbandingan dengan tahun lalu juga bisa dilihat di halaman Tren.' },
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