import { ref, watch } from 'vue'

const KEY = 'karhutla-theme'
function initial() {
  try { return localStorage.getItem(KEY) === 'dark' ? 'dark' : 'light' } catch { return 'light' }
}

export const theme = ref(initial())

function apply(t) {
  document.documentElement.dataset.theme = t
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'light' ? '#f4f2ed' : '#0c1310')
}
apply(theme.value)

watch(theme, (t) => {
  const root = document.documentElement
  root.classList.add('theme-switching')
  apply(t)
  try { localStorage.setItem(KEY, t) } catch { }
  setTimeout(() => root.classList.remove('theme-switching'), 400)
})

export function toggleTheme() {
  theme.value = theme.value === 'light' ? 'dark' : 'light'
}

export function cssColor(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}