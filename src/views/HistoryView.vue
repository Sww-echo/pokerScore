<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useRoomStore } from "../stores/room";
import { formatTime, formatScore } from "../utils/format";
import type { RoomMember, TransferRecord } from "../types";

const route = useRoute();
const router = useRouter();
const roomStore = useRoomStore();

const activeTab = ref<"all" | "in" | "out">("all");
const roomCode = computed(() => route.params.roomCode as string);

onMounted(() => {
  if (!roomStore.room || roomStore.room.code !== roomCode.value) {
    if (roomCode.value) {
      roomStore.joinRoom({
        nickname: roomStore.profile?.nickname ?? "Guest",
        authMode: roomStore.profile?.authMode ?? "guest",
        roomCode: roomCode.value,
      });
    } else {
      router.replace({ name: "home" });
    }
  }
});

const room = computed(() => roomStore.room);
const currentUser = computed(() => roomStore.currentUser);

const timelineGroups = computed(() => {
  if (!room.value || !currentUser.value) return [];

  const me = currentUser.value.id;
  let records = [...room.value.transfers].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  if (activeTab.value === "in") {
    records = records.filter((r) => r.toMemberId === me);
  } else if (activeTab.value === "out") {
    records = records.filter((r) => r.fromMemberId === me);
  }

  const groups: Record<
    string,
    { dateLabel: string; records: TransferRecord[] }
  > = {};

  const todayStr = new Date().toLocaleDateString();
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayStr = yesterdayDate.toLocaleDateString();

  records.forEach((record) => {
    const d = new Date(record.createdAt);
    const dateStr = d.toLocaleDateString();
    let label = dateStr;
    if (dateStr === todayStr) label = "今天";
    else if (dateStr === yesterdayStr) label = "昨天";
    else label = `${d.getMonth() + 1}月${d.getDate()}日`;

    if (!groups[dateStr]) {
      groups[dateStr] = { dateLabel: label, records: [] };
    }
    groups[dateStr].records.push(record);
  });

  return Object.values(groups);
});

function resolveMember(memberId: string): RoomMember | undefined {
  return room.value?.members.find((m) => m.id === memberId);
}

function getGradient(id: string) {
  const hash = id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const colors = [
    "from-slate-200 to-slate-300 text-slate-700",
    "from-primary to-yellow-300 text-slate-800",
    "from-emerald-100 to-emerald-200 text-emerald-800",
    "from-rose-100 to-rose-200 text-rose-800",
  ];
  return colors[hash % colors.length];
}

function navBack() {
  if (room.value) {
    router.push({ name: "room", params: { roomCode: room.value.code } });
  } else {
    router.push("/");
  }
}

function formatFlowScore(record: TransferRecord) {
  if (!currentUser.value) {
    return `${record.score}`;
  }

  if (record.toMemberId === currentUser.value.id) {
    return formatScore(record.score);
  }

  if (record.fromMemberId === currentUser.value.id) {
    return `-${record.score}`;
  }

  return `${record.score}`;
}
</script>

<template>
  <div
    v-if="room && currentUser"
    class="fixed inset-0 bg-background-light font-display text-slate-900 flex flex-col pt-safe pb-safe outline-none h-[100dvh] antialiased"
  >
    <header
      class="shrink-0 z-10 bg-background-light/90 backdrop-blur-md border-b border-slate-200"
    >
      <div
        class="flex items-center p-4 justify-between max-w-md mx-auto w-full"
      >
        <button
          @click="navBack"
          class="flex size-10 items-center justify-center rounded-full hover:bg-slate-200/50 transition-colors"
        >
          <span class="material-symbols-outlined text-slate-900"
            >arrow_back</span
          >
        </button>
        <div class="flex flex-col items-center">
          <h1 class="text-slate-900 text-lg font-bold leading-tight">
            对局记录
          </h1>
          <span
            class="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]"
            >{{ room.name }}</span
          >
        </div>
        <button
          class="flex size-10 items-center justify-center rounded-full hover:bg-slate-200/50 transition-colors"
        >
          <span class="material-symbols-outlined text-slate-900">search</span>
        </button>
      </div>

      <!-- Segmented Control -->
      <div class="px-4 pb-4 max-w-md mx-auto w-full">
        <div
          class="flex w-full bg-slate-200/60 p-1 rounded-xl shadow-inner border border-slate-200 text-sm font-bold"
        >
          <button
            class="flex-1 py-2 text-center rounded-lg transition-all"
            :class="
              activeTab === 'all'
                ? 'bg-white text-slate-900 shadow-sm border border-slate-100'
                : 'text-slate-500 hover:text-slate-700'
            "
            @click="activeTab = 'all'"
          >
            全部
          </button>
          <button
            class="flex-1 py-2 text-center rounded-lg transition-all"
            :class="
              activeTab === 'in'
                ? 'bg-white text-slate-900 shadow-sm border border-slate-100'
                : 'text-slate-500 hover:text-slate-700'
            "
            @click="activeTab = 'in'"
          >
            <span class="text-emerald-500">转入</span>
          </button>
          <button
            class="flex-1 py-2 text-center rounded-lg transition-all"
            :class="
              activeTab === 'out'
                ? 'bg-white text-slate-900 shadow-sm border border-slate-100'
                : 'text-slate-500 hover:text-slate-700'
            "
            @click="activeTab = 'out'"
          >
            <span class="text-rose-500">转出</span>
          </button>
        </div>
      </div>
    </header>

    <main class="flex-1 overflow-y-auto px-4 py-2 w-full max-w-md mx-auto">
      <div v-if="timelineGroups.length > 0">
        <section
          v-for="(group, gIndex) in timelineGroups"
          :key="gIndex"
          class="mb-8"
        >
          <h2
            class="text-slate-900 font-bold text-sm tracking-widest uppercase mb-4 sticky top-0 bg-background-light/95 shadow-[0_4px_10px_-4px_rgba(248,248,245,1)] py-2 z-10 flex items-center gap-2"
          >
            <span class="w-1.5 h-1.5 rounded-full bg-primary/60"></span>
            {{ group.dateLabel }}
          </h2>

          <div class="space-y-3 pl-3">
            <div
              v-for="record in group.records"
              :key="record.id"
              class="p-3 bg-white rounded-xl border border-slate-200 flex items-center gap-3 shadow-sm hover:border-primary/50 transition-colors"
            >
              <div class="flex-1">
                <div class="flex items-center justify-between mb-1">
                  <p class="text-slate-900 font-bold text-sm">
                    <span v-if="record.toMemberId === currentUser.id"
                      >收到来自
                      {{
                        resolveMember(record.fromMemberId)?.nickname
                      }}
                      的转账</span
                    >
                    <span v-else-if="record.fromMemberId === currentUser.id"
                      >向
                      {{
                        resolveMember(record.toMemberId)?.nickname
                      }}
                      转出</span
                    >
                    <span v-else
                      >{{ resolveMember(record.fromMemberId)?.nickname }} 向
                      {{
                        resolveMember(record.toMemberId)?.nickname
                      }}
                      转账</span
                    >
                  </p>
                  <span
                    class="text-xs font-black"
                    :class="
                      record.toMemberId === currentUser.id
                        ? 'text-emerald-500'
                        : record.fromMemberId === currentUser.id
                          ? 'text-rose-500'
                        : 'text-slate-400'
                    "
                  >
                    {{ formatFlowScore(record) }}
                  </span>
                </div>

                <div class="flex items-center gap-2 mt-2">
                  <div
                    class="size-5 rounded-full bg-gradient-to-tr shadow-inner flex items-center justify-center text-[10px] font-bold border border-slate-200/50"
                    :class="getGradient(record.fromMemberId)"
                  >
                    {{
                      resolveMember(record.fromMemberId)
                        ?.nickname.slice(0, 1)
                        .toUpperCase()
                    }}
                  </div>

                  <div
                    class="h-[1px] w-6 bg-slate-200 flex items-center justify-center"
                  >
                    <span
                      class="material-symbols-outlined text-[10px] text-primary bg-white px-1"
                      >chevron_right</span
                    >
                  </div>

                  <div
                    class="size-5 rounded-full bg-gradient-to-tr shadow-inner flex items-center justify-center text-[10px] font-bold border border-slate-200/50"
                    :class="getGradient(record.toMemberId)"
                  >
                    {{
                      resolveMember(record.toMemberId)
                        ?.nickname.slice(0, 1)
                        .toUpperCase()
                    }}
                  </div>

                  <span
                    class="text-[10px] text-slate-400 font-medium ml-auto tracking-wide"
                    >{{ formatTime(record.createdAt) }}</span
                  >
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <div
        v-else
        class="flex flex-col items-center justify-center py-24 text-center"
      >
        <div
          class="size-20 bg-slate-100 rounded-full flex items-center justify-center mb-6 border border-slate-200 shadow-inner"
        >
          <span class="material-symbols-outlined text-4xl text-slate-400/50"
            >receipt_long</span
          >
        </div>
        <h3 class="text-slate-800 text-lg font-bold mb-2">暂无流转记录</h3>
        <p class="text-slate-500 text-xs font-medium max-w-[200px]">
          牌局刚刚开始，去完成第一笔操作吧。
        </p>
      </div>
    </main>
  </div>

  <main
    v-else
    class="flex flex-col items-center justify-center px-6 text-center h-[100dvh] bg-background-light text-slate-900 pt-safe pb-safe"
  >
    <div
      class="w-full bg-white p-8 rounded-[2rem] shadow-xl border border-slate-200 max-w-sm"
    >
      <h1 class="text-2xl font-black mb-4">记录获取失败</h1>
      <p class="text-slate-500 mb-8 text-sm font-medium">
        未能成功加载此房间的流水信，可以试试返回
      </p>
      <RouterLink
        class="w-full h-14 bg-primary text-slate-900 rounded-xl font-bold tracking-widest text-lg active:scale-95 transition-transform flex items-center justify-center drop-shadow-[0_4px_16px_rgba(249,212,6,0.2)]"
        to="/"
        >返回首页</RouterLink
      >
    </div>
  </main>
</template>
