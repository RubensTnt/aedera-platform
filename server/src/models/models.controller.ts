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
import { SessionGuard } from "../auth/session.guard";
import { UseGuards } from "@nestjs/common";


function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

@UseGuards(SessionGuard)

@Controller("/api/projects/:projectId/models")
export class ModelsController {
  constructor(private readonly models: ModelsService) {}

  @Get()
  async list(@Param("projectId") projectId: string) {
    const rows = await this.models.list(projectId);
    return rows.map((m) => ({
      ...m,
      url: `/storage/${m.fileKey}`,
    }));
  }

  @Post("upload")
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
    const id = file.filename.replace(/\.ifc$/i, "");
    const fileKey = `projects/${projectId}/models/${id}.ifc`; // relativo sotto /storage
    const label = body?.label?.trim() || file.originalname;

    const created = await this.models.create({
      id,
      projectId,
      label,
      fileName: file.originalname,
      fileKey,
      size: file.size,
    });

    return {
      ...created,
      url: `/storage/${fileKey}`,
    };
  }

  @Delete(":modelId")
  async remove(
    @Param("projectId") projectId: string,
    @Param("modelId") modelId: string,
  ) {
    const removed = await this.models.remove(projectId, modelId);

    // prova a cancellare anche il file
    const abs = join(process.cwd(), "storage", removed.fileKey);
    try {
      if (fs.existsSync(abs)) fs.unlinkSync(abs);
    } catch {}

    return removed;
  }
}
