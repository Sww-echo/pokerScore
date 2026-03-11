<script setup lang="ts">
const props = defineProps<{
  open: boolean;
  roomCode: string;
  roomName: string;
  inviteLink: string;
  identityKey?: string;
  feedbackText?: string;
  canNativeShare: boolean;
}>();

const emit = defineEmits<{
  close: [];
  copyCode: [];
  copyIdentity: [];
  copyLink: [];
  share: [];
}>();
</script>

<template>
  <Transition name="fade">
    <div
      v-if="props.open"
      class="fixed inset-0 z-[110] grid place-items-center overflow-y-auto px-4 pt-[calc(env(safe-area-inset-top)+16px)] pb-[calc(env(safe-area-inset-bottom)+16px)]"
    >
      <div class="absolute inset-0 bg-slate-950/45 backdrop-blur-sm" @click="emit('close')"></div>

      <div
        class="relative flex h-[82dvh] max-h-[48rem] w-full max-w-md flex-col overflow-hidden rounded-[2rem] border border-slate-100 bg-white shadow-2xl"
      >
        <div class="shrink-0 px-6 pb-3 pt-4">
          <div class="flex items-start justify-between gap-4">
            <div>
              <p class="text-xs font-black uppercase tracking-[0.2em] text-primary">Invite Players</p>
              <h3 class="mt-1 text-xl font-black text-slate-900">邀请牌友入房</h3>
            </div>
            <button
              @click="emit('close')"
              class="flex size-8 items-center justify-center rounded-full bg-slate-100 transition-colors hover:bg-slate-200"
            >
              <span class="material-symbols-outlined text-[18px] text-slate-500">close</span>
            </button>
          </div>
        </div>

        <div
          class="min-h-0 flex-1 overflow-y-auto px-6 pb-[calc(env(safe-area-inset-bottom)+24px)] scrollbar-hide"
        >
          <div class="space-y-4">
            <div class="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
              <div class="flex items-center justify-between gap-3">
                <div>
                  <p class="text-lg font-black text-slate-900">{{ roomName }}</p>
                </div>
                <div
                  class="flex size-14 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10"
                >
                  <span class="material-symbols-outlined text-[28px] text-primary">groups</span>
                </div>
              </div>
            </div>

            <div class="rounded-[1.5rem] border border-slate-200 bg-white p-4">
              <p class="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">房间码</p>
              <div class="flex items-center gap-3">
                <div
                  class="flex h-14 flex-1 items-center rounded-xl border border-slate-200 bg-slate-50 px-4 text-xl font-black tracking-[0.25em] text-slate-900"
                >{{ roomCode }}</div>
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
              <p class="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">邀请链接</p>
              <div class="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p class="break-all text-xs font-medium leading-5 text-slate-600">{{ inviteLink }}</p>
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

            <div v-if="identityKey" class="rounded-[1.5rem] border border-slate-200 bg-white p-4">
              <p class="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">我的专属识别名</p>
              <p class="mt-2 text-sm font-medium leading-6 text-slate-500">换设备时，可用它找回记录和常用房间。</p>
              <div class="mt-3 flex items-center gap-3">
                <div
                  class="flex h-14 flex-1 items-center rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-black tracking-[0.18em] text-slate-900"
                >{{ identityKey }}</div>
                <button
                  @click="emit('copyIdentity')"
                  class="flex h-14 shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-900 transition-colors hover:bg-slate-50"
                >
                  <span class="material-symbols-outlined text-[18px]">content_copy</span>
                  复制
                </button>
              </div>
              <p class="mt-3 text-[11px] font-medium text-slate-500">它相当于你的 PokerScore 用户编号，建议妥善保存。</p>
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
