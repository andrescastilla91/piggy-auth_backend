import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RefreshToken } from './entities/refresh-token.entity';
import { UsersService } from '../users/users.service';
import * as crypto from 'crypto';

// Mapa de apps a sus URLs de frontend
const APP_FRONTEND_URLS: Record<string, string> = {
  kids: process.env.KIDS_FRONTEND_URL ?? 'https://piggy.vadi-technologies.com',
  pro:  process.env.PRO_FRONTEND_URL  ?? 'https://piggy-pro.vadi-technologies.com',
};

@Injectable()
export class AuthService {

  constructor(
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
    @InjectRepository(RefreshToken)
    private readonly refreshRepo: Repository<RefreshToken>,
  ) {}

  // Rol por defecto según la app que inicia el login
  private static readonly APP_ROLE: Record<string, string> = {
    kids: 'parent',
    pro:  'adult',
  };

  /** Crea o actualiza usuario en auth.users, registra la app y emite tokens */
  async loginWithGoogle(profile: {
    googleId: string;
    email: string;
    name: string;
    picture: string;
    requestedApp?: string;
  }) {
    const app  = profile.requestedApp ?? 'kids';
    const role = AuthService.APP_ROLE[app] ?? 'parent';

    // Upsert en auth.users — fuente de verdad de identidad del ecosistema
    const user = await this.usersService.upsert({
      googleId: profile.googleId,
      email:    profile.email,
      name:     profile.name,
      picture:  profile.picture,
    });

    // Registrar en qué app se ha autenticado el usuario (idempotente)
    await this.usersService.assignRole(user.id, app, role);

    // JWT con claims completos para que los backends de kids/pro puedan
    // upsertear sus propios usuarios sin llamar a piggy-auth de nuevo
    const payload = {
      sub:      user.id,
      googleId: user.googleId,
      email:    user.email,
      name:     user.name,
      picture:  user.picture,
      app,
      role,
    };

    const accessToken  = this.jwtService.sign(payload);
    const refreshToken = await this.createRefreshToken(user.id);

    return { accessToken, refreshToken, app };
  }

  getRedirectUrl(app: string, token: string): string {
    const base = APP_FRONTEND_URLS[app] ?? APP_FRONTEND_URLS['kids'];
    return `${base}/auth/callback?token=${token}`;
  }

  async refresh(rawToken: string) {
    if (!rawToken) throw new UnauthorizedException('No refresh token');

    const hash = this.hashToken(rawToken);
    const stored = await this.refreshRepo.findOne({
      where: { tokenHash: hash, revoked: false },
    });

    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token inválido o expirado');
    }

    // Rebuild full payload so JwtStrategy in kids/pro can upsert from it
    const user = await this.usersService.findById(stored.userId);
    const app  = Object.keys(user.appRoles)[0] ?? 'kids';
    const role = user.appRoles[app]?.[0] ?? 'parent';

    const accessToken = this.jwtService.sign({
      sub:      user.id,
      googleId: user.googleId,
      email:    user.email,
      name:     user.name,
      picture:  user.picture,
      app,
      role,
    });
    return { accessToken };
  }

  /** Revoca el refresh token (logout) */
  async revoke(rawToken: string): Promise<void> {
    if (!rawToken) return;
    const hash = this.hashToken(rawToken);
    await this.refreshRepo.update({ tokenHash: hash }, { revoked: true });
  }

  // ---------------------------------------------------------------------------
  // Helpers privados
  // ---------------------------------------------------------------------------

  private async createRefreshToken(userId: string): Promise<string> {
    const raw  = crypto.randomBytes(64).toString('hex');
    const hash = this.hashToken(raw);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 días

    const token = this.refreshRepo.create({ userId, tokenHash: hash, expiresAt });
    await this.refreshRepo.save(token);
    return raw;
  }

  private hashToken(raw: string): string {
    return crypto.createHash('sha256').update(raw).digest('hex');
  }
}
