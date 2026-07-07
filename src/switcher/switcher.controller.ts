import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SwitcherService } from './switcher.service';

@Controller('switcher')
export class SwitcherController {
  constructor(private readonly switcherService: SwitcherService) {}

  /**
   * Emite un switcher_token (TTL 5 min) para navegar a otra app del ecosistema.
   *
   * Body: { targetApp: 'pro' | 'kids' | 'family' | 'business' }
   * Respuesta: { switcherToken: string, redirectUrl: string }
   */
  @Post('token')
  @UseGuards(AuthGuard('jwt'))
  async getSwitcherToken(
    @Req() req: any,
    @Body('targetApp') targetApp: string,
  ) {
    return this.switcherService.createSwitcherToken(req.user.userId, targetApp);
  }
}
