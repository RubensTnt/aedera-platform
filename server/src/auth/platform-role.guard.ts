import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";

export type PlatformRole = "PLATFORM_MANAGER" | "USER";

@Injectable()
export class PlatformManagerGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const role = req.user?.platformRole as PlatformRole | undefined;

    if (role !== "PLATFORM_MANAGER") {
      throw new ForbiddenException("Platform manager required");
    }
    return true;
  }
}
