<script setup>
import { ref } from 'vue'
import Logo from './Logo.vue'
import { theme, toggleTheme } from '../composables/useTheme'

const open = ref(false)
const links = [
  { to: '/', label: 'Beranda' },
  { to: '/peta', label: 'Peta' },
  { to: '/tren', label: 'Tren' },
  { to: '/daerah', label: 'Profil Daerah' },
  { to: '/sekitar', label: 'Cek Sekitar' },
  { to: '/siaga', label: 'Siaga Asap' },
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

      <div class="flex items-center gap-1">
        <ul class="hidden items-center gap-0.5 xl:flex">
          <li v-for="l in links" :key="l.to">
            <RouterLink
              :to="l.to"
              class="rounded-full px-3 py-2 text-sm font-medium text-mist transition hover:text-paper"
              :active-class="l.to === '/' ? '' : '!bg-veil/10 !text-paper'"
              :exact-active-class="l.to === '/' ? '!bg-veil/10 !text-paper' : ''"
            >{{ l.label }}</RouterLink>
          </li>
        </ul>

        <button
          class="grid h-10 w-10 place-items-center rounded-full text-mist transition hover:bg-veil/10 hover:text-paper"
          :aria-label="theme === 'light' ? 'Ganti ke tema gelap' : 'Ganti ke tema terang'"
          :title="theme === 'light' ? 'Tema gelap' : 'Tema terang'"
          @click="toggleTheme"
        >
          <Transition name="spin" mode="out-in">
            <svg v-if="theme === 'light'" key="moon" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" /></svg>
            <svg v-else key="sun" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" /></svg>
          </Transition>
        </button>

        <button class="grid h-10 w-10 place-items-center rounded-full hover:bg-veil/10 xl:hidden" :aria-expanded="open" aria-label="Buka menu" @click="open = !open">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path v-if="!open" d="M4 8h16M4 16h16" /><path v-else d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
    </nav>

    <Transition name="drop">
      <ul v-if="open" class="glass mx-auto mt-2 flex max-w-6xl flex-col p-2 xl:hidden">
        <li v-for="(l, i) in links" :key="l.to" class="drop-item" :style="{ '--i': i }">
          <RouterLink :to="l.to" class="block rounded-xl px-4 py-3 font-medium text-mist" active-class="" exact-active-class="!bg-veil/10 !text-paper" @click="open = false">{{ l.label }}</RouterLink>
        </li>
      </ul>
    </Transition>
  </header>
</template>

<style scoped>
.spin-enter-active, .spin-leave-active { transition: transform 0.3s ease, opacity 0.3s ease; }
.spin-enter-from { transform: rotate(-90deg) scale(0.6); opacity: 0; }
.spin-leave-to { transform: rotate(90deg) scale(0.6); opacity: 0; }

.drop-enter-active, .drop-leave-active { transition: opacity 0.2s ease, transform 0.2s ease; }
.drop-enter-from, .drop-leave-to { opacity: 0; transform: translateY(-6px); }
.drop-enter-active .drop-item { animation: item-in 0.35s cubic-bezier(0.2, 0.8, 0.2, 1) both; animation-delay: calc(var(--i) * 35ms); }
@keyframes item-in { from { opacity: 0; transform: translateX(-8px); } }
</style>