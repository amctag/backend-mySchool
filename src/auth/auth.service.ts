import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../database/prisma/prisma.service';
import { ParentLoginResponseDto } from './dto/parent-login-response.dto';
import { ParentLoginDto } from './dto/parent-login.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async parentLogin(loginDto: ParentLoginDto): Promise<ParentLoginResponseDto> {
    const candidates = await this.prisma.person.findMany({
      where: {
        username: loginDto.username,
        status: true,
        parent: { isNot: null },
      },
      include: {
        parent: {
          include: {
            students: {
              include: {
                person: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    username: true,
                    schoolId: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (candidates.length === 0) {
      throw new UnauthorizedException('Invalid username or password');
    }

    let person: (typeof candidates)[number] | undefined;

    for (const candidate of candidates) {
      const passwordMatches = await bcrypt.compare(
        loginDto.password,
        candidate.password,
      );
      if (passwordMatches) {
        person = candidate;
        break;
      }
    }

    if (!person?.parent) {
      throw new UnauthorizedException('Invalid username or password');
    }

    const payload: JwtPayload = {
      sub: person.id.toString(),
      username: person.username,
      role: 'parent',
      parentId: person.parent.id,
    };

    const children = person.parent.students.map((student) => ({
      studentId: student.id,
      personId: student.person.id,
      firstName: student.person.firstName,
      lastName: student.person.lastName,
      username: student.person.username,
      schoolId: student.person.schoolId,
    }));

    return {
      accessToken: this.jwtService.sign(payload),
      parent: {
        personId: person.id,
        parentId: person.parent.id,
        username: person.username,
        firstName: person.firstName,
        middleName: person.middleName,
        lastName: person.lastName,
        email: person.email,
        schoolId: person.schoolId,
      },
      children,
    };
  }
}
