import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { router } from './router'
import { useRoomStore } from './stores/room'
import './styles.css'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
useRoomStore(pinia).hydrate()
app.use(router)
app.mount('#app')
