<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'

const props = defineProps({ hotspots: { type: Array, default: () => [] } })
const wrap = ref(null)
const canvas = ref(null)

const BOUNDS = { west: 94.5, east: 141.5, north: 6.5, south: -11.2 }
const COLORS = { high: [255, 90, 31], nominal: [255, 166, 64], low: [142, 154, 146] }
const SWEEP_MS = 3200

let ctx, coast, dots, glowSprite, raf, ro
let w = 0, h = 0, dpr = 1, startAt = 0
let pulses = []
let embers = []
const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

function project(lng, lat) {
  const pad = 0.04
  const sx = (w * (1 - 2 * pad)) / (BOUNDS.east - BOUNDS.west)
  const sy = (h * (1 - 2 * pad)) / (BOUNDS.north - BOUNDS.south)
  const s = Math.min(sx, sy)
  const ox = (w - s * (BOUNDS.east - BOUNDS.west)) / 2
  const oy = (h - s * (BOUNDS.north - BOUNDS.south)) / 2
  return [ox + (lng - BOUNDS.west) * s, oy + (BOUNDS.north - lat) * s]
}

function makeGlow() {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  grad.addColorStop(0, 'rgba(255,200,140,0.95)')
  grad.addColorStop(0.25, 'rgba(255,110,40,0.55)')
  grad.addColorStop(1, 'rgba(255,90,31,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 64, 64)
  return c
}

let geo = null
async function loadCoast() {
  if (geo) return geo
  try {
    const res = await fetch('/data/batas-provinsi.geojson')
    geo = res.ok ? await res.json() : { features: [] }
  } catch { geo = { features: [] } }
  return geo
}

function drawCoast() {
  coast = document.createElement('canvas')
  coast.width = w * dpr
  coast.height = h * dpr
  const g = coast.getContext('2d')
  g.scale(dpr, dpr)
  g.strokeStyle = 'rgba(159,176,166,0.22)'
  g.fillStyle = 'rgba(159,176,166,0.035)'
  g.lineWidth = 0.7
  for (const f of geo?.features ?? []) {
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates
    for (const poly of polys) {
      g.beginPath()
      poly[0].forEach(([x, y], i) => {
        const [px, py] = project(x, y)
        i ? g.lineTo(px, py) : g.moveTo(px, py)
      })
      g.closePath()
      g.fill()
      g.stroke()
    }
  }
}

function prepareDots() {
  dots = props.hotspots
    .map((p) => { const [x, y] = project(p.lng, p.lat); return { x, y, c: p.confidence } })
    .sort((a, b) => a.x - b.x)
  // Titik berkepercayaan tinggi berdenyut pelan setelah sapuan selesai.
  const high = dots.filter((d) => d.c === 'high')
  pulses = high.filter((_, i) => i % Math.max(1, Math.round(high.length / 160)) === 0)
    .map((d) => ({ ...d, phase: Math.random() * Math.PI * 2, speed: 0.6 + Math.random() * 0.8 }))
  embers = Array.from({ length: Math.round(w / 28) }, () => newEmber(true))
}

function newEmber(anywhere) {
  return { x: Math.random() * w, y: anywhere ? Math.random() * h : h + 10, r: 0.6 + Math.random() * 1.6, v: 0.15 + Math.random() * 0.35, a: 0.15 + Math.random() * 0.45, drift: Math.random() * 0.6 - 0.3 }
}

function resize() {
  const rect = wrap.value.getBoundingClientRect()
  w = rect.width
  h = rect.height
  dpr = Math.min(window.devicePixelRatio || 1, 2)
  canvas.value.width = w * dpr
  canvas.value.height = h * dpr
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  drawCoast()
  prepareDots()
}

function frame(now) {
  const t = reduce ? 1 : Math.min(1, (now - startAt) / SWEEP_MS)
  const eased = 1 - Math.pow(1 - t, 3)
  const sweepX = eased * (w + 40) - 20

  ctx.clearRect(0, 0, w, h)
  ctx.drawImage(coast, 0, 0, w, h)

  ctx.globalCompositeOperation = 'lighter'
  for (const d of dots) {
    if (d.x > sweepX) break
    const [r, g, b] = COLORS[d.c]
    const fresh = Math.max(0, 1 - (sweepX - d.x) / 120) 
    ctx.fillStyle = `rgba(${r},${g},${b},${d.c === 'low' ? 0.35 : 0.55 + fresh * 0.45})`
    ctx.fillRect(d.x - 0.9, d.y - 0.9, 1.8 + fresh * 1.4, 1.8 + fresh * 1.4)
  }

  if (t >= 1) {
    for (const p of pulses) {
      const k = (Math.sin(now / 1000 * p.speed + p.phase) + 1) / 2
      const s = (6 + k * 14) * Math.min(1, w / 1000) 
      ctx.globalAlpha = 0.25 + k * 0.5
      ctx.drawImage(glowSprite, p.x - s / 2, p.y - s / 2, s, s)
    }
    ctx.globalAlpha = 1
  }
  ctx.globalCompositeOperation = 'source-over'

  if (t < 1) {
    const grad = ctx.createLinearGradient(sweepX - 90, 0, sweepX, 0)
    grad.addColorStop(0, 'rgba(255,194,122,0)')
    grad.addColorStop(1, 'rgba(255,194,122,0.22)')
    ctx.fillStyle = grad
    ctx.fillRect(sweepX - 90, 0, 90, h)
    ctx.fillStyle = 'rgba(255,214,170,0.75)'
    ctx.fillRect(sweepX, 0, 1, h)
  }

  // Bara kecil melayang naik
  if (!reduce) {
    for (const e of embers) {
      e.y -= e.v
      e.x += e.drift * 0.3
      if (e.y < -10) Object.assign(e, newEmber(false))
      ctx.fillStyle = `rgba(255,150,80,${e.a * Math.min(1, e.y / h + 0.2)})`
      ctx.beginPath()
      ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  if (!reduce || t < 1) raf = requestAnimationFrame(frame)
}

async function start() {
  await loadCoast()
  resize()
  startAt = performance.now()
  cancelAnimationFrame(raf)
  raf = requestAnimationFrame(frame)
}

onMounted(() => {
  ctx = canvas.value.getContext('2d')
  glowSprite = makeGlow()
  ro = new ResizeObserver(() => { if (geo) { resize(); if (reduce) frame(performance.now()) } })
  ro.observe(wrap.value)
  if (props.hotspots.length) start()
})

watch(() => props.hotspots, (v) => { if (v.length && ctx) start() })

onBeforeUnmount(() => { cancelAnimationFrame(raf); ro?.disconnect() })
</script>

<template>
  <div ref="wrap" class="relative h-full w-full">
    <canvas ref="canvas" class="absolute inset-0 h-full w-full" role="img" :aria-label="`Peta Indonesia dengan ${hotspots.length.toLocaleString('id-ID')} titik panas dari satelit dalam 7 hari terakhir`"></canvas>
  </div>
</template>