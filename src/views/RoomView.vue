<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import InviteRoomSheet from "../components/InviteRoomSheet.vue";
import PlayerCard from "../components/PlayerCard.vue";
import TransferPanel from "../components/TransferPanel.vue";
import TransferTimeline from "../components/TransferTimeline.vue";
import { useRoomStore } from "../stores/room";
import { buildRoomInviteLink } from "../utils/roomInvite";
import { formatIdentityKey, formatScore, shortCode } from "../utils/format";
import type { TransferDraft, TransferMode } from "../types";

const route = useRoute();
const router = useRouter();
const roomStore = useRoomStore();

const transferOpen = ref(false);
const transferMode = ref<TransferMode>("multi");
const activeRecipientId = ref<string | null>(null);
const copiedText = ref("");
const inviteSheetOpen = ref(false);
const inviteFeedback = ref("");
const isSubmittingTransfer = ref(false);
const isSettling = ref(false);
const identityNoticeOpen = ref(false);

const roomCode = computed(() => shortCode(String(route.params.roomCode ?? "")));
const room = computed(() => roomStore.room);
const currentUser = computed(() => roomStore.currentUser);
const playerCount = computed(() => room.value?.members.length ?? 0);
const onlineCount = computed(
  () => room.value?.members.filter((member) => member.isOnline).length ?? 0
);
const isSettled = computed(() => room.value?.status === "settled");
const totalTransfers = computed(() => room.value?.transfers.length ?? 0);
const roomStatusLabel = computed(() =>
  room.value?.status === "active" ? "进行中牌局" : "已结算牌局"
);
const leadingMember = computed(() => {
  const members = room.value?.members ?? [];
  return (
    [...members].sort((left, right) => right.score - left.score)[0] ?? null
  );
});
const currentUserScoreLabel = computed(() =>
  currentUser.value ? formatScore(currentUser.value.score) : "--"
);
const identityKey = computed(() => formatIdentityKey(roomStore.profile?.id));
const inviteLink = computed(
  () => roomStore.inviteLink || buildRoomInviteLink(roomCode.value)
);
const canNativeShare = computed(
  () =>
    typeof navigator !== "undefined" && typeof navigator.share === "function"
);

let copiedTextTimer: number | null = null;
let inviteFeedbackTimer: number | null = null;
let roomRefreshTimer: number | null = null;
const IDENTITY_TIP_PENDING_KEY = "poker-score-identity-tip-pending";
const IDENTITY_TIP_DISMISSED_KEY = "poker-score-identity-tip-dismissed";

onMounted(() => {
  void loadRoomPage();
  roomRefreshTimer = window.setInterval(() => {
    void syncRoomSilently();
  }, 15000);
});

onBeforeUnmount(() => {
  if (copiedTextTimer !== null) {
    window.clearTimeout(copiedTextTimer);
  }

  if (inviteFeedbackTimer !== null) {
    window.clearTimeout(inviteFeedbackTimer);
  }

  if (roomRefreshTimer !== null) {
    window.clearInterval(roomRefreshTimer);
  }

  roomStore.disconnectRoomRealtime(roomCode.value);
});

async function loadRoomPage() {
  try {
    if (!room.value || room.value.code !== roomCode.value) {
      await roomStore.joinRoom({
        nickname: roomStore.profile?.nickname ?? "新牌友",
        authMode: roomStore.profile?.authMode ?? "guest",
        roomCode: roomCode.value,
      });
    } else {
      await roomStore.fetchRoom(roomCode.value);
    }

    if (roomStore.room?.status === "settled") {
      await roomStore.fetchCurrentSettlement(roomCode.value).catch(() => null);
    }
    await roomStore.refreshInviteLink(roomCode.value).catch(() => "");
    await roomStore.connectRoomRealtime(roomCode.value).catch(() => null);
    openIdentityNoticeIfNeeded();
  } catch {
    await router.replace({ name: "home" });
  }
}

async function syncRoomSilently() {
  if (!roomCode.value) {
    return;
  }

  try {
    await roomStore.fetchRoom(roomCode.value);

    if (roomStore.room?.status === "settled") {
      await roomStore.fetchCurrentSettlement(roomCode.value).catch(() => null);
    }
  } catch {
    // 定时补拉失败时保持静默，避免打断当前操作。
  }
}

