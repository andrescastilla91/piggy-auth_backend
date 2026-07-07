import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist:            true,
      forbidNonWhitelisted: true,
      transform:            true,
    }),
  );

  // Trust proxy — requerido detrás de Railway / Cloudflare
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
