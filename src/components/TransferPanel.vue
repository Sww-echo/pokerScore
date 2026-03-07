<script setup lang="ts">
import { computed, reactive, watch } from "vue";
import type { RoomMember, TransferDraft, TransferMode } from "../types";
import { formatScore } from "../utils/format";

const props = defineProps<{
  open: boolean;
  mode: TransferMode;
  members: RoomMember[];
  currentUser: RoomMember | null;
  initialRecipientId: string | null;
}>();

const emit = defineEmits<{
  close: [];
  submit: [drafts: TransferDraft[], mode: TransferMode];
}>();

const selectedIds = reactive<string[]>([]);
const amountMap = reactive<Record<string, string>>({});

const selectableMembers = computed(() =>
  props.members.filter((member) => !member.isCurrentUser),
);

const totalScore = computed(() =>
  selectedIds.reduce(
    (total, memberId) =>
      total + Number.parseInt(amountMap[memberId] || "0", 10),
    0,
  ),
);

watch(
  () => [props.open, props.mode, props.initialRecipientId] as const,
  ([isOpen, mode, initialRecipientId]) => {
    selectedIds.splice(0, selectedIds.length);
    Object.keys(amountMap).forEach((key) => delete amountMap[key]);

    if (!isOpen) return;

    if (mode === "single" && initialRecipientId) {
      selectedIds.push(initialRecipientId);
      amountMap[initialRecipientId] = "10";
    }
  },
  { immediate: true },
);

function toggleRecipient(memberId: string) {
  if (props.mode === "single") {
    selectedIds.splice(0, selectedIds.length, memberId);
    if (!amountMap[memberId]) amountMap[memberId] = "10";
    return;
  }

  const index = selectedIds.indexOf(memberId);
  if (index >= 0) {
    selectedIds.splice(index, 1);
    delete amountMap[memberId];
    return;
  }

  selectedIds.push(memberId);
  amountMap[memberId] = amountMap[memberId] || "10";
}

function closePanel() {
  emit("close");
}

function submitTransfer() {
  const drafts = selectedIds
    .map((memberId) => ({
      toMemberId: memberId,
      score: Number.parseInt(amountMap[memberId] || "0", 10),
    }))
    .filter((draft) => Number.isInteger(draft.score) && draft.score > 0);

  if (drafts.length === 0) {
    window.alert("请至少选择一位收款人，并确保划转金额大于 0。");
    return;
  }

  emit("submit", drafts, props.mode);
}

function handleAmountChange(event: Event, memberId: string) {
  const target = event.target as HTMLInputElement;
  let val = parseInt(target.value, 10);
  if (isNaN(val) || val < 0) {
    val = 0;
  }

  if (props.mode === "single" && val > 0) {
    selectedIds.splice(0, selectedIds.length, memberId);
    Object.keys(amountMap).forEach((key) => {
      if (key !== memberId) {
        amountMap[key] = "";
      }
    });
  }

  amountMap[memberId] = val.toString();

  if (val > 0 && !selectedIds.includes(memberId)) {
    selectedIds.push(memberId);
  } else if (val === 0 && selectedIds.includes(memberId)) {
    const idx = selectedIds.indexOf(memberId);
    if (idx > -1) selectedIds.splice(idx, 1);
  }
}

function getGradient(id: string) {
  const hash = id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const colors = [
    "from-slate-200 to-slate-400 text-slate-800",
    "from-primary to-yellow-300 text-slate-900",
    "from-emerald-200 to-emerald-400 text-emerald-900",
    "from-rose-200 to-rose-400 text-rose-900",
  ];
  return colors[hash % colors.length];
}
</script>

