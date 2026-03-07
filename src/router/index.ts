import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import RoomView from '../views/RoomView.vue'
import SettlementView from '../views/SettlementView.vue'
import HistoryView from '../views/HistoryView.vue'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView
    },
    {
      path: '/room/:roomCode',
      name: 'room',
      component: RoomView
    },
    {
      path: '/room/:roomCode/settlement',
      name: 'settlement',
      component: SettlementView
    },
    {
      path: '/room/:roomCode/history',
      name: 'history',
      component: HistoryView
    }
  ]
})