function openTransfer(mode: TransferMode, memberId: string | null = null) {
  if (isSettled.value) {
    window.alert("当前牌局已经结算，请先查看账单或重新开局后再转分。");
    return;
  }

  transferMode.value = mode;
  activeRecipientId.value = memberId;
  transferOpen.value = true;
}

function closeTransfer() {
  transferOpen.value = false;
}

function openIdentityNoticeIfNeeded() {
  const shouldOpen =
    window.sessionStorage.getItem(IDENTITY_TIP_PENDING_KEY) === "1" &&
    window.localStorage.getItem(IDENTITY_TIP_DISMISSED_KEY) !== "1" &&
    Boolean(identityKey.value);

  if (!shouldOpen) {
    return;
  }

  identityNoticeOpen.value = true;
  window.sessionStorage.removeItem(IDENTITY_TIP_PENDING_KEY);
}

function closeIdentityNotice() {
  identityNoticeOpen.value = false;
  window.localStorage.setItem(IDENTITY_TIP_DISMISSED_KEY, "1");
}

async function submitTransfer(drafts: TransferDraft[], mode: TransferMode) {
  if (isSubmittingTransfer.value) return;

  isSubmittingTransfer.value = true;

  try {
    const submitted = await roomStore.transferScores(drafts, mode);

    if (submitted) {
      transferOpen.value = false;
    }
  } catch (error) {
    window.alert(error instanceof Error ? error.message : "转分失败");
  } finally {
    isSubmittingTransfer.value = false;
  }
}

async function copyRoomCode() {
  const copied = await writeClipboard(roomCode.value);

  if (!copied) {
    window.alert("当前浏览器不支持复制，请手动记录房间码。");
    return;
  }

  copiedText.value = "已复制房间码";
  setInviteFeedback("房间码已复制，可直接发给牌友");

  if (copiedTextTimer !== null) {
    window.clearTimeout(copiedTextTimer);
  }

  copiedTextTimer = window.setTimeout(() => {
    copiedText.value = "";
  }, 1800);
}

function openInviteSheet() {
  inviteSheetOpen.value = true;
}

function closeInviteSheet() {
  inviteSheetOpen.value = false;
}

function setInviteFeedback(message: string) {
  inviteFeedback.value = message;

  if (inviteFeedbackTimer !== null) {
    window.clearTimeout(inviteFeedbackTimer);
  }

  inviteFeedbackTimer = window.setTimeout(() => {
    inviteFeedback.value = "";
  }, 2200);
}

async function writeClipboard(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return true;
  }

  const input = document.createElement("textarea");
  input.value = value;
  input.setAttribute("readonly", "true");
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.appendChild(input);
  input.select();

  const copied = document.execCommand("copy");
  document.body.removeChild(input);

  return copied;
}

async function copyInviteLink() {
  const copied = await writeClipboard(inviteLink.value);

  if (!copied) {
    window.alert("当前浏览器不支持复制，请手动复制邀请链接。");
    return;
  }

  setInviteFeedback("邀请链接已复制，可直接发送给牌友");
}

async function copyIdentityKey() {
  if (!identityKey.value) {
    window.alert("当前还没有可用的专属识别名。");
    return;
  }

  const copied = await writeClipboard(identityKey.value);

  if (!copied) {
    window.alert("当前浏览器不支持复制，请手动记录专属识别名。");
    return;
  }

  setInviteFeedback("专属识别名已复制，建议保存到备忘录或微信收藏");

  if (identityNoticeOpen.value) {
    closeIdentityNotice();
  }
}

async function shareInviteLink() {
  if (!canNativeShare.value) {
    setInviteFeedback("当前浏览器暂不支持系统分享，可改用复制链接");
    return;
  }

  try {
    await navigator.share({
      title: room.value?.name ?? "PokerScore 牌局",
      text: `加入牌局「${room.value?.name ?? roomCode.value}」`,
      url: inviteLink.value,
    });
    setInviteFeedback("邀请链接已调起系统分享");
  } catch {
    // 用户取消分享时保持静默。
  }
}

