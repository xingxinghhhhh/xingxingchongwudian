import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import {
  createSafeDatabaseIdentity,
  getDeclaredNodeRequirement,
  resolveProductionHostPorts,
  resolveProductionSqliteDatabasePath
} from "./production-host-preflight";

describe("production host preflight helpers", () => {
  it("rejects the development SQLite database and accepts an external path", () => {
    const root = mkdtempSync(join(process.cwd(), "production-host-preflight-"));
    try {
      expect(() =>
        resolveProductionSqliteDatabasePath(`file:${join(root, "production.db")}`, root)
      ).not.toThrow();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects the repository prisma/dev.db path", () => {
    const root = mkdtempSync(join(process.cwd(), "production-host-preflight-"));
    try {
      const developmentDatabase = join(root, "prisma", "dev.db");
      expect(() =>
        resolveProductionSqliteDatabasePath(`file:${developmentDatabase}`, root)
      ).toThrow("prisma/dev.db");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("resolves documented API and web defaults and validates overrides", () => {
    expect(resolveProductionHostPorts({})).toEqual({ api: 3000, web: 3001 });
    expect(resolveProductionHostPorts({ PORT: "3100", WEB_PORT: "3101" })).toEqual({
      api: 3100,
      web: 3101
    });
    expect(() => resolveProductionHostPorts({ PORT: "0" })).toThrow();
  });

  it("uses a stable non-secret database identity and reports absent node engines", () => {
    expect(createSafeDatabaseIdentity("C:\\data\\cloud-pets.db")).toHaveLength(16);
    expect(getDeclaredNodeRequirement({})).toBe("not_declared");
    expect(getDeclaredNodeRequirement({ engines: { node: ">=22" } })).toBe(">=22");
  });
});
