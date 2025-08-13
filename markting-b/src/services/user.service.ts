import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { RegisterDto } from '../dto/auth.dto';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async create(registerDto: RegisterDto): Promise<User> {
    const hashedPassword = await bcrypt.hash(registerDto.password, 12);
    const verificationToken = randomBytes(32).toString('hex');

    const user = this.userRepository.create({
      ...registerDto,
      password: hashedPassword,
      verification_token: verificationToken,
      verified: false,
    });

    return await this.userRepository.save(user);
  }

  async findByEmail(email: string): Promise<User | null> {
    return await this.userRepository.findOne({ where: { email } });
  }

  async findById(id: number): Promise<User | null> {
    return await this.userRepository.findOne({ where: { id } });
  }

  async verifyEmail(token: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { verification_token: token },
    });

    if (!user) {
      throw new NotFoundException('Invalid verification token');
    }

    user.verified = true;
    user.verification_token = undefined;

    return await this.userRepository.save(user);
  }

  async setResetPasswordToken(email: string): Promise<string> {
    const user = await this.findByEmail(email);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const resetToken = randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 3600000); // 1 hour

    user.reset_password_token = resetToken;
    user.reset_password_expires = resetExpires;

    await this.userRepository.save(user);

    return resetToken;
  }

  async resetPassword(token: string, newPassword: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: {
        reset_password_token: token,
      },
    });

    if (
      !user ||
      !user.reset_password_expires ||
      user.reset_password_expires < new Date()
    ) {
      throw new NotFoundException('Invalid or expired reset token');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    user.password = hashedPassword;
    user.reset_password_token = undefined;
    user.reset_password_expires = undefined;

    return await this.userRepository.save(user);
  }

  async validatePassword(
    plainPassword: string,
    hashedPassword: string,
  ): Promise<boolean> {
    return await bcrypt.compare(plainPassword, hashedPassword);
  }
}
