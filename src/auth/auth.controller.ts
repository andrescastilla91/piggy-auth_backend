import {
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';

// Cookie cross-domain: con el túnel de Cloudflare todos los dominios son HTTPS
// y pertenecen a *.vadi-technologies.com. Se usa sameSite:'none'+secure:true
// para que piggy-kids y piggy-pro puedan enviar la cookie a auth.vadi-technologies.com.
// En local (NODE_ENV != production) se usa 'lax' (cookie solo en auth.localhost:3020).
const cookieOptions = {
  httpOnly: true,
  secure:   process.env.NODE_ENV === 'production',
  sameSite: (process.env.NODE_ENV === 'production' ? 'none' : 'lax') as 'none' | 'lax',
  maxAge:   7 * 24 * 60 * 60 * 1000, // 7 días en ms
};

@Controller('auth')
export class AuthController {

  constructor(private readonly authService: AuthService) {}

  /** Inicia el flujo OAuth de Google.
   *  Acepta ?app=kids|pro para saber a qué frontend redirigir después.
   *  La app se codifica en el state de OAuth para sobrevivir el round-trip.
   *  Ej: GET /api/auth/google?app=pro
   */
  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleLogin() {
    // Passport redirige automáticamente a Google — la lógica del state
    // está en GoogleStrategy.authenticate()
  }

  /** Callback de Google — crea/actualiza usuario, emite JWT y redirige al frontend */
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(@Req() req: any, @Res() res: any) {
    const { accessToken, refreshToken, app } =
      await this.authService.loginWithGoogle(req.user);

    // Refresh token en cookie HttpOnly — no accesible desde JS del frontend
    res.cookie('piggy_auth_refresh', refreshToken, cookieOptions);

    // Access token en la URL → el frontend lo lee en /auth/callback y lo guarda
    // en memoria (no en localStorage). La cookie de refresh persiste para renovarlo.
    const redirectUrl = this.authService.getRedirectUrl(app, accessToken);
    return res.redirect(redirectUrl);
  }

  /** Renueva el access token usando la cookie HttpOnly de refresh */
  @Post('refresh')
  @HttpCode(200)
  async refresh(@Req() req: any) {
    const rawToken = req.cookies?.['piggy_auth_refresh'];
    return this.authService.refresh(rawToken);
  }

  /** Revoca el refresh token y limpia la cookie */
  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: any, @Res() res: any) {
    const rawToken = req.cookies?.['piggy_auth_refresh'];
    if (rawToken) await this.authService.revoke(rawToken);
    res.clearCookie('piggy_auth_refresh', cookieOptions);
    return res.status(204).send();
  }
}
