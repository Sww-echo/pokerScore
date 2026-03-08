import { computed, ref } from "vue";
import { defineStore } from "pinia";
import type {
  AuthMode,
  AuthSession,
  CreateRoomPayload,
  JoinRoomPayload,
  RoomState,
  SettlementSnapshot,
  TransferDraft,
  TransferMode,
  UserProfile,
} from "../types";
import {
  authWithGuest,
  authWithWechat,
  createRoomRequest,
  createSettlementRequest,
  createTransfersRequest,
  getCurrentSettlementRequest,
  getInviteInfoRequest,
  getRoomSnapshotRequest,
  joinRoomRequest,
  reopenRoomRequest,
} from "../services/apiRoomService";
import { ApiError } from "../services/apiClient";
import {
  connectRoomRealtime as openRoomRealtime,
  disconnectRoomRealtime as closeRoomRealtime,
} from "../services/realtimeRoomService";
import {
  generateDefaultNickname,
  normalizeNickname,
  normalizeRoomCode,
  normalizeRoomName,
  validateRoomCode,
} from "../utils/roomForm";

const STORAGE_KEY = "poker-score-room-state-v2";
const DEVICE_ID_KEY = "poker-score-device-id";

interface PersistedState {
  profile: UserProfile | null;
  room: RoomState | null;
  auth: AuthSession | null;
}

