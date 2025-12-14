import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { AuthService } from "./auth.service";

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private auth: AuthService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();

    const cookieName = this.auth.getCookieName();
    const token = req.cookies?.[cookieName];

    if (!token) throw new UnauthorizedException("Missing session");

    const user = await this.auth.getUserBySessionToken(token);
    if (!user) throw new UnauthorizedException("Invalid session");

    // 👇 fondamentale: user disponibile per i guard successivi e nei controller
    req.user = user;
    return true;
  }
}
