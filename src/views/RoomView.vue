<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import PlayerCard from "../components/PlayerCard.vue";
import TransferPanel from "../components/TransferPanel.vue";
import TransferTimeline from "../components/TransferTimeline.vue";
import { useRoomStore } from "../stores/room";
import { shortCode } from "../utils/format";
import type { TransferDraft, TransferMode } from "../types";

const route = useRoute();
const router = useRouter();
const roomStore = useRoomStore();

const transferOpen = ref(false);
const transferMode = ref<TransferMode>("multi");
const activeRecipientId = ref<string | null>(null);
const copiedText = ref("");

const roomCode = computed(() => shortCode(String(route.params.roomCode ?? "")));
const room = computed(() => roomStore.room);
const currentUser = computed(() => roomStore.currentUser);
const playerCount = computed(() => room.value?.members.length ?? 0);
const isSettled = computed(() => room.value?.status === "settled");

onMounted(() => {
  if (!room.value || room.value.code !== roomCode.value) {
    roomStore.joinRoom({
      nickname: roomStore.profile?.nickname ?? "新牌友",
      authMode: roomStore.profile?.authMode ?? "guest",
      roomCode: roomCode.value,
    });
  }
});

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

function submitTransfer(drafts: TransferDraft[], mode: TransferMode) {
  const submitted = roomStore.transferScores(drafts, mode);

  if (submitted) {
    transferOpen.value = false;
  }
}

async function copyRoomCode() {
  await navigator.clipboard.writeText(roomCode.value);
  copiedText.value = "已复制房间码";
  window.setTimeout(() => {
    copiedText.value = "";
  }, 1800);
}

function settleRoom() {
  if (isSettled.value) {
    void router.push({
      name: "settlement",
      params: { roomCode: roomCode.value },
    });
    return;
  }

  const confirmed = window.confirm(
    "确认关闭牌局并生成账单？此操作也可以撤回。",
  );
  if (!confirmed) return;
  roomStore.settleRoom();
  void router.push({
    name: "settlement",
    params: { roomCode: roomCode.value },
  });
}
</script>

