import { Module } from '@nestjs/common'
import { RoomModule } from '../room/room.module'
import { SettlementController } from './settlement.controller'
import { SettlementService } from './settlement.service'

@Module({
  imports: [RoomModule],
  controllers: [SettlementController],
  providers: [SettlementService]
})
export class SettlementModule {}
