import { IsOptional, IsString, MaxLength } from 'class-validator'

export class CreateRoomDto {
  @IsOptional()
  @IsString()
  @MaxLength(18)
  roomName?: string

  @IsOptional()
  @IsString()
  @MaxLength(12)
  nickname?: string
}
