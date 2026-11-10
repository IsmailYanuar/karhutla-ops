import { createApp } from 'vue'
import { inject } from '@vercel/analytics'
import './style.css'
import 'leaflet/dist/leaflet.css'
import App from './App.vue'
import router from './router'

inject()

createApp(App).use(router).mount('#app')