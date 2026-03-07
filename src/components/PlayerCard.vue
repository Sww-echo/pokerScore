<script setup lang="ts">
import { computed } from "vue";
import type { RoomMember } from "../types";
import { formatScore } from "../utils/format";

const props = defineProps<{
  member: RoomMember;
}>();

const emit = defineEmits<{
  transfer: [memberId: string];
}>();

const initial = computed(() => props.member.nickname.slice(0, 1).toUpperCase());

const scoreClass = computed(() => {
  if (props.member.score > 0) return "text-primary";
  if (props.member.score < 0) return "text-rose-500";
  return "text-slate-500";
});

const borderClass = computed(() => {
  if (props.member.isCurrentUser)
    return "border-primary shadow-[0_0_15px_rgba(249,212,6,0.3)]";
  if (props.member.score > 0) return "border-primary/40";
  if (props.member.score < 0) return "border-rose-400/40";
  return "border-slate-200";
});

function getGradient(id: string) {
  const hash = id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const colors = [
    "bg-gradient-to-tr from-slate-200 to-slate-300 text-slate-700",
    "bg-gradient-to-tr from-primary to-yellow-300 text-slate-800",
    "bg-gradient-to-tr from-emerald-100 to-emerald-200 text-emerald-800",
    "bg-gradient-to-tr from-rose-100 to-rose-200 text-rose-800",
  ];
  return colors[hash % colors.length];
}

function openTransfer() {
  if (props.member.isCurrentUser) return;
  emit("transfer", props.member.id);
}
</script>

<template>
  <div
    class="flex flex-col items-center gap-2 group cursor-pointer"
    :class="{ 'opacity-60': !props.member.isOnline }"
    @click="openTransfer"
  >
    <div class="relative transition-transform group-active:scale-95">
      <div class="size-16 rounded-full border-2 p-0.5" :class="borderClass">
        <div
          class="w-full h-full rounded-full overflow-hidden flex items-center justify-center font-bold text-2xl shadow-sm"
          :class="
            props.member.isCurrentUser
              ? 'bg-primary text-slate-900 border border-primary/20'
              : getGradient(props.member.id)
          "
        >
          {{ initial }}
        </div>
      </div>

      <div
        v-if="props.member.isCurrentUser"
        class="absolute -bottom-1 -right-1 size-5 bg-primary rounded-full flex items-center justify-center border-2 border-background-light shadow-sm"
      >
        <span
          class="material-symbols-outlined text-[10px] text-slate-900 font-bold"
          >star</span
        >
      </div>
      <div
        v-else-if="props.member.score > 0"
        class="absolute -bottom-1 -right-1 size-5 bg-primary rounded-full flex items-center justify-center border-2 border-background-light shadow-sm"
      >
        <span
          class="material-symbols-outlined text-[10px] text-slate-900 font-bold"
          >trending_up</span
        >
      </div>
      <div
        v-else-if="props.member.score < 0"
        class="absolute -bottom-1 -right-1 size-5 bg-rose-500 rounded-full flex items-center justify-center border-2 border-background-light shadow-sm"
      >
        <span class="material-symbols-outlined text-[10px] text-white font-bold"
          >trending_down</span
        >
      </div>
    </div>
    <div class="text-center w-full px-1">
      <p
        class="text-sm font-bold w-full truncate"
        :class="
          props.member.isCurrentUser ? 'text-slate-900' : 'text-slate-700'
        "
      >
        {{ member.nickname }}
      </p>
      <p class="text-xs font-black" :class="scoreClass">
        {{ formatScore(member.score) }}
      </p>
    </div>
  </div>
</template>
