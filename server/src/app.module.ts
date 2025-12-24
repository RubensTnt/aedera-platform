import { Module } from "@nestjs/common";
import { PrismaModule } from "./prisma/prisma.module";
import { ProjectsModule } from "./projects/projects.module";
import { ModelsModule } from "./models/models.module";
import { AuthModule } from "./auth/auth.module";
import { ElementParamsModule } from "./element-params/element-params.module";
import { SuppliersModule } from "./suppliers/suppliers.module";
import { WbsModule } from "./wbs/wbs.module";
import { ScenariosModule } from "./scenarios/scenarios.module";

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    ProjectsModule,
    ModelsModule,
    ElementParamsModule,
    SuppliersModule,
    WbsModule,
    ScenariosModule,
  ],
})
export class AppModule {}
