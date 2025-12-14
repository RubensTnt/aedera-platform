import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { AuthService } from "./auth.service";
import { SessionGuard } from "./session.guard";
import { PlatformManagerGuard } from "./platform-role.guard";
// import { AuthController } from "./auth.controller";

@Module({
  imports: [PrismaModule],
  // controllers: [AuthController],
  providers: [AuthService, SessionGuard, PlatformManagerGuard],
  exports: [AuthService, SessionGuard, PlatformManagerGuard],
})
export class AuthModule {}
