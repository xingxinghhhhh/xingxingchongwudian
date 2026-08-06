import { rm } from "node:fs/promises";
import { resolve } from "node:path";

const rootDir = resolve(import.meta.dirname, "..");

await Promise.all([
  rm(resolve(rootDir, "dist"), {
    recursive: true,
    force: true
  }),
  rm(resolve(rootDir, "tsconfig.build.tsbuildinfo"), {
    force: true
  })
]);
