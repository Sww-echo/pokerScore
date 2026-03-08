import { Body, Controller, Get, Param, Post } from '@nestjs/common'
import type { AuthenticatedUser } from '../../common/authenticated-user.interface'
import { ok } from '../../common/contracts'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { CreateSettlementDto } from './dto/create-settlement.dto'
import { ReopenRoomDto } from './dto/reopen-room.dto'
import { SettlementService } from './settlement.service'

@Controller('rooms/:roomCode')
export class SettlementController {
  constructor(private readonly settlementService: SettlementService) {}

  @Post('settlements')
  async createSettlement(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('roomCode') roomCode: string,
    @Body() payload: CreateSettlementDto
  ) {
    return ok(await this.settlementService.createSettlement(currentUser, roomCode, payload))
  }

  @Get('settlements/current')
  async getCurrentSettlement(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('roomCode') roomCode: string
  ) {
    return ok(await this.settlementService.getCurrentSettlement(currentUser, roomCode))
  }

  @Post('reopen')
  async reopenRoom(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('roomCode') roomCode: string,
    @Body() payload: ReopenRoomDto
  ) {
    return ok(await this.settlementService.reopenRoom(currentUser, roomCode, payload))
  }
}
