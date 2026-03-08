import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { AuthType, UserStatus, type User } from '@prisma/client'
import { createHash } from 'node:crypto'
import type { AuthenticatedUser } from '../../common/authenticated-user.interface'
import type { AuthUserView } from '../../common/contracts'
import { PrismaService } from '../prisma/prisma.service'
import { GuestAuthDto } from './dto/guest-auth.dto'
import { WechatLoginDto } from './dto/wechat-login.dto'

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService
  ) {}

  async guestAuth(payload: GuestAuthDto) {
    const nickname = this.normalizeNickname(payload.nickname)
    const deviceId = payload.deviceId?.trim() || null

    let user: User

    if (deviceId) {
      const existingUser = await this.prisma.user.findFirst({
        where: {
          authType: AuthType.guest,
          deviceId
        },
        orderBy: {
          createdAt: 'desc'
        }
      })

      if (existingUser) {
        this.assertUserAvailable(existingUser)

        user = await this.prisma.user.update({
          where: {
            id: existingUser.id
          },
          data: {
            nickname
          }
        })
      } else {
        user = await this.prisma.user.create({
          data: {
            authType: AuthType.guest,
            nickname,
            accent: 'sunset',
            deviceId
          }
        })
      }
    } else {
      user = await this.prisma.user.create({
        data: {
          authType: AuthType.guest,
          nickname,
          accent: 'sunset'
        }
      })
    }

    return this.buildAuthResponse(user)
  }

  async wechatAuth(payload: WechatLoginDto) {
    const openId = this.buildMockWechatOpenId(payload.code)
    const existingUser = await this.prisma.user.findUnique({
      where: {
        wechatOpenId: openId
      }
    })

    if (existingUser) {
      this.assertUserAvailable(existingUser)

      return this.buildAuthResponse(existingUser)
    }

    const nicknameSuffix = openId.slice(-4).toUpperCase()
    const user = await this.prisma.user.create({
      data: {
        authType: AuthType.wechat,
        nickname: `微信用户${nicknameSuffix}`,
        accent: 'jade',
        wechatOpenId: openId
      }
    })

    return this.buildAuthResponse(user)
  }

  private buildAuthResponse(user: User) {
    this.assertUserAvailable(user)

    const authenticatedUser = this.toAuthenticatedUser(user)
    const tokenPayload = {
      sub: authenticatedUser.userId,
      userId: authenticatedUser.userId,
      nickname: authenticatedUser.nickname,
      authMode: authenticatedUser.authMode,
      accent: authenticatedUser.accent,
      avatarUrl: authenticatedUser.avatarUrl,
      deviceId: authenticatedUser.deviceId
    }

    const token = this.jwtService.sign(tokenPayload)
    const refreshToken = this.jwtService.sign({
      ...tokenPayload,
      tokenType: 'refresh'
    })

    const authUser: AuthUserView = {
      id: user.id,
      nickname: user.nickname,
      authMode: authenticatedUser.authMode,
      accent: user.accent,
      avatarUrl: user.avatarUrl
    }

    return {
      user: authUser,
      token,
      refreshToken
    }
  }

  private toAuthenticatedUser(user: User): AuthenticatedUser {
    return {
      userId: user.id,
      nickname: user.nickname,
      authMode: user.authType === AuthType.wechat ? 'wechat' : 'guest',
      accent: user.accent,
      avatarUrl: user.avatarUrl,
      deviceId: user.deviceId ?? undefined
    }
  }

  private assertUserAvailable(user: User) {
    if (user.status === UserStatus.disabled) {
      throw new ForbiddenException('用户已被禁用')
    }
  }

  private buildMockWechatOpenId(code: string) {
    const normalizedCode = code.trim()

    if (!normalizedCode) {
      throw new BadRequestException('code 不能为空')
    }

    return `mock_wechat_${createHash('sha256').update(normalizedCode).digest('hex').slice(0, 24)}`
  }

  private normalizeNickname(value?: string) {
    const nickname = value?.trim()

    if (nickname) {
      return nickname
    }

    return `牌友${Math.floor(Math.random() * 900 + 100)}`
  }
}
