import "dotenv/config";
import { resolve } from "node:path";
import { z } from "zod";

const settings = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    NOX_AUTH_SOCKET: z.string().default("/run/nox-suite/nox-auth.sock"),
    HOST: z.string().min(1).default("127.0.0.1"),
    PORT: z.coerce.number().int().min(1).max(65535).default(3001),
    PC_CONFIGURATOR_DATA_DIR: z.string().min(1).default("./data"),
    PC_CONFIGURATOR_WEB_DIR: z.string().min(1).optional(),
  })
  .parse(process.env);

export const env = {
  ...settings,
  databaseFile: resolve(settings.PC_CONFIGURATOR_DATA_DIR, "catalog.db"),
  webDir: settings.PC_CONFIGURATOR_WEB_DIR
    ? resolve(settings.PC_CONFIGURATOR_WEB_DIR)
    : settings.NODE_ENV === "production"
      ? resolve("../frontend/dist")
      : undefined,
};
