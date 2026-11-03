import { createRouter, createWebHistory } from 'vue-router'
import Home from '../pages/Home.vue'

const routes = [
  { path: '/', name: 'home', component: Home },
  { path: '/peta', name: 'dashboard', component: () => import('../pages/Dashboard.vue') },
  { path: '/tren', name: 'trends', component: () => import('../pages/Trends.vue') },
  { path: '/daerah', name: 'region', component: () => import('../pages/Region.vue') },
  { path: '/sekitar', name: 'nearby', component: () => import('../pages/Nearby.vue') },
  { path: '/tentang-data', name: 'about', component: () => import('../pages/About.vue') }, 
]

export default createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
})