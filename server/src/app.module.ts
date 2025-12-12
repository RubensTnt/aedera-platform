import { Module } from "@nestjs/common";
import { PrismaModule } from "./prisma/prisma.module";
import { ProjectsModule } from "./projects/projects.module";
import { DatiWbsModule } from "./dati-wbs/dati-wbs.module";

@Module({
  imports: [PrismaModule, ProjectsModule, DatiWbsModule],
})
export class AppModule {}
