<script setup>
import { computed } from 'vue'
import { useCountUp } from '../composables/useCountUp'

const props = defineProps({ label: String, value: [String, Number], note: String })
const shown = useCountUp(computed(() => props.value))
</script>

<template>
  <div class="glass p-5 md:p-6">
    <p class="label">{{ label }}</p>
    <p class="mt-2 font-display text-4xl font-extrabold tabular-nums tracking-tight">
      {{ typeof shown === 'number' ? shown.toLocaleString('id-ID') : shown }}
    </p>
    <p v-if="note" class="mt-1 text-sm text-mist">{{ note }}</p>
  </div>
</template>