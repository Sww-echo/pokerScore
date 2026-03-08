<script setup lang="ts">
const props = defineProps<{
  open: boolean
  roomCode: string
  roomName: string
  inviteLink: string
  feedbackText?: string
  canNativeShare: boolean
}>()

const emit = defineEmits<{
  close: []
  copyCode: []
  copyLink: []
  share: []
}>()
</script>

<template>
  <Transition name="fade">
    <div
      v-if="props.open"
      class="fixed inset-0 z-[110] flex items-end justify-center p-4"
    >
      <div
        class="absolute inset-0 bg-slate-950/45 backdrop-blur-sm"
        @click="emit('close')"
      ></div>

      <div
        class="relative w-full max-w-md overflow-hidden rounded-[2rem] border border-slate-100 bg-white shadow-2xl"
      >
        <div class="px-6 pb-6 pt-5">
          <div class="mb-5 flex items-start justify-between gap-4">
            <div>
              <p class="text-xs font-black uppercase tracking-[0.2em] text-primary">
                Invite Players
              </p>
              <h3 class="mt-1 text-xl font-black text-slate-900">邀请牌友入房</h3>
              <p class="mt-1 text-sm font-medium text-slate-500">
                分享房间码或邀请链接，对方可手动输入或扫码进入
              </p>
            </div>
            <button
              @click="emit('close')"
              class="flex size-8 items-center justify-center rounded-full bg-slate-100 transition-colors hover:bg-slate-200"
            >
              <span class="material-symbols-outlined text-[18px] text-slate-500">
                close
              </span>
            </button>
          </div>

          <div class="space-y-4">
            <div class="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
              <p class="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                当前牌局
              </p>
              <div class="mt-2 flex items-end justify-between gap-3">
                <div>
                  <p class="text-lg font-black text-slate-900">{{ roomName }}</p>
                  <p class="mt-1 text-xs font-medium text-slate-500">
                    房间码：{{ roomCode }}
                  </p>
                </div>
                <div
                  class="flex size-14 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10"
                >
                  <span class="material-symbols-outlined text-[28px] text-primary">
                    groups
                  </span>
                </div>
              </div>
            </div>

            <div class="rounded-[1.5rem] border border-slate-200 bg-white p-4">
              <p class="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                房间码
              </p>
              <div class="flex items-center gap-3">
                <div
                  class="flex h-14 flex-1 items-center rounded-xl border border-slate-200 bg-slate-50 px-4 text-xl font-black tracking-[0.25em] text-slate-900"
                >
                  {{ roomCode }}
                </div>
                <button
                  @click="emit('copyCode')"
                  class="flex h-14 shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-900 transition-colors hover:bg-slate-50"
                >
                  <span class="material-symbols-outlined text-[18px]">content_copy</span>
                  复制
                </button>
              </div>
            </div>

            <div class="rounded-[1.5rem] border border-slate-200 bg-white p-4">
              <p class="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                邀请链接
              </p>
              <div class="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p class="break-all text-xs font-medium leading-5 text-slate-600">
                  {{ inviteLink }}
                </p>
              </div>
              <div class="mt-3 grid grid-cols-2 gap-3">
                <button
                  @click="emit('copyLink')"
                  class="flex h-12 items-center justify-center gap-2 rounded-xl bg-slate-900 text-sm font-bold text-white transition-transform active:scale-[0.98]"
                >
                  <span class="material-symbols-outlined text-[18px]">link</span>
                  复制链接
                </button>
                <button
                  @click="emit('share')"
                  :disabled="!canNativeShare"
                  class="flex h-12 items-center justify-center gap-2 rounded-xl text-sm font-bold transition-transform active:scale-[0.98]"
                  :class="
                    canNativeShare
                      ? 'bg-primary text-slate-900'
                      : 'bg-slate-200 text-slate-400'
                  "
                >
                  <span class="material-symbols-outlined text-[18px]">ios_share</span>
                  系统分享
                </button>
              </div>
            </div>

            <p
              class="text-center text-xs font-medium"
              :class="feedbackText ? 'text-primary' : 'text-slate-500'"
            >
              {{
                feedbackText ||
                '如需二维码，可将邀请链接通过浏览器或微信的分享能力生成二维码后发给牌友'
              }}
            </p>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
