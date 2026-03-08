import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { JwtModule } from '@nestjs/jwt'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'

@Module({
  imports: [
    JwtModule.registerAsync({
      global: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const expiresInRaw = configService.get<string>('JWT_EXPIRES_IN')
        const expiresIn = expiresInRaw && /^\d+$/.test(expiresInRaw)
          ? Number(expiresInRaw)
          : ('7d' as const)

        return {
          secret: configService.get<string>('JWT_SECRET', 'pokerscore-dev-secret'),
          signOptions: {
            expiresIn
          }
        }
      }
    })
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService, JwtModule]
})
export class AuthModule {}
