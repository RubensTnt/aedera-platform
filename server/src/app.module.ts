import { Module } from "@nestjs/common";
import { PrismaModule } from "./prisma/prisma.module";
import { ProjectsModule } from "./projects/projects.module";
import { DatiWbsModule } from "./dati-wbs/dati-wbs.module";
import { ModelsModule } from "./models/models.module";
import { AuthModule } from "./auth/auth.module";

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    ProjectsModule,
    ModelsModule,
    DatiWbsModule,
  ],
})
export class AppModule {}
