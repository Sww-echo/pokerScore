import { Body, Controller, Get, Param, Post } from '@nestjs/common'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { ok } from '../../common/contracts'
import type { AuthenticatedUser } from '../../common/authenticated-user.interface'
import { CreateRoomDto } from './dto/create-room.dto'
import { JoinRoomDto } from './dto/join-room.dto'
import { RoomService } from './room.service'

@Controller('rooms')
export class RoomController {
  constructor(private readonly roomService: RoomService) {}

  @Post()
  createRoom(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() payload: CreateRoomDto
  ) {
    return ok(this.roomService.createRoom(currentUser, payload))
  }

  @Get(':roomCode')
  getRoom(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('roomCode') roomCode: string
  ) {
    return ok(this.roomService.getRoomSnapshot(currentUser, roomCode))
  }

  @Post(':roomCode/join')
  joinRoom(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('roomCode') roomCode: string,
    @Body() payload: JoinRoomDto
  ) {
    return ok(this.roomService.joinRoom(currentUser, roomCode, payload))
  }

  @Get(':roomCode/invite')
  getInvite(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('roomCode') roomCode: string
  ) {
    return ok(this.roomService.getInviteInfo(currentUser, roomCode))
  }
}
