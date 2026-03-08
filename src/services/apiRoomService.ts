import type {
  AuthMode,
  RoomMember,
  RoomState,
  SettlementSnapshot,
  SettlementSuggestion,
  TransferDraft,
  TransferRecord,
  UserProfile,
} from "../types";
import { apiRequest } from "./apiClient";

interface AuthUserPayload {
  id: string;
  nickname: string;
  authMode: AuthMode;
  accent: string;
  avatarUrl: string | null;
}

interface AuthResponsePayload {
  user: AuthUserPayload;
  token: string;
  refreshToken?: string;
}

interface RoomMemberPayload extends RoomMember {
  avatarUrl?: string | null;
}

interface SettlementSnapshotPayload {
  settledAt: string;
  ranking: RoomMemberPayload[];
  suggestions: SettlementSuggestion[];
}

interface RoomSnapshotPayload {
  code: string;
  name: string;
  status: "active" | "settled";
  updatedAt: string;
  version?: number;
  roundNo?: number;
  currentUserMemberId?: string | null;
  members: RoomMemberPayload[];
  transfers: TransferRecord[];
  settlement: SettlementSnapshotPayload | null;
}

interface RoomEnvelope {
  room: RoomSnapshotPayload;
}

interface RoomCreateOrJoinEnvelope extends RoomEnvelope {
  roomCode: string;
}

interface InviteInfoResponse {
  roomCode: string;
  inviteLink: string;
}

function mapRoomMember(member: RoomMemberPayload): RoomMember {
  return {
    id: member.id,
    nickname: member.nickname,
    authMode: member.authMode,
    accent: member.accent,
    avatarUrl: member.avatarUrl ?? null,
    seatLabel: member.seatLabel,
    score: member.score,
    isOnline: member.isOnline,
    isCurrentUser: member.isCurrentUser,
  };
}

function mapSettlement(snapshot: SettlementSnapshotPayload | null): SettlementSnapshot | null {
  if (!snapshot) {
    return null;
  }

  return {
    settledAt: snapshot.settledAt,
    ranking: snapshot.ranking.map(mapRoomMember),
    suggestions: snapshot.suggestions,
  };
}

function mapRoomSnapshot(room: RoomSnapshotPayload): RoomState {
  return {
    code: room.code,
    name: room.name,
    status: room.status,
    updatedAt: room.updatedAt,
    version: room.version,
    roundNo: room.roundNo,
    currentUserMemberId: room.currentUserMemberId ?? null,
    members: room.members.map(mapRoomMember),
    transfers: room.transfers,
    settlement: mapSettlement(room.settlement),
  };
}

export async function authWithGuest(payload: {
  nickname?: string;
  deviceId: string;
}) {
  const result = await apiRequest<AuthResponsePayload>("/auth/guest", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return {
    user: mapAuthUser(result.user),
    token: result.token,
    refreshToken: result.refreshToken ?? "",
  };
}

export async function authWithWechat(payload: {
  code: string;
  inviterRoomCode?: string;
}) {
  const result = await apiRequest<AuthResponsePayload>("/auth/wechat/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return {
    user: mapAuthUser(result.user),
    token: result.token,
    refreshToken: result.refreshToken ?? "",
  };
}

export async function createRoomRequest(
  token: string,
  payload: {
    nickname?: string;
    roomName?: string;
  },
) {
  const result = await apiRequest<RoomCreateOrJoinEnvelope>("/rooms", {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });

  return {
    roomCode: result.roomCode,
    room: mapRoomSnapshot(result.room),
  };
}

export async function joinRoomRequest(
  token: string,
  roomCode: string,
  payload: {
    nickname?: string;
  },
) {
  const result = await apiRequest<RoomCreateOrJoinEnvelope>(`/rooms/${encodeURIComponent(roomCode)}/join`, {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });

  return {
    roomCode: result.roomCode,
    room: mapRoomSnapshot(result.room),
  };
}

export async function getRoomSnapshotRequest(token: string, roomCode: string) {
  const result = await apiRequest<RoomEnvelope>(`/rooms/${encodeURIComponent(roomCode)}`, {
    token,
  });

  return {
    room: mapRoomSnapshot(result.room),
  };
}

export async function getInviteInfoRequest(token: string, roomCode: string) {
  return apiRequest<InviteInfoResponse>(`/rooms/${encodeURIComponent(roomCode)}/invite`, {
    token,
  });
}

export async function createTransfersRequest(
  token: string,
  roomCode: string,
  payload: {
    requestId: string;
    expectedVersion?: number;
    items: TransferDraft[];
  },
) {
  const result = await apiRequest<{
    room: RoomSnapshotPayload;
    createdTransfers: TransferRecord[];
  }>(`/rooms/${encodeURIComponent(roomCode)}/transfers`, {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });

  return {
    room: mapRoomSnapshot(result.room),
    createdTransfers: result.createdTransfers,
  };
}

export async function createSettlementRequest(
  token: string,
  roomCode: string,
  payload: {
    requestId: string;
    expectedVersion?: number;
  },
) {
  const result = await apiRequest<{
    room: RoomSnapshotPayload;
    settlement: SettlementSnapshotPayload;
  }>(`/rooms/${encodeURIComponent(roomCode)}/settlements`, {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });

  return {
    room: mapRoomSnapshot(result.room),
    settlement: mapSettlement(result.settlement),
  };
}

export async function getCurrentSettlementRequest(token: string, roomCode: string) {
  const result = await apiRequest<{
    room: RoomSnapshotPayload;
    settlement: SettlementSnapshotPayload;
  }>(`/rooms/${encodeURIComponent(roomCode)}/settlements/current`, {
    token,
  });

  return {
    room: mapRoomSnapshot(result.room),
    settlement: mapSettlement(result.settlement),
  };
}

export async function reopenRoomRequest(
  token: string,
  roomCode: string,
  payload: {
    requestId: string;
    expectedVersion?: number;
  },
) {
  const result = await apiRequest<RoomEnvelope>(`/rooms/${encodeURIComponent(roomCode)}/reopen`, {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });

  return {
    room: mapRoomSnapshot(result.room),
  };
}

function mapAuthUser(user: AuthUserPayload): UserProfile {
  return {
    id: user.id,
    nickname: user.nickname,
    authMode: user.authMode,
    accent: user.accent,
    avatarUrl: user.avatarUrl ?? null,
  };
}
