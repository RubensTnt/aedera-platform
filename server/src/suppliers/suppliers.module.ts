import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { AuthzModule } from "../authz/authz.module";
import { AuthModule } from "../auth/auth.module";
import { SuppliersController } from "./suppliers.controller";
import { SuppliersService } from "./suppliers.service";

@Module({
  imports: [PrismaModule, AuthzModule, AuthModule],
  controllers: [SuppliersController],
  providers: [SuppliersService],
})
export class SuppliersModule {}
