import { ConfigService } from "@nestjs/config";
import { StaffService } from "./staff.service";

describe("StaffService legacy admin tokens", () => {
  const createService = (nodeEnv: string) =>
    new StaffService(new ConfigService({ NODE_ENV: nodeEnv }), {} as never);

  it("keeps development owner and operator tokens for test compatibility", () => {
    const service = createService("test");

    expect(service.resolveStaffByToken("dev-admin-key")).toMatchObject({
      role: "owner"
    });
    expect(service.resolveStaffByToken("ops-admin-key")).toMatchObject({
      role: "operator"
    });
  });

  it("rejects hard-coded tokens in production", () => {
    const service = createService("production");

    expect(service.resolveStaffByToken("dev-admin-key")).toBeNull();
    expect(service.resolveStaffByToken("ops-admin-key")).toBeNull();
  });

  it("accepts only the configured legacy owner token in production", () => {
    const service = createService("production");

    expect(
      service.resolveStaffByToken(
        "configured-production-admin-key",
        "configured-production-admin-key"
      )
    ).toMatchObject({
      role: "owner"
    });
  });
});
