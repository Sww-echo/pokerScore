import { Module } from '@nestjs/common'
import { RealtimeModule } from '../realtime/realtime.module'
import { RoomController } from './room.controller'
import { RoomService } from './room.service'

@Module({
  imports: [RealtimeModule],
  controllers: [RoomController],
  providers: [RoomService],
  exports: [RoomService]
})
export class RoomModule {}
