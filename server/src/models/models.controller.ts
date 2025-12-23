import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  UploadedFile,
  UseInterceptors,
  Body,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { join } from "path";
import { randomUUID } from "crypto";
import * as fs from "fs";
import { ModelsService } from "./models.service";
import { UseGuards } from "@nestjs/common";
import { SessionGuard } from "../auth/session.guard";
import { ProjectRoleGuard } from "../authz/project-role.guard";
import { ProjectRoles } from "../authz/project-roles.decorator";


function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

@UseGuards(SessionGuard)

@Controller("/api/projects/:projectId/models")
export class ModelsController {
  constructor(private readonly models: ModelsService) {}

  @Get()
  @UseGuards(ProjectRoleGuard)
  @ProjectRoles("VIEWER", "EDITOR", "ADMIN", "OWNER")
  async list(@Param("projectId") projectId: string) {
    const rows = await this.models.list(projectId);
    return rows.map((m) => {
      const fileKey = m.currentVersion?.fileKey ?? null;
      return {
        id: m.id,
        label: m.label,
        url: fileKey ? `/storage/${fileKey}` : null,
        currentVersion: m.currentVersion
          ? { id: m.currentVersion.id, version: m.currentVersion.version, createdAt: m.currentVersion.createdAt }
          : null,
      };
    });
  }

  
  @Post("upload")
  @UseGuards(ProjectRoleGuard)
  @ProjectRoles("EDITOR", "ADMIN", "OWNER")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const projectId = (req.params as any).projectId;
          const dir = join(process.cwd(), "storage", "projects", projectId, "models");
          ensureDir(dir);
          cb(null, dir);
        },
        filename: (req, file, cb) => {
          const id = randomUUID();
          cb(null, `${id}.ifc`);
        },
      }),
      fileFilter: (req, file, cb) => {
        const ok = file.originalname.toLowerCase().endsWith(".ifc");
        cb(ok ? null : new Error("Only .ifc files are allowed"), ok);
      },
      limits: { fileSize: 200 * 1024 * 1024 }, // 200MB
    }),
  )
  async upload(
    @Param("projectId") projectId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { label?: string },
  ) {
    const storageId = file.filename.replace(/\.ifc$/i, ""); // id solo per il nome file in storage
    const fileKey = `projects/${projectId}/models/${storageId}.ifc`;
    const label = body?.label?.trim() || file.originalname;

    const updatedModel = await this.models.uploadNewVersion({
      projectId,
      label,
      fileName: file.originalname,
      fileKey,
      size: file.size,
    });

    return {
      id: updatedModel.id,
      label: updatedModel.label,
      url: updatedModel.currentVersion?.fileKey ? `/storage/${updatedModel.currentVersion.fileKey}` : null,
    };
  }


  
  @Post(':modelId/index-elements')
  @UseGuards(ProjectRoleGuard)
  @ProjectRoles('EDITOR', 'ADMIN', 'OWNER')
  async indexElements(
    @Param('projectId') projectId: string,
    @Param('modelId') modelId: string,
    @Body() body: {
      elements: Array<{
        guid: string;
        ifcType: string;
        name?: string | null;
        typeName?: string | null;
        category?: string | null;
      }>;
    },
  ) {
    return this.models.indexElements(projectId, modelId, body);
  }


  @Delete(":modelId")
  @UseGuards(ProjectRoleGuard)
  @ProjectRoles("EDITOR", "ADMIN", "OWNER")
  async remove(
    @Param("projectId") projectId: string,
    @Param("modelId") modelId: string,
  ) {
    const removed = await this.models.remove(projectId, modelId);

    // cancella tutti i file delle versioni
    for (const v of removed.versions ?? []) {
      const abs = join(process.cwd(), "storage", v.fileKey);
      try {
        if (fs.existsSync(abs)) fs.unlinkSync(abs);
      } catch {}
    }

    return removed;
  }

}
