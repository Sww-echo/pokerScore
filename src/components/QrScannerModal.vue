<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";

interface DetectedBarcode {
  rawValue?: string;
}

interface BarcodeDetectorInstance {
  detect(source: HTMLVideoElement): Promise<DetectedBarcode[]>;
}

interface BarcodeDetectorCtor {
  new (options?: { formats?: string[] }): BarcodeDetectorInstance;
}

const props = defineProps<{
  open: boolean;
  errorText?: string;
}>();

const emit = defineEmits<{
  close: [];
  clearError: [];
  detect: [payload: string];
}>();

const videoRef = ref<HTMLVideoElement | null>(null);
const manualPayload = ref("");
const status = ref<"idle" | "loading" | "ready" | "unsupported" | "error">(
  "idle"
);
const localErrorText = ref("");

let mediaStream: MediaStream | null = null;
let scanTimer: number | null = null;
let detector: BarcodeDetectorInstance | null = null;

const scannerWindow = window as Window & {
  BarcodeDetector?: BarcodeDetectorCtor;
};

const mergedErrorText = computed(() => props.errorText || localErrorText.value);

const helperText = computed(() => {
  if (mergedErrorText.value) {
    return mergedErrorText.value;
  }

  if (status.value === "loading") {
    return "正在打开后置摄像头，请稍候";
  }

  if (status.value === "ready") {
    return "将二维码对准取景框，识别成功后会自动入房";
  }

  if (status.value === "unsupported") {
    return "当前浏览器不支持相机扫码，可直接粘贴邀请链接或房间码";
  }

  if (status.value === "error") {
    return "相机启动失败，可检查权限后重试，或直接粘贴邀请内容";
  }

  return "支持扫码识别，也支持直接粘贴邀请链接";
});

function stopScanner() {
  if (scanTimer !== null) {
    window.clearTimeout(scanTimer);
    scanTimer = null;
  }

  mediaStream?.getTracks().forEach((track) => track.stop());
  mediaStream = null;
  detector = null;

  if (videoRef.value) {
    videoRef.value.srcObject = null;
  }
}

async function scanLoop() {
  if (!videoRef.value || !detector || status.value !== "ready") {
    return;
  }

  try {
    const barcodes = await detector.detect(videoRef.value);
    const rawValue = barcodes[0]?.rawValue?.trim();

    if (rawValue) {
      emit("detect", rawValue);
      return;
    }
  } catch {
    // 浏览器兼容性问题下忽略单次识别失败，继续下一轮扫描。
  }

  scanTimer = window.setTimeout(() => {
    void scanLoop();
  }, 450);
}

async function startScanner() {
  stopScanner();
  localErrorText.value = "";
  status.value = "loading";

  if (!scannerWindow.BarcodeDetector || !navigator.mediaDevices?.getUserMedia) {
    status.value = "unsupported";
    return;
  }

  try {
    detector = new scannerWindow.BarcodeDetector({
      formats: ["qr_code"],
    });

    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: {
          ideal: "environment",
        },
      },
    });

    await nextTick();

    if (!videoRef.value) {
      status.value = "error";
      localErrorText.value = "未能初始化扫码画面，请重试";
      return;
    }

    videoRef.value.srcObject = mediaStream;
    await videoRef.value.play();

    status.value = "ready";
    void scanLoop();
  } catch (error) {
    status.value = "error";
    localErrorText.value =
      error instanceof Error ? error.message : "相机权限获取失败";
    stopScanner();
  }
}

function closeModal() {
  stopScanner();
  manualPayload.value = "";
  localErrorText.value = "";
  status.value = "idle";
  emit("close");
}

function retryScanner() {
  manualPayload.value = "";
  emit("clearError");
  void startScanner();
}

function submitManualPayload() {
  if (!manualPayload.value.trim()) {
    localErrorText.value = "请先输入邀请链接或房间码";
    return;
  }

  localErrorText.value = "";
  emit("clearError");
  emit("detect", manualPayload.value);
}

watch(
  () => props.open,
  (open) => {
    if (open) {
      manualPayload.value = "";
      void startScanner();
      return;
    }

    stopScanner();
  },
  { immediate: true }
);

onBeforeUnmount(() => {
  stopScanner();
});
</script>

