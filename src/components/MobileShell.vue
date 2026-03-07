<script setup lang="ts">
import { computed, useSlots } from 'vue'
import BottomNavBar from './BottomNavBar.vue'

type NavTab = 'home' | 'game' | 'history' | 'me'

defineProps<{
  title: string
  subtitle?: string
  activeTab: NavTab
}>()

const slots = useSlots()
const hasDock = computed(() => Boolean(slots.dock))
</script>

<template>
  <main class="screen-page">
    <section class="screen-device">
      <header class="screen-header">
        <div class="screen-header__slot">
          <slot name="leftAction">
            <div class="icon-circle icon-circle--empty" aria-hidden="true"></div>
          </slot>
        </div>

        <div class="screen-header__copy">
          <p v-if="subtitle" class="screen-header__subtitle">{{ subtitle }}</p>
          <h1 class="screen-header__title">{{ title }}</h1>
        </div>

        <div class="screen-header__slot screen-header__slot--end">
          <slot name="rightAction">
            <div class="icon-circle icon-circle--empty" aria-hidden="true"></div>
          </slot>
        </div>
      </header>

      <div class="screen-content" :class="{ 'screen-content--with-dock': hasDock }">
        <slot />
      </div>

      <div v-if="hasDock" class="screen-dock">
        <slot name="dock" />
      </div>

      <BottomNavBar :active="activeTab" />
    </section>
  </main>
</template>
