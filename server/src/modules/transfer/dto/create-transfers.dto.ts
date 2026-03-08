import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested
} from 'class-validator'
import { Type } from 'class-transformer'

export class TransferItemDto {
  @IsUUID()
  toMemberId!: string

  @Type(() => Number)
  @IsInt()
  @Min(1)
  score!: number
}

export class CreateTransfersDto {
  @IsString()
  @MaxLength(64)
  requestId!: string

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion?: number

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => TransferItemDto)
  items!: TransferItemDto[]
}
