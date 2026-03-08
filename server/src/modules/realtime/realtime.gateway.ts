import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketServer,
  WebSocketGateway
} from '@nestjs/websockets'
import type { Server, Socket } from 'socket.io'

@WebSocketGateway({
  namespace: '/ws',
  cors: true
})
export class RealtimeGateway {
  @WebSocketServer()
  private readonly server!: Server

  @SubscribeMessage('room:join')
  async handleRoomJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { roomCode?: string }
  ) {
    const roomCode = payload?.roomCode?.trim().toUpperCase()

    if (!roomCode) {
      return {
        event: 'room:error',
        data: {
          message: 'roomCode is required'
        }
      }
    }

    await client.join(`room:${roomCode}`)

    return {
      event: 'room:joined',
      data: {
        roomCode,
        timestamp: new Date().toISOString()
      }
    }
  }

  @SubscribeMessage('room:leave')
  async handleRoomLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { roomCode?: string }
  ) {
    const roomCode = payload?.roomCode?.trim().toUpperCase()

    if (roomCode) {
      await client.leave(`room:${roomCode}`)
    }

    return {
      event: 'room:left',
      data: {
        roomCode: roomCode ?? null,
        timestamp: new Date().toISOString()
      }
    }
  }

  @SubscribeMessage('room:ping')
  handleRoomPing() {
    return {
      event: 'room:pong',
      data: {
        timestamp: new Date().toISOString()
      }
    }
  }

  emitRoomSnapshot(roomCode: string, room: unknown) {
    this.server.to(this.buildRoomChannel(roomCode)).emit('room:snapshot', {
      room
    })
  }

  emitMemberJoined(
    roomCode: string,
    payload: {
      room: unknown
      memberId: string | null
      isReconnect: boolean
    }
  ) {
    this.server.to(this.buildRoomChannel(roomCode)).emit('room:member_joined', payload)
  }

  emitTransferCreated(
    roomCode: string,
    payload: {
      room: unknown
      createdTransfers: unknown[]
    }
  ) {
    this.server.to(this.buildRoomChannel(roomCode)).emit('room:transfer_created', payload)
  }

  emitSettlementCreated(
    roomCode: string,
    payload: {
      room: unknown
      settlement: unknown
    }
  ) {
    this.server.to(this.buildRoomChannel(roomCode)).emit('room:settlement_created', payload)
  }

  emitRoomReopened(
    roomCode: string,
    payload: {
      room: unknown
    }
  ) {
    this.server.to(this.buildRoomChannel(roomCode)).emit('room:reopened', payload)
  }

  private buildRoomChannel(roomCode: string) {
    return `room:${roomCode.trim().toUpperCase()}`
  }
}
