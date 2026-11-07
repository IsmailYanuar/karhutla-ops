<script setup>
defineProps({ size: { type: Number, default: 32 }, light: { type: Boolean, default: false } })
</script>

<template>
  <svg :width="size" :height="size" viewBox="0 0 64 64" role="img" aria-label="Logo KarhutlaTracker">
    <path d="M8 27a25 25 0 0 1 48 0" fill="none" :stroke="light ? '#1a1e19' : '#edf2ee'" stroke-width="4" stroke-linecap="round" />
    <circle cx="56" cy="27" r="5" :fill="light ? '#1a1e19' : '#edf2ee'" />
    <path d="M32 20c2.6 8.6 12 12.8 12 23.4a12 12 0 0 1-24 0c0-6 3-10.2 6.2-12.8.2 4.6 2.2 7.4 5.2 8.2C29.4 32.6 29 26 32 20Z" :fill="light ? '#c2410c' : '#ff7a2f'" />
  </svg>
</template>