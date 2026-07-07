import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor() {
    super({
      clientID:          process.env.GOOGLE_CLIENT_ID!,
      clientSecret:      process.env.GOOGLE_CLIENT_SECRET!,
      callbackURL:       process.env.GOOGLE_CALLBACK_URL!,
      scope:             ['email', 'profile'],
      passReqToCallback: true,
    });
  }

  /**
   * Sobreescribimos authenticate() para capturar ?app=kids|pro del request
   * inicial y pasarlo como OAuth state. Google lo devuelve intacto en el
   * callback — esto es lo único que sobrevive el round-trip de OAuth.
   */
  override authenticate(req: any, options?: any) {
    const app = (req.query?.app as string) ?? 'kids';
    super.authenticate(req, { ...options, state: app });
  }

  async validate(
    req: any,
    accessToken: string,
    _refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ) {
    const { id, emails, photos, displayName } = profile;

    // req.query.state contiene el valor que pusimos en authenticate()
    const requestedApp = (req.query?.state as string) ?? 'kids';

    const user = {
      googleId:     id,
      email:        emails[0].value,
      name:         displayName,
      picture:      photos[0]?.value,
      requestedApp,
    };

    done(null, user);
  }
}
