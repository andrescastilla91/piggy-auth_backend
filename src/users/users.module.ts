/**
 * UsersModule — Perfil unificado del usuario (auth.users)
 *
 * Rutas:
 *   GET /api/users/me  → Devuelve el perfil del usuario autenticado
 */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
