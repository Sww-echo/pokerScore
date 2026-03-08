import { Injectable } from '@nestjs/common'
import type { AuthenticatedUser } from '../../common/authenticated-user.interface'
import { RoomService } from '../room/room.service'
import { CreateTransfersDto } from './dto/create-transfers.dto'

@Injectable()
export class TransferService {
  constructor(private readonly roomService: RoomService) {}

  createTransfers(
    currentUser: AuthenticatedUser,
    roomCode: string,
    payload: CreateTransfersDto
  ) {
    return this.roomService.createTransfers(
      currentUser,
      roomCode,
      payload.requestId,
      payload.expectedVersion,
      payload.items
    )
  }
}
