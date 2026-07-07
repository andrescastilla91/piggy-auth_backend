import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { SwitcherModule } from './switcher/switcher.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    // ── Configuración global ──────────────────────────────────────────────
    ConfigModule.forRoot({ isGlobal: true }),

    // ── Base de datos (schema auth) ───────────────────────────────────────
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.POSTGRES_HOST ?? 'piggy_postgres',
      port: Number(process.env.POSTGRES_PORT ?? 5432),
      database: process.env.POSTGRES_DB ?? 'piggy',
      username: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      schema: 'auth',
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      synchronize: false,
      migrations: [__dirname + '/migrations/*{.ts,.js}'],
      migrationsRun: true,          // Corre migraciones pendientes al arrancar
      migrationsTableName: 'public.typeorm_migrations', // Tabla de control en public (auth aún no existe al arrancar)
      ssl: process.env.NODE_ENV === 'production'
        ? { rejectUnauthorized: false }
        : false,
    }),

    // ── Módulos de dominio ────────────────────────────────────────────────
    AuthModule,
    UsersModule,
    SwitcherModule,
    HealthModule,
  ],
})
export class AppModule {}
