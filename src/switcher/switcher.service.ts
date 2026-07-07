import { Injectable, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';

const APP_URLS: Record<string, string> = {
  kids:     process.env.KIDS_FRONTEND_URL     ?? 'https://piggy.vadi-technologies.com',
  pro:      process.env.PRO_FRONTEND_URL      ?? 'https://piggy-pro.vadi-technologies.com',
  family:   process.env.FAMILY_FRONTEND_URL   ?? 'https://piggy-family.vadi-technologies.com',
  business: process.env.BUSINESS_FRONTEND_URL ?? 'https://piggy-business.vadi-technologies.com',
};

// Rol por defecto al aterrizar en cada app
const APP_DEFAULT_ROLE: Record<string, string> = {
  kids:     'parent',
  pro:      'adult',
  family:   'family_admin',
  business: 'business_owner',
};

const VALID_APPS = Object.keys(APP_URLS);

@Injectable()
export class SwitcherService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
  ) {}

  async createSwitcherToken(userId: string, targetApp: string) {
    if (!VALID_APPS.includes(targetApp)) {
      throw new BadRequestException(`App inválida: ${targetApp}`);
    }

    // Cargar perfil completo del usuario para incluirlo en el token
    const user = await this.usersService.findById(userId);

    // El rol de destino: si el usuario ya tiene rol en la app, mantenerlo;
    // si no, usar el rol por defecto (primer acceso via switcher).
    const existingRoles = user.appRoles[targetApp] ?? [];
    const role = existingRoles[0] ?? APP_DEFAULT_ROLE[targetApp] ?? 'parent';

    // Switcher token: payload completo para que el JwtStrategy de la app
    // destino pueda hacer upsert sin llamar de nuevo a piggy-auth.
    // TTL corto (5 min) — solo para el viaje de redirección.
    const switcherToken = this.jwtService.sign(
      {
        sub:      user.id,
        googleId: user.googleId,
        email:    user.email,
        name:     user.name,
        picture:  user.picture,
        app:      targetApp,
        role,
        type:     'switcher',
      },
      { expiresIn: '5m' },
    );

    const baseUrl = APP_URLS[targetApp] ?? APP_URLS['kids'];
    const redirectUrl = `${baseUrl}/auth/switch?token=${switcherToken}`;

    return { switcherToken, redirectUrl };
  }
}
