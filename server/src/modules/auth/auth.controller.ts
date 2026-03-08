import { Body, Controller, Post } from '@nestjs/common'
import { ok } from '../../common/contracts'
import { Public } from '../../common/decorators/public.decorator'
import { AuthService } from './auth.service'
import { GuestAuthDto } from './dto/guest-auth.dto'
import { WechatLoginDto } from './dto/wechat-login.dto'

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('guest')
  guestAuth(@Body() payload: GuestAuthDto) {
    return ok(this.authService.guestAuth(payload))
  }

  @Public()
  @Post('wechat/login')
  wechatAuth(@Body() payload: WechatLoginDto) {
    return ok(this.authService.wechatAuth(payload))
  }
}
