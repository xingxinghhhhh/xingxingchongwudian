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
  it("restores persisted growth task templates and care score rules after restart", async () => {
    const savedTemplates = new Map<string, Record<string, unknown>>();
    let savedRules: Record<string, unknown> | null = null;
    const updatedAt = new Date("2026-07-23T09:00:00.000Z");
    const prisma = {
      cloudPetGrowthTaskTemplate: {
        findMany: jest.fn(async () => Array.from(savedTemplates.values())),
        upsert: jest.fn(async ({ create, update }: {
          create: Record<string, unknown>;
          update: Record<string, unknown>;
        }) => {
          const key = String(create.key);
          const saved = {
            ...(savedTemplates.get(key) ?? create),
            ...update,
            key,
            updatedAt
          };
          savedTemplates.set(key, saved);
          return saved;
        })
      },
      cloudPetCareScoreConfig: {
        findUnique: jest.fn(async () => savedRules),
        upsert: jest.fn(async ({ create, update }: {
          create: Record<string, unknown>;
          update: Record<string, unknown>;
        }) => {
          savedRules = {
            ...(savedRules ?? create),
            ...update,
            id: "active",
            updatedAt
          };
          return savedRules;
        })
      }
    };
    const firstService = new CloudPetsService(
      createConfigService("file:test.db"),
      prisma as never,
      createProductsService() as never
    );

    await firstService.onModuleInit();
    await firstService.updateGrowthTaskTemplate("daily-care", {
      points: 31,
      rewards: { intimacy: 15 }
    });
    await firstService.updateCareScoreRules({
      dailyTaskBonus: 18,
      steadyMinScore: 62,
      thrivingMinScore: 82
    });

    const restartedService = new CloudPetsService(
      createConfigService("file:test.db"),
      prisma as never,
      createProductsService() as never
    );
    await restartedService.onModuleInit();

    expect(restartedService.listGrowthTasks()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "daily-care",
          points: 31,
          rewards: expect.objectContaining({ intimacy: 15 })
        })
      ])
    );
    expect(restartedService.getCareScoreRules()).toEqual({
      dailyTaskBonus: 18,
      steadyMinScore: 62,
      thrivingMinScore: 82,
      thrivingRequiresCareToday: true,
      updatedAt: "2026-07-23T09:00:00.000Z"
    });
  });

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
              expect.objectContaining({ type: "care_daily_diary" })
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
  it("supports multiple daily care actions without duplicating the generated diary", async () => {
    const service = new CloudPetsService(
      createConfigService(),
      {} as never,
      createProductsService() as never
    );
    const pet = await service.createPet({
      ownerName: "Care Owner",
      ownerPhone: "13600136010",
      name: "Care Pet",
      species: "dog",
      personality: "likes complete care routines"
    });

    await service.completeGrowthTask(pet.petNo, "daily-care");
    await service.completeGrowthTask(pet.petNo, "feed-care");
    const updatedPet = await service.getPet(pet.petNo);

    expect(updatedPet.growth).toMatchObject({
      todayCompletedTaskCount: 2,
      todayCompletedTaskKeys: expect.arrayContaining(["daily-care", "feed-care"])
    });
    expect(
      updatedPet.timeline.filter((event) => event.type === "care_daily_diary")
    ).toHaveLength(1);
  });

  it("calculates daily care streak from unique completed dates", async () => {
    jest.useFakeTimers();

    try {
      const service = new CloudPetsService(
        createConfigService(),
        {} as never,
        createProductsService() as never
      );

      jest.setSystemTime(new Date("2026-06-01T08:00:00.000Z"));
      const pet = await service.createPet({
        ownerName: "Streak Owner",
        ownerPhone: "13600136009",
        name: "Streak Pet",
        species: "cat",
        personality: "returns every day"
      });
      await service.completeGrowthTask(pet.petNo, "daily-care");

      jest.setSystemTime(new Date("2026-06-02T08:00:00.000Z"));
      await service.completeGrowthTask(pet.petNo, "daily-care");

      jest.setSystemTime(new Date("2026-06-03T08:00:00.000Z"));
      const beforeTodayCare = await service.getPet(pet.petNo);
      expect(beforeTodayCare.growth).toMatchObject({
        careStreakDays: 2,
        isCareCompleteToday: false,
        lastCareDate: "2026-06-02"
      });
      expect(beforeTodayCare.growth.nextCarePrompt.length).toBeGreaterThan(0);

      await service.completeGrowthTask(pet.petNo, "daily-care");
      const afterTodayCare = await service.getPet(pet.petNo);

      expect(afterTodayCare.growth).toMatchObject({
        careStreakDays: 3,
        isCareCompleteToday: true,
        lastCareDate: "2026-06-03"
      });
    } finally {
      jest.useRealTimers();
    }
  });
});
