import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UserService } from '../services/user.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private userService: UserService,
  ) {
    const secret = configService.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error('JWT_SECRET is not configured');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: { sub: string | number; email: string }) {
    try {
      // Convert sub to number if it's a string (for backward compatibility)
      const userId =
        typeof payload.sub === 'string'
          ? parseInt(payload.sub, 10)
          : payload.sub;

      // Check if the conversion resulted in a valid number
      if (isNaN(userId)) {
        console.error('Invalid user ID in JWT payload:', payload.sub);
        throw new UnauthorizedException('Invalid token format');
      }

      const user = await this.userService.findById(userId);
      if (!user) {
        console.error('User not found for ID:', userId);
        throw new UnauthorizedException('User not found');
      }

      return user;
    } catch (error) {
      console.error('JWT validation error:', error.message);
      throw new UnauthorizedException('Token validation failed');
    }
  }
}
