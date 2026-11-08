<script setup>
import { ref } from 'vue'
import Navbar from './components/Navbar.vue'
import Footer from './components/Footer.vue'
import { useReveal } from './composables/useReveal'

const main = ref(null)
useReveal(main)
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <Navbar />
    <main ref="main" class="flex-1">
      <RouterView v-slot="{ Component }">
        <Transition name="page" mode="out-in">
          <component :is="Component" />
        </Transition>
      </RouterView>
    </main>
    <Footer />
  </div>
</template>