async function settleRoom() {
  if (isSettling.value) return;

  if (isSettled.value) {
    void router.push({
      name: "settlement",
      params: { roomCode: roomCode.value },
    });
    return;
  }

  const confirmed = window.confirm(
    "确认关闭牌局并生成账单？此操作也可以撤回。"
  );
  if (!confirmed) return;

  isSettling.value = true;

  try {
    await roomStore.settleRoom();
    await router.push({
      name: "settlement",
      params: { roomCode: roomCode.value },
    });
  } catch (error) {
    window.alert(error instanceof Error ? error.message : "生成账单失败");
  } finally {
    isSettling.value = false;
  }
}
</script>

<template>
  <div
    v-if="room"
    class="fixed inset-0 flex h-[100dvh] flex-col overflow-hidden bg-background-light font-display text-slate-900 antialiased"
  >
    <div class="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        class="absolute inset-x-0 top-0 h-64 bg-[linear-gradient(180deg,rgba(249,212,6,0.12)_0%,rgba(248,248,245,0)_100%)]"
      ></div>
      <div class="absolute left-[-5rem] top-16 h-44 w-44 rounded-full bg-primary/15 blur-3xl"></div>
      <div class="absolute right-[-4rem] top-44 h-40 w-40 rounded-full bg-white/80 blur-3xl"></div>
    </div>

    <header class="relative z-40 shrink-0 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+12px)]">
      <div
        class="mx-auto flex w-full max-w-2xl items-center justify-between rounded-[1.75rem] border border-white/80 bg-white/85 px-3 py-3 shadow-[0_10px_30px_rgba(15,23,42,0.06)] backdrop-blur-xl"
      >
        <RouterLink
          class="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200/80 bg-slate-50/90 text-slate-700 transition-colors hover:bg-white"
          to="/"
        >
          <span class="material-symbols-outlined text-[20px]">arrow_back</span>
        </RouterLink>

        <div class="min-w-0 px-3 text-center">
          <h1
            class="truncate text-[1.05rem] font-black leading-tight text-slate-900"
          >{{ room.name }}</h1>
          <p class="mt-1 text-[11px] font-bold text-slate-500">房间码 {{ room.code }}</p>
        </div>

        <button
          type="button"
          class="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200/80 bg-slate-50/90 text-slate-700 transition-colors hover:bg-white"
          @click="openInviteSheet"
        >
          <span class="material-symbols-outlined text-[20px]">ios_share</span>
        </button>
      </div>
    </header>

    <main class="relative flex-1 overflow-x-hidden overflow-y-auto scrollbar-hide">
      <div class="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 pb-8 pt-1">
        <section
          class="relative overflow-hidden rounded-[2rem] border border-white/80 bg-[linear-gradient(145deg,rgba(255,255,255,0.96)_0%,rgba(255,255,255,0.84)_100%)] p-4 shadow-[0_18px_40px_rgba(15,23,42,0.08)]"
        >
          <div class="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-primary/15 blur-3xl"></div>
          <div class="absolute -bottom-8 left-0 h-24 w-24 rounded-full bg-white blur-2xl"></div>
          <div class="relative z-10">
            <div class="flex items-start justify-between gap-4">
              <div class="min-w-0">
                <h2
                  class="text-[2.35rem] font-black tracking-[-0.06em] text-slate-900 transition-all"
                  :class="{ 'scale-[1.02] text-primary': copiedText }"
                >{{ room.code }}</h2>
              </div>

              <div class="flex items-center">
                <button
                  type="button"
                  class="flex size-14 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white/90 shadow-[0_10px_24px_rgba(15,23,42,0.08)]"
                  @click="copyRoomCode"
                >
                  <span class="material-symbols-outlined text-[24px] text-slate-500">content_copy</span>
                </button>
              </div>
            </div>

            <div class="mt-1 flex flex-wrap items-center gap-2 text-xs font-bold text-slate-500">
              <span
                class="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/75 px-3 py-1.5"
              >
                <span
                  class="size-2 rounded-full"
                  :class="room.status === 'active' ? 'bg-emerald-500' : 'bg-rose-500'"
                ></span>
                {{ roomStatusLabel }}
              </span>
              <span
                class="inline-flex items-center rounded-full border border-slate-200 bg-white/75 px-3 py-1.5"
              >在线 {{ onlineCount }}/{{ playerCount }}</span>
              <span
                class="inline-flex items-center rounded-full border border-slate-200 bg-white/75 px-3 py-1.5"
              >流水 {{ totalTransfers }}</span>
              <span
                class="inline-flex items-center rounded-full border border-slate-200 bg-white/75 px-3 py-1.5"
              >我的分数 {{ currentUserScoreLabel }}</span>
              <span
                v-if="leadingMember"
                class="inline-flex items-center rounded-full border border-slate-200 bg-white/75 px-3 py-1.5"
              >领跑 {{ leadingMember.nickname }} {{ formatScore(leadingMember.score) }}</span>
              <span
                v-if="isSettled"
                class="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-rose-600"
              >当前牌局已结算</span>
            </div>
          </div>
        </section>

        <section
          class="rounded-[1.75rem] border border-white/80 bg-white/80 p-4 shadow-[0_14px_32px_rgba(15,23,42,0.06)] backdrop-blur-sm"
        >
          <div class="mb-4 flex items-end justify-between gap-3">
            <div>
              <p
                class="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400"
              >Table Crew</p>
              <h3 class="mt-1 text-lg font-black tracking-tight text-slate-900">牌桌成员</h3>
            </div>
            <span
              class="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-500"
            >左右滑动查看</span>
          </div>

          <div class="-mx-1 overflow-x-auto px-1 pb-2 scrollbar-hide">
            <div class="flex min-w-full gap-3">
              <div v-for="member in room.members" :key="member.id" class="w-[7.2rem] shrink-0">
                <PlayerCard :member="member" @transfer="openTransfer('single', $event)" />
              </div>

              <button
                type="button"
                class="flex w-[7.2rem] shrink-0 min-h-[8.75rem] flex-col items-center justify-center gap-3 rounded-[1.5rem] border border-dashed border-slate-300 bg-slate-50/80 p-3 text-center transition-colors hover:border-primary/30 hover:bg-white"
                @click="openInviteSheet"
              >
                <div
                  class="flex size-14 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 shadow-sm"
                >
                  <span class="material-symbols-outlined text-[24px]">share</span>
                </div>
                <div>
                  <p class="text-xs font-black uppercase tracking-[0.18em] text-slate-500">邀请牌友</p>
                  <p class="mt-1 text-xs font-medium text-slate-400">分享房间码或链接</p>
                </div>
              </button>
            </div>
          </div>
        </section>

        <TransferTimeline
          :members="room.members"
          :transfers="room.transfers"
          content-height-class="h-[26rem]"
        />
      </div>
    </main>

    <footer class="relative z-40 shrink-0 px-4 pb-[calc(env(safe-area-inset-bottom)+18px)] pt-3">
      <div
        class="mx-auto max-w-2xl rounded-[2rem] border border-white/80 bg-white/88 p-3 shadow-[0_-10px_28px_rgba(15,23,42,0.05)] backdrop-blur-xl"
      >
        <div class="flex gap-3">
          <button
            @click="openTransfer('multi')"
            :disabled="isSettled || isSubmittingTransfer || isSettling"
            class="flex-[0.92] flex h-14 items-center justify-center gap-2 rounded-[1.35rem] font-bold shadow-[0_10px_20px_rgba(15,23,42,0.08)] transition-transform"
            :class="
            isSettled || isSubmittingTransfer || isSettling
              ? 'cursor-not-allowed bg-slate-200 text-slate-400'
              : 'bg-slate-900 text-white active:scale-[0.98] hover:bg-slate-800'
          "
          >
            <span class="material-symbols-outlined text-xl">group</span>
            <span>多人转分</span>
          </button>
          <button
            @click="settleRoom"
            :disabled="isSubmittingTransfer || isSettling"
            class="flex-[1.08] flex h-14 items-center justify-center gap-2 rounded-[1.35rem] bg-primary font-black text-slate-900 shadow-[0_12px_24px_rgba(249,212,6,0.24)] transition-transform active:scale-[0.98]"
            :class="{ 'pointer-events-none opacity-60': isSubmittingTransfer || isSettling }"
          >
            <span
              class="material-symbols-outlined text-xl"
            >{{ isSettled ? "receipt_long" : "check_circle" }}</span>
            <span>
              {{
              isSettling ? "处理中..." : isSettled ? "查看账单" : "生成账单"
              }}
            </span>
          </button>
        </div>
      </div>
    </footer>

    <TransferPanel
      v-if="transferOpen"
      :open="transferOpen"
      :mode="transferMode"
      :members="room.members"
      :current-user="currentUser"
      :initial-recipient-id="activeRecipientId"
      @close="closeTransfer"
      @submit="submitTransfer"
    />

    <InviteRoomSheet
      :open="inviteSheetOpen"
      :room-code="room.code"
      :room-name="room.name"
      :invite-link="inviteLink"
      :identity-key="identityKey"
      :feedback-text="inviteFeedback"
      :can-native-share="canNativeShare"
      @close="closeInviteSheet"
      @copy-code="copyRoomCode"
      @copy-identity="copyIdentityKey"
      @copy-link="copyInviteLink"
      @share="shareInviteLink"
    />

    <Transition name="fade">
      <div
        v-if="identityNoticeOpen"
        class="fixed inset-0 z-[120] grid place-items-center overflow-y-auto px-4 pt-[calc(env(safe-area-inset-top)+16px)] pb-[calc(env(safe-area-inset-bottom)+16px)]"
      >
        <div
          class="absolute inset-0 bg-slate-950/45 backdrop-blur-sm"
          @click.self="closeIdentityNotice"
        ></div>
        <div
          class="relative flex h-[78dvh] max-h-[44rem] w-full max-w-sm flex-col overflow-hidden rounded-[2rem] border border-slate-100 bg-white shadow-2xl"
        >
          <div class="shrink-0 px-6 pb-3 pt-5">
            <div class="flex justify-end">
              <button
                @click="closeIdentityNotice"
                class="flex size-8 items-center justify-center rounded-full bg-slate-100 transition-colors hover:bg-slate-200"
              >
                <span class="material-symbols-outlined text-[18px] text-slate-500">close</span>
              </button>
            </div>

            <div class="mt-1 flex flex-col items-center text-center">
              <div
                class="mb-4 flex size-14 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10"
              >
                <span class="material-symbols-outlined text-[28px] text-primary">badge</span>
              </div>
              <h3 class="text-xl font-black text-slate-900">保存你的专属识别名</h3>
              <p
                class="mt-2 text-sm font-medium leading-6 text-slate-500"
              >这串识别名相当于你的 PokerScore 用户编号。换设备时，可用它找回历史记录或重新进入常用房间。</p>
            </div>
          </div>

          <div class="min-h-0 flex-1 overflow-y-auto px-6 pb-5 scrollbar-hide">
            <div class="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
              <p class="text-sm font-bold text-slate-900">专属识别名</p>
              <p
                class="mt-3 break-all text-center text-lg font-black tracking-[0.18em] text-slate-900"
              >{{ identityKey }}</p>
              <p
                class="mt-3 text-center text-[11px] font-medium leading-5 text-slate-500"
              >建议复制后保存到备忘录、微信收藏或截图留存。它不会影响你在房间里的显示昵称。</p>
            </div>
          </div>

          <div class="shrink-0 border-t border-slate-100 px-6 pb-6 pt-4">
            <div class="grid grid-cols-2 gap-3">
              <button
                @click="closeIdentityNotice"
                class="h-12 rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-100"
              >稍后再说</button>
              <button
                @click="copyIdentityKey"
                class="h-12 rounded-xl bg-slate-900 text-sm font-bold text-white transition-transform active:scale-[0.98]"
              >复制并保存</button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>

  <main
    v-else
    class="flex h-[100dvh] flex-col items-center justify-center bg-background-light px-6 pb-[calc(env(safe-area-inset-bottom)+24px)] pt-[calc(env(safe-area-inset-top)+24px)] text-center text-slate-900"
  >
    <div
      class="w-full max-w-sm rounded-[2rem] border border-white/80 bg-white p-8 shadow-[0_18px_40px_rgba(15,23,42,0.08)]"
    >
      <div
        class="size-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100 shadow-inner"
      >
        <span class="material-symbols-outlined text-slate-400 text-3xl">sentiment_dissatisfied</span>
      </div>
      <h1 class="text-2xl font-black mb-3 text-slate-900 tracking-tight">房间不存在</h1>
      <p class="text-slate-500 mb-8 font-medium text-sm">未能加载数据，或者房间已被解散。</p>
      <RouterLink
        class="w-full h-14 bg-primary text-slate-900 rounded-xl font-bold text-lg tracking-widest active:scale-95 transition-transform flex items-center justify-center shadow-lg shadow-primary/20"
        to="/"
      >返回首页</RouterLink>
    </div>
  </main>
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
