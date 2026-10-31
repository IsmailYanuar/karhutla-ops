<script setup>
import { ref } from 'vue'
const open = ref(false)
const links = [
  { to: '/', label: 'Beranda' },
  { to: '/peta', label: 'Peta Titik Panas' },
  { to: '/tren', label: 'Tren' },
  { to: '/daerah', label: 'Profil Daerah' },
  { to: '/tentang-data', label: 'Tentang Data' },
]
</script>

<template>
  <header class="sticky top-0 z-[1000] border-b border-ash-200 bg-ash-50/90 backdrop-blur">
    <nav class="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
      <RouterLink to="/" class="flex items-center gap-2" @click="open = false">
        <span class="grid h-8 w-8 place-items-center rounded-md bg-ember-600 font-display text-lg font-extrabold text-white">K</span>
        <span class="font-display text-xl font-extrabold tracking-tight">Karhutla<span class="text-ember-600">Ops</span></span>
      </RouterLink>

      <button class="rounded-md p-2 md:hidden" :aria-expanded="open" aria-label="Buka menu" @click="open = !open">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
      </button>

      <ul class="hidden gap-1 md:flex">
        <li v-for="l in links" :key="l.to">
          <RouterLink :to="l.to" class="rounded-md px-3 py-2 text-sm font-medium text-ash-700 hover:bg-ash-100" active-class="!bg-ember-50 !text-ember-700" :exact-active-class="l.to === '/' ? '!bg-ember-50 !text-ember-700' : ''">
            {{ l.label }}
          </RouterLink>
        </li>
      </ul>
    </nav>

    <ul v-if="open" class="flex flex-col border-t border-ash-200 px-4 py-2 md:hidden">
      <li v-for="l in links" :key="l.to">
        <RouterLink :to="l.to" class="block rounded-md px-3 py-2 font-medium" @click="open = false">{{ l.label }}</RouterLink>
      </li>
    </ul>
  </header>
</template>