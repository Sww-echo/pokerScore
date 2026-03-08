import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { JwtService } from '@nestjs/jwt'
import type { AuthenticatedUser } from '../authenticated-user.interface'
import { IS_PUBLIC_KEY } from '../decorators/public.decorator'

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass()
    ])

    if (isPublic) {
      return true
    }

    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>
      user?: AuthenticatedUser
    }>()
    const authorization = request.headers.authorization

    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('未登录或登录已过期')
    }

    try {
      const token = authorization.slice('Bearer '.length).trim()
      const payload = this.jwtService.verify<AuthenticatedUser & { sub?: string }>(token)

      request.user = {
        userId: payload.userId ?? payload.sub ?? '',
        nickname: payload.nickname,
        authMode: payload.authMode,
        accent: payload.accent,
        avatarUrl: payload.avatarUrl ?? null,
        deviceId: payload.deviceId
      }

      if (!request.user.userId) {
        throw new UnauthorizedException('用户身份无效')
      }

      return true
    } catch {
      throw new UnauthorizedException('未登录或登录已过期')
    }
  }
}
