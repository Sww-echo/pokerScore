import { io, type Socket } from "socket.io-client";
import type { RoomState } from "../types";

type RoomEventPayload = {
  room?: RoomState;
};

interface RoomRealtimeHandlers {
  onRoomSnapshot: (room: RoomState) => void;
  onDisconnected?: () => void;
}

let socket: Socket | null = null;
let joinedRoomCode = "";

function resolveSocketUrl() {
  const configured = import.meta.env.VITE_WS_BASE_URL?.trim();

  if (configured) {
    return configured.replace(/\/$/, "");
  }

  return window.location.origin;
}

export function connectRoomRealtime(
  roomCode: string,
  handlers: RoomRealtimeHandlers,
  token?: string,
) {
  const normalizedRoomCode = roomCode.trim().toUpperCase();

  if (!normalizedRoomCode) {
    return null;
  }

  if (!socket) {
    socket = io(`${resolveSocketUrl()}/ws`, {
      autoConnect: false,
      transports: ["websocket"],
      auth: token
        ? {
            token,
          }
        : undefined,
    });
  } else if (token) {
    socket.auth = {
      token,
    };
  }

  if (!socket.connected) {
    socket.connect();
  }

  const forwardRoomPayload = (payload: RoomEventPayload) => {
    if (payload?.room) {
      handlers.onRoomSnapshot(payload.room);
    }
  };

  socket.off("room:snapshot");
  socket.off("room:member_joined");
  socket.off("room:transfer_created");
  socket.off("room:settlement_created");
  socket.off("room:reopened");
  socket.off("disconnect");

  socket.on("room:snapshot", forwardRoomPayload);
  socket.on("room:member_joined", forwardRoomPayload);
  socket.on("room:transfer_created", forwardRoomPayload);
  socket.on("room:settlement_created", forwardRoomPayload);
  socket.on("room:reopened", forwardRoomPayload);
  socket.on("disconnect", () => {
    handlers.onDisconnected?.();
  });

  if (joinedRoomCode && joinedRoomCode !== normalizedRoomCode) {
    socket.emit("room:leave", {
      roomCode: joinedRoomCode,
    });
  }

  joinedRoomCode = normalizedRoomCode;
  socket.emit("room:join", {
    roomCode: normalizedRoomCode,
  });

  return socket;
}

export function disconnectRoomRealtime(roomCode?: string) {
  if (!socket) {
    return;
  }

  const targetRoomCode = roomCode?.trim().toUpperCase() || joinedRoomCode;

  if (targetRoomCode) {
    socket.emit("room:leave", {
      roomCode: targetRoomCode,
    });
  }

  socket.off("room:snapshot");
  socket.off("room:member_joined");
  socket.off("room:transfer_created");
  socket.off("room:settlement_created");
  socket.off("room:reopened");
  socket.off("disconnect");
  socket.disconnect();
  socket = null;
  joinedRoomCode = "";
}
