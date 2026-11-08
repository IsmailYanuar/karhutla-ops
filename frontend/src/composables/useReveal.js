import { onMounted, onBeforeUnmount } from 'vue'

const SELECTOR = '.glass, .glass-sm, [data-reveal]'

export function useReveal(rootRef) {
  let io, mo
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  function prepare(el) {
    if (el.dataset.revealed || el.closest('header, nav, [data-no-reveal]')) return
    el.dataset.revealed = '1'
    const siblings = [...(el.parentElement?.children ?? [])].filter((s) => s.matches(SELECTOR))
    el.style.setProperty('--reveal-delay', `${Math.min(siblings.indexOf(el), 5) * 70}ms`)
    el.classList.add('reveal')
    io.observe(el)
  }

  function scan(node) {
    if (!(node instanceof Element)) return
    if (node.matches(SELECTOR)) prepare(node)
    node.querySelectorAll(SELECTOR).forEach(prepare)
  }

  onMounted(() => {
    if (reduce || !('IntersectionObserver' in window)) return
    io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue
        e.target.classList.add('reveal-in')
        io.unobserve(e.target)
        setTimeout(() => e.target.classList.remove('reveal', 'reveal-in'), 1200)
      }
    }, { rootMargin: '0px 0px -40px 0px', threshold: 0.05 })
    scan(rootRef.value)
    mo = new MutationObserver((list) => list.forEach((m) => m.addedNodes.forEach(scan)))
    mo.observe(rootRef.value, { childList: true, subtree: true })
  })

  onBeforeUnmount(() => { io?.disconnect(); mo?.disconnect() })
}