<script setup>
defineProps({ label: String, value: [String, Number], note: String })
</script>

<template>
  <div class="rounded-lg border border-ash-200 bg-white p-5">
    <p class="text-xs font-semibold uppercase tracking-wider text-ash-500">{{ label }}</p>
    <p class="mt-2 font-display text-3xl font-extrabold tabular-nums">{{ typeof value === 'number' ? value.toLocaleString('id-ID') : value }}</p>
    <p v-if="note" class="mt-1 text-sm text-ash-500">{{ note }}</p>
  </div>
</template>