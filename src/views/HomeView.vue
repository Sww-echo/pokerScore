<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import QrScannerModal from "../components/QrScannerModal.vue";
import { useRoomStore } from "../stores/room";
import { extractRoomCodeFromInvitePayload } from "../utils/roomInvite";
import {
  generateDefaultNickname,
  normalizeNickname,
  normalizeRoomCode,
  normalizeRoomName,
  validateRoomCode,
} from "../utils/roomForm";

const router = useRouter();
const roomStore = useRoomStore();

const isJoinModalOpen = ref(false);
const isScannerOpen = ref(false);
const roomNameInput = ref("");
const roomCodeInput = ref("");
const nicknameInput = ref(roomStore.profile?.nickname ?? "");
const authMode = ref<"wechat" | "guest">(
  roomStore.profile?.authMode ?? "wechat",
);
const joinError = ref("");
const scannerError = ref("");
const isSubmitting = ref(false);
const fallbackNickname = ref(
  roomStore.profile?.nickname ?? generateDefaultNickname(),
);

const resolvedNicknameHint = computed(() =>
  nicknameInput.value.trim()
    ? normalizeNickname(nicknameInput.value)
    : fallbackNickname.value,
);

const roomNameHint = computed(() =>
  normalizeRoomName(roomNameInput.value, resolvedNicknameHint.value),
);

const normalizedRoomCode = computed(() => normalizeRoomCode(roomCodeInput.value));

const roomCodeHelperText = computed(() => {
  if (joinError.value) {
    return joinError.value;
  }

  if (normalizedRoomCode.value) {
    return `将进入房间 ${normalizedRoomCode.value}`;
  }

  return "支持输入 4 到 8 位字母或数字房间码";
});

function assignDefaultNickname() {
  fallbackNickname.value = generateDefaultNickname();
  nicknameInput.value = fallbackNickname.value;
}

function resolveNickname() {
  const nextNickname = normalizeNickname(
    nicknameInput.value.trim() || fallbackNickname.value,
  );

  nicknameInput.value = nextNickname;
  fallbackNickname.value = nextNickname;

  return nextNickname;
}

async function createRoom() {
  if (isSubmitting.value) return;

  const nickname = resolveNickname();
  const roomName = normalizeRoomName(roomNameInput.value, nickname);

  roomNameInput.value = roomName;

  isSubmitting.value = true;

  try {
    const roomCode = await roomStore.createRoom({
      nickname,
      authMode: authMode.value,
      roomName,
    });

    await router.push({
      name: "room",
      params: { roomCode },
    });
  } catch (error) {
    window.alert(error instanceof Error ? error.message : "创建房间失败");
  } finally {
    isSubmitting.value = false;
  }
}

function openJoinModal() {
  isJoinModalOpen.value = true;
  joinError.value = "";
}

function closeJoinModal() {
  isJoinModalOpen.value = false;
  joinError.value = "";
}

function openScanner() {
  isJoinModalOpen.value = false;
  isScannerOpen.value = true;
  scannerError.value = "";
}

function closeScanner() {
  isScannerOpen.value = false;
  scannerError.value = "";
}

function clearScannerError() {
  scannerError.value = "";
}

function normalizeCodeInput() {
  roomCodeInput.value = normalizeRoomCode(roomCodeInput.value);

  if (joinError.value) {
    joinError.value = validateRoomCode(roomCodeInput.value);
  }
}

async function submitJoin(roomCode: string) {
  if (isSubmitting.value) return;

  const nickname = resolveNickname();
  roomCodeInput.value = roomCode;
  joinError.value = "";

  isSubmitting.value = true;

  try {
    const joinedRoomCode = await roomStore.joinRoom({
      nickname,
      authMode: authMode.value,
      roomCode,
    });

    closeJoinModal();
    closeScanner();
    await router.push({
      name: "room",
      params: { roomCode: joinedRoomCode },
    });
  } finally {
    isSubmitting.value = false;
  }
}

async function joinRoom() {
  const validationMessage = validateRoomCode(roomCodeInput.value);

  if (validationMessage) {
    joinError.value = validationMessage;
    return;
  }

  const roomCode = normalizeRoomCode(roomCodeInput.value);

  try {
    await submitJoin(roomCode);
  } catch (error) {
    joinError.value = error instanceof Error ? error.message : "加入房间失败";
  }
}

async function handleScannedPayload(payload: string) {
  const roomCode = extractRoomCodeFromInvitePayload(payload);

  if (!roomCode) {
    scannerError.value = "未识别到有效房间码，请尝试粘贴邀请链接";
    return;
  }

  roomCodeInput.value = roomCode;
  scannerError.value = "";

  try {
    await submitJoin(roomCode);
  } catch (error) {
    scannerError.value = error instanceof Error ? error.message : "加入房间失败";
  }
}
</script>

<template>
  <div
    class="fixed inset-0 flex flex-col pb-safe h-[100dvh] bg-background-light font-display text-slate-900 antialiased overflow-hidden"
  >
    <header
      class="shrink-0 flex items-center justify-between p-4 pt-safe z-50 bg-transparent"
    >
      <div class="flex size-10 items-center justify-center">
        <button
          class="flex items-center justify-center rounded-full hover:bg-slate-200/50 transition-colors"
        >
          <span class="material-symbols-outlined text-slate-900 text-2xl"
            >menu</span
          >
        </button>
      </div>
      <div class="flex-1 text-center">
        <span
          class="text-xs font-black tracking-[0.2em] uppercase text-slate-400"
          >PokerScore H5</span
        >
      </div>
      <div class="flex size-10 items-center justify-end">
        <button
          class="flex items-center justify-center size-8 rounded-full bg-primary/20 text-primary border border-primary/30 shadow-sm"
        >
          <span class="material-symbols-outlined text-lg">account_circle</span>
        </button>
      </div>
    </header>

    <main
      class="flex-1 overflow-y-auto flex flex-col items-center justify-center px-6 py-6 max-w-md mx-auto w-full"
    >
      <div class="mb-16 flex flex-col items-center">
        <div class="relative mb-8">
          <div
            class="absolute -inset-4 rounded-full bg-primary/20 blur-xl"
          ></div>
          <div
            class="relative flex h-24 w-24 items-center justify-center rounded-[2rem] border-2 border-primary/30 bg-white shadow-xl shadow-primary/10"
          >
            <span
              class="material-symbols-outlined text-6xl text-primary drop-shadow-md"
              >style</span
            >
          </div>
        </div>
        <h1 class="text-slate-900 text-5xl font-black tracking-tight mb-3">
          PokerScore
        </h1>
        <div class="h-1.5 w-12 bg-primary rounded-full mb-5 shadow-sm"></div>
        <p class="text-slate-500 text-sm font-bold tracking-[0.3em] uppercase">
          尊享扑克计分
        </p>
      </div>

      <div class="w-full px-4 mb-8">
        <div class="rounded-[1.75rem] bg-white border border-slate-200 shadow-sm p-4">
          <div class="flex items-center justify-between gap-3 mb-3">
            <div>
              <p class="text-sm font-bold text-slate-900">本局信息</p>
              <p class="text-[11px] text-slate-500 font-medium">
                支持浏览器直接进入，昵称和房间名都可手动填写
              </p>
            </div>
            <button
              @click="assignDefaultNickname"
              class="shrink-0 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-[11px] font-bold text-slate-900"
            >
              随机昵称
            </button>
          </div>

          <div class="space-y-4">
            <div>
              <div class="relative group">
                <span
                  class="material-symbols-outlined text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 group-focus-within:text-primary transition-colors"
                  >badge</span
                >
                <input
                  v-model.trim="nicknameInput"
                  class="w-full rounded-xl border border-slate-200 bg-slate-50 py-4 pl-12 pr-4 text-slate-900 font-bold outline-none transition-colors focus:border-primary focus:bg-white placeholder:text-slate-300"
                  placeholder="请输入你的昵称"
                  type="text"
                  maxlength="12"
                />
              </div>
              <p class="mt-2 text-[11px] font-medium text-slate-500">
                留空将使用默认昵称「{{ resolvedNicknameHint }}」
              </p>
            </div>

            <div class="border-t border-slate-100 pt-4">
              <div class="flex items-center justify-between gap-3 mb-3">
                <div>
                  <p class="text-sm font-bold text-slate-900">创建房间名称</p>
                  <p class="text-[11px] text-slate-500 font-medium">
                    仅创建房间时生效，不填会自动补全
                  </p>
                </div>
                <span
                  class="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-bold text-slate-500"
                  >可选</span
                >
              </div>

              <div class="relative group">
                <span
                  class="material-symbols-outlined text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 group-focus-within:text-primary transition-colors"
                  >meeting_room</span
                >
                <input
                  v-model.trim="roomNameInput"
                  class="w-full rounded-xl border border-slate-200 bg-slate-50 py-4 pl-12 pr-4 text-slate-900 font-bold outline-none transition-colors focus:border-primary focus:bg-white placeholder:text-slate-300"
                  placeholder="例如：周末德州局"
                  type="text"
                  maxlength="18"
                  @keyup.enter="createRoom"
                />
              </div>
              <p class="mt-2 text-[11px] font-medium text-slate-500">
                默认将创建「{{ roomNameHint }}」
              </p>
            </div>
          </div>
        </div>
      </div>

      <div class="w-full space-y-4 px-4">
        <button
          @click="createRoom"
          :disabled="isSubmitting"
          class="w-full h-[3.5rem] bg-primary text-slate-900 font-black tracking-widest text-lg rounded-2xl shadow-[0_8px_25px_rgba(249,212,6,0.3)] active:scale-95 transition-transform flex items-center justify-center"
          :class="{ 'opacity-60 pointer-events-none': isSubmitting }"
        >
          {{ isSubmitting ? "提交中..." : "创建房间" }}
        </button>
        <div class="grid grid-cols-2 gap-3">
          <button
            @click="openScanner"
            class="h-[3.5rem] bg-slate-900 text-white font-bold text-base rounded-2xl shadow-sm active:scale-95 transition-transform flex items-center justify-center gap-2"
          >
            <span class="material-symbols-outlined text-[20px]">
              qr_code_scanner
            </span>
            扫码加入
          </button>
          <button
            @click="openJoinModal"
            class="h-[3.5rem] bg-white text-primary font-bold text-base rounded-2xl border-2 border-primary/20 shadow-sm active:scale-95 transition-transform flex items-center justify-center gap-2 hover:bg-slate-50"
          >
            <span class="material-symbols-outlined text-[20px]">
              keyboard
            </span>
            输入房间码
          </button>
        </div>
        <p class="px-1 text-center text-[11px] font-medium text-slate-500">
          牌友可通过邀请链接直接打开房间，也可扫码识别二维码进入
        </p>
      </div>
    </main>

    <footer
      class="shrink-0 px-6 pb-12 pt-4 relative z-10 w-full max-w-sm mx-auto"
    >
      <div class="flex flex-col items-center space-y-6 w-full">
        <div class="flex items-center w-full gap-4">
          <div
            class="h-[1px] flex-1 bg-gradient-to-r from-transparent to-slate-200"
          ></div>
          <span
            class="text-slate-400 text-[10px] font-black tracking-widest uppercase opacity-80"
            >登录方式</span
          >
          <div
            class="h-[1px] flex-1 bg-gradient-to-l from-transparent to-slate-200"
          ></div>
        </div>

        <div class="flex gap-10">
          <button
            @click="authMode = 'wechat'"
            class="flex flex-col items-center gap-2 group outline-none"
          >
            <div
              class="flex size-14 items-center justify-center rounded-2xl bg-white shadow-sm border transition-all"
              :class="
                authMode === 'wechat'
                  ? 'border-primary ring-2 ring-primary/20 scale-105'
                  : 'border-slate-100 group-hover:border-primary/50'
              "
            >
              <span class="material-symbols-outlined text-[#07C160] text-3xl"
                >chat_bubble</span
              >
            </div>
            <span
              class="text-xs font-bold tracking-wide"
              :class="
                authMode === 'wechat' ? 'text-slate-900' : 'text-slate-400'
              "
              >微信登录</span
            >
          </button>
          <button
            @click="authMode = 'guest'"
            class="flex flex-col items-center gap-2 group outline-none"
          >
            <div
              class="flex size-14 items-center justify-center rounded-2xl bg-white shadow-sm border transition-all"
              :class="
                authMode === 'guest'
                  ? 'border-primary ring-2 ring-primary/20 scale-105'
                  : 'border-slate-100 group-hover:border-primary/50'
              "
            >
              <span
                class="material-symbols-outlined text-slate-400 group-hover:text-slate-600 text-3xl"
                >person</span
              >
            </div>
            <span
              class="text-xs font-bold tracking-wide"
              :class="
                authMode === 'guest' ? 'text-slate-900' : 'text-slate-400'
              "
              >游客登录</span
            >
          </button>
        </div>
      </div>
    </footer>

    <Transition name="fade">
      <div
        v-if="isJoinModalOpen"
        class="fixed inset-0 z-[100] flex items-center justify-center p-4"
      >
        <div
          class="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
          @click.self="closeJoinModal"
        ></div>
        <div
          class="relative w-full max-w-sm rounded-[2rem] bg-white p-6 shadow-2xl slide-up border border-slate-100"
        >
          <button
            @click="closeJoinModal"
            class="absolute right-4 top-4 flex size-8 items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 transition-colors"
          >
            <span class="material-symbols-outlined text-slate-500 text-[18px]"
              >close</span
            >
          </button>

          <div class="mb-6 flex flex-col items-center mt-2">
            <div
              class="flex size-14 items-center justify-center rounded-2xl bg-primary/10 mb-4 shadow-inner border border-primary/20"
            >
              <span class="material-symbols-outlined text-primary text-[28px]">
                meeting_room
              </span>
            </div>
            <h3 class="text-xl font-bold text-slate-900">加入已有牌桌</h3>
            <p class="mt-1 text-sm text-slate-500 font-medium text-center">
              请输入房主分享的房间码，后续也可接扫码填充
            </p>
          </div>

          <div class="space-y-4 mb-8">
            <div class="relative group">
              <span
                class="material-symbols-outlined text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 group-focus-within:text-primary transition-colors"
                >tag</span
              >
              <input
                v-model="roomCodeInput"
                class="w-full rounded-xl border py-4 pl-12 pr-4 text-slate-900 font-black tracking-widest outline-none transition-colors focus:bg-white placeholder:text-slate-300 placeholder:font-medium placeholder:tracking-normal"
                :class="
                  joinError
                    ? 'border-rose-300 bg-rose-50 focus:border-rose-400'
                    : 'border-slate-200 bg-slate-50 focus:border-primary'
                "
                placeholder="请输入房间码"
                type="text"
                maxlength="8"
                autocomplete="off"
                @input="normalizeCodeInput"
                @keyup.enter="joinRoom"
              />
            </div>

            <p
              class="text-xs font-medium"
              :class="joinError ? 'text-rose-500' : 'text-slate-500'"
            >
              {{ roomCodeHelperText }}
            </p>

            <button
              @click="openScanner"
              class="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold text-slate-900 transition-colors hover:bg-slate-100"
            >
              <span class="material-symbols-outlined text-[18px]">
                qr_code_scanner
              </span>
              改用扫码识别
            </button>
          </div>

            <button
              @click="joinRoom"
              :disabled="isSubmitting"
              class="w-full rounded-xl bg-primary py-4 text-slate-900 font-black text-lg active:scale-[0.98] transition-transform shadow-[0_4px_20px_rgba(249,212,6,0.2)] flex items-center justify-center gap-2"
              :class="{ 'opacity-60 pointer-events-none': isSubmitting }"
            >
            <span>{{ isSubmitting ? "进入中..." : "进入房间" }}</span>
            <span class="material-symbols-outlined text-[18px]"
              >arrow_forward</span
            >
          </button>
        </div>
      </div>
    </Transition>

    <QrScannerModal
      :open="isScannerOpen"
      :error-text="scannerError"
      @clear-error="clearScannerError"
      @close="closeScanner"
      @detect="handleScannedPayload"
    />
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-up {
  animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

@keyframes slideUp {
  from {
    transform: translateY(20px) scale(0.95);
    opacity: 0;
  }
  to {
    transform: translateY(0) scale(1);
    opacity: 1;
  }
}
</style>