<template>
  <Transition name="fade">
    <div
      v-if="open"
      class="fixed inset-0 z-[120] grid place-items-center overflow-y-auto px-4 pt-[calc(env(safe-area-inset-top)+16px)] pb-[calc(env(safe-area-inset-bottom)+16px)]"
    >
      <div class="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" @click="closeModal"></div>

      <div
        class="relative flex h-[78dvh] max-h-[44rem] w-full max-w-sm flex-col overflow-hidden rounded-[2rem] border border-slate-100 bg-white shadow-2xl"
      >
        <div class="shrink-0 px-6 pb-3 pt-5">
          <div class="flex justify-end">
            <button
              @click="closeModal"
              class="flex size-8 items-center justify-center rounded-full bg-slate-100 transition-colors hover:bg-slate-200"
            >
              <span class="material-symbols-outlined text-[18px] text-slate-500">close</span>
            </button>
          </div>

          <div class="mt-1 flex flex-col items-center text-center">
            <div
              class="mb-4 flex size-14 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10"
            >
              <span class="material-symbols-outlined text-[28px] text-primary">qr_code_scanner</span>
            </div>
            <h3 class="text-xl font-bold text-slate-900">扫码加入房间</h3>
            <p class="mt-1 text-sm font-medium text-slate-500">支持识别邀请二维码，也支持粘贴邀请链接</p>
          </div>
        </div>

        <div class="min-h-0 flex-1 overflow-y-auto px-6 pb-6 scrollbar-hide">
          <div class="space-y-4">
            <div class="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-slate-950">
              <div class="relative aspect-square w-full">
                <video
                  ref="videoRef"
                  playsinline
                  muted
                  class="h-full w-full object-cover"
                  :class="{ 'opacity-0': status !== 'ready' }"
                ></video>

                <div
                  v-if="status !== 'ready'"
                  class="absolute inset-0 flex flex-col items-center justify-center px-6 text-center"
                >
                  <span
                    class="material-symbols-outlined mb-3 text-5xl"
                    :class="
                      mergedErrorText || status === 'error'
                        ? 'text-rose-300'
                        : 'text-white/80'
                    "
                  >{{ status === 'loading' ? 'camera' : 'qr_code_2' }}</span>
                  <p
                    class="text-sm font-medium"
                    :class="
                      mergedErrorText || status === 'error'
                        ? 'text-rose-100'
                        : 'text-white/80'
                    "
                  >{{ helperText }}</p>
                </div>

                <div
                  v-else
                  class="pointer-events-none absolute inset-0 flex items-center justify-center"
                >
                  <div class="relative h-48 w-48 rounded-[1.75rem] border-2 border-white/90">
                    <div
                      class="absolute -left-0.5 -top-0.5 h-8 w-8 rounded-tl-[1.25rem] border-l-4 border-t-4 border-primary"
                    ></div>
                    <div
                      class="absolute -right-0.5 -top-0.5 h-8 w-8 rounded-tr-[1.25rem] border-r-4 border-t-4 border-primary"
                    ></div>
                    <div
                      class="absolute -bottom-0.5 -left-0.5 h-8 w-8 rounded-bl-[1.25rem] border-b-4 border-l-4 border-primary"
                    ></div>
                    <div
                      class="absolute -bottom-0.5 -right-0.5 h-8 w-8 rounded-br-[1.25rem] border-b-4 border-r-4 border-primary"
                    ></div>
                    <div
                      class="absolute left-4 right-4 top-1/2 h-0.5 -translate-y-1/2 bg-primary/80 shadow-[0_0_18px_rgba(249,212,6,0.6)]"
                    ></div>
                  </div>
                </div>
              </div>
            </div>

            <p
              class="text-center text-xs font-medium"
              :class="mergedErrorText ? 'text-rose-500' : 'text-slate-500'"
            >{{ helperText }}</p>

            <button
              v-if="status === 'error'"
              @click="retryScanner"
              class="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold text-slate-900 transition-colors hover:bg-slate-100"
            >
              <span class="material-symbols-outlined text-[18px]">restart_alt</span>
              重新打开相机
            </button>
          </div>
        </div>
      </div>
    </div>
  </Transition>
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
