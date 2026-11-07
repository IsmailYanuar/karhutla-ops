<script setup>
import Logo from './Logo.vue'
</script>

<template>
  <footer class="mt-16 border-t border-line">
    <div class="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-mist sm:flex-row sm:items-center sm:justify-between">
      <div class="flex items-center gap-3">
        <Logo :size="28" />
        <p><span class="font-semibold text-paper">KarhutlaTracker</span>, dibuat tim KarhutlaOps untuk Web In Action MIA 2026</p>
      </div>
      <p>Data: NASA FIRMS, BIG, ISPU KLHK, Copernicus</p>
    </div>
  </footer>
</template>