<template>
  <div
    v-if="room"
    class="fixed inset-0 flex flex-col bg-background-light font-display text-slate-900 antialiased h-[100dvh]"
  >
    <!-- Header -->
    <header
      class="shrink-0 flex items-center justify-between p-4 pt-safe z-50 bg-background-light/90 backdrop-blur-md border-b border-slate-200"
    >
      <RouterLink
        class="flex size-10 items-center justify-center rounded-full hover:bg-slate-100 transition-colors"
        to="/"
      >
        <span class="material-symbols-outlined text-slate-900">arrow_back</span>
      </RouterLink>
      <div class="flex flex-col items-center">
        <h1 class="text-slate-900 text-lg font-bold leading-tight">
          {{ room.name }}
        </h1>
        <span
          class="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]"
          >{{ room.status === "active" ? "Live Session" : "Settled" }}</span
        >
      </div>
      <div
        class="flex size-10 items-center justify-center rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
        @click="copyRoomCode"
      >
        <span class="material-symbols-outlined text-slate-900">info</span>
      </div>
    </header>

    <main class="flex-1 overflow-y-auto overflow-x-hidden">
      <!-- Room Info Card -->
      <div class="p-4">
        <div
          class="relative overflow-hidden rounded-xl bg-white p-5 border border-slate-200 shadow-sm"
          @click="copyRoomCode"
        >
          <div class="absolute -top-2 -right-4 p-4 opacity-[0.03]">
            <span class="material-symbols-outlined text-[100px] text-slate-900"
              >style</span
            >
          </div>
          <div class="flex flex-col gap-1 relative z-10">
            <p
              class="text-primary text-xs font-black uppercase tracking-[0.15em] mb-1"
            >
              {{ copiedText || "Room Code" }}
            </p>
            <h2
              class="text-slate-900 text-2xl font-black tracking-tight"
              :class="{ 'text-primary scale-105 transition-all': copiedText }"
            >
              {{ room.code }}
            </h2>
            <div class="flex items-center gap-2 mt-1 relative z-20">
              <span
                class="size-1.5 rounded-full"
                :class="
                  room.status === 'active'
                    ? 'bg-emerald-500 animate-pulse'
                    : 'bg-rose-500'
                "
              ></span>
              <span class="text-slate-500 text-xs font-bold"
                >{{ playerCount }} Players Connected</span
              >
            </div>

            <p
              v-if="isSettled"
              class="mt-3 text-xs font-bold text-rose-500 relative z-20"
            >
              当前牌局已结算，需重新开局后才能继续转分
            </p>

            <div
              class="absolute bottom-1 right-2 w-14 h-14 bg-slate-50 rounded-full border border-slate-100 flex items-center justify-center cursor-pointer shadow-sm hover:bg-slate-100 transition active:scale-95 group"
            >
              <span
                class="material-symbols-outlined text-slate-400 group-hover:text-primary transition-colors"
                >content_copy</span
              >
            </div>
          </div>
        </div>
      </div>

      <!-- Players Grid -->
      <div class="px-4 py-2">
        <h3
          class="text-slate-900 text-sm font-bold uppercase tracking-widest mb-4"
        >
          Players & Scores
        </h3>
        <div class="grid grid-cols-4 gap-x-2 gap-y-4">
          <PlayerCard
            v-for="member in room.members"
            :key="member.id"
            :member="member"
            @transfer="openTransfer('single', $event)"
          />

          <!-- Add Player Placeholder -->
          <div
            class="flex flex-col items-center gap-2 group cursor-pointer"
            @click="copyRoomCode"
          >
            <div
              class="size-16 rounded-full border-2 border-dashed border-slate-300 flex items-center justify-center group-hover:bg-slate-50 transition-colors"
            >
              <span class="material-symbols-outlined text-slate-400"
                >person_add</span
              >
            </div>
            <div class="text-center">
              <p
                class="text-slate-400 text-xs font-bold uppercase tracking-wide"
              >
                Invite
              </p>
              <p class="text-slate-300 font-bold text-xs">--</p>
            </div>
          </div>
        </div>
      </div>

      <TransferTimeline :members="room.members" :transfers="room.transfers" />
    </main>

    <!-- Fixed Bottom Bar -->
    <footer
      class="shrink-0 p-4 bg-background-light/95 backdrop-blur-lg border-t border-slate-200 pb-safe z-40"
    >
        <div class="flex gap-3 max-w-md mx-auto">
          <button
            @click="openTransfer('multi')"
            :disabled="isSettled"
            class="flex-[0.9] h-14 flex items-center justify-center gap-2 rounded-xl font-bold transition-transform shadow-md"
            :class="
              isSettled
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : 'bg-slate-900 hover:bg-slate-800 text-white active:scale-95'
            "
          >
            <span class="material-symbols-outlined text-xl">group</span>
            <span>多人转分</span>
          </button>
          <button
            @click="settleRoom"
            class="flex-[1.1] h-14 flex items-center justify-center gap-2 bg-primary text-slate-900 rounded-xl font-black transition-transform active:scale-95 shadow-lg shadow-primary/20"
          >
            <span class="material-symbols-outlined text-xl">
              {{ isSettled ? "receipt_long" : "check_circle" }}
            </span>
            <span>{{ isSettled ? "查看账单" : "生成账单" }}</span>
          </button>
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
  </div>

  <main
    v-else
    class="flex flex-col items-center justify-center px-6 text-center h-[100dvh] bg-background-light text-slate-900"
  >
    <div
      class="w-full bg-white p-8 rounded-[2rem] border border-slate-200 shadow-xl max-w-sm"
    >
      <div
        class="size-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100 shadow-inner"
      >
        <span class="material-symbols-outlined text-slate-400 text-3xl"
          >sentiment_dissatisfied</span
        >
      </div>
      <h1 class="text-2xl font-black mb-3 text-slate-900 tracking-tight">
        房间不存在
      </h1>
      <p class="text-slate-500 mb-8 font-medium text-sm">
        未能加载数据，或者房间已被解散。
      </p>
      <RouterLink
        class="w-full h-14 bg-primary text-slate-900 rounded-xl font-bold text-lg tracking-widest active:scale-95 transition-transform flex items-center justify-center shadow-lg shadow-primary/20"
        to="/"
        >返回首页</RouterLink
      >
    </div>
  </main>
</template>
