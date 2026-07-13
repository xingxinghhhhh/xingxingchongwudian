import { ConfigService } from "@nestjs/config";
import { CloudPetsService } from "./cloud-pets.service";

function createConfigService(databaseUrl?: string): ConfigService {
  return {
    get: jest.fn((key: string) =>
      key === "DATABASE_URL" ? databaseUrl : undefined
    )
  } as unknown as ConfigService;
}

function createProductsService() {
  return {
    listActiveProducts: jest.fn().mockResolvedValue([])
  };
}

describe("CloudPetsService", () => {
  it("persists a daily task completion before applying database rewards", async () => {
    const prisma = {
      virtualPet: {
        findUnique: jest.fn().mockResolvedValue({ id: "pet_internal_1" }),
        update: jest.fn().mockResolvedValue({
          petNo: "VPDB001",
          ownerName: "Task Owner",
          ownerPhone: "13600136003",
          name: "Database Pet",
          species: "dog",
          personality: "Daily",
          avatarUrl: "/pet.png",
          bio: "Database Pet",
          mood: 80,
          energy: 72,
          intimacy: 25,
          timeline: []
        })
      },
      virtualPetTaskCompletion: {
        create: jest.fn().mockResolvedValue({})
      },
      virtualPetEvent: {
        findFirst: jest.fn().mockResolvedValue(null)
      }
    };
    const service = new CloudPetsService(
      createConfigService("mysql://user:pass@localhost:3306/shop"),
      prisma as never,
      createProductsService() as never
    );

    await expect(service.completeGrowthTask("VPDB001", "daily-care")).resolves.toMatchObject({
      completedTask: {
        key: "daily-care"
      },
      pet: {
        stats: {
          intimacy: 25
        }
      }
    });
    expect(prisma.virtualPetTaskCompletion.create).toHaveBeenCalledWith({
      data: {
        completedDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        petId: "pet_internal_1",
        petNo: "VPDB001",
        taskKey: "daily-care"
      }
    });
    expect(prisma.virtualPet.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          timeline: {
            create: expect.arrayContaining([
              expect.objectContaining({ type: "growth_task" }),
              expect.objectContaining({ type: "daily_diary" })
            ])
          }
        }),
        where: { petNo: "VPDB001" }
      })
    );
  });

  it("rejects duplicate database task completion records for the same day", async () => {
    const prisma = {
      virtualPet: {
        findUnique: jest.fn().mockResolvedValue({ id: "pet_internal_1" }),
        update: jest.fn()
      },
      virtualPetTaskCompletion: {
        create: jest.fn().mockRejectedValue({ code: "P2002" })
      },
      virtualPetEvent: {
        findFirst: jest.fn()
      }
    };
    const service = new CloudPetsService(
      createConfigService("mysql://user:pass@localhost:3306/shop"),
      prisma as never,
      createProductsService() as never
    );

    await expect(
      service.completeGrowthTask("VPDB001", "daily-care")
    ).rejects.toMatchObject({
      status: 409,
      message: "Growth task already completed today"
    });
    expect(prisma.virtualPet.update).not.toHaveBeenCalled();
  });
});
