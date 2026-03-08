import { Module } from '@nestjs/common'
import { RoomModule } from '../room/room.module'
import { TransferController } from './transfer.controller'
import { TransferService } from './transfer.service'

@Module({
  imports: [RoomModule],
  controllers: [TransferController],
  providers: [TransferService]
})
export class TransferModule {}
