import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1751900000000 implements MigrationInterface {
  name = 'InitialSchema1751900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Crear schema auth si no existe
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS auth`);

    // Tabla users
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "auth"."users" (
        "id"         UUID          NOT NULL DEFAULT gen_random_uuid(),
        "googleId"   VARCHAR       NOT NULL,
        "email"      VARCHAR       NOT NULL,
        "name"       VARCHAR       NOT NULL,
        "picture"    VARCHAR,
        "appRoles"   JSONB         NOT NULL DEFAULT '{}',
        "createdAt"  TIMESTAMPTZ   NOT NULL DEFAULT now(),
        "updatedAt"  TIMESTAMPTZ   NOT NULL DEFAULT now(),
        CONSTRAINT "PK_auth_users"         PRIMARY KEY ("id"),
        CONSTRAINT "UQ_auth_users_google"  UNIQUE ("googleId"),
        CONSTRAINT "UQ_auth_users_email"   UNIQUE ("email")
      )
    `);

    // Tabla refresh_tokens
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "auth"."refresh_tokens" (
        "id"          UUID         NOT NULL DEFAULT gen_random_uuid(),
        "userId"      UUID         NOT NULL,
        "tokenHash"   VARCHAR      NOT NULL,
        "expiresAt"   TIMESTAMPTZ  NOT NULL,
        "revoked"     BOOLEAN      NOT NULL DEFAULT false,
        "createdAt"   TIMESTAMPTZ  NOT NULL DEFAULT now(),
        CONSTRAINT "PK_auth_refresh_tokens"      PRIMARY KEY ("id"),
        CONSTRAINT "UQ_auth_refresh_tokens_hash" UNIQUE ("tokenHash"),
        CONSTRAINT "FK_auth_refresh_tokens_user"
          FOREIGN KEY ("userId") REFERENCES "auth"."users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_auth_refresh_tokens_userId"
        ON "auth"."refresh_tokens" ("userId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "auth"."refresh_tokens"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "auth"."users"`);
    await queryRunner.query(`DROP SCHEMA IF EXISTS auth`);
  }
}
