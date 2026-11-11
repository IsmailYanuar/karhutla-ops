<script setup>
import { useRoute } from 'vue-router'

const route = useRoute()
const links = [
  { to: '/peta', label: 'Peta Titik Panas' },
  { to: '/tren', label: 'Tren' },
  { to: '/daerah', label: 'Profil Daerah' },
  { to: '/sekitar', label: 'Cek Sekitar' },
  { to: '/siaga', label: 'Siaga Asap' },
]
</script>

<template>
  <section class="page grid min-h-[60vh] place-items-center text-center">
    <div class="glass max-w-xl p-8 md:p-10">
      <p class="font-display text-6xl font-extrabold text-flare">404</p>
      <h1 class="mt-3 font-display text-3xl font-bold">Halaman tidak ditemukan</h1>
      <p class="mt-3 text-mist">
        Alamat <code class="rounded bg-veil/10 px-1.5 py-0.5 text-sm text-paper">{{ route.fullPath }}</code> tidak ada di KarhutlaTracker.
        Mungkin tautannya salah ketik atau halamannya sudah dipindah.
      </p>
      <RouterLink to="/" class="btn-ember mt-6">Kembali ke Beranda</RouterLink>
      <div class="mt-6 flex flex-wrap justify-center gap-2">
        <RouterLink v-for="l in links" :key="l.to" :to="l.to" class="btn-ghost !px-4 !py-2 text-sm">{{ l.label }}</RouterLink>
      </div>
    </div>
  </section>
</template>