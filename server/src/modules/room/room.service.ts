import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import {
  AuthType as PrismaAuthType,
  Prisma,
  RoomStatus as PrismaRoomStatus,
  RoundStatus,
  UserStatus
} from '@prisma/client'
import type { AuthenticatedUser } from '../../common/authenticated-user.interface'
import type {
  RoomMemberView,
  RoomSnapshotView,
  RoomStatus,
  SettlementSnapshotView,
  SettlementSuggestionView,
  TransferRecordView
} from '../../common/contracts'
import { PrismaService } from '../prisma/prisma.service'
import { RealtimeGateway } from '../realtime/realtime.gateway'
import { CreateRoomDto } from './dto/create-room.dto'
import { JoinRoomDto } from './dto/join-room.dto'

type DbClient = Prisma.TransactionClient | PrismaService

type RoomCore = Prisma.RoomGetPayload<{
  select: {
    id: true
    code: true
    name: true
    status: true
    updatedAt: true
    version: true
    currentRoundNo: true
  }
}>

type MemberWithUser = Prisma.RoomMemberGetPayload<{
  include: {
    user: true
  }
}>

type RoundWithSettlement = Prisma.RoomRoundGetPayload<{
  include: {
    settlementSnapshot: true
  }
}>

interface RoomContext {
  room: RoomCore
  member: MemberWithUser
}

interface TransferDraftInput {
  toMemberId: string
  score: number
}

