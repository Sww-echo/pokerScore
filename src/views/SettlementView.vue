<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useRoomStore } from "../stores/room";
import { formatDateTime, formatScore } from "../utils/format";
import type { RoomMember } from "../types";

const route = useRoute();
const router = useRouter();
const roomStore = useRoomStore();

const room = computed(() => roomStore.room);
const snapshot = computed(() => room.value?.settlement ?? null);
const isReopening = computed(() => roomStore.syncing);

onMounted(() => {
  void loadSettlementPage();
});

onBeforeUnmount(() => {
  roomStore.disconnectRoomRealtime(String(route.params.roomCode ?? ""));
});

function resolveMember(memberId: string): RoomMember | undefined {
  return room.value?.members.find((member) => member.id === memberId);
}

async function loadSettlementPage() {
  const targetRoomCode = String(route.params.roomCode ?? "");

  try {
    if (!room.value || room.value.code !== targetRoomCode) {
      await roomStore.joinRoom({
        nickname: roomStore.profile?.nickname ?? "新牌友",
        authMode: roomStore.profile?.authMode ?? "guest",
        roomCode: targetRoomCode,
      });
    } else {
      await roomStore.fetchRoom(targetRoomCode);
    }

    await roomStore.connectRoomRealtime(targetRoomCode).catch(() => null);
  } catch {
    await router.replace({ name: "home" });
    return;
  }

  await roomStore.fetchCurrentSettlement(targetRoomCode).catch(() => null);
}

async function reopenRoom() {
  if (isReopening.value) return;

  try {
    await roomStore.reopenRoom();
    await router.push({
      name: "room",
      params: { roomCode: room.value?.code ?? "" },
    });
  } catch (error) {
    window.alert(error instanceof Error ? error.message : "重开失败");
  }
}

function backToHome() {
  void router.push("/");
}

function navRoom() {
  if (room.value) {
    router.push({ name: "room", params: { roomCode: room.value.code } });
  }
}

function getGradient(id: string) {
  const hash = id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const colors = [
    "from-slate-200 to-slate-300 text-slate-800",
    "from-primary to-yellow-300 text-slate-900",
    "from-emerald-100 to-emerald-200 text-emerald-900",
    "from-rose-100 to-rose-200 text-rose-900",
  ];
  return colors[hash % colors.length];
}
</script>

