import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { json, urlencoded } from "express";
import { join } from "path";
import { NestExpressApplication } from "@nestjs/platform-express";
import cookieParser from "cookie-parser";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.use(cookieParser());
  
  // ✅ Aumenta limite body JSON (bulk-get può essere grande)
  app.use(json({ limit: "5mb" }));
  app.use(urlencoded({ extended: true, limit: "5mb" }));

  app.enableCors({
    origin: true,
    credentials: true,
  });

  // ✅ Serve i file caricati (IFC) dal filesystem locale
  app.useStaticAssets(join(process.cwd(), "storage"), { prefix: "/storage" });

  const port = process.env.PORT ? Number(process.env.PORT) : 4000;
  await app.listen(port);
  console.log(`Aedera API listening on http://localhost:${port}`);
}
bootstrap();
