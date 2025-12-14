import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import * as bcrypt from "bcryptjs";
import { randomBytes, createHash } from "crypto";

const COOKIE_NAME = "aedera_session";

function sha256(input: string) {
  return createHash("sha256").update(input).digest("hex");
}

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService) {}

  getCookieName() {
    return COOKIE_NAME;
  }

  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new UnauthorizedException("Invalid credentials");

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException("Invalid credentials");

    return user;
  }

  async createSession(userId: string, remember: boolean) {
    const token = randomBytes(32).toString("hex");
    const tokenHash = sha256(token);

    const now = Date.now();
    const ttlMs = remember
      ? 1000 * 60 * 60 * 24 * 30 // 30 giorni
      : 1000 * 60 * 60 * 8;     // 8 ore

    const expiresAt = new Date(now + ttlMs);

    await this.prisma.session.create({
      data: { userId, tokenHash, expiresAt },
    });

    return { token, expiresAt };
  }

  async revokeSession(rawToken: string) {
    const tokenHash = sha256(rawToken);
    await this.prisma.session.deleteMany({ where: { tokenHash } });
  }

  async getUserBySessionToken(rawToken: string) {
    const tokenHash = sha256(rawToken);

    const session = await this.prisma.session.findFirst({
      where: { tokenHash, expiresAt: { gt: new Date() } },
      include: { user: true },
    });

    return session?.user ?? null;
  }
}