function saveState(payload: PersistedState) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function loadState(): PersistedState | null {
  const raw = window.localStorage.getItem(STORAGE_KEY);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as PersistedState;
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

function getOrCreateDeviceId() {
  const stored = window.localStorage.getItem(DEVICE_ID_KEY);

  if (stored) {
    return stored;
  }

  const nextId =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `device-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  window.localStorage.setItem(DEVICE_ID_KEY, nextId);
  return nextId;
}

function createRequestId(prefix: string) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}_${crypto.randomUUID()}`;
  }

  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export const useRoomStore = defineStore("room", () => {
  const profile = ref<UserProfile | null>(null);
  const room = ref<RoomState | null>(null);
  const auth = ref<AuthSession | null>(null);
  const inviteLink = ref("");
  const syncing = ref(false);
  const realtimeConnected = ref(false);

  function persist() {
    saveState({
      profile: profile.value,
      room: room.value,
      auth: auth.value,
    });
  }

  function hydrate() {
    const persisted = loadState();

    if (!persisted) {
      return;
    }

    profile.value = persisted.profile;
    room.value = persisted.room ? normalizeRoomSnapshot(persisted.room) : null;
    auth.value = persisted.auth;
  }

  function clearState() {
    closeRoomRealtime(room.value?.code || "");
    profile.value = null;
    room.value = null;
    auth.value = null;
    inviteLink.value = "";
    realtimeConnected.value = false;
    window.localStorage.removeItem(STORAGE_KEY);
  }

  function assignProfile(user: UserProfile, preferredNickname?: string) {
    profile.value = {
      ...user,
      nickname: preferredNickname?.trim() ? normalizeNickname(preferredNickname) : user.nickname,
    };
  }

  function normalizeRoomSnapshot(nextRoom: RoomState) {
    const fallbackMemberId =
      room.value?.code === nextRoom.code ? room.value?.currentUserMemberId ?? null : null;
    const currentUserMemberId = nextRoom.currentUserMemberId ?? fallbackMemberId ?? null;

    return {
      ...nextRoom,
      currentUserMemberId,
      members: nextRoom.members.map((member) => ({
        ...member,
        isCurrentUser: member.id === currentUserMemberId,
      })),
      settlement: nextRoom.settlement
        ? {
            ...nextRoom.settlement,
            ranking: nextRoom.settlement.ranking.map((member) => ({
              ...member,
              isCurrentUser: member.id === currentUserMemberId,
            })),
          }
        : null,
    };
  }

  function assignRoom(nextRoom: RoomState | null) {
    room.value = nextRoom ? normalizeRoomSnapshot(nextRoom) : null;
    persist();
    return room.value;
  }

  async function withApiGuard<T>(runner: () => Promise<T>) {
    syncing.value = true;

    try {
      return await runner();
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        clearState();
      }

      throw error;
    } finally {
      syncing.value = false;
    }
  }

  async function authenticate(
    nickname: string,
    authMode: AuthMode,
    inviterRoomCode?: string,
  ) {
    return withApiGuard(async () => {
      const deviceId = getOrCreateDeviceId();
      const preferredNickname = nickname.trim() ? normalizeNickname(nickname) : "";
      const authResponse =
        authMode === "wechat"
          ? await authWithWechat({
              code: `wechat-${deviceId}`,
              inviterRoomCode,
            })
          : await authWithGuest({
              nickname: preferredNickname || undefined,
              deviceId,
            });

      assignProfile(authResponse.user, preferredNickname);
      auth.value = {
        token: authResponse.token,
        refreshToken: authResponse.refreshToken,
        deviceId,
      };
      persist();

      return authResponse.token;
    });
  }

  async function ensureAccessToken() {
    if (auth.value?.token) {
      return auth.value.token;
    }

    const fallbackNickname = profile.value?.nickname ?? generateDefaultNickname();
    const fallbackAuthMode = profile.value?.authMode ?? "guest";

    return authenticate(fallbackNickname, fallbackAuthMode);
  }

  async function refreshInviteLink(roomCode?: string) {
    const targetRoomCode = normalizeRoomCode(roomCode || room.value?.code || "");

    if (!targetRoomCode) {
      inviteLink.value = "";
      return "";
    }

    return withApiGuard(async () => {
      const token = await ensureAccessToken();
      const result = await getInviteInfoRequest(token, targetRoomCode);
      inviteLink.value = result.inviteLink;
      persist();
      return result.inviteLink;
    });
  }

  async function createRoom(payload: CreateRoomPayload) {
    const nickname = normalizeNickname(payload.nickname);
    const roomName = normalizeRoomName(payload.roomName, nickname);
    const token = await authenticate(nickname, payload.authMode);

    return withApiGuard(async () => {
      const result = await createRoomRequest(token, {
        nickname,
        roomName,
      });

      assignRoom(result.room);
      await refreshInviteLink(result.roomCode).catch(() => "");
      return result.roomCode;
    });
  }

  async function joinRoom(payload: JoinRoomPayload) {
    const validationMessage = validateRoomCode(payload.roomCode);

    if (validationMessage) {
      throw new Error(validationMessage);
    }

    const nickname = normalizeNickname(payload.nickname);
    const roomCode = normalizeRoomCode(payload.roomCode);
    const token = await authenticate(nickname, payload.authMode, roomCode);

    return withApiGuard(async () => {
      const result = await joinRoomRequest(token, roomCode, {
        nickname,
      });

      assignRoom(result.room);
      await refreshInviteLink(result.roomCode).catch(() => "");
      return result.roomCode;
    });
  }

  async function fetchRoom(roomCodeValue?: string) {
    const targetRoomCode = normalizeRoomCode(roomCodeValue || room.value?.code || "");

    if (!targetRoomCode) {
      throw new Error("房间码不能为空");
    }

    return withApiGuard(async () => {
      const token = await ensureAccessToken();
      const result = await getRoomSnapshotRequest(token, targetRoomCode);
      assignRoom(result.room);
      return result.room;
    });
  }

  async function transferScores(drafts: TransferDraft[], _mode: TransferMode) {
    if (!room.value || room.value.status === "settled") {
      return false;
    }

    const validDrafts = drafts.filter((draft) => draft.score > 0);

    if (!validDrafts.length) {
      return false;
    }

    return withApiGuard(async () => {
      const token = await ensureAccessToken();
      const result = await createTransfersRequest(token, room.value!.code, {
        requestId: createRequestId("transfer"),
        expectedVersion: room.value?.version,
        items: validDrafts,
      });

      assignRoom(result.room);
      return true;
    });
  }

  async function settleRoom() {
    if (!room.value) {
      return null;
    }

    return withApiGuard(async () => {
      const token = await ensureAccessToken();
      const result = await createSettlementRequest(token, room.value!.code, {
        requestId: createRequestId("settlement"),
        expectedVersion: room.value?.version,
      });

      assignRoom(result.room);
      return result.settlement;
    });
  }

  async function fetchCurrentSettlement(roomCodeValue?: string) {
    const targetRoomCode = normalizeRoomCode(roomCodeValue || room.value?.code || "");

    if (!targetRoomCode) {
      throw new Error("房间码不能为空");
    }

    return withApiGuard(async () => {
      const token = await ensureAccessToken();
      const result = await getCurrentSettlementRequest(token, targetRoomCode);
      assignRoom(result.room);
      return result.settlement as SettlementSnapshot;
    });
  }

  async function reopenRoom() {
    if (!room.value) {
      return;
    }

    return withApiGuard(async () => {
      const token = await ensureAccessToken();
      const result = await reopenRoomRequest(token, room.value!.code, {
        requestId: createRequestId("reopen"),
        expectedVersion: room.value?.version,
      });

      assignRoom(result.room);
      return result.room;
    });
  }

  async function connectRoomRealtime(roomCodeValue?: string) {
    const targetRoomCode = normalizeRoomCode(roomCodeValue || room.value?.code || "");

    if (!targetRoomCode) {
      return;
    }

    const token = await ensureAccessToken();

    openRoomRealtime(
      targetRoomCode,
      {
        onRoomSnapshot: (nextRoom) => {
          if (normalizeRoomCode(nextRoom.code) !== targetRoomCode) {
            return;
          }

          assignRoom(nextRoom);
        },
        onDisconnected: () => {
          realtimeConnected.value = false;
        },
      },
      token,
    );

    realtimeConnected.value = true;
  }

  function disconnectRoomRealtime(roomCodeValue?: string) {
    closeRoomRealtime(roomCodeValue || room.value?.code || "");
    realtimeConnected.value = false;
  }

  const currentUser = computed(
    () => room.value?.members.find((member) => member.isCurrentUser) ?? null,
  );
  const ranking = computed(() =>
    room.value ? [...room.value.members].sort((left, right) => right.score - left.score) : [],
  );
  const totalTransfers = computed(() => room.value?.transfers.length ?? 0);

  return {
    profile,
    room,
    auth,
    inviteLink,
    syncing,
    realtimeConnected,
    currentUser,
    ranking,
    totalTransfers,
    hydrate,
    clearState,
    authenticate,
    createRoom,
    joinRoom,
    fetchRoom,
    refreshInviteLink,
    transferScores,
    settleRoom,
    fetchCurrentSettlement,
    reopenRoom,
    connectRoomRealtime,
    disconnectRoomRealtime,
  };
});
