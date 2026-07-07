# 🔐 Piggy Auth

> Servicio de identidad compartido (SSO) para el ecosistema Piggy. Gestiona el login con Google, emite JWT firmados, y redirige al frontend correcto según la app que inició el flujo.

**Base URL en producción:** `https://auth.vadi-technologies.com/api`  
**Parte del ecosistema:** [`piggy-family`](../)

---

## ¿Por qué existe piggy-auth?

Piggy Kids y Piggy Pro comparten el mismo proveedor de identidad (Google). En lugar de duplicar la lógica de OAuth en cada app, un único servicio centralizado:

- Autentica con Google una sola vez
- Emite un JWT firmado con un secreto compartido
- Redirige al frontend de la app correcta con el token
- Los backends de Kids y Pro validan ese mismo JWT sin necesidad de llamar a piggy-auth en cada request

---

## Stack

| | |
|---|---|
| Framework | NestJS 10 |
| Lenguaje | TypeScript 5 |
| Base de datos | PostgreSQL 17 (schema `auth`) |
| ORM | TypeORM 0.3 |
| OAuth | `passport-google-oauth20` |
| JWT | `@nestjs/jwt` + `passport-jwt` |
| Node | 22 LTS |

---

## Estructura del proyecto

```
src/
├── auth/
│   ├── strategies/
│   │   ├── google.strategy.ts     # OAuth2 con Google — captura ?app=kids|pro en state
│   │   └── jwt.strategy.ts        # Valida tokens emitidos por este servicio
│   ├── entities/
│   │   └── refresh-token.entity.ts
│   ├── auth.controller.ts         # /auth/google, /auth/google/callback,
│   │                              # /auth/refresh, /auth/logout
│   ├── auth.service.ts            # loginWithGoogle(), refresh(), revoke()
│   └── auth.module.ts
├── users/
│   ├── entities/user.entity.ts    # Fuente de verdad de identidad del ecosistema
│   ├── users.service.ts           # upsert() — crea o actualiza en cada login
│   └── users.module.ts
├── switcher/                      # App-switcher: navega entre apps sin re-login
├── health/                        # GET /api/health — Docker healthcheck
├── main.ts
└── app.module.ts
```

---

## Endpoints

### Auth (`/api/auth`)

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/google?app=kids\|pro` | Inicia OAuth con Google. El parámetro `app` determina a qué frontend redirigir al final. |
| GET | `/google/callback` | Callback de Google — crea/actualiza usuario, emite JWT, redirige al frontend. |
| POST | `/refresh` | Renueva el access token usando la cookie HttpOnly de refresh. |
| POST | `/logout` | Revoca el refresh token y limpia la cookie. |

### Users (`/api/users`)

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/me` | Perfil del usuario autenticado en auth.users |

---

## Flujo OAuth completo

```
1. Frontend Piggy Pro       →  GET /api/auth/google?app=pro
2. google.strategy          →  authenticate() captura app='pro', lo pasa como OAuth state
3. Google                   →  autentica al usuario
4. Google callback          →  devuelve code + state='pro'
5. google.strategy.validate →  lee req.query.state = 'pro'
6. auth.service             →  upserta en auth.users, emite accessToken + refreshToken
7. auth.controller          →  res.cookie(refreshToken, HttpOnly)
                               res.redirect('https://piggy-pro.vadi-tech.com/auth/callback?token=<jwt>')
8. Frontend Piggy Pro       →  guarda el token en memoria, listo para usar
```

**Clave:** El parámetro `?app=pro` se codifica en el OAuth `state` para sobrevivir el round-trip de Google. Los query params originales se pierden en el redirect; solo `state` se devuelve intacto.

---

## JWT emitido

```json
{
  "sub":      "uuid-de-auth.users",
  "googleId": "google-id-del-usuario",
  "email":    "usuario@gmail.com",
  "name":     "Nombre Apellido",
  "picture":  "https://lh3.googleusercontent.com/...",
  "app":      "pro",
  "role":     "parent",
  "iat":      1234567890,
  "exp":      1234568790
}
```

