import { Injectable, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../services/user.service';
import { EmailService } from '../services/email.service';
import {
  RegisterDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from '../dto/auth.dto';
import { User } from '../entities/user.entity';

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private jwtService: JwtService,
    private emailService: EmailService,
  ) {}

  async register(registerDto: RegisterDto): Promise<{ message: string }> {
    const existingUser = await this.userService.findByEmail(registerDto.email);

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    const user = await this.userService.create(registerDto);

    // Send verification email
    try {
      if (user.verification_token) {
        await this.emailService.sendVerificationEmail(
          user.email,
          user.verification_token,
        );
      }
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
      // Continue without throwing error - user is still created
    }

    return {
      message:
        'User registered successfully. Please check your email for verification.',
    };
  }

  async verifyEmail(token: string): Promise<{ message: string }> {
    await this.userService.verifyEmail(token);

    return {
      message: 'Email verified successfully. You can now log in.',
    };
  }

  async login(
    user: User,
  ): Promise<{ access_token: string; user: Partial<User> }> {
    const payload = { email: user.email, sub: user.id };

    const {
      password: _,
      verification_token: __,
      reset_password_token: ___,
      ...userWithoutSensitiveData
    } = user;

    return {
      access_token: this.jwtService.sign(payload),
      user: userWithoutSensitiveData,
    };
  }

  async forgotPassword(
    forgotPasswordDto: ForgotPasswordDto,
  ): Promise<{ message: string }> {
    try {
      const resetToken = await this.userService.setResetPasswordToken(
        forgotPasswordDto.email,
      );

      await this.emailService.sendPasswordResetEmail(
        forgotPasswordDto.email,
        resetToken,
      );

      return {
        message: 'Password reset email sent. Please check your email.',
      };
    } catch (error) {
      // Don't reveal if email exists or not for security
      return {
        message:
          'If an account with this email exists, you will receive a password reset email.',
      };
    }
  }

  async resetPassword(
    resetPasswordDto: ResetPasswordDto,
  ): Promise<{ message: string }> {
    await this.userService.resetPassword(
      resetPasswordDto.token,
      resetPasswordDto.password,
    );

    return {
      message:
        'Password reset successfully. You can now log in with your new password.',
    };
  }

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.userService.findByEmail(email);

    if (
      user &&
      (await this.userService.validatePassword(password, user.password))
    ) {
      const { password: _, ...result } = user;
      return result;
    }

    return null;
  }
}
