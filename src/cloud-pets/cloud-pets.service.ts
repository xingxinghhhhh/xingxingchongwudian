import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { BadRequestException } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import { ProductsService } from "../products/products.service";
import { ProductListItem } from "../products/product.types";
import { CreateCloudPetDto } from "./dto/create-cloud-pet.dto";
import { UpdateCloudPetHomepageDto } from "./dto/update-cloud-pet-homepage.dto";

export interface CloudPetProfile {
  petNo: string;
  ownerName: string;
  ownerPhone: string;
  name: string;
  species: "cat" | "dog";
  personality: string;
  avatarUrl: string;
  bio: string;
  stats: {
    mood: number;
    energy: number;
    intimacy: number;
  };
  growth: CloudPetGrowthProfile;
  homepage: CloudPetHomepageProfile;
  timeline: Array<{
    type: string;
    title: string;
    body: string;
    createdAt: string;
  }>;
}

export type CloudPetCareState = "needs_care" | "steady" | "thriving";
export type CloudPetHomepageTheme = "sunny" | "forest" | "midnight";

export interface CloudPetHomepageProfile {
  theme: CloudPetHomepageTheme;
  headline: string;
  ownerStory: string;
  showGrowthArchive: boolean;
  showMallRecommendations: boolean;
}

export interface CloudPetHomepageArchive {
  petNo: string;
  share: {
    title: string;
    description: string;
    url: string;
    ctaLabel: string;
  };
  commerceReward: {
    status: "locked" | "unlocked";
    title: string;
    description: string;
    couponCode?: string;
    discountCents?: number;
    ctaHref: string;
    ctaLabel: string;
    recommendedProductSlug?: string;
    recommendedProductTitle?: string;
  };
  engagement: {
    homepageVisitCount: number;
  };
  filters: Array<{
    key: string;
    label: string;
    count: number;
  }>;
  items: Array<{
    type: string;
    title: string;
    body: string;
    createdAt: string;
  }>;
}

export interface CloudPetGrowthProfile {
  level: number;
  levelLabel: string;
  experiencePoints: number;
  nextLevelExperience: number;
  progressPercent: number;
  careState: CloudPetCareState;
  careScore: number;
  todayCompletedTaskCount: number;
}

export interface CloudPetRecommendation extends ProductListItem {
  reason: string;
}

export interface CloudPetNextAction {
  key: "open-homepage" | "share-community" | "shop-reward" | "continue-care";
  title: string;
  description: string;
  href: string;
  ctaLabel: string;
}

export interface GrowthTask {
  key: string;
  title: string;
  description: string;
  points: number;
  rewards: {
    mood: number;
    energy: number;
    intimacy: number;
  };
}

export interface GrowthTaskCompletionRecord {
  petNo: string;
  taskKey: string;
  completedDate: string;
  createdAt: string;
}

export interface CloudPetHomepageVisitRecord {
  petNo: string;
  source: string;
  visitCount: number;
  createdAt: string;
}

export interface CloudPetDailyDiaryGenerationItem {
  petNo: string;
  name: string;
  status: "generated" | "skipped";
  reason: string;
  event?: CloudPetProfile["timeline"][number];
}

export interface CloudPetDailyDiaryGenerationResult {
  date: string;
  generatedCount: number;
  skippedCount: number;
  items: CloudPetDailyDiaryGenerationItem[];
}

export interface CloudPetDailyDiaryStatusItem {
  petNo: string;
  name: string;
  status: "covered" | "missing";
  latestDailyDiaryAt?: string;
}

export interface CloudPetDailyDiaryStatus {
  date: string;
  totalPetCount: number;
  generatedTodayCount: number;
  missingTodayCount: number;
  coverageRate: number;
  items: CloudPetDailyDiaryStatusItem[];
}

export interface CloudPetDailyDiaryCoverageMissingPet {
  petId: string;
  petNo: string;
  petName: string;
  memberId: string;
  memberPhone: string;
  growthLevel: number;
  careState: CloudPetCareState;
  lastDiaryDate?: string;
  reason: "NO_TASK_COMPLETED" | "NO_DIARY_GENERATED";
}

export interface CloudPetDailyDiaryCoverage {
  date: string;
  coveredCount: number;
  missingCount: number;
  coverageRate: number;
  missingPets: CloudPetDailyDiaryCoverageMissingPet[];
}

export interface CloudPetDailyDiaryBackfillInput {
  date: string;
  mode: "missingOnly" | "selected";
  petIds?: string[];
}

export interface CloudPetDailyDiaryBackfillResultItem {
  petId: string;
  petNo?: string;
  petName?: string;
  status: "created" | "skipped" | "failed";
  diaryId?: string;
  reason?:
    | "ALREADY_HAS_DIARY"
    | "NOT_MISSING"
    | "PET_NOT_FOUND"
    | "NO_TASK_COMPLETED"
    | "NO_DIARY_GENERATED"
    | "GENERATION_FAILED"
    | "INVALID_SELECTED_PET"
    | "UNKNOWN";
}

export interface CloudPetDailyDiaryBackfillResult {
  date: string;
  mode: "missingOnly" | "selected";
  attemptedCount: number;
  successCount: number;
  skippedCount: number;
  failedCount: number;
  results: CloudPetDailyDiaryBackfillResultItem[];
}

interface CloudPetRecord {
  id?: string;
  petNo: string;
  ownerName: string;
  ownerPhone: string;
  name: string;
  species: "cat" | "dog";
  personality: string;
  avatarUrl: string;
  bio: string;
  homepageTheme?: string;
  homepageHeadline?: string;
  homepageOwnerStory?: string;
  homepageShowGrowthArchive?: boolean;
  homepageShowMallRecommendations?: boolean;
  mood: number;
  energy: number;
  intimacy: number;
  timeline: Array<{
    type: string;
    title: string;
    body: string;
    createdAt: Date | string;
  }>;
}

type CloudPetTimelineEventInput = {
  type: string;
  title: string;
  body: string;
  createdAt: Date;
};

export const growthTasks: GrowthTask[] = [
  {
    key: "daily-care",
    title: "Daily care",
    description: "Complete feeding, grooming, or a light interaction so the pet has a care record every day.",
    points: 20,
    rewards: {
      mood: 8,
      energy: 4,
      intimacy: 10
    }
  },
  {
    key: "community-share",
    title: "Community share",
    description: "Publish a pet update so the growth record flows into the interactive community.",
    points: 30,
    rewards: {
      mood: 6,
      energy: 2,
      intimacy: 8
    }
  },
  {
    key: "shop-gift",
    title: "Shop gift",
    description: "Choose a recommended product from the pet profile and connect content to commerce.",
    points: 40,
    rewards: {
      mood: 10,
      energy: 6,
      intimacy: 12
    }
  }
];

@Injectable()
export class CloudPetsService {
  private readonly pets = new Map<string, CloudPetRecord>();
  private readonly completedTaskDates = new Set<string>();
  private readonly taskCompletions = new Map<string, GrowthTaskCompletionRecord>();
  private readonly homepageVisits = new Map<string, CloudPetHomepageVisitRecord>();
  private sequence = 0;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly productsService: ProductsService
  ) {}

  async createPet(dto: CreateCloudPetDto): Promise<CloudPetProfile> {
    const petNo = this.createPetNo();
    const pet = this.createPetRecord(petNo, dto);

    if (!this.isDatabaseConfigured()) {
      this.pets.set(pet.petNo, pet);
      return this.toProfile(pet, []);
    }

    const savedPet = await this.prisma.virtualPet.create({
      data: {
        petNo: pet.petNo,
        ownerName: pet.ownerName,
        ownerPhone: pet.ownerPhone,
        name: pet.name,
        species: pet.species,
        personality: pet.personality,
        avatarUrl: pet.avatarUrl,
        bio: pet.bio,
        homepageTheme: pet.homepageTheme,
        homepageHeadline: pet.homepageHeadline,
        homepageOwnerStory: pet.homepageOwnerStory,
        homepageShowGrowthArchive: pet.homepageShowGrowthArchive,
        homepageShowMallRecommendations: pet.homepageShowMallRecommendations,
        mood: pet.mood,
        energy: pet.energy,
        intimacy: pet.intimacy,
        timeline: {
          create: pet.timeline.map((event) => ({
            type: event.type,
            title: event.title,
            body: event.body
          }))
        }
      },
      include: { timeline: { orderBy: { createdAt: "desc" } } }
    });

    return this.toProfile(savedPet, []);
  }

  async getPet(petNo: string): Promise<CloudPetProfile> {
    if (!this.isDatabaseConfigured()) {
      const pet = this.pets.get(petNo);

      if (!pet) {
        throw new NotFoundException("Cloud pet not found");
      }

      return this.toProfile(pet, this.getMemoryTaskCompletionsForPet(petNo));
    }

    const pet = await this.prisma.virtualPet.findUnique({
      where: { petNo },
      include: { timeline: { orderBy: { createdAt: "desc" } } }
    });

    if (!pet) {
      throw new NotFoundException("Cloud pet not found");
    }

    const completions = await this.prisma.virtualPetTaskCompletion.findMany({
      where: { petNo },
      orderBy: [{ completedDate: "desc" }, { createdAt: "desc" }]
    });

    return this.toProfile(
      pet,
      completions.map((completion) => ({
        petNo: completion.petNo,
        taskKey: completion.taskKey,
        completedDate: completion.completedDate,
        createdAt: completion.createdAt.toISOString()
      }))
    );
  }

  async getPetRecord(petNo: string): Promise<CloudPetProfile> {
    return this.getPet(petNo);
  }

  async listPetsByOwnerPhone(ownerPhone: string): Promise<CloudPetProfile[]> {
    if (!this.isDatabaseConfigured()) {
      return Array.from(this.pets.values())
        .filter((pet) => pet.ownerPhone === ownerPhone)
        .map((pet) =>
          this.toProfile(pet, this.getMemoryTaskCompletionsForPet(pet.petNo))
        );
    }

    const pets = await this.prisma.virtualPet.findMany({
      where: { ownerPhone },
      include: {
        taskCompletions: { orderBy: [{ completedDate: "desc" }, { createdAt: "desc" }] },
        timeline: { orderBy: { createdAt: "desc" } }
      },
      orderBy: { createdAt: "desc" }
    });

    return pets.map((pet) => this.toProfile(pet, this.toCompletionRecords(pet.taskCompletions)));
  }

  listGrowthTasks() {
    return growthTasks;
  }

  async listTaskCompletionsByOwnerPhone(
    ownerPhone: string
  ): Promise<GrowthTaskCompletionRecord[]> {
    if (!this.isDatabaseConfigured()) {
      const petNos = new Set(
        Array.from(this.pets.values())
          .filter((pet) => pet.ownerPhone === ownerPhone)
          .map((pet) => pet.petNo)
      );

      return Array.from(this.taskCompletions.values())
        .filter((completion) => petNos.has(completion.petNo))
        .sort((left, right) => right.completedDate.localeCompare(left.completedDate));
    }

    const completions = await this.prisma.virtualPetTaskCompletion.findMany({
      where: {
        pet: {
          ownerPhone
        }
      },
      orderBy: [{ completedDate: "desc" }, { createdAt: "desc" }]
    });

    return completions.map((completion) => ({
      petNo: completion.petNo,
      taskKey: completion.taskKey,
      completedDate: completion.completedDate,
      createdAt: completion.createdAt.toISOString()
    }));
  }

  async countHomepageVisitsByOwnerPhone(ownerPhone: string): Promise<number> {
    if (!this.isDatabaseConfigured()) {
      const petNos = new Set(
        Array.from(this.pets.values())
          .filter((pet) => pet.ownerPhone === ownerPhone)
          .map((pet) => pet.petNo)
      );

      return Array.from(this.homepageVisits.values()).filter((visit) =>
        petNos.has(visit.petNo)
      ).length;
    }

    return this.prisma.virtualPetHomepageVisit.count({
      where: {
        pet: {
          ownerPhone
        }
      }
    });
  }

  async completeGrowthTask(petNo: string, taskKey: string) {
    const task = growthTasks.find((item) => item.key === taskKey);

    if (!task) {
      throw new NotFoundException("Growth task not found");
    }

    const completionKey = this.createTaskCompletionKey(petNo, taskKey);

    if (!this.isDatabaseConfigured()) {
      const pet = this.pets.get(petNo);

      if (!pet) {
        throw new NotFoundException("Cloud pet not found");
      }

      this.reserveTaskCompletion(completionKey);
      this.taskCompletions.set(completionKey, {
        petNo,
        taskKey,
        completedDate: this.getTaskDate(),
        createdAt: new Date().toISOString()
      });
      await this.applyTaskRewards(pet, task);
      this.pets.set(pet.petNo, pet);

      return {
        completedTask: task,
        pet: this.toProfile(pet, this.getMemoryTaskCompletionsForPet(petNo)),
        nextActions: this.buildGrowthTaskNextActions(petNo, task)
      };
    }

    const petRecord = await this.prisma.virtualPet.findUnique({
      where: { petNo },
      select: { id: true, name: true, species: true }
    });

    if (!petRecord) {
      throw new NotFoundException("Cloud pet not found");
    }

    try {
      await this.prisma.virtualPetTaskCompletion.create({
        data: {
          petId: petRecord.id,
          petNo,
          taskKey,
          completedDate: this.getTaskDate()
        }
      });

      const timelineEvents: CloudPetTimelineEventInput[] = [
        this.buildGrowthTaskEvent(task)
      ];
      const hasDailyDiary = await this.hasDailyDiaryForToday(petRecord.id);

      if (!hasDailyDiary) {
        timelineEvents.push(
          await this.buildDailyDiaryEvent(
            {
              petNo,
              name: petRecord.name,
              species: petRecord.species
            },
            task
          )
        );
      }

      const pet = await this.prisma.virtualPet.update({
        where: { petNo },
        data: {
          mood: { increment: task.rewards.mood },
          energy: { increment: task.rewards.energy },
          intimacy: { increment: task.rewards.intimacy },
          timeline: {
            create: timelineEvents
          }
        },
        include: { timeline: { orderBy: { createdAt: "desc" } } }
      });

      return {
        completedTask: task,
        pet: this.toProfile(pet, [
          {
            petNo,
            taskKey,
            completedDate: this.getTaskDate(),
            createdAt: new Date().toISOString()
          }
        ]),
        nextActions: this.buildGrowthTaskNextActions(petNo, task)
      };
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException("Growth task already completed today");
      }

      throw error;
    }
  }

  async listAdminPets() {
    if (!this.isDatabaseConfigured()) {
      return Array.from(this.pets.values()).map((pet) => ({
        ...this.toProfile(pet, this.getMemoryTaskCompletionsForPet(pet.petNo)),
        communityPostCount: 0,
        homepageVisitCount: this.countMemoryHomepageVisits(pet.petNo)
      }));
    }

    const pets = await this.prisma.virtualPet.findMany({
      include: {
        taskCompletions: { orderBy: [{ completedDate: "desc" }, { createdAt: "desc" }] },
        timeline: { orderBy: { createdAt: "desc" } },
        _count: { select: { communityPosts: true, homepageVisits: true } }
      },
      orderBy: { createdAt: "desc" }
    });

    return pets.map((pet) => ({
      ...this.toProfile(pet, this.toCompletionRecords(pet.taskCompletions)),
      communityPostCount: pet._count.communityPosts,
      homepageVisitCount: pet._count.homepageVisits
    }));
  }

  async getMetrics() {
    const pets = await this.listAdminPets();

    return {
      cloudPetCount: pets.length
    };
  }

  async updateHomepage(
    petNo: string,
    dto: UpdateCloudPetHomepageDto
  ): Promise<CloudPetProfile> {
    if (!this.isDatabaseConfigured()) {
      const pet = this.pets.get(petNo);

      if (!pet) {
        throw new NotFoundException("Cloud pet not found");
      }

      const updatedPet = this.applyHomepageSettings(pet, dto);
      this.pets.set(petNo, updatedPet);

      return this.toProfile(
        updatedPet,
        this.getMemoryTaskCompletionsForPet(petNo)
      );
    }

    const pet = await this.prisma.virtualPet.update({
      where: { petNo },
      data: this.toHomepageUpdateData(dto),
      include: {
        taskCompletions: { orderBy: [{ completedDate: "desc" }, { createdAt: "desc" }] },
        timeline: { orderBy: { createdAt: "desc" } }
      }
    });

    return this.toProfile(pet, this.toCompletionRecords(pet.taskCompletions));
  }

  async getHomepageArchive(
    petNo: string,
    eventType?: string
  ): Promise<CloudPetHomepageArchive> {
    const pet = await this.getPet(petNo);
    const selectedType = eventType && eventType !== "all" ? eventType : null;
    const items = selectedType
      ? pet.timeline.filter((event) => event.type === selectedType)
      : pet.timeline;

    return {
      petNo: pet.petNo,
      share: {
        title: pet.homepage.headline,
        description: pet.homepage.ownerStory,
        url: "/cloud-pets/" + pet.petNo,
        ctaLabel: "Open pet homepage"
      },
      commerceReward: await this.buildCommerceReward(pet),
      engagement: {
        homepageVisitCount: await this.countHomepageVisits(petNo)
      },
      filters: this.buildArchiveFilters(pet.timeline),
      items
    };
  }

  async generateDailyDiariesForToday(): Promise<CloudPetDailyDiaryGenerationResult> {
    const task = growthTasks[0];
    const items: CloudPetDailyDiaryGenerationItem[] = [];

    if (!this.isDatabaseConfigured()) {
      for (const pet of this.pets.values()) {
        if (this.hasMemoryDailyDiaryForToday(pet)) {
          items.push({
            petNo: pet.petNo,
            name: pet.name,
            status: "skipped",
            reason: "Daily diary already exists for today"
          });
          continue;
        }

        const event = await this.buildDailyDiaryEvent(pet, task);
        pet.timeline.unshift(event);
        this.pets.set(pet.petNo, pet);
        items.push({
          petNo: pet.petNo,
          name: pet.name,
          status: "generated",
          reason: "Generated today's cloud-pet diary",
          event: this.toTimelineEventResponse(event)
        });
      }

      return this.toDailyDiaryGenerationResult(items);
    }

    const pets = await this.prisma.virtualPet.findMany({
      select: {
        id: true,
        petNo: true,
        name: true,
        species: true
      },
      orderBy: { createdAt: "desc" }
    });

    for (const pet of pets) {
      const hasDailyDiary = await this.hasDailyDiaryForToday(pet.id);

      if (hasDailyDiary) {
        items.push({
          petNo: pet.petNo,
          name: pet.name,
          status: "skipped",
          reason: "Daily diary already exists for today"
        });
        continue;
      }

      const event = await this.buildDailyDiaryEvent(
        {
          petNo: pet.petNo,
          name: pet.name,
          species: pet.species as "cat" | "dog"
        },
        task
      );
      const savedEvent = await this.prisma.virtualPetEvent.create({
        data: {
          petId: pet.id,
          type: event.type,
          title: event.title,
          body: event.body
        }
      });

      items.push({
        petNo: pet.petNo,
        name: pet.name,
        status: "generated",
        reason: "Generated today's cloud-pet diary",
        event: this.toTimelineEventResponse({
          ...event,
          createdAt: savedEvent.createdAt
        })
      });
    }

    return this.toDailyDiaryGenerationResult(items);
  }

  async getDailyDiaryStatusForToday(): Promise<CloudPetDailyDiaryStatus> {
    const items: CloudPetDailyDiaryStatusItem[] = [];

    if (!this.isDatabaseConfigured()) {
      for (const pet of this.pets.values()) {
        const dailyDiary = this.findMemoryDailyDiaryForToday(pet);
        items.push({
          petNo: pet.petNo,
          name: pet.name,
          status: dailyDiary ? "covered" : "missing",
          latestDailyDiaryAt: dailyDiary
            ? this.toTimelineEventResponse(dailyDiary).createdAt
            : undefined
        });
      }

      return this.toDailyDiaryStatus(items);
    }

    const pets = await this.prisma.virtualPet.findMany({
      select: {
        id: true,
        petNo: true,
        name: true
      },
      orderBy: { createdAt: "desc" }
    });

    for (const pet of pets) {
      const dailyDiary = await this.findDailyDiaryForToday(pet.id);
      items.push({
        petNo: pet.petNo,
        name: pet.name,
        status: dailyDiary ? "covered" : "missing",
        latestDailyDiaryAt: dailyDiary?.createdAt.toISOString()
      });
    }

    return this.toDailyDiaryStatus(items);
  }

  async getDailyDiaryCoverage(
    date = this.getTaskDate()
  ): Promise<CloudPetDailyDiaryCoverage> {
    const pets = await this.listAdminPets();
    const missingPets = pets
      .filter((pet) => !this.hasTimelineDailyDiaryOnDate(pet.timeline, date))
      .map((pet) => ({
        petId: pet.petNo,
        petNo: pet.petNo,
        petName: pet.name,
        memberId: pet.ownerPhone,
        memberPhone: pet.ownerPhone,
        growthLevel: pet.growth.level,
        careState: pet.growth.careState,
        lastDiaryDate: this.getLatestTimelineDailyDiaryDate(pet.timeline),
        reason:
          pet.growth.todayCompletedTaskCount > 0
            ? "NO_DIARY_GENERATED"
            : "NO_TASK_COMPLETED"
      } satisfies CloudPetDailyDiaryCoverageMissingPet));
    const coveredCount = pets.length - missingPets.length;

    return {
      date,
      coveredCount,
      missingCount: missingPets.length,
      coverageRate: pets.length === 0 ? 1 : coveredCount / pets.length,
      missingPets
    };
  }

  async backfillDailyDiaryCoverage(
    input: CloudPetDailyDiaryBackfillInput
  ): Promise<CloudPetDailyDiaryBackfillResult> {
    this.assertBackfillInput(input);

    const pets = await this.listAdminPets();
    const petMap = new Map(pets.map((pet) => [pet.petNo, pet]));
    const coverage = await this.getDailyDiaryCoverage(input.date);
    const missingMap = new Map(
      coverage.missingPets.map((pet) => [pet.petNo, pet] as const)
    );
    const targetPetIds =
      input.mode === "missingOnly"
        ? coverage.missingPets.map((pet) => pet.petNo)
        : input.petIds ?? [];
    const results: CloudPetDailyDiaryBackfillResultItem[] = [];

    for (const petId of targetPetIds) {
      const pet = petMap.get(petId);

      if (!pet) {
        results.push({
          petId,
          status: "skipped",
          reason: "PET_NOT_FOUND"
        });
        continue;
      }

      if (this.hasTimelineDailyDiaryOnDate(pet.timeline, input.date)) {
        results.push({
          petId,
          petNo: pet.petNo,
          petName: pet.name,
          status: "skipped",
          reason: "ALREADY_HAS_DIARY"
        });
        continue;
      }

      const missingPet = missingMap.get(pet.petNo);

      if (!missingPet) {
        results.push({
          petId,
          petNo: pet.petNo,
          petName: pet.name,
          status: "skipped",
          reason: "NOT_MISSING"
        });
        continue;
      }

      try {
        const savedDiaryId = await this.createBackfillDiaryEvent(
          pet,
          missingPet.reason,
          input.date
        );
        results.push({
          petId,
          petNo: pet.petNo,
          petName: pet.name,
          status: "created",
          diaryId: savedDiaryId,
          reason: missingPet.reason
        });
      } catch {
        results.push({
          petId,
          petNo: pet.petNo,
          petName: pet.name,
          status: "failed",
          reason: "GENERATION_FAILED"
        });
      }
    }

    return {
      date: input.date,
      mode: input.mode,
      attemptedCount: targetPetIds.length,
      successCount: results.filter((item) => item.status === "created").length,
      skippedCount: results.filter((item) => item.status === "skipped").length,
      failedCount: results.filter((item) => item.status === "failed").length,
      results
    };
  }

  async recordHomepageVisit(
    petNo: string,
    source = "direct"
  ): Promise<CloudPetHomepageVisitRecord> {
    const normalizedSource = source.trim() || "direct";

    if (!this.isDatabaseConfigured()) {
      const pet = this.pets.get(petNo);

      if (!pet) {
        throw new NotFoundException("Cloud pet not found");
      }

      const visitNo = petNo + ":" + Date.now() + ":" + (this.homepageVisits.size + 1);
      const record = {
        petNo,
        source: normalizedSource,
        visitCount: this.countMemoryHomepageVisits(petNo) + 1,
        createdAt: new Date().toISOString()
      };
      this.homepageVisits.set(visitNo, record);

      return record;
    }

    const pet = await this.prisma.virtualPet.findUnique({
      where: { petNo },
      select: { id: true }
    });

    if (!pet) {
      throw new NotFoundException("Cloud pet not found");
    }

    const visit = await this.prisma.virtualPetHomepageVisit.create({
      data: {
        petId: pet.id,
        petNo,
        source: normalizedSource
      }
    });

    return {
      petNo,
      source: visit.source,
      visitCount: await this.countHomepageVisits(petNo),
      createdAt: visit.createdAt.toISOString()
    };
  }

  async getRecommendations(
    petNo: string
  ): Promise<CloudPetRecommendation[]> {
    const pet = await this.getPet(petNo);
    const products = await this.productsService.listActiveProducts();
    const speciesLabel = pet.species === "cat" ? "cat" : "dog";

    return products
      .filter(
        (product) => product.petType === pet.species || product.petType === "both"
      )
      .map((product) => ({
        ...product,
        reason:
          "Recommended for " +
          pet.name +
          "'s " +
          speciesLabel +
          " interaction needs."
      }));
  }

  private createPetRecord(
    petNo: string,
    dto: CreateCloudPetDto
  ): CloudPetRecord {
    const avatarUrl =
      dto.species === "cat"
        ? "/brand/naigai-niangao/naigai-standard.png"
        : "/brand/naigai-niangao/niangao-standard.png";
    const speciesLabel = dto.species === "cat" ? "cat" : "dog";

    return {
      petNo,
      ownerName: dto.ownerName,
      ownerPhone: dto.ownerPhone,
      name: dto.name,
      species: dto.species,
      personality: dto.personality,
      avatarUrl,
      bio:
        dto.name +
        " is " +
        dto.ownerName +
        "'s custom cloud " +
        speciesLabel +
        ", with a personality of " +
        dto.personality +
        ".",
      homepageTheme: "sunny",
      homepageHeadline: dto.name + "'s cloud-pet homepage",
      homepageOwnerStory: "A dedicated space for daily growth, memories, and shop recommendations.",
      homepageShowGrowthArchive: true,
      homepageShowMallRecommendations: true,
      mood: 72,
      energy: 68,
      intimacy: 15,
      timeline: [
        {
          type: "adoption",
          title: dto.name + " arrived at the cloud-pet home",
          body: "The first day is for learning the home's rhythm, scent, light, and the owner's voice.",
          createdAt: new Date()
        }
      ]
    };
  }

  private toProfile(
    pet: CloudPetRecord,
    completions: GrowthTaskCompletionRecord[] = []
  ): CloudPetProfile {
    return {
      petNo: pet.petNo,
      ownerName: pet.ownerName,
      ownerPhone: pet.ownerPhone,
      name: pet.name,
      species: pet.species,
      personality: pet.personality,
      avatarUrl: pet.avatarUrl,
      bio: pet.bio,
      stats: {
        mood: pet.mood,
        energy: pet.energy,
        intimacy: pet.intimacy
      },
      growth: this.buildGrowthProfile(pet, completions),
      homepage: this.buildHomepageProfile(pet),
      timeline: pet.timeline.map((event) => ({
        type: event.type,
        title: event.title,
        body: event.body,
        createdAt:
          event.createdAt instanceof Date
            ? event.createdAt.toISOString()
            : event.createdAt
      }))
    };
  }

  private buildHomepageProfile(pet: CloudPetRecord): CloudPetHomepageProfile {
    return {
      theme: this.getHomepageTheme(pet.homepageTheme),
      headline: pet.homepageHeadline || pet.name + "'s cloud-pet homepage",
      ownerStory:
        pet.homepageOwnerStory ||
        "A dedicated space for daily growth, memories, and shop recommendations.",
      showGrowthArchive: pet.homepageShowGrowthArchive ?? true,
      showMallRecommendations: pet.homepageShowMallRecommendations ?? true
    };
  }

  private applyHomepageSettings(
    pet: CloudPetRecord,
    dto: UpdateCloudPetHomepageDto
  ): CloudPetRecord {
    return {
      ...pet,
      homepageTheme: dto.theme ?? pet.homepageTheme,
      homepageHeadline: dto.headline ?? pet.homepageHeadline,
      homepageOwnerStory: dto.ownerStory ?? pet.homepageOwnerStory,
      homepageShowGrowthArchive:
        dto.showGrowthArchive ?? pet.homepageShowGrowthArchive,
      homepageShowMallRecommendations:
        dto.showMallRecommendations ?? pet.homepageShowMallRecommendations
    };
  }

  private toHomepageUpdateData(dto: UpdateCloudPetHomepageDto) {
    const data: {
      homepageTheme?: CloudPetHomepageTheme;
      homepageHeadline?: string;
      homepageOwnerStory?: string;
      homepageShowGrowthArchive?: boolean;
      homepageShowMallRecommendations?: boolean;
    } = {};

    if (dto.theme !== undefined) {
      data.homepageTheme = dto.theme;
    }

    if (dto.headline !== undefined) {
      data.homepageHeadline = dto.headline;
    }

    if (dto.ownerStory !== undefined) {
      data.homepageOwnerStory = dto.ownerStory;
    }

    if (dto.showGrowthArchive !== undefined) {
      data.homepageShowGrowthArchive = dto.showGrowthArchive;
    }

    if (dto.showMallRecommendations !== undefined) {
      data.homepageShowMallRecommendations = dto.showMallRecommendations;
    }

    return data;
  }

  private getHomepageTheme(theme?: string): CloudPetHomepageTheme {
    if (theme === "forest" || theme === "midnight") {
      return theme;
    }

    return "sunny";
  }

  private buildArchiveFilters(events: CloudPetProfile["timeline"]) {
    const counts = events.reduce(
      (result, event) => ({
        ...result,
        [event.type]: (result[event.type] ?? 0) + 1
      }),
      {} as Record<string, number>
    );
    const labels: Record<string, string> = {
      adoption: "Adoption",
      growth_task: "Growth tasks",
      daily_diary: "Daily diary"
    };

    return [
      { key: "all", label: "All", count: events.length },
      ...Object.entries(counts).map(([key, count]) => ({
        key,
        label: labels[key] ?? key,
        count
      }))
    ];
  }

  private async countHomepageVisits(petNo: string) {
    if (!this.isDatabaseConfigured()) {
      return this.countMemoryHomepageVisits(petNo);
    }

    return this.prisma.virtualPetHomepageVisit.count({
      where: { petNo }
    });
  }

  private countMemoryHomepageVisits(petNo: string) {
    return Array.from(this.homepageVisits.values()).filter(
      (visit) => visit.petNo === petNo
    ).length;
  }

  private async buildCommerceReward(pet: CloudPetProfile) {
    const products = await this.productsService.listActiveProducts();
    const recommendedProduct = products.find(
      (product) => product.petType === pet.species || product.petType === "both"
    );
    const isUnlocked = pet.growth.todayCompletedTaskCount > 0;

    if (!isUnlocked) {
      return {
        status: "locked" as const,
        title: "Complete today's care task",
        description:
          "Finish a cloud-pet growth task to unlock the homepage shop reward.",
        ctaHref: "/member",
        ctaLabel: "Go complete task",
        recommendedProductSlug: recommendedProduct?.slug,
        recommendedProductTitle: recommendedProduct?.title
      };
    }

    return {
      status: "unlocked" as const,
      title: "Today's cloud-pet shop reward",
      description:
        "Daily care is complete. Use WELCOME20 on the pet mall recommendation.",
      couponCode: "WELCOME20",
      discountCents: 2000,
      ctaHref: "/shop",
      ctaLabel: "Use reward in shop",
      recommendedProductSlug: recommendedProduct?.slug,
      recommendedProductTitle: recommendedProduct?.title
    };
  }

  private buildGrowthTaskNextActions(
    petNo: string,
    task: GrowthTask
  ): CloudPetNextAction[] {
    return [
      {
        key: "open-homepage",
        title: "Review the dedicated pet homepage",
        description: "Today's " + task.title + " is now part of the growth archive.",
        href: "/cloud-pets/" + petNo,
        ctaLabel: "Open homepage"
      },
      {
        key: "share-community",
        title: "Share today's care moment",
        description:
          "Turn the completed task into a community post for social retention.",
        href: "/cloud-pets#community",
        ctaLabel: "Post update"
      },
      {
        key: "shop-reward",
        title: "Use the mall reward",
        description: "Daily care unlocked the pet-aware shop recommendation path.",
        href: "/shop",
        ctaLabel: "Visit shop"
      },
      {
        key: "continue-care",
        title: "Plan tomorrow's care streak",
        description: "Come back tomorrow to keep the growth calendar active.",
        href: "/member",
        ctaLabel: "View member center"
      }
    ];
  }

  private buildGrowthProfile(
    pet: CloudPetRecord,
    completions: GrowthTaskCompletionRecord[]
  ): CloudPetGrowthProfile {
    const taskPoints = completions.reduce((total, completion) => {
      const task = growthTasks.find((item) => item.key === completion.taskKey);
      return total + (task?.points ?? 0);
    }, 0);
    const experiencePoints = pet.intimacy + taskPoints;
    const level = this.getGrowthLevel(experiencePoints);
    const currentLevelExperience = this.getLevelThreshold(level);
    const nextLevelExperience = this.getLevelThreshold(level + 1);
    const progressRange = Math.max(nextLevelExperience - currentLevelExperience, 1);
    const todayCompletedTaskCount = completions.filter(
      (completion) => completion.completedDate === this.getTaskDate()
    ).length;
    const careScore = Math.min(
      100,
      Math.round((pet.mood + pet.energy + pet.intimacy) / 3) +
        todayCompletedTaskCount * 12
    );

    return {
      level,
      levelLabel: "Lv." + level + " companion",
      experiencePoints,
      nextLevelExperience,
      progressPercent: Math.min(
        100,
        Math.max(
          0,
          Math.round(
            ((experiencePoints - currentLevelExperience) / progressRange) * 100
          )
        )
      ),
      careState: this.getCareState(todayCompletedTaskCount, careScore),
      careScore,
      todayCompletedTaskCount
    };
  }

  private getGrowthLevel(experiencePoints: number) {
    if (experiencePoints >= 160) {
      return 4;
    }

    if (experiencePoints >= 90) {
      return 3;
    }

    if (experiencePoints >= 40) {
      return 2;
    }

    return 1;
  }

  private getLevelThreshold(level: number) {
    const thresholds: Record<number, number> = {
      1: 0,
      2: 40,
      3: 90,
      4: 160,
      5: 260
    };

    return thresholds[level] ?? 260;
  }

  private getCareState(
    todayCompletedTaskCount: number,
    careScore: number
  ): CloudPetCareState {
    if (todayCompletedTaskCount > 0 && careScore >= 70) {
      return "thriving";
    }

    if (careScore >= 60) {
      return "steady";
    }

    return "needs_care";
  }

  private getMemoryTaskCompletionsForPet(petNo: string) {
    return Array.from(this.taskCompletions.values()).filter(
      (completion) => completion.petNo === petNo
    );
  }

  private toCompletionRecords(
    completions: Array<{
      petNo: string;
      taskKey: string;
      completedDate: string;
      createdAt: Date;
    }>
  ): GrowthTaskCompletionRecord[] {
    return completions.map((completion) => ({
      petNo: completion.petNo,
      taskKey: completion.taskKey,
      completedDate: completion.completedDate,
      createdAt: completion.createdAt.toISOString()
    }));
  }

  private async applyTaskRewards(pet: CloudPetRecord, task: GrowthTask) {
    pet.mood += task.rewards.mood;
    pet.energy += task.rewards.energy;
    pet.intimacy += task.rewards.intimacy;
    pet.timeline.unshift(this.buildGrowthTaskEvent(task));

    if (!this.hasMemoryDailyDiaryForToday(pet)) {
      pet.timeline.unshift(await this.buildDailyDiaryEvent(pet, task));
    }
  }

  private buildGrowthTaskEvent(task: GrowthTask): CloudPetTimelineEventInput {
    return {
      type: "growth_task",
      title: "Completed " + task.title,
      body: task.description + " Reward: " + task.points + " growth points.",
      createdAt: new Date()
    };
  }

  private async buildDailyDiaryEvent(
    pet: {
      petNo: string;
      name: string;
      species: "cat" | "dog";
    },
    task: GrowthTask,
    createdAt = new Date()
  ): Promise<CloudPetTimelineEventInput> {
    const recommendedProduct = (await this.productsService.listActiveProducts()).find(
      (product) => product.petType === pet.species || product.petType === "both"
    );
    const productSentence = recommendedProduct
      ? " Recommended mall item: " + recommendedProduct.title + "."
      : " Recommended mall item will refresh when the catalog is ready.";

    return {
      type: "daily_diary",
      title: "Daily diary for " + pet.name,
      body:
        pet.name +
        " completed " +
        task.title +
        " today and earned " +
        task.points +
        " growth points. WELCOME20 is ready for today's pet-aware shop reward." +
        productSentence,
      createdAt
    };
  }

  private async buildPresenceDailyDiaryEvent(
    pet: {
      petNo: string;
      name: string;
      species: "cat" | "dog";
    },
    date: string
  ): Promise<CloudPetTimelineEventInput> {
    const recommendedProduct = (await this.productsService.listActiveProducts()).find(
      (product) => product.petType === pet.species || product.petType === "both"
    );
    const productSentence = recommendedProduct
      ? " Recommended mall item: " + recommendedProduct.title + "."
      : " Recommended mall item will refresh when the catalog is ready.";

    return {
      type: "daily_diary",
      title: "Daily diary for " + pet.name,
      body:
        pet.name +
        " spent a calm day in the cloud-pet home on " +
        date +
        ". No new growth task was completed, but the daily presence record is now restored." +
        productSentence,
      createdAt: this.createDiaryCreatedAt(date)
    };
  }

  private toTimelineEventResponse(
    event: CloudPetTimelineEventInput
  ): CloudPetProfile["timeline"][number] {
    return {
      type: event.type,
      title: event.title,
      body: event.body,
      createdAt: event.createdAt.toISOString()
    };
  }

  private toDailyDiaryGenerationResult(
    items: CloudPetDailyDiaryGenerationItem[]
  ): CloudPetDailyDiaryGenerationResult {
    return {
      date: this.getTaskDate(),
      generatedCount: items.filter((item) => item.status === "generated").length,
      skippedCount: items.filter((item) => item.status === "skipped").length,
      items
    };
  }

  private toDailyDiaryStatus(
    items: CloudPetDailyDiaryStatusItem[]
  ): CloudPetDailyDiaryStatus {
    const generatedTodayCount = items.filter(
      (item) => item.status === "covered"
    ).length;
    const totalPetCount = items.length;

    return {
      date: this.getTaskDate(),
      totalPetCount,
      generatedTodayCount,
      missingTodayCount: totalPetCount - generatedTodayCount,
      coverageRate: totalPetCount === 0 ? 1 : generatedTodayCount / totalPetCount,
      items
    };
  }

  private hasTimelineDailyDiaryOnDate(
    timeline: CloudPetProfile["timeline"],
    date: string
  ) {
    return timeline.some(
      (event) => event.type === "daily_diary" && this.toIsoDate(event.createdAt) === date
    );
  }

  private getLatestTimelineDailyDiaryDate(timeline: CloudPetProfile["timeline"]) {
    const latestDiary = timeline.find((event) => event.type === "daily_diary");

    return latestDiary ? this.toIsoDate(latestDiary.createdAt) : undefined;
  }

  private async createBackfillDiaryEvent(
    pet: CloudPetProfile,
    reason: CloudPetDailyDiaryCoverageMissingPet["reason"],
    date: string
  ) {
    const event =
      reason === "NO_DIARY_GENERATED"
        ? await this.buildDailyDiaryEvent(
            {
              petNo: pet.petNo,
              name: pet.name,
              species: pet.species
            },
            growthTasks[0],
            this.createDiaryCreatedAt(date)
          )
        : await this.buildPresenceDailyDiaryEvent(
            {
              petNo: pet.petNo,
              name: pet.name,
              species: pet.species
            },
            date
          );

    if (!this.isDatabaseConfigured()) {
      const petRecord = this.pets.get(pet.petNo);

      if (!petRecord) {
        throw new NotFoundException("Cloud pet not found");
      }

      petRecord.timeline.unshift(event);
      this.pets.set(pet.petNo, petRecord);
      return undefined;
    }

    const petRecord = await this.prisma.virtualPet.findUnique({
      where: { petNo: pet.petNo },
      select: { id: true }
    });

    if (!petRecord) {
      throw new NotFoundException("Cloud pet not found");
    }

    const savedEvent = await this.prisma.virtualPetEvent.create({
      data: {
        petId: petRecord.id,
        type: event.type,
        title: event.title,
        body: event.body,
        createdAt: event.createdAt
      }
    });

    return savedEvent.id;
  }

  private createDiaryCreatedAt(date: string) {
    return new Date(date + "T12:00:00.000Z");
  }

  private assertBackfillInput(input: CloudPetDailyDiaryBackfillInput) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
      throw new BadRequestException("Backfill date must use YYYY-MM-DD");
    }

    if (input.mode === "selected" && (!input.petIds || input.petIds.length === 0)) {
      throw new BadRequestException("Selected backfill requires petIds");
    }
  }

  private hasMemoryDailyDiaryForToday(pet: CloudPetRecord) {
    return Boolean(this.findMemoryDailyDiaryForToday(pet));
  }

  private findMemoryDailyDiaryForToday(pet: CloudPetRecord) {
    const event = pet.timeline.find(
      (event) =>
        event.type === "daily_diary" &&
        this.toIsoDate(event.createdAt) === this.getTaskDate()
    );

    return event
      ? {
          ...event,
          createdAt:
            event.createdAt instanceof Date ? event.createdAt : new Date(event.createdAt)
        }
      : undefined;
  }

  private async hasDailyDiaryForToday(petId: string) {
    return Boolean(await this.findDailyDiaryForToday(petId));
  }

  private async findDailyDiaryForToday(petId: string) {
    const start = new Date(this.getTaskDate() + "T00:00:00.000Z");
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);

    return this.prisma.virtualPetEvent.findFirst({
      where: {
        petId,
        type: "daily_diary",
        createdAt: {
          gte: start,
          lt: end
        }
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, createdAt: true }
    });
  }

  private toIsoDate(value: Date | string) {
    return value instanceof Date ? value.toISOString().slice(0, 10) : value.slice(0, 10);
  }

  private reserveTaskCompletion(completionKey: string) {
    if (this.completedTaskDates.has(completionKey)) {
      throw new ConflictException("Growth task already completed today");
    }

    this.completedTaskDates.add(completionKey);
  }

  private createTaskCompletionKey(petNo: string, taskKey: string) {
    return petNo + ":" + taskKey + ":" + this.getTaskDate();
  }

  private getTaskDate() {
    return new Date().toISOString().slice(0, 10);
  }

  private isUniqueConstraintError(error: unknown) {
    return (
      error !== null &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2002"
    );
  }

  private createPetNo() {
    this.sequence += 1;
    const now = new Date();
    const timestamp = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
      String(now.getHours()).padStart(2, "0"),
      String(now.getMinutes()).padStart(2, "0"),
      String(now.getSeconds()).padStart(2, "0")
    ].join("");

    return "VP" + timestamp + String(this.sequence).padStart(4, "0");
  }

  private isDatabaseConfigured() {
    return Boolean(this.configService.get<string>("DATABASE_URL"));
  }
}
