import 'reflect-metadata';
import * as path from 'path';
import { DataSource } from 'typeorm';

require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

export const AppDataSource = new DataSource({
  type:     'postgres',
  host:     process.env.POSTGRES_HOST     ?? 'localhost',
  port:     Number(process.env.POSTGRES_PORT ?? 5432),
  database: process.env.POSTGRES_DB       ?? 'piggy',
  username: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  schema:   'auth',

  entities:   [path.join(__dirname, '**/*.entity{.ts,.js}')],
  migrations: [path.join(__dirname, 'migrations/*{.ts,.js}')],

  synchronize: false,
  logging:     false,

  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false,
});
