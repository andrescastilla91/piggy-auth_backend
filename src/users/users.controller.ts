import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * GET /api/users/me
   * Perfil del usuario autenticado con sus roles por app.
   * Los frontends usan appRoles para saber qué apps mostrar en el App Switcher.
   */
  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  async me(@Req() req: any) {
    const user = await this.usersService.findById(req.user.userId);
    return {
      id:       user.id,
      email:    user.email,
      name:     user.name,
      picture:  user.picture,
      appRoles: user.appRoles, // { kids: ['parent'], pro: ['adult'] }
    };
  }

  /**
   * GET /api/users/apps
   * Mapa de qué apps tiene registradas el usuario.
   * Usado por AppSwitcherService para construir el panel del switcher.
   * Respuesta: { kids: true, pro: true, family: false, business: false }
   */
  @Get('apps')
  @UseGuards(AuthGuard('jwt'))
  async myApps(@Req() req: any) {
    const user = await this.usersService.findById(req.user.userId);
    const ALL_APPS = ['kids', 'pro', 'family', 'business'] as const;
    return ALL_APPS.reduce(
      (acc, app) => ({ ...acc, [app]: !!(user.appRoles[app]?.length) }),
      {} as Record<typeof ALL_APPS[number], boolean>,
    );
  }
}
