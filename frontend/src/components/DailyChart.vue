<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { Chart, LineController, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend, Filler } from 'chart.js'

Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend, Filler)

const props = defineProps({ labels: Array, series: Array, height: { type: Number, default: 300 } })
const canvas = ref(null)
let chart = null

function datasets() {
  return props.series.map((s, i) => ({
    label: s.label,
    data: s.values,
    borderColor: s.color,
    backgroundColor: i === 0 ? s.color + '1f' : 'transparent',
    fill: i === 0,
    borderWidth: 2,
    borderDash: s.dashed ? [5, 4] : [],
    pointRadius: 0,
    pointHoverRadius: 4,
    tension: 0.25,
    spanGaps: true,
  }))
}

function render() {
  chart?.destroy()
  chart = new Chart(canvas.value, {
    type: 'line',
    data: { labels: props.labels, datasets: datasets() },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: props.series.length > 1, position: 'top', align: 'start', labels: { boxWidth: 12, boxHeight: 2, color: '#9fb0a6' } },
        tooltip: {
          callbacks: { label: (c) => ` ${c.dataset.label}: ${c.parsed.y == null ? 'tidak ada data' : c.parsed.y.toLocaleString('id-ID')} titik` },
        },
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#9fb0a6', maxRotation: 0, autoSkipPadding: 16 } },
        y: { beginAtZero: true, grid: { color: 'rgba(232,240,234,0.08)' }, border: { display: false }, ticks: { color: '#9fb0a6', callback: (v) => v.toLocaleString('id-ID') } },
      },
    },
  })
}

onMounted(render)
watch(() => [props.labels, props.series], render, { deep: true })
onBeforeUnmount(() => chart?.destroy())

</script>

<template>
  <div :style="{ height: height + 'px' }" class="relative">
    <canvas ref="canvas" role="img" :aria-label="series.map((s) => s.label).join(', ')"></canvas>
  </div>
</template>