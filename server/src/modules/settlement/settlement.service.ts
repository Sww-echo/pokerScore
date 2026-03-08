import { Injectable } from '@nestjs/common'
import type { AuthenticatedUser } from '../../common/authenticated-user.interface'
import { RoomService } from '../room/room.service'
import { CreateSettlementDto } from './dto/create-settlement.dto'
import { ReopenRoomDto } from './dto/reopen-room.dto'

@Injectable()
export class SettlementService {
  constructor(private readonly roomService: RoomService) {}

  createSettlement(
    currentUser: AuthenticatedUser,
    roomCode: string,
    payload: CreateSettlementDto
  ) {
    return this.roomService.createSettlement(
      currentUser,
      roomCode,
      payload.requestId,
      payload.expectedVersion
    )
  }

  getCurrentSettlement(currentUser: AuthenticatedUser, roomCode: string) {
    return this.roomService.getCurrentSettlement(currentUser, roomCode)
  }

  reopenRoom(
    currentUser: AuthenticatedUser,
    roomCode: string,
    payload: ReopenRoomDto
  ) {
    return this.roomService.reopenRoom(
      currentUser,
      roomCode,
      payload.requestId,
      payload.expectedVersion
    )
  }
}
