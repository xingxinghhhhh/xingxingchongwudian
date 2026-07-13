import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../database/prisma.service";
import { LoginMemberDto } from "./dto/login-member.dto";

interface MemberSession {
  phone: string;
  name: string;
  createdAt: string;
}

@Injectable()
export class AuthService {
  private readonly sessions = new Map<string, MemberSession>();
  private sequence = 0;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService
  ) {}

  async login(dto: LoginMemberDto) {
    const sessionToken = this.createSessionToken();
    const member = {
      phone: dto.phone,
      name: dto.name
    };

    if (this.isDatabaseConfigured()) {
      await this.prisma.memberSession.create({
        data: {
          token: sessionToken,
          phone: dto.phone,
          name: dto.name
        }
      });

      return {
        sessionToken,
        member
      };
    }

    this.sessions.set(sessionToken, {
      ...member,
      createdAt: new Date().toISOString()
    });

    return {
      sessionToken,
      member
    };
  }

  async getSession(sessionToken?: string) {
    if (!sessionToken) {
      throw new UnauthorizedException("Invalid member session");
    }

    if (this.isDatabaseConfigured()) {
      const session = await this.prisma.memberSession.findUnique({
        where: { token: sessionToken }
      });

      if (!session) {
        throw new UnauthorizedException("Invalid member session");
      }

      await this.prisma.memberSession.update({
        where: { token: sessionToken },
        data: { lastSeenAt: new Date() }
      });

      return session;
    }

    const session = this.sessions.get(sessionToken);

    if (!session) {
      throw new UnauthorizedException("Invalid member session");
    }

    return session;
  }

  private createSessionToken() {
    this.sequence += 1;
    return `member_${Date.now()}_${String(this.sequence).padStart(4, "0")}`;
  }

  private isDatabaseConfigured() {
    return Boolean(this.configService.get<string>("DATABASE_URL"));
  }
}
