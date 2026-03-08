import { IsOptional, IsString, MaxLength } from 'class-validator'

export class GuestAuthDto {
  @IsOptional()
  @IsString()
  @MaxLength(12)
  nickname?: string

  @IsOptional()
  @IsString()
  @MaxLength(64)
  deviceId?: string
}
