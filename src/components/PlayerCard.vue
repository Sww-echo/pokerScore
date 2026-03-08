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

const cardClass = computed(() => {
  if (props.member.isCurrentUser) {
    return "border-primary/35 bg-[linear-gradient(180deg,rgba(249,212,6,0.14)_0%,rgba(255,255,255,0.96)_100%)] shadow-[0_12px_24px_rgba(249,212,6,0.16)]";
  }
  if (props.member.score > 0) {
    return "border-primary/20 bg-white";
  }
  if (props.member.score < 0) {
    return "border-rose-200 bg-white";
  }
  return "border-slate-200 bg-white/88";
});

const avatarRingClass = computed(() => {
  if (props.member.isCurrentUser)
    return "border-primary shadow-[0_0_15px_rgba(249,212,6,0.3)]";
  if (props.member.score > 0) return "border-primary/40";
  if (props.member.score < 0) return "border-rose-400/40";
  return "border-slate-200";
});

const metaLabel = computed(() => {
  if (props.member.isCurrentUser) return "自己";
  return props.member.isOnline ? "在线" : "离线";
});

const metaClass = computed(() => {
  if (props.member.isCurrentUser) {
    return "border-primary/20 bg-primary/10 text-slate-900";
  }
  return props.member.isOnline
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border-slate-200 bg-slate-100 text-slate-400";
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
  <button
    type="button"
    class="group flex h-full w-full flex-col items-center rounded-[1.5rem] border px-2.5 py-3 text-center shadow-[0_10px_24px_rgba(15,23,42,0.05)] transition-transform active:scale-[0.98]"
    :class="[
      cardClass,
      props.member.isCurrentUser ? 'cursor-default' : 'cursor-pointer',
      !props.member.isOnline ? 'opacity-75' : '',
    ]"
    @click="openTransfer"
  >
    <div class="relative transition-transform group-active:scale-[0.98]">
      <div class="size-14 rounded-full border-2 p-0.5" :class="avatarRingClass">
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

    <div class="mt-2 w-full px-1">
      <p
        class="w-full truncate text-sm font-bold"
        :class="
          props.member.isCurrentUser ? 'text-slate-900' : 'text-slate-700'
        "
      >
        {{ member.nickname }}
      </p>

      <div
        class="mx-auto mt-1 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold"
        :class="metaClass"
      >
        {{ metaLabel }}
      </div>

      <p class="mt-2 text-sm font-black" :class="scoreClass">
        {{ formatScore(member.score) }}
      </p>
    </div>
  </button>
</template>