@Injectable()
export class RoomService {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly realtimeGateway: RealtimeGateway
  ) {}

  async createRoom(currentUser: AuthenticatedUser, payload: CreateRoomDto) {
    return this.prisma.$transaction(async (tx) => {
      const actor = await this.requireActiveUser(tx, currentUser.userId)
      const nickname = this.normalizeNickname(payload.nickname, actor.nickname)
      const roomName = this.normalizeRoomName(payload.roomName, nickname)
      const roomCode = await this.generateUniqueRoomCode(tx)
      const now = new Date()

      const room = await tx.room.create({
        data: {
          code: roomCode,
          name: roomName,
          ownerUserId: actor.id,
          status: PrismaRoomStatus.active,
          currentRoundNo: 1,
          version: 1n,
          updatedAt: now
        },
        select: {
          id: true,
          code: true
        }
      })

      const round = await tx.roomRound.create({
        data: {
          roomId: room.id,
          roundNo: 1,
          status: RoundStatus.active,
          version: 1n
        }
      })

      const member = await tx.roomMember.create({
        data: {
          roomId: room.id,
          userId: actor.id,
          nickname,
          accent: actor.accent,
          avatarUrl: actor.avatarUrl,
          seatLabel: this.resolveSeatLabel(0),
          score: 0,
          isOnline: true,
          lastActiveAt: now
        }
      })

      await this.createRoomEvent(tx, {
        roomId: room.id,
        roundId: round.id,
        operatorMemberId: member.id,
        eventType: 'room_created',
        payload: {
          roomCode: room.code,
          roomName,
          roundNo: 1
        }
      })

      return {
        roomCode: room.code,
        room: await this.buildRoomSnapshot(tx, room.id, actor.id)
      }
    })
  }

  async joinRoom(currentUser: AuthenticatedUser, roomCodeValue: string, payload: JoinRoomDto) {
    const result = await this.prisma.$transaction(async (tx) => {
      const roomCode = this.normalizeRoomCode(roomCodeValue)
      const room = await tx.room.findUnique({
        where: {
          code: roomCode
        },
        select: {
          id: true,
          code: true,
          status: true
        }
      })

      if (!room) {
        throw new NotFoundException('房间不存在')
      }

      if (room.status === PrismaRoomStatus.closed) {
        throw new ConflictException('房间当前不可加入')
      }

      const actor = await this.requireActiveUser(tx, currentUser.userId)
      const baseNickname = this.normalizeNickname(payload.nickname, actor.nickname)
      const existingMember = await tx.roomMember.findUnique({
        where: {
          roomId_userId: {
            roomId: room.id,
            userId: actor.id
          }
        },
        include: {
          user: true
        }
      })

      const nickname = await this.resolveUniqueNickname(tx, room.id, baseNickname, existingMember?.id)
      const now = new Date()
      let memberId = existingMember?.id ?? null

      if (existingMember) {
        await tx.roomMember.update({
          where: {
            id: existingMember.id
          },
          data: {
            nickname,
            accent: actor.accent,
            avatarUrl: actor.avatarUrl,
            isOnline: true,
            lastActiveAt: now,
            leftAt: null
          }
        })
      } else {
        const memberCount = await tx.roomMember.count({
          where: {
            roomId: room.id
          }
        })

        const createdMember = await tx.roomMember.create({
          data: {
            roomId: room.id,
            userId: actor.id,
            nickname,
            accent: actor.accent,
            avatarUrl: actor.avatarUrl,
            seatLabel: this.resolveSeatLabel(memberCount),
            score: 0,
            isOnline: true,
            lastActiveAt: now
          }
        })
        memberId = createdMember.id
      }

      await tx.room.update({
        where: {
          id: room.id
        },
        data: {
          updatedAt: now,
          version: {
            increment: 1
          }
        }
      })

      await this.createRoomEvent(tx, {
        roomId: room.id,
        operatorMemberId: memberId,
        eventType: existingMember ? 'member_reconnected' : 'member_joined',
        payload: {
          memberId,
          nickname
        }
      })

      const snapshot = await this.buildRoomSnapshot(tx, room.id, actor.id)

      return {
        roomCode: room.code,
        room: snapshot,
        isReconnect: Boolean(existingMember),
        memberId
      }
    })

    this.realtimeGateway.emitMemberJoined(result.roomCode, {
      room: this.toBroadcastRoomSnapshot(result.room),
      memberId: result.memberId,
      isReconnect: result.isReconnect
    })

    return {
      roomCode: result.roomCode,
      room: result.room
    }
  }

  async getRoomSnapshot(currentUser: AuthenticatedUser, roomCodeValue: string) {
    const context = await this.requireMemberRoom(this.prisma, roomCodeValue, currentUser.userId)

    return {
      room: await this.buildRoomSnapshot(this.prisma, context.room.id, currentUser.userId)
    }
  }

  async getInviteInfo(currentUser: AuthenticatedUser, roomCodeValue: string) {
    const context = await this.requireMemberRoom(this.prisma, roomCodeValue, currentUser.userId, {
      touchMember: false
    })
    const baseUrl = this.configService.get<string>('APP_H5_BASE_URL', 'http://localhost:5173')

    return {
      roomCode: context.room.code,
      inviteLink: `${baseUrl.replace(/\/$/, '')}/room/${context.room.code}`
    }
  }

  async createTransfers(
    currentUser: AuthenticatedUser,
    roomCodeValue: string,
    requestIdValue: string,
    expectedVersion: number | undefined,
    items: TransferDraftInput[]
  ) {
    const result = await this.prisma.$transaction(async (tx) => {
      const context = await this.requireMemberRoom(tx, roomCodeValue, currentUser.userId)
      const currentRound = await this.getCurrentRound(tx, context.room.id, context.room.currentRoundNo)
      const requestId = this.normalizeRequestId(requestIdValue)
      const existingBatch = await tx.transferBatch.findUnique({
        where: {
          requestId
        },
        include: {
          transfers: {
            orderBy: [
              {
                createdAt: 'desc'
              },
              {
                id: 'desc'
              }
            ]
          }
        }
      })

      if (existingBatch) {
        if (existingBatch.roomId !== context.room.id || existingBatch.roundId !== currentRound.id) {
          throw new ConflictException('requestId 已被其他请求占用')
        }

        return {
          roomCode: context.room.code,
          room: await this.buildRoomSnapshot(tx, context.room.id, currentUser.userId),
          shouldBroadcast: false,
          createdTransfers: existingBatch.transfers.map((transfer) =>
            this.toTransferRecordView(transfer, context.room.code)
          )
        }
      }

      if (context.room.status === PrismaRoomStatus.settled || currentRound.status !== RoundStatus.active) {
        throw new ConflictException('当前牌局已结算，禁止继续转分')
      }

      this.assertExpectedVersion(context.room.version, expectedVersion)

      if (!items.length) {
        throw new BadRequestException('至少需要一条转分记录')
      }

      const receiverIds = [...new Set(items.map((item) => item.toMemberId))]
      const receivers = await tx.roomMember.findMany({
        where: {
          roomId: context.room.id,
          id: {
            in: receiverIds
          }
        }
      })
      const receiverMap = new Map(receivers.map((member) => [member.id, member]))

      let totalScore = 0
      const scoreDeltaMap = new Map<string, number>()

      for (const item of items) {
        if (item.score <= 0) {
          throw new BadRequestException('转分分值必须大于 0')
        }

        if (item.toMemberId === context.member.id) {
          throw new BadRequestException('不能给自己转分')
        }

        if (!receiverMap.has(item.toMemberId)) {
          throw new NotFoundException('接收成员不存在')
        }

        totalScore += item.score
        scoreDeltaMap.set(item.toMemberId, (scoreDeltaMap.get(item.toMemberId) ?? 0) + item.score)
      }

      const now = new Date()
      const batch = await tx.transferBatch.create({
        data: {
          roomId: context.room.id,
          roundId: currentRound.id,
          requestId,
          operatorMemberId: context.member.id,
          itemCount: items.length,
          totalScore
        }
      })

      const createdTransfers = await Promise.all(
        items.map((item) =>
          tx.transferRecord.create({
            data: {
              transferBatchId: batch.id,
              roomId: context.room.id,
              roundId: currentRound.id,
              fromMemberId: context.member.id,
              toMemberId: item.toMemberId,
              score: item.score,
              createdAt: now
            }
          })
        )
      )

      await tx.roomMember.update({
        where: {
          id: context.member.id
        },
        data: {
          score: {
            decrement: totalScore
          },
          isOnline: true,
          lastActiveAt: now,
          leftAt: null
        }
      })

      await Promise.all(
        [...scoreDeltaMap.entries()].map(([memberId, delta]) =>
          tx.roomMember.update({
            where: {
              id: memberId
            },
            data: {
              score: {
                increment: delta
              }
            }
          })
        )
      )

      await tx.roomRound.update({
        where: {
          id: currentRound.id
        },
        data: {
          version: {
            increment: 1
          }
        }
      })

      await tx.room.update({
        where: {
          id: context.room.id
        },
        data: {
          status: PrismaRoomStatus.active,
          updatedAt: now,
          version: {
            increment: 1
          }
        }
      })

      await this.createRoomEvent(tx, {
        roomId: context.room.id,
        roundId: currentRound.id,
        operatorMemberId: context.member.id,
        eventType: 'transfer_created',
        requestId,
        payload: {
          transferBatchId: batch.id,
          itemCount: items.length,
          totalScore,
          transferIds: createdTransfers.map((transfer) => transfer.id)
        }
      })

      const snapshot = await this.buildRoomSnapshot(tx, context.room.id, currentUser.userId)

      return {
        room: snapshot,
        roomCode: context.room.code,
        shouldBroadcast: true,
        createdTransfers: createdTransfers.map((transfer) =>
          this.toTransferRecordView(transfer, context.room.code)
        )
      }
    })

    if (result.shouldBroadcast) {
      this.realtimeGateway.emitTransferCreated(result.roomCode, {
        room: this.toBroadcastRoomSnapshot(result.room),
        createdTransfers: result.createdTransfers
      })
    }

    return {
      room: result.room,
      createdTransfers: result.createdTransfers
    }
  }

  async createSettlement(
    currentUser: AuthenticatedUser,
    roomCodeValue: string,
    requestIdValue: string,
    expectedVersion?: number
  ) {
    const result = await this.prisma.$transaction(async (tx) => {
      const context = await this.requireMemberRoom(tx, roomCodeValue, currentUser.userId)
      const currentRound = await this.getCurrentRound(tx, context.room.id, context.room.currentRoundNo)
      const requestId = this.normalizeRequestId(requestIdValue)
      const existingSettlementByRequest = await tx.settlementSnapshot.findUnique({
        where: {
          requestId
        }
      })

      if (existingSettlementByRequest) {
        if (
          existingSettlementByRequest.roomId !== context.room.id ||
          existingSettlementByRequest.roundId !== currentRound.id
        ) {
          throw new ConflictException('requestId 已被其他请求占用')
        }

        const room = await this.buildRoomSnapshot(tx, context.room.id, currentUser.userId)

        return {
          roomCode: context.room.code,
          room,
          shouldBroadcast: false,
          settlement: this.toSettlementSnapshotView(
            existingSettlementByRequest,
            room.currentUserMemberId
          )
        }
      }

      if (currentRound.settlementSnapshot) {
        const room = await this.buildRoomSnapshot(tx, context.room.id, currentUser.userId)

        return {
          roomCode: context.room.code,
          room,
          shouldBroadcast: false,
          settlement: this.toSettlementSnapshotView(
            currentRound.settlementSnapshot,
            room.currentUserMemberId
          )
        }
      }

      if (currentRound.status !== RoundStatus.active) {
        throw new ConflictException('当前牌局状态不允许结算')
      }

      this.assertExpectedVersion(context.room.version, expectedVersion)

      const members = await tx.roomMember.findMany({
        where: {
          roomId: context.room.id
        },
        include: {
          user: true
        },
        orderBy: [
          {
            score: 'desc'
          },
          {
            joinedAt: 'asc'
          }
        ]
      })

      const totalScore = members.reduce((sum, member) => sum + member.score, 0)

      if (totalScore !== 0) {
        throw new ConflictException('房间分数数据异常，暂时无法结算')
      }

      const rankingForStorage = members.map((member, index) =>
        this.toRoomMemberView(member, '', member.seatLabel ?? this.resolveSeatLabel(index))
      )
      const suggestions = this.buildSettlementSuggestions(rankingForStorage)
      const settledAt = new Date()
      const settlement = await tx.settlementSnapshot.create({
        data: {
          roomId: context.room.id,
          roundId: currentRound.id,
          requestId,
          settledByMemberId: context.member.id,
          settledAt,
          rankingJson: rankingForStorage as unknown as Prisma.InputJsonValue,
          suggestionsJson: suggestions as unknown as Prisma.InputJsonValue
        }
      })

      await tx.roomRound.update({
        where: {
          id: currentRound.id
        },
        data: {
          status: RoundStatus.settled,
          settledAt,
          settledByMemberId: context.member.id,
          version: {
            increment: 1
          }
        }
      })

      await tx.room.update({
        where: {
          id: context.room.id
        },
        data: {
          status: PrismaRoomStatus.settled,
          lastSettledAt: settledAt,
          updatedAt: settledAt,
          version: {
            increment: 1
          }
        }
      })

      await this.createRoomEvent(tx, {
        roomId: context.room.id,
        roundId: currentRound.id,
        operatorMemberId: context.member.id,
        eventType: 'settlement_created',
        requestId,
        payload: {
          settlementId: settlement.id,
          roundNo: context.room.currentRoundNo,
          settledAt: settledAt.toISOString()
        }
      })

      const room = await this.buildRoomSnapshot(tx, context.room.id, currentUser.userId)

      return {
        roomCode: context.room.code,
        room,
        shouldBroadcast: true,
        settlement: this.toSettlementSnapshotView(settlement, room.currentUserMemberId)
      }
    })

    if (result.shouldBroadcast) {
      this.realtimeGateway.emitSettlementCreated(result.roomCode, {
        room: this.toBroadcastRoomSnapshot(result.room),
        settlement: result.settlement
      })
    }

    return {
      room: result.room,
      settlement: result.settlement
    }
  }

  async getCurrentSettlement(currentUser: AuthenticatedUser, roomCodeValue: string) {
    const context = await this.requireMemberRoom(this.prisma, roomCodeValue, currentUser.userId)
    const currentRound = await this.getCurrentRound(
      this.prisma,
      context.room.id,
      context.room.currentRoundNo
    )
    const settlement = currentRound.settlementSnapshot

    if (!settlement) {
      throw new NotFoundException('当前局尚未生成结算账单')
    }

    const room = await this.buildRoomSnapshot(this.prisma, context.room.id, currentUser.userId)

    return {
      room,
      settlement: this.toSettlementSnapshotView(settlement, room.currentUserMemberId)
    }
  }

  async reopenRoom(
    currentUser: AuthenticatedUser,
    roomCodeValue: string,
    requestIdValue: string,
    expectedVersion?: number
  ) {
    const result = await this.prisma.$transaction(async (tx) => {
      const context = await this.requireMemberRoom(tx, roomCodeValue, currentUser.userId)
      const currentRound = await this.getCurrentRound(tx, context.room.id, context.room.currentRoundNo)
      const requestId = this.normalizeRequestId(requestIdValue)
      const existingOpenedRound = await tx.roomRound.findUnique({
        where: {
          openRequestId: requestId
        }
      })

      if (existingOpenedRound) {
        if (
          existingOpenedRound.roomId !== context.room.id ||
          existingOpenedRound.roundNo !== context.room.currentRoundNo
        ) {
          throw new ConflictException('requestId 已被其他请求占用')
        }

        return {
          roomCode: context.room.code,
          shouldBroadcast: false,
          room: await this.buildRoomSnapshot(tx, context.room.id, currentUser.userId)
        }
      }

      if (currentRound.status !== RoundStatus.settled) {
        throw new ConflictException('当前牌局尚未结算，不能直接重开')
      }

      this.assertExpectedVersion(context.room.version, expectedVersion)

      const now = new Date()
      const nextRoundNo = context.room.currentRoundNo + 1

      const nextRound = await tx.roomRound.create({
        data: {
          roomId: context.room.id,
          roundNo: nextRoundNo,
          status: RoundStatus.active,
          openRequestId: requestId,
          version: 1n
        }
      })

      await tx.roomMember.updateMany({
        where: {
          roomId: context.room.id
        },
        data: {
          score: 0
        }
      })

      await tx.roomMember.update({
        where: {
          id: context.member.id
        },
        data: {
          isOnline: true,
          lastActiveAt: now,
          leftAt: null
        }
      })

      await tx.room.update({
        where: {
          id: context.room.id
        },
        data: {
          currentRoundNo: nextRoundNo,
          status: PrismaRoomStatus.active,
          updatedAt: now,
          version: {
            increment: 1
          }
        }
      })

      await this.createRoomEvent(tx, {
        roomId: context.room.id,
        roundId: nextRound.id,
        operatorMemberId: context.member.id,
        eventType: 'room_reopened',
        requestId,
        payload: {
          fromRoundNo: context.room.currentRoundNo,
          toRoundNo: nextRoundNo
        }
      })

      return {
        roomCode: context.room.code,
        shouldBroadcast: true,
        room: await this.buildRoomSnapshot(tx, context.room.id, currentUser.userId)
      }
    })

    if (result.shouldBroadcast) {
      this.realtimeGateway.emitRoomReopened(result.roomCode, {
        room: this.toBroadcastRoomSnapshot(result.room)
      })
    }

    return {
      room: result.room
    }
  }

  private async createRoomEvent(
    db: DbClient,
    input: {
      roomId: string
      roundId?: string | null
      operatorMemberId?: string | null
      eventType: string
      requestId?: string | null
      payload?: Prisma.InputJsonValue
    }
  ) {
    await db.roomEvent.create({
      data: {
        roomId: input.roomId,
        roundId: input.roundId ?? null,
        operatorMemberId: input.operatorMemberId ?? null,
        eventType: input.eventType,
        requestId: input.requestId ?? null,
        payloadJson: input.payload ?? Prisma.JsonNull
      }
    })
  }

  private async buildRoomSnapshot(
    db: DbClient,
    roomId: string,
    currentUserId: string
  ): Promise<RoomSnapshotView> {
    const room = await db.room.findUnique({
      where: {
        id: roomId
      },
      select: {
        id: true,
        code: true,
        name: true,
        status: true,
        updatedAt: true,
        version: true,
        currentRoundNo: true
      }
    })

    if (!room) {
      throw new NotFoundException('房间不存在')
    }

    const members = await db.roomMember.findMany({
      where: {
        roomId
      },
      include: {
        user: true
      },
      orderBy: [
        {
          joinedAt: 'asc'
        },
        {
          id: 'asc'
        }
      ]
    })
    const currentMember = members.find((member) => member.userId === currentUserId) ?? null
    const currentRound = await this.getCurrentRound(db, roomId, room.currentRoundNo)
    const transfers = await db.transferRecord.findMany({
      where: {
        roomId,
        roundId: currentRound.id
      },
      orderBy: [
        {
          createdAt: 'desc'
        },
        {
          id: 'desc'
        }
      ]
    })

    return {
      code: room.code,
      name: room.name,
      status: this.toContractRoomStatus(room.status),
      updatedAt: room.updatedAt.toISOString(),
      version: Number(room.version),
      roundNo: room.currentRoundNo,
      currentUserMemberId: currentMember?.id ?? null,
      members: members.map((member, index) =>
        this.toRoomMemberView(member, currentUserId, member.seatLabel ?? this.resolveSeatLabel(index))
      ),
      transfers: transfers.map((transfer) => this.toTransferRecordView(transfer, room.code)),
      settlement: currentRound.settlementSnapshot
        ? this.toSettlementSnapshotView(currentRound.settlementSnapshot, currentMember?.id ?? null)
        : null
    }
  }

  private async getCurrentRound(
    db: DbClient,
    roomId: string,
    roundNo: number
  ): Promise<RoundWithSettlement> {
    const round = await db.roomRound.findUnique({
      where: {
        roomId_roundNo: {
          roomId,
          roundNo
        }
      },
      include: {
        settlementSnapshot: true
      }
    })

    if (!round) {
      throw new NotFoundException('当前牌局不存在')
    }

    return round
  }

  private buildSettlementSuggestions(
    ranking: RoomMemberView[]
  ): SettlementSuggestionView[] {
    const creditors = ranking
      .filter((member) => member.score > 0)
      .map((member) => ({
        memberId: member.id,
        amount: member.score
      }))
      .sort((left, right) => right.amount - left.amount)
    const debtors = ranking
      .filter((member) => member.score < 0)
      .map((member) => ({
        memberId: member.id,
        amount: Math.abs(member.score)
      }))
      .sort((left, right) => right.amount - left.amount)

    const suggestions: SettlementSuggestionView[] = []
    let creditorIndex = 0
    let debtorIndex = 0

    while (creditorIndex < creditors.length && debtorIndex < debtors.length) {
      const creditor = creditors[creditorIndex]
      const debtor = debtors[debtorIndex]
      const amount = Math.min(creditor.amount, debtor.amount)

      if (amount > 0) {
        suggestions.push({
          fromMemberId: debtor.memberId,
          toMemberId: creditor.memberId,
          amount
        })
      }

      creditor.amount -= amount
      debtor.amount -= amount

      if (creditor.amount === 0) {
        creditorIndex += 1
      }

      if (debtor.amount === 0) {
        debtorIndex += 1
      }
    }

    return suggestions
  }

  private async resolveUniqueNickname(
    db: DbClient,
    roomId: string,
    nickname: string,
    selfMemberId?: string
  ) {
    const members = await db.roomMember.findMany({
      where: {
        roomId,
        ...(selfMemberId
          ? {
              NOT: {
                id: selfMemberId
              }
            }
          : {})
      },
      select: {
        nickname: true
      }
    })
    const occupiedNicknames = new Set(members.map((member) => member.nickname))

    if (!occupiedNicknames.has(nickname)) {
      return nickname
    }

    let suffix = 2

    while (occupiedNicknames.has(`${nickname}(${suffix})`)) {
      suffix += 1
    }

    return `${nickname}(${suffix})`
  }

  private async generateUniqueRoomCode(db: DbClient) {
    const configuredLength = Number(this.configService.get<string>('ROOM_CODE_LENGTH', '6'))
    const roomCodeLength = Number.isInteger(configuredLength)
      ? Math.min(Math.max(configuredLength, 4), 8)
      : 6

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const roomCode = this.randomNumericCode(roomCodeLength)
      const exists = await db.room.findUnique({
        where: {
          code: roomCode
        },
        select: {
          id: true
        }
      })

      if (!exists) {
        return roomCode
      }
    }

    throw new ConflictException('房间码生成失败，请稍后重试')
  }

  private async requireMemberRoom(
    db: DbClient,
    roomCodeValue: string,
    userId: string,
    options?: {
      touchMember?: boolean
    }
  ): Promise<RoomContext> {
    const roomCode = this.normalizeRoomCode(roomCodeValue)
    const room = await db.room.findUnique({
      where: {
        code: roomCode
      },
      select: {
        id: true,
        code: true,
        name: true,
        status: true,
        updatedAt: true,
        version: true,
        currentRoundNo: true
      }
    })

    if (!room) {
      throw new NotFoundException('房间不存在')
    }

    const member = await db.roomMember.findUnique({
      where: {
        roomId_userId: {
          roomId: room.id,
          userId
        }
      },
      include: {
        user: true
      }
    })

    if (!member) {
      throw new ForbiddenException('当前用户不是该房间成员')
    }

    if (member.user.status === UserStatus.disabled) {
      throw new ForbiddenException('当前用户已被禁用')
    }

    if (options?.touchMember !== false) {
      const now = new Date()

      await db.roomMember.update({
        where: {
          id: member.id
        },
        data: {
          isOnline: true,
          lastActiveAt: now,
          leftAt: null
        }
      })

      member.isOnline = true
      member.lastActiveAt = now
      member.leftAt = null
    }

    return {
      room,
      member
    }
  }

  private async requireActiveUser(db: DbClient, userId: string) {
    const user = await db.user.findUnique({
      where: {
        id: userId
      }
    })

    if (!user) {
      throw new ForbiddenException('当前用户不存在')
    }

    if (user.status === UserStatus.disabled) {
      throw new ForbiddenException('当前用户已被禁用')
    }

    return user
  }

  private assertExpectedVersion(roomVersion: bigint, expectedVersion?: number) {
    if (expectedVersion !== undefined && expectedVersion !== Number(roomVersion)) {
      throw new ConflictException('房间版本已变化，请刷新后重试')
    }
  }

  private toRoomMemberView(
    member: MemberWithUser,
    currentUserId: string,
    seatLabel: string
  ): RoomMemberView {
    return {
      id: member.id,
      nickname: member.nickname,
      authMode: member.user.authType === PrismaAuthType.wechat ? 'wechat' : 'guest',
      accent: member.accent,
      avatarUrl: member.avatarUrl,
      seatLabel,
      score: member.score,
      isOnline: member.isOnline,
      isCurrentUser: member.userId === currentUserId
    }
  }

  private toTransferRecordView(
    transfer: Prisma.TransferRecordGetPayload<Record<string, never>>,
    roomCode: string
  ): TransferRecordView {
    return {
      id: transfer.id,
      roomCode,
      fromMemberId: transfer.fromMemberId,
      toMemberId: transfer.toMemberId,
      score: transfer.score,
      createdAt: transfer.createdAt.toISOString()
    }
  }

  private toSettlementSnapshotView(
    settlement: Prisma.SettlementSnapshotGetPayload<Record<string, never>>,
    currentUserMemberId: string | null
  ): SettlementSnapshotView {
    const ranking = Array.isArray(settlement.rankingJson)
      ? (settlement.rankingJson as unknown as RoomMemberView[])
      : []
    const suggestions = Array.isArray(settlement.suggestionsJson)
      ? (settlement.suggestionsJson as unknown as SettlementSuggestionView[])
      : []

    return {
      settledAt: settlement.settledAt.toISOString(),
      ranking: ranking.map((member, index) => ({
        ...member,
        avatarUrl: member.avatarUrl ?? null,
        seatLabel: member.seatLabel || this.resolveSeatLabel(index),
        isCurrentUser: member.id === currentUserMemberId
      })),
      suggestions
    }
  }

  private toBroadcastRoomSnapshot(room: RoomSnapshotView): RoomSnapshotView {
    return {
      ...room,
      currentUserMemberId: null,
      members: room.members.map((member) => ({
        ...member,
        isCurrentUser: false
      })),
      settlement: room.settlement
        ? {
            ...room.settlement,
            ranking: room.settlement.ranking.map((member) => ({
              ...member,
              isCurrentUser: false
            }))
          }
        : null
    }
  }

  private toContractRoomStatus(status: PrismaRoomStatus): RoomStatus {
    return status === PrismaRoomStatus.active ? 'active' : 'settled'
  }

  private normalizeNickname(value?: string, fallbackNickname?: string) {
    const nickname = value?.trim()

    if (nickname) {
      return nickname
    }

    if (fallbackNickname?.trim()) {
      return fallbackNickname.trim()
    }

    return `牌友${Math.floor(Math.random() * 900 + 100)}`
  }

  private normalizeRoomName(value?: string, fallbackNickname?: string) {
    const roomName = value?.trim()

    if (roomName) {
      return roomName
    }

    if (fallbackNickname) {
      return `${fallbackNickname}的牌局`
    }

    return '新牌局'
  }

  private normalizeRoomCode(value: string) {
    const roomCode = value.trim().toUpperCase()

    if (!/^[A-Z0-9]{4,8}$/.test(roomCode)) {
      throw new BadRequestException('房间码长度需为 4 到 8 位，且仅支持字母和数字')
    }

    return roomCode
  }

  private normalizeRequestId(value: string) {
    const requestId = value.trim()

    if (!requestId) {
      throw new BadRequestException('requestId 不能为空')
    }

    return requestId
  }

  private resolveSeatLabel(index: number) {
    const labels = ['东位', '南位', '西位', '北位']
    return labels[index] ?? `${index + 1}号位`
  }

  private randomNumericCode(length: number) {
    const min = 10 ** (length - 1)
    const max = 10 ** length - 1

    return Math.floor(Math.random() * (max - min + 1) + min).toString()
  }
}