Los backends de piggy-kids y piggy-pro validan este token con el mismo `JWT_SECRET`. El campo `sub` es el UUID de `auth.users` — cada app mantiene su propia tabla `users` y hace upsert la primera vez que ve un `googleId`.

---

## Modelo de datos (schema `auth`)

```
users           id(UUID), google_id(unique), email(unique), name, picture, created_at, updated_at
refresh_tokens  id(UUID), user_id(FK→users), token_hash(sha256), expires_at, revoked
```

La tabla `users` aquí es la **fuente de verdad de identidad** del ecosistema. Las tablas `users` en piggy-kids (schema `kids`) y piggy-pro (schema `pro`) son réplicas locales con datos adicionales propios de cada app.

---

## Desarrollo local

### Prerrequisitos
- Docker + Docker Compose
- Infra compartida corriendo (Postgres)

### Arranque

```bash
cd piggy-family/infra && docker compose up -d
cd ../piggy-auth      && docker compose up -d

# API: http://localhost:3020/api
# Health: http://localhost:3020/api/health
```

### Rebuild tras cambios

```bash
docker compose build
docker compose up -d
docker compose logs -f
```

---

## Variables de entorno

```env
# Base de datos
POSTGRES_HOST=piggy_postgres
POSTGRES_PORT=5432
POSTGRES_DB=piggy
POSTGRES_USER=piggy_app
POSTGRES_PASSWORD=your_password
POSTGRES_SCHEMA=auth

# JWT — MISMO secreto que piggy-kids y piggy-pro
JWT_SECRET=your_shared_secret_min_32_chars
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Google OAuth — Client ID/Secret compartido con todas las apps
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_CALLBACK_URL=https://auth.vadi-technologies.com/api/auth/google/callback

# Destinos de redirección por app
KIDS_FRONTEND_URL=https://piggy.vadi-technologies.com
PRO_FRONTEND_URL=https://piggy-pro.vadi-technologies.com

# CORS
CORS_ORIGINS=https://piggy.vadi-technologies.com,https://piggy-pro.vadi-technologies.com,http://localhost:4200,http://localhost:4210

NODE_ENV=production
TZ=America/Bogota
```

> **Crítico:** `JWT_SECRET` debe ser idéntico en piggy-auth, piggy-kids y piggy-pro. Si difieren, los backends rechazarán los tokens con 401.

---

## Cookies cross-domain

En producción, todos los dominios son `*.vadi-technologies.com` bajo HTTPS. La cookie de refresh se configura con:

```typescript
{
  httpOnly: true,
  secure:   true,          // HTTPS obligatorio
  sameSite: 'none',        // cross-domain (piggy-auth → piggy-pro/piggy-kids)
  maxAge:   7 * 24 * 60 * 60 * 1000,
}
```

En desarrollo local (`NODE_ENV !== production`): `sameSite: 'lax'`, `secure: false`.

---

## Docker

```
Contenedor:  piggy_auth_backend
Puerto:      3020 (interno), expuesto en override.yml para desarrollo
Red:         piggy_infra_net
Healthcheck: GET http://localhost:3020/api/health
```

---

## Parte del ecosistema Piggy

| App | Descripción | Estado |
|---|---|---|
| 🐷 Piggy Kids | Tareas y PiggyCoins para niños | ✅ Producción |
| 💼 Piggy Pro | Finanzas personales para adultos | ✅ Producción |
| 🔐 **Piggy Auth** | SSO compartido del ecosistema | ✅ Activo |
| 👨‍👩‍👧 Piggy Family | Conecta Kids ↔ Pro | 📋 Planeado |

---

## Licencia

Proyecto privado — Vadi Technologies. Todos los derechos reservados.
