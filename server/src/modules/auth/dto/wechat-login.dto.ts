import { IsOptional, IsString, Matches } from 'class-validator'

export class WechatLoginDto {
  @IsString()
  code!: string

  @IsOptional()
  @IsString()
  @Matches(/^[A-Z0-9]{4,8}$/)
  inviterRoomCode?: string
}
