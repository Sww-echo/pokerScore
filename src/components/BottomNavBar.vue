<script setup lang="ts">
import { computed } from 'vue'
import { useRoomStore } from '../stores/room'

type NavTab = 'home' | 'game' | 'history' | 'me'

defineProps<{
  active: NavTab
}>()

const roomStore = useRoomStore()

const roomCode = computed(() => roomStore.room?.code ?? '')
const roomRoute = computed(() =>
  roomCode.value ? { name: 'room' as const, params: { roomCode: roomCode.value } } : null
)
const historyRoute = computed(() =>
  roomCode.value ? { name: 'history' as const, params: { roomCode: roomCode.value } } : null
)
</script>

<template>
  <nav class="bottom-nav" aria-label="主导航">
    <div class="bottom-nav__grid">
      <RouterLink class="bottom-nav__item" :class="{ 'bottom-nav__item--active': active === 'home' }" to="/">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M4.5 10.5L12 4l7.5 6.5V19a1 1 0 0 1-1 1h-4.5v-5h-4v5H5.5a1 1 0 0 1-1-1v-8.5Z"
            fill="none"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="1.7"
          />
        </svg>
        <span>主页</span>
      </RouterLink>

      <RouterLink
        v-if="roomRoute"
        class="bottom-nav__item"
        :class="{ 'bottom-nav__item--active': active === 'game' }"
        :to="roomRoute"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M6 7.5h12M6 12h12M6 16.5h8"
            fill="none"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-width="1.7"
          />
          <circle cx="18.2" cy="16.5" r="2.5" fill="none" stroke="currentColor" stroke-width="1.7" />
        </svg>
        <span>游戏</span>
      </RouterLink>
      <div v-else class="bottom-nav__item bottom-nav__item--disabled">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M6 7.5h12M6 12h12M6 16.5h8"
            fill="none"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-width="1.7"
          />
          <circle cx="18.2" cy="16.5" r="2.5" fill="none" stroke="currentColor" stroke-width="1.7" />
        </svg>
        <span>游戏</span>
      </div>

      <RouterLink
        v-if="historyRoute"
        class="bottom-nav__item"
        :class="{ 'bottom-nav__item--active': active === 'history' }"
        :to="historyRoute"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M12 5.5a6.5 6.5 0 1 1-6.5 6.5"
            fill="none"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-width="1.9"
          />
          <path
            d="M8.5 3.8V7h3.2"
            fill="none"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="1.9"
          />
        </svg>
        <span>记录</span>
      </RouterLink>
      <div v-else class="bottom-nav__item bottom-nav__item--disabled">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M12 5.5a6.5 6.5 0 1 1-6.5 6.5"
            fill="none"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-width="1.9"
          />
          <path
            d="M8.5 3.8V7h3.2"
            fill="none"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="1.9"
          />
        </svg>
        <span>记录</span>
      </div>

      <div class="bottom-nav__item bottom-nav__item--disabled" :class="{ 'bottom-nav__item--active': active === 'me' }">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="8.4" r="3.1" fill="none" stroke="currentColor" stroke-width="1.7" />
          <path
            d="M6.2 18.2c1.3-2.4 3.4-3.6 5.8-3.6s4.5 1.2 5.8 3.6"
            fill="none"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-width="1.7"
          />
        </svg>
        <span>我的</span>
      </div>
    </div>

    <div class="bottom-nav__indicator" aria-hidden="true"></div>
  </nav>
</template>
