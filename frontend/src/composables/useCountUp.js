import { ref, watch, onBeforeUnmount } from 'vue'

export function useCountUp(source, duration = 1400) {
  const shown = ref(0)
  let frame = null
  const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  function run(target) {
    cancelAnimationFrame(frame)
    if (typeof target !== 'number' || reduce) { shown.value = target; return }
    const from = shown.value
    const start = performance.now()
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 4)
      shown.value = Math.round(from + (target - from) * eased)
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
  }

  watch(source, run, { immediate: true })
  onBeforeUnmount(() => cancelAnimationFrame(frame))
  return shown
}