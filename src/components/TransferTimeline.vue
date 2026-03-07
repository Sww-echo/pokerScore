<script setup lang="ts">
import { computed } from "vue";
import type { RoomMember, TransferRecord } from "../types";
import { formatTime, formatScore } from "../utils/format";

const props = defineProps<{
  members: RoomMember[];
  transfers: TransferRecord[];
}>();

interface TimelineRecord {
  id: string;
  fromName: string;
  toName: string;
  amount: number;
  meta: string;
}

const records = computed<TimelineRecord[]>(() =>
  [...props.transfers]
    .sort(
      (left, right) =>
        new Date(right.createdAt).getTime() -
        new Date(left.createdAt).getTime(),
    )
    .map((transfer) => {
      const fromMember = props.members.find(
        (member) => member.id === transfer.fromMemberId,
      );
      const toMember = props.members.find(
        (member) => member.id === transfer.toMemberId,
      );

      return {
        id: transfer.id,
        fromName: fromMember?.nickname ?? "未知",
        toName: toMember?.nickname ?? "未知",
        amount: transfer.score,
        meta: `${formatTime(transfer.createdAt)}`,
      };
    }),
);

function formatNumber(num: number) {
  return formatScore(num);
}
</script>

<template>
  <div class="px-4 pt-6 pb-20 w-full mb-8">
    <div class="flex items-center justify-between mb-4">
      <h3
        class="text-slate-900 text-sm font-bold uppercase tracking-widest flex items-center gap-2"
      >
        <span class="material-symbols-outlined text-lg">history</span>近期战况
      </h3>
      <span
        class="text-primary text-xs font-bold bg-primary/10 px-2 py-1 rounded cursor-pointer"
        >自动更新</span
      >
    </div>

    <div v-if="records.length" class="space-y-3">
      <div
        v-for="record in records"
        :key="record.id"
        class="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-100 shadow-sm transition-colors hover:border-slate-200"
      >
        <div
          class="size-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0"
        >
          <span
            class="material-symbols-outlined text-primary text-[16px] font-bold"
            >swap_horiz</span
          >
        </div>
        <div class="flex flex-col flex-1 min-w-0">
          <p class="text-slate-900 text-xs truncate">
            <span class="font-bold">{{ record.fromName }}</span> 支付给
            <span class="font-bold">{{ record.toName }}</span>
          </p>
          <p class="text-[10px] text-slate-400 mt-0.5">{{ record.meta }}</p>
        </div>
        <div class="shrink-0 flex items-center">
          <span class="text-primary font-black text-sm">{{
            formatNumber(record.amount)
          }}</span>
          <span class="text-[10px] text-primary/80 font-bold ml-0.5">分</span>
        </div>
      </div>
    </div>

    <div
      v-else
      class="flex flex-col items-center justify-center py-10 text-slate-400 bg-white/50 rounded-xl border border-dashed border-slate-200"
    >
      <span
        class="material-symbols-outlined text-4xl mb-2 opacity-30 text-slate-400"
        >data_info_alert</span
      >
      <p class="text-xs font-medium">暂无流水记录，点击玩家头像开始转分</p>
    </div>
  </div>
</template>
