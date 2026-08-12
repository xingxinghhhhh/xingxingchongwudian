import {
  ADMIN_OWNER_PERMISSIONS,
  bootstrapAdminOwner
} from "./admin-owner-bootstrap";

function createStore() {
  let account: Record<string, unknown> | null = null;
  const delegate = {
    findFirst: jest.fn(async () => account),
    findUnique: jest.fn(async ({ where }: { where: { staffNo?: string; email?: string } }) => {
      if (!account) return null;
      if (where.staffNo && account.staffNo !== where.staffNo) return null;
      if (where.email && account.email !== where.email) return null;
      return account;
    }),
    create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
      account = { id: "staff_owner_id", ...data };
      return account;
    })
  };

  return {
    prisma: {
      adminStaffAccount: delegate,
      $transaction: async <T>(callback: (tx: typeof delegate) => Promise<T>) =>
        callback({ adminStaffAccount: delegate } as never)
    },
    getAccount: () => account,
    delegate
  };
}

describe("bootstrapAdminOwner", () => {
  it("creates a real owner account with the existing login contract", async () => {
    const store = createStore();

    await expect(
      bootstrapAdminOwner(store.prisma as never, {
        name: "商家 Owner",
        email: "owner@pets.example.com",
        password: "owner-secret-2026"
      })
    ).resolves.toMatchObject({
      staffNo: "STAFF_OWNER",
      role: "owner",
      email: "owner@pets.example.com"
    });

    expect(store.getAccount()).toMatchObject({
      staffNo: "STAFF_OWNER",
      role: "owner",
      status: "active",
      permissions: [...ADMIN_OWNER_PERMISSIONS]
    });
    expect(String(store.getAccount()?.passwordHash)).toMatch(/^scrypt\$/);
    expect(String(store.getAccount()?.passwordHash)).not.toContain("owner-secret-2026");
  });

  it("fails closed when an owner already exists", async () => {
    const store = createStore();
    await bootstrapAdminOwner(store.prisma as never, {
      email: "owner@pets.example.com",
      password: "owner-secret-2026"
    });

    await expect(
      bootstrapAdminOwner(store.prisma as never, {
        email: "second@pets.example.com",
        password: "second-owner-secret-2026"
      })
    ).rejects.toThrow("bootstrap is one-time");
    expect(store.delegate.create).toHaveBeenCalledTimes(1);
  });

  it("rejects invalid credentials before touching the database", async () => {
    const store = createStore();

    await expect(
      bootstrapAdminOwner(store.prisma as never, {
        email: "not-an-email",
        password: "password"
      })
    ).rejects.toThrow("valid email address");
    expect(store.delegate.findFirst).not.toHaveBeenCalled();
    expect(store.delegate.create).not.toHaveBeenCalled();
  });
});
