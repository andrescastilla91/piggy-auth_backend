import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { Client } from 'pg';
import * as cookieParser from 'cookie-parser';

async function ensureAuthSchema() {
  const client = new Client({
    host:     process.env.POSTGRES_HOST     ?? 'localhost',
    port:     Number(process.env.POSTGRES_PORT ?? 5432),
    database: process.env.POSTGRES_DB       ?? 'piggy',
    user:     process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });
  await client.connect();
  await client.query('CREATE SCHEMA IF NOT EXISTS auth');
  await client.end();
}

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  await ensureAuthSchema();

  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  app.setGlobalPrefix('api');
  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist:            true,
      forbidNonWhitelisted: true,
      transform:            true,
    }),
  );

  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  app.enableCors({
    origin:      (process.env.CORS_ORIGINS ?? '').split(',').filter(Boolean),
    credentials: true,
  });

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, '0.0.0.0');
  logger.log(`piggy-auth corriendo en puerto ${port} [${process.env.NODE_ENV}]`);
}

bootstrap().catch((err) => {
  console.error('[piggy-auth] Error fatal al arrancar:', err);
  process.exit(1);
});
