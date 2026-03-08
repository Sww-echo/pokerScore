import { Controller, Get } from '@nestjs/common'
import { ok } from '../../common/contracts'
import { Public } from '../../common/decorators/public.decorator'

@Controller('health')
export class HealthController {
  @Public()
  @Get()
  getHealth() {
    return ok({
      status: 'ok',
      timestamp: new Date().toISOString()
    })
  }
}
