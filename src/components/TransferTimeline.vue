<script setup lang="ts">
import { computed } from "vue";
import type { RoomMember, TransferRecord } from "../types";
import { formatTime, formatScore } from "../utils/format";

const props = defineProps<{
  members: RoomMember[];
  transfers: TransferRecord[];
  contentHeightClass?: string;
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
  <section
    class="rounded-[1.75rem] border border-white/80 bg-white/80 p-4 shadow-[0_14px_32px_rgba(15,23,42,0.06)] backdrop-blur-sm"
  >
    <div class="mb-4 flex items-start justify-between gap-3">
      <div>
        <p class="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">
          Live Feed
        </p>
        <h3 class="mt-1 flex items-center gap-2 text-lg font-black tracking-tight text-slate-900">
          <span class="material-symbols-outlined text-[20px] text-slate-500">history</span>
          近期战况
        </h3>
        <p class="mt-1 text-xs font-medium text-slate-500">
          最近的转分记录会自动刷新。
        </p>
      </div>
      <span
        class="rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-bold text-slate-900"
      >
        {{ records.length ? `${records.length} 笔` : "实时同步" }}
      </span>
    </div>

    <div
      class="overflow-y-auto pr-1 scrollbar-hide"
      :class="props.contentHeightClass || 'h-[22rem]'"
    >
      <div v-if="records.length" class="space-y-3">
        <article
          v-for="record in records"
          :key="record.id"
          class="flex items-center gap-3 rounded-[1.35rem] border border-slate-200/80 bg-slate-50/80 p-3.5 shadow-[0_8px_18px_rgba(15,23,42,0.04)] transition-colors hover:border-slate-300"
        >
          <div
            class="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-primary/10 bg-primary/10"
          >
            <span
              class="material-symbols-outlined text-[18px] font-bold text-primary"
              >swap_horiz</span
            >
          </div>
          <div class="min-w-0 flex-1">
            <p class="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
              {{ record.meta }}
            </p>
            <p class="mt-1 truncate text-sm text-slate-800">
              <span class="font-black">{{ record.fromName }}</span>
              <span class="mx-1 text-slate-300">→</span>
              <span class="font-black">{{ record.toName }}</span>
            </p>
          </div>
          <div
            class="shrink-0 rounded-full border border-primary/15 bg-white px-3 py-1.5 text-right"
          >
            <span class="text-sm font-black text-primary">{{
              formatNumber(record.amount)
            }}</span>
            <span class="ml-0.5 text-[10px] font-bold text-primary/80">分</span>
          </div>
        </article>
      </div>

      <div
        v-else
        class="flex h-full flex-col items-center justify-center rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50/70 px-4 py-12 text-slate-400"
      >
        <span
          class="material-symbols-outlined mb-3 text-4xl opacity-30 text-slate-400"
          >data_info_alert</span
        >
        <p class="text-sm font-bold text-slate-500">还没有转分记录</p>
        <p class="mt-1 text-xs font-medium text-slate-400">
          点击成员卡片或底部按钮即可开始记分。
        </p>
      </div>
    </div>
  </section>
</template>
