import { Body, Controller, Get, Post, Req, Res, UnauthorizedException, UseGuards } from "@nestjs/common";
import type { Response, Request } from "express";
import { AuthService } from "./auth.service";
import { SessionGuard } from "./session.guard";

@Controller("/api/auth")
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post("login")
  async login(
    @Body() body: { email: string; password: string; remember?: boolean },
    @Res({ passthrough: true }) res: Response,
  ) {
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const remember = !!body.remember;

    if (!email || !password) throw new UnauthorizedException("Missing credentials");

    const user = await this.auth.validateUser(email, password);
    const { token, expiresAt } = await this.auth.createSession(user.id, remember);

    // cookie httpOnly
    res.cookie(this.auth.getCookieName(), token, {
      httpOnly: true,
      sameSite: "lax",
      secure: false, // in prod: true (https)
      expires: expiresAt,
    });

    // non mandare passwordHash
    const { passwordHash, ...safe } = user as any;
    return safe;
  }

  @Post("logout")
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = (req as any).cookies?.[this.auth.getCookieName()];
    if (token) await this.auth.revokeSession(token);

    res.clearCookie(this.auth.getCookieName(), {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
    });

    return { ok: true };
  }

  @Get("me")
  @UseGuards(SessionGuard)
  me(@Req() req: any) {
    const u = req.user;
    const { passwordHash, ...safe } = u as any;
    return safe;
  }
}