<template>
  <div
    v-if="room && snapshot"
    class="fixed inset-0 bg-background-light font-display text-slate-900 flex flex-col pt-safe outline-none h-[100dvh]"
  >
    <!-- Top Navigation Bar -->
    <header
      class="shrink-0 flex items-center justify-between px-4 py-4 bg-background-light/90 backdrop-blur-md z-10 border-b border-slate-200"
    >
      <button
        @click="navRoom"
        class="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-200/50 transition-colors"
      >
        <span class="material-symbols-outlined text-slate-900">close</span>
      </button>
      <h1 class="text-lg font-bold tracking-tight text-slate-900">结算账单</h1>
      <button
        class="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-200/50 transition-colors"
      >
        <span class="material-symbols-outlined text-slate-900">share</span>
      </button>
    </header>

    <main class="flex-1 overflow-y-auto w-full max-w-md mx-auto">
      <!-- Hero Section: Celebratory State -->
      <div class="px-4 py-6">
        <div
          class="relative overflow-hidden rounded-xl bg-white p-6 border border-slate-200 shadow-sm"
        >
          <div class="absolute -top-4 -right-4 p-4 opacity-[0.03]">
            <span class="material-symbols-outlined text-[120px] text-slate-900"
              >emoji_events</span
            >
          </div>
          <div class="relative z-10">
            <p
              class="text-slate-500 font-bold text-sm uppercase tracking-widest mb-2"
            >
              Game Over
            </p>
            <h2
              class="text-3xl font-display font-black leading-tight text-slate-900"
            >
              本局已结束
            </h2>
            <p class="text-slate-400 mt-2 text-xs font-medium">
              清算时间: {{ formatDateTime(snapshot.settledAt) }}
            </p>
          </div>
        </div>
      </div>

      <!-- Hall of Fame / Leaderboard -->
      <section class="px-4 py-4">
        <div class="flex items-center gap-2 mb-4">
          <span class="material-symbols-outlined text-primary"
            >military_tech</span
          >
          <h3
            class="text-sm uppercase tracking-widest font-bold text-slate-900"
          >
            排行榜
          </h3>
        </div>

        <div class="grid grid-cols-2 gap-3 mb-6">
          <div
            v-for="(member, idx) in snapshot.ranking"
            :key="member.id"
            class="flex flex-col items-center justify-center p-4 rounded-xl relative overflow-hidden bg-white shadow-sm"
            :class="
              idx === 0
                ? 'border-2 border-primary/50 ring-2 ring-primary/10'
                : 'border border-slate-200'
            "
          >
            <div
              v-if="idx === 0"
              class="absolute top-0 right-0 bg-primary/20 text-primary px-2 py-0.5 rounded-bl-lg text-[10px] font-black border-l border-b border-primary/10 tracking-wider"
            >
              MVP
            </div>
            <span
              class="text-2xl font-display font-bold mb-1"
              :class="
                idx === 0
                  ? 'text-primary'
                  : member.score < 0
                    ? 'text-rose-500'
                    : member.score > 0
                      ? 'text-emerald-500'
                      : 'text-slate-500'
              "
            >
                  {{ formatScore(member.score) }}
            </span>
            <span
              class="text-xs font-bold"
              :class="idx === 0 ? 'text-slate-900' : 'text-slate-400'"
              >{{ member.nickname }}
              <span v-if="idx === 0" class="ml-1 text-[10px] opacity-70"
                >👑</span
              >
            </span>
          </div>
        </div>
      </section>

      <!-- Transfer Paths -->
      <section class="px-4 py-4 mb-8">
        <div
          class="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5"
        >
          <div class="flex items-center justify-between mb-6">
            <h3
              class="text-sm font-bold flex items-center gap-2 text-slate-900 uppercase tracking-widest"
            >
              <span
                class="material-symbols-outlined font-normal text-slate-500 text-lg"
                >payments</span
              >
              最少转账建议
            </h3>
            <span
              class="text-[10px] font-bold bg-primary/20 text-slate-900 px-2 py-1 rounded shadow-inner"
              >最优解</span
            >
          </div>

          <div v-if="snapshot.suggestions.length > 0" class="space-y-6">
            <div
              v-for="suggestion in snapshot.suggestions"
              :key="`${suggestion.fromMemberId}-${suggestion.toMemberId}`"
              class="flex items-center justify-between"
            >
              <!-- From User -->
              <div class="flex items-center gap-3">
                <div
                  class="size-10 rounded-full flex items-center justify-center overflow-hidden font-bold border border-white shadow-md bg-gradient-to-tr"
                  :class="getGradient(suggestion.fromMemberId)"
                >
                  {{
                    resolveMember(suggestion.fromMemberId)
                      ?.nickname.slice(0, 1)
                      .toUpperCase()
                  }}
                </div>
                <div>
                  <p
                    class="text-xs font-bold text-slate-900 truncate max-w-[60px]"
                  >
                    {{ resolveMember(suggestion.fromMemberId)?.nickname }}
                  </p>
                  <p class="text-[9px] text-slate-500 font-medium">支付方</p>
                </div>
              </div>

              <!-- Arrow Track -->
              <div class="flex flex-col items-center flex-1 px-3 min-w-0">
                <div class="flex items-center text-primary mb-1 gap-1">
                  <span class="text-sm font-black text-slate-900 truncate">{{
                    suggestion.amount
                  }}</span>
                  <span class="text-[10px] font-bold text-slate-500">点</span>
                </div>
                <div class="w-full h-[2px] bg-slate-200 relative">
                  <div
                    class="absolute right-0 -top-1.5 text-slate-400 bg-white rounded-full"
                  >
                    <span class="material-symbols-outlined text-[14px]"
                      >chevron_right</span
                    >
                  </div>
                </div>
              </div>

              <!-- To User -->
              <div class="flex items-center gap-3 text-right">
                <div>
                  <p
                    class="text-xs font-bold text-slate-900 truncate max-w-[60px]"
                  >
                    {{ resolveMember(suggestion.toMemberId)?.nickname }}
                  </p>
                  <p class="text-[9px] text-slate-500 font-medium">接收方</p>
                </div>
                <div
                  class="size-10 rounded-full flex items-center justify-center overflow-hidden font-bold border border-white shadow-md bg-gradient-to-tr"
                  :class="getGradient(suggestion.toMemberId)"
                >
                  {{
                    resolveMember(suggestion.toMemberId)
                      ?.nickname.slice(0, 1)
                      .toUpperCase()
                  }}
                </div>
              </div>
            </div>
          </div>

          <div v-else class="text-center py-8">
            <span
              class="material-symbols-outlined text-4xl mb-2 opacity-30 text-slate-400"
              >check_circle</span
            >
            <p class="text-slate-500 text-xs font-bold">
              所有玩家已平账，无须任何操作。
            </p>
          </div>
        </div>
      </section>
    </main>

    <!-- Bottom Actions -->
    <footer
      class="shrink-0 p-4 bg-background-light/95 border-t border-slate-200 pb-safe z-40"
    >
      <div class="flex flex-col gap-3 max-w-md mx-auto">
        <button
          @click="reopenRoom"
          :disabled="isReopening"
          class="w-full h-14 bg-primary text-slate-900 font-bold text-sm tracking-widest rounded-xl flex items-center justify-center gap-2 transition-transform active:scale-95 shadow-md hover:bg-[#ebd074]"
          :class="{ 'opacity-60 pointer-events-none': isReopening }"
        >
          <span class="material-symbols-outlined text-[18px]">restart_alt</span>
          {{ isReopening ? "处理中..." : "重开当前局" }}
        </button>
        <button
          @click="backToHome"
          class="w-full h-14 bg-white text-slate-900 font-bold text-sm tracking-widest rounded-xl border border-slate-200 flex items-center justify-center gap-2 transition-transform shadow-sm active:scale-95 hover:bg-slate-50"
        >
          <span class="material-symbols-outlined text-slate-400 text-[18px]"
            >meeting_room</span
          >
          返回首页面
        </button>
      </div>
    </footer>
  </div>

  <main
    v-else
    class="flex flex-col items-center justify-center px-6 text-center h-[100dvh] bg-background-light text-slate-900 pt-safe pb-safe"
  >
    <div
      class="w-full bg-white p-8 border border-slate-200 rounded-[2rem] shadow-xl max-w-sm"
    >
      <h1 class="text-xl font-bold mb-4 text-slate-900">数据不可用</h1>
      <p class="text-slate-500 mb-8 font-medium text-xs leading-relaxed">
        未找到已确认的结算账单，请先回到房间页点击“生成账单”
      </p>
        <button
          @click="navRoom"
          class="w-full h-14 bg-primary text-slate-900 rounded-xl font-bold text-sm active:scale-95 shadow-lg shadow-primary/20 transition-transform"
        >
          返回房间页
      </button>
    </div>
  </main>
</template>