<template>
  <Transition name="fade">
    <div
      v-if="open"
      class="fixed inset-0 z-[100] flex flex-col justify-end antialiased font-display"
    >
      <div
        class="absolute inset-0 z-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
        @click.self="closePanel"
      ></div>

      <div
        class="relative z-10 flex flex-col w-full bg-white rounded-t-[2rem] shadow-2xl border-t border-slate-200 slide-up max-w-xl mx-auto h-[85vh] max-h-[800px]"
      >
        <div class="flex h-6 w-full items-center justify-center pt-3 shrink-0">
          <div class="h-1.5 w-12 rounded-full bg-slate-300"></div>
        </div>

        <div class="px-6 pt-5 pb-3 flex justify-between items-center shrink-0">
          <h3 class="text-slate-900 text-xl font-bold tracking-tight">
            积分转账
          </h3>
          <button
            @click="closePanel"
            class="flex size-8 items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 transition"
          >
            <span class="material-symbols-outlined text-slate-500 text-[18px]"
              >close</span
            >
          </button>
        </div>

        <div class="px-6 py-4 shrink-0">
          <div
            class="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200 shadow-sm"
          >
            <div
              class="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30"
            >
              <span
                class="material-symbols-outlined text-primary text-2xl font-bold"
                >account_balance_wallet</span
              >
            </div>
            <div class="flex flex-col">
              <p
                class="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-0.5"
              >
                付款账户 (我)
              </p>
              <p class="text-slate-900 text-base font-bold">
                {{ currentUser?.nickname ?? "未登录" }}
              </p>
              <div class="flex items-center gap-1.5 mt-0.5">
                <span class="text-primary text-base font-black">{{
                  currentUser?.score ?? 0
                }}</span>
                <span class="text-slate-500 text-xs font-medium">当前积分</span>
              </div>
            </div>
          </div>
        </div>

        <div
          class="flex-1 overflow-y-auto px-6 py-2 scrollbar-hide pb-4 min-h-0"
        >
          <div
            class="flex justify-between items-center mb-4 sticky top-0 bg-white/95 backdrop-blur z-20 py-2"
          >
            <h4
              class="text-slate-900 text-sm font-bold tracking-widest uppercase"
            >
              选择收款人与金额
            </h4>
            <span
              class="text-primary text-xs font-bold bg-primary/10 px-2 py-1 rounded-sm"
              >{{ mode === "single" ? "单人" : "多人" }}转账</span
            >
          </div>

          <div class="space-y-3 pb-8">
            <label
              v-for="member in selectableMembers"
              :key="member.id"
              class="flex items-center gap-3 p-3.5 rounded-2xl border transition-all cursor-pointer shadow-sm relative overflow-hidden"
              :class="
                selectedIds.includes(member.id)
                  ? 'bg-primary/5 border-primary shadow-primary/10'
                  : 'bg-white border-slate-200 hover:border-primary/50'
              "
            >
              <div
                v-if="selectedIds.includes(member.id)"
                class="absolute left-0 top-0 bottom-0 w-1 bg-primary"
              ></div>

              <input
                :type="mode === 'single' ? 'radio' : 'checkbox'"
                :checked="selectedIds.includes(member.id)"
                @change="toggleRecipient(member.id)"
                class="hidden"
              />

              <div
                class="size-6 rounded-full border-2 flex items-center justify-center transition-colors"
                :class="
                  selectedIds.includes(member.id)
                    ? 'border-primary bg-primary'
                    : 'border-slate-300 bg-white'
                "
              >
                <span
                  v-if="selectedIds.includes(member.id)"
                  class="material-symbols-outlined text-white text-[16px] font-bold"
                  >check</span
                >
              </div>

              <div
                class="size-10 rounded-full bg-gradient-to-tr shrink-0 flex items-center justify-center text-white font-bold"
                :class="getGradient(member.id)"
              >
                {{ member.nickname.slice(0, 1).toUpperCase() }}
              </div>

              <div class="flex-1 min-w-0">
                <p class="text-slate-900 text-sm font-bold truncate">
                  {{ member.nickname }}
                </p>
                <p class="text-slate-400 text-xs mt-0.5">
                  {{ formatScore(member.score) }} 积分
                </p>
              </div>

              <div class="relative w-28 shrink-0">
                <input
                  type="number"
                  inputmode="numeric"
                  :value="amountMap[member.id] || ''"
                  @input="handleAmountChange($event, member.id)"
                  class="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-sm text-right font-black focus:border-primary focus:bg-white focus:outline-none transition-colors shadow-inner"
                  :class="
                    selectedIds.includes(member.id)
                      ? 'text-primary border-primary bg-white'
                      : 'text-slate-500'
                  "
                  placeholder="金额"
                />
              </div>
            </label>
          </div>
        </div>

        <div
          class="shrink-0 mt-auto px-6 py-6 pb-safe bg-slate-50 border-t border-slate-200 shadow-[0_-4px_20px_rgba(0,0,0,0.02)]"
        >
          <div class="flex justify-between items-center mb-6">
            <div>
              <p
                class="text-slate-400 text-[10px] font-bold tracking-widest uppercase mb-1"
              >
                转账总额
              </p>
              <div class="flex items-baseline gap-1.5">
                <span
                  class="text-slate-900 text-4xl font-black tracking-tight"
                  :class="
                    totalScore > 0
                      ? 'text-primary drop-shadow-[0_2px_10px_rgba(249,212,6,0.3)]'
                      : ''
                  "
                  >{{ formatScore(totalScore) }}</span
                >
                <span class="text-slate-400 text-sm font-bold">积分</span>
              </div>
            </div>
            <div class="text-right flex flex-col items-end">
              <p
                class="text-slate-400 text-[10px] uppercase font-bold tracking-widest mb-1"
              >
                已选收款人数
              </p>
              <div
                class="bg-slate-200 px-3 py-1 rounded-lg text-slate-700 text-sm font-bold border border-slate-300"
              >
                {{ selectedIds.length }} 人
              </div>
            </div>
          </div>

          <button
            @click="submitTransfer"
            class="w-full bg-primary hover:bg-[#ebd074] text-slate-900 font-bold tracking-widest text-lg py-4 rounded-xl shadow-[0_4px_20px_rgba(249,212,6,0.2)] transition-transform active:scale-[0.98]"
          >
            确认划转
          </button>

          <p
            class="text-center text-slate-400 text-xs mt-4 font-medium uppercase tracking-widest"
          >
            点按确认即立即生效，请仔细核对
          </p>
        </div>
      </div>
    </div>
  </Transition>
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
    transform: translateY(100%);
  }
  to {
    transform: translateY(0);
  }
}

.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
