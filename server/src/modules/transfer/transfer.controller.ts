import { Body, Controller, Param, Post } from '@nestjs/common'
import type { AuthenticatedUser } from '../../common/authenticated-user.interface'
import { ok } from '../../common/contracts'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { CreateTransfersDto } from './dto/create-transfers.dto'
import { TransferService } from './transfer.service'

@Controller('rooms/:roomCode/transfers')
export class TransferController {
  constructor(private readonly transferService: TransferService) {}

  @Post()
  async createTransfers(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('roomCode') roomCode: string,
    @Body() payload: CreateTransfersDto
  ) {
    return ok(await this.transferService.createTransfers(currentUser, roomCode, payload))
  }
}
