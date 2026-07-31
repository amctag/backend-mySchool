import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { LoginDto, RegisterDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(private readonly jwtService: JwtService) {}

  login(loginDto: LoginDto) {
    // TODO: validate credentials against database
    const payload = { sub: 'user-id', email: loginDto.email };
    return {
      accessToken: this.jwtService.sign(payload),
    };
  }

  register(registerDto: RegisterDto) {
    // TODO: create user in database
    const payload = { sub: 'user-id', email: registerDto.email };
    return {
      accessToken: this.jwtService.sign(payload),
    };
  }
}
