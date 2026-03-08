import { Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { ConfigModule } from '@nestjs/config'
import { PublicHealthModule } from './modules/health/health.module'
import { AuthModule } from './modules/auth/auth.module'
import { PrismaModule } from './modules/prisma/prisma.module'
import { RoomModule } from './modules/room/room.module'
import { TransferModule } from './modules/transfer/transfer.module'
import { SettlementModule } from './modules/settlement/settlement.module'
import { RealtimeModule } from './modules/realtime/realtime.module'
import { JwtAuthGuard } from './common/guards/jwt-auth.guard'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['server/.env', '.env']
    }),
    PublicHealthModule,
    AuthModule,
    PrismaModule,
    RoomModule,
    TransferModule,
    SettlementModule,
    RealtimeModule
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard
    }
  ]
})
export class AppModule {}
