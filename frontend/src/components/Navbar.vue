<script setup>
import { ref } from 'vue'
import Logo from './Logo.vue'

const open = ref(false)
const links = [
  { to: '/', label: 'Beranda' },
  { to: '/peta', label: 'Peta' },
  { to: '/tren', label: 'Tren' },
  { to: '/daerah', label: 'Profil Daerah' },
  { to: '/sekitar', label: 'Cek Sekitar' },
  { to: '/tentang-data', label: 'Tentang Data' },
]
</script>

<template>
  <header class="sticky top-0 z-[1000] px-3 pt-3">
    <nav class="glass mx-auto flex max-w-6xl items-center justify-between !rounded-full py-2 pl-4 pr-2">
      <RouterLink to="/" class="flex items-center gap-2" @click="open = false">
        <Logo :size="32" />
        <span class="font-display text-lg font-extrabold tracking-tight">Karhutla<span class="text-ember-400">Tracker</span></span>
      </RouterLink>

      <ul class="hidden items-center gap-1 lg:flex">
        <li v-for="l in links" :key="l.to">
          <RouterLink
            :to="l.to"
            class="rounded-full px-3.5 py-2 text-sm font-medium text-mist transition hover:text-paper"
            :active-class="l.to === '/' ? '' : '!bg-white/10 !text-paper'"
            :exact-active-class="l.to === '/' ? '!bg-white/10 !text-paper' : ''"
          >{{ l.label }}</RouterLink>
        </li>
      </ul>

      <button class="grid h-10 w-10 place-items-center rounded-full hover:bg-white/10 lg:hidden" :aria-expanded="open" aria-label="Buka menu" @click="open = !open">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <path v-if="!open" d="M4 8h16M4 16h16" /><path v-else d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </nav>

    <Transition name="page">
      <ul v-if="open" class="glass mx-auto mt-2 flex max-w-6xl flex-col p-2 lg:hidden">
        <li v-for="l in links" :key="l.to">
          <RouterLink :to="l.to" class="block rounded-xl px-4 py-3 font-medium text-mist" active-class="" exact-active-class="!bg-white/10 !text-paper" @click="open = false">{{ l.label }}</RouterLink>
        </li>
      </ul>
    </Transition>
  </header>
</template>