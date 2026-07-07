/**
 * SwitcherModule — App Switcher SSO
 *
 * Ruta:
 *   POST /api/switcher/token  → Emite un switcher_token de corta vida (5 min)
 *                               para que el usuario pueda navegar entre apps
 *                               sin re-autenticarse.
 */
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { SwitcherController } from './switcher.controller';
import { SwitcherService } from './switcher.service';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      // TTL por defecto del JwtModule — el SwitcherService override con '5m' al firmar
      signOptions: { expiresIn: '24h' },
    }),
    UsersModule,
  ],
  controllers: [SwitcherController],
  providers: [SwitcherService],
})
export class SwitcherModule {}
