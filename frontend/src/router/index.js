import { createRouter, createWebHistory } from 'vue-router'
import Home from '../pages/Home.vue'

const routes = [
  { path: '/', name: 'home', component: Home, meta: { title: 'Titik api Indonesia, terpantau dari orbit' } },
  { path: '/peta', name: 'dashboard', component: () => import('../pages/Dashboard.vue'), meta: { title: 'Peta Titik Panas' } },
  { path: '/tren', name: 'trends', component: () => import('../pages/Trends.vue'), meta: { title: 'Tren Titik Panas' } },
  { path: '/daerah', name: 'region', component: () => import('../pages/Region.vue'), meta: { title: 'Profil Daerah' } },
  { path: '/sekitar', name: 'nearby', component: () => import('../pages/Nearby.vue'), meta: { title: 'Cek Sekitar' } },
  { path: '/siaga', name: 'siaga', component: () => import('../pages/Siaga.vue'), meta: { title: 'Siaga Asap' } },
  { path: '/tentang-data', name: 'about', component: () => import('../pages/About.vue'), meta: { title: 'Tentang Data' } },
  { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('../pages/NotFound.vue'), meta: { title: 'Halaman tidak ditemukan' } },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: (to, from) => (to.hash ? { el: to.hash, top: 90 } : to.path === from.path ? false : { top: 0 }),
})

router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title} · KarhutlaTracker` : 'KarhutlaTracker'
})

export default router