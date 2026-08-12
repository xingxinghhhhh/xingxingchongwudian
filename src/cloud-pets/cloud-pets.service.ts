import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { createHash } from "node:crypto";
import { ConfigService } from "@nestjs/config";
import { BadRequestException, OnModuleInit } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import { ProductsService } from "../products/products.service";
import { ProductListItem } from "../products/product.types";
import { CreateCloudPetDto } from "./dto/create-cloud-pet.dto";
import { CreateCloudPetDiaryNoteDto } from "./dto/create-cloud-pet-diary-note.dto";
import { UpdateCloudPetHomepageDto } from "./dto/update-cloud-pet-homepage.dto";
import {
  DAILY_DIARY_EVENT_TYPES,
  isCloudPetDiaryEventType
} from "./cloud-pet-event-types";
import {
  addCloudPetBusinessDays,
  getCloudPetBusinessDateKey,
  getCloudPetBusinessDayRange
} from "./cloud-pet-business-day";

export interface CloudPetProfile {
  petNo: string;
  ownerName: string;
  ownerPhone: string;
  homepageVisitCount?: number;
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
    id?: string;
    type: string;
    title: string;
    body: string;
    createdAt: string;
  }>;
}

export type CloudPetPublicProfile = Omit<
  CloudPetProfile,
  "ownerName" | "ownerPhone" | "homepageVisitCount"
>;

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
  todayCompletedTaskKeys: string[];
  isCareCompleteToday: boolean;
  careStreakDays: number;
  lastCareDate?: string;
  nextCarePrompt: string;
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

export interface CloudPetCareScoreRules {
  dailyTaskBonus: number;
  steadyMinScore: number;
  thrivingMinScore: number;
  thrivingRequiresCareToday: boolean;
  updatedAt?: string;
}

export interface UpdateCloudPetCareScoreRulesInput {
  dailyTaskBonus?: number;
  steadyMinScore?: number;
  thrivingMinScore?: number;
  thrivingRequiresCareToday?: boolean;
}

export interface UpdateGrowthTaskTemplateInput {
  title?: string;
  description?: string;
  points?: number;
  rewards?: Partial<GrowthTask["rewards"]>;
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
    id?: string;
    type: string;
    title: string;
    body: string;
    createdAt: Date | string;
  }>;
}

type CloudPetTimelineEventInput = {
  id?: string;
  type: string;
  title: string;
  body: string;
  createdAt: Date;
};

export const growthTasks: GrowthTask[] = [
  {
    key: "daily-care",
    title: "日常照护",
    description: "完成喂食、梳理或轻互动，为宠物留下每日照护记录。",
    points: 20,
    rewards: {
      mood: 8,
      energy: 4,
      intimacy: 10
    }
  },
  {
    key: "feed-care",
    title: "喂食记录",
    description: "记录今天的餐食与食欲，让宠物的日常节奏更鲜活。",
    points: 12,
    rewards: {
      mood: 5,
      energy: 6,
      intimacy: 4
    }
  },
  {
    key: "play-care",
    title: "一起玩耍",
    description: "安排一段简短互动，提升心情并维持亲密关系。",
    points: 12,
    rewards: {
      mood: 8,
      energy: 3,
      intimacy: 5
    }
  },
  {
    key: "clean-care",
    title: "清理空间",
    description: "整理宠物的小空间，补全今天的照护记录。",
    points: 10,
    rewards: {
      mood: 4,
      energy: 4,
      intimacy: 4
    }
  },
  {
    key: "accompany-care",
    title: "安静陪伴",
    description: "安静陪宠物待一会儿，记录今天的陪伴时刻。",
    points: 14,
    rewards: {
      mood: 5,
      energy: 2,
      intimacy: 8
    }
  },
  {
    key: "community-share",
    title: "社区分享",
    description: "发布一条宠物动态，让成长记录进入互动社区。",
    points: 30,
    rewards: {
      mood: 6,
      energy: 2,
      intimacy: 8
    }
  },
  {
    key: "shop-gift",
    title: "商城礼物",
    description: "从宠物主页选择推荐商品，连接内容与商城体验。",
    points: 40,
    rewards: {
      mood: 10,
      energy: 6,
      intimacy: 12
    }
  }
];

const defaultCareScoreRules: CloudPetCareScoreRules = {
  dailyTaskBonus: 12,
  steadyMinScore: 60,
  thrivingMinScore: 70,
  thrivingRequiresCareToday: true
};

const MAX_OWNER_DIARY_NOTES_PER_DAY = 5;

@Injectable()
export class CloudPetsService implements OnModuleInit {
  private readonly pets = new Map<string, CloudPetRecord>();
  private readonly completedTaskDates = new Set<string>();
  private readonly taskCompletions = new Map<string, GrowthTaskCompletionRecord>();
  private readonly homepageVisits = new Map<string, CloudPetHomepageVisitRecord>();
  private growthTaskTemplates: GrowthTask[] = growthTasks.map((task) => ({
    ...task,
    rewards: { ...task.rewards }
  }));
  private careScoreRules: CloudPetCareScoreRules = { ...defaultCareScoreRules };
  private sequence = 0;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly productsService: ProductsService
  ) {}

  async onModuleInit() {
    if (!this.isDatabaseConfigured()) {
      return;
    }

    const [savedTemplates, savedRules] = await Promise.all([
      this.prisma.cloudPetGrowthTaskTemplate.findMany(),
      this.prisma.cloudPetCareScoreConfig.findUnique({
        where: { id: "active" }
      })
    ]);
    const savedTemplateByKey = new Map(
      savedTemplates.map((template) => [template.key, template])
    );

    this.growthTaskTemplates = growthTasks.map((task) => {
      const saved = savedTemplateByKey.get(task.key);

      return saved
        ? {
            key: task.key,
            title: saved.title,
            description: saved.description,
            points: saved.points,
            rewards: {
              mood: saved.rewardMood,
              energy: saved.rewardEnergy,
              intimacy: saved.rewardIntimacy
            }
          }
        : this.cloneGrowthTask(task);
    });

    if (savedRules) {
      this.careScoreRules = {
        dailyTaskBonus: savedRules.dailyTaskBonus,
        steadyMinScore: savedRules.steadyMinScore,
        thrivingMinScore: savedRules.thrivingMinScore,
        thrivingRequiresCareToday: savedRules.thrivingRequiresCareToday,
        updatedAt: savedRules.updatedAt.toISOString()
      };
    }
  }

  async createPet(dto: CreateCloudPetDto): Promise<CloudPetProfile> {
    const petInput = this.normalizeCreatePetInput(dto);
    const petNo = this.createPetNo();
    const pet = this.createPetRecord(petNo, petInput);

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

  async getPublicPet(petNo: string): Promise<CloudPetPublicProfile> {
    const pet = await this.getPet(petNo);
    const {
      ownerName: _ownerName,
      ownerPhone: _ownerPhone,
      homepageVisitCount: _homepageVisitCount,
      ...publicPet
    } = pet;
    const speciesLabel = pet.species === "cat" ? "猫咪" : "狗狗";

    return {
      ...publicPet,
      timeline: this.toPublicTimelineEvents(publicPet.timeline),
      bio: `${pet.name}是一只性格${pet.personality}的云养${speciesLabel}。`
    };
  }

  async getPetRecord(petNo: string): Promise<CloudPetProfile> {
    return this.getPet(petNo);
  }

  async listPetsByOwnerPhone(ownerPhone: string): Promise<CloudPetProfile[]> {
    if (!this.isDatabaseConfigured()) {
      return Array.from(this.pets.values())
        .filter((pet) => pet.ownerPhone === ownerPhone)
        .map((pet) =>
          ({
            ...this.toProfile(pet, this.getMemoryTaskCompletionsForPet(pet.petNo)),
            homepageVisitCount: this.countMemoryHomepageVisits(pet.petNo)
          })
        );
    }

    const pets = await this.prisma.virtualPet.findMany({
      where: { ownerPhone },
      include: {
        taskCompletions: { orderBy: [{ completedDate: "desc" }, { createdAt: "desc" }] },
        timeline: { orderBy: { createdAt: "desc" } },
        _count: { select: { homepageVisits: true } }
      },
      orderBy: { createdAt: "desc" }
    });

    return pets.map((pet) => ({
      ...this.toProfile(pet, this.toCompletionRecords(pet.taskCompletions)),
      homepageVisitCount: pet._count.homepageVisits
    }));
  }

  listGrowthTasks() {
    return this.growthTaskTemplates.map((task) => this.cloneGrowthTask(task));
  }

  async updateGrowthTaskTemplate(
    taskKey: string,
    input: UpdateGrowthTaskTemplateInput
  ): Promise<GrowthTask> {
    const index = this.growthTaskTemplates.findIndex((task) => task.key === taskKey);

    if (index === -1) {
      throw new NotFoundException("Growth task not found");
    }

    const current = this.growthTaskTemplates[index];
    const next: GrowthTask = {
      ...current,
      ...this.normalizeGrowthTaskTemplate(input),
      rewards: {
        ...current.rewards,
        ...this.normalizeGrowthTaskRewards(input.rewards ?? {})
      }
    };

    if (this.isDatabaseConfigured()) {
      await this.prisma.cloudPetGrowthTaskTemplate.upsert({
        where: { key: taskKey },
        create: {
          key: taskKey,
          title: next.title,
          description: next.description,
          points: next.points,
          rewardMood: next.rewards.mood,
          rewardEnergy: next.rewards.energy,
          rewardIntimacy: next.rewards.intimacy
        },
        update: {
          title: next.title,
          description: next.description,
          points: next.points,
          rewardMood: next.rewards.mood,
          rewardEnergy: next.rewards.energy,
          rewardIntimacy: next.rewards.intimacy
        }
      });
    }

    this.growthTaskTemplates[index] = next;
    return this.cloneGrowthTask(next);
  }

  getCareScoreRules(): CloudPetCareScoreRules {
    return { ...this.careScoreRules };
  }

  async updateCareScoreRules(
    input: UpdateCloudPetCareScoreRulesInput
  ): Promise<CloudPetCareScoreRules> {
    const nextRules = {
      ...this.careScoreRules,
      ...this.normalizeCareScoreRules(input),
      updatedAt: new Date().toISOString()
    };

    if (nextRules.steadyMinScore > nextRules.thrivingMinScore) {
      throw new BadRequestException(
        "steadyMinScore cannot be greater than thrivingMinScore"
      );
    }

    if (this.isDatabaseConfigured()) {
      const saved = await this.prisma.cloudPetCareScoreConfig.upsert({
        where: { id: "active" },
        create: {
          id: "active",
          dailyTaskBonus: nextRules.dailyTaskBonus,
          steadyMinScore: nextRules.steadyMinScore,
          thrivingMinScore: nextRules.thrivingMinScore,
          thrivingRequiresCareToday: nextRules.thrivingRequiresCareToday
        },
        update: {
          dailyTaskBonus: nextRules.dailyTaskBonus,
          steadyMinScore: nextRules.steadyMinScore,
          thrivingMinScore: nextRules.thrivingMinScore,
          thrivingRequiresCareToday: nextRules.thrivingRequiresCareToday
        }
      });
      nextRules.updatedAt = saved.updatedAt.toISOString();
    }

    this.careScoreRules = nextRules;
    return this.getCareScoreRules();
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
    const task = this.findGrowthTask(taskKey);

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
    const homepageSettings = this.normalizeHomepageSettings(dto);

    if (!this.isDatabaseConfigured()) {
      const pet = this.pets.get(petNo);

      if (!pet) {
        throw new NotFoundException("Cloud pet not found");
      }

      const updatedPet = this.applyHomepageSettings(pet, homepageSettings);
      this.pets.set(petNo, updatedPet);

      return this.toProfile(
        updatedPet,
        this.getMemoryTaskCompletionsForPet(petNo)
      );
    }

    const pet = await this.prisma.virtualPet.update({
      where: { petNo },
      data: this.toHomepageUpdateData(homepageSettings),
      include: {
        taskCompletions: { orderBy: [{ completedDate: "desc" }, { createdAt: "desc" }] },
        timeline: { orderBy: { createdAt: "desc" } }
      }
    });

    return this.toProfile(pet, this.toCompletionRecords(pet.taskCompletions));
  }

  async createDiaryNote(
    petNo: string,
    dto: CreateCloudPetDiaryNoteDto
  ): Promise<CloudPetProfile> {
    const body = dto.body.trim();

    if (!body) {
      throw new BadRequestException("Diary note body is required");
    }

    if (!this.isDatabaseConfigured()) {
      const pet = this.pets.get(petNo);

      if (!pet) {
        throw new NotFoundException("Cloud pet not found");
      }

      this.assertOwnerDiaryNoteQuota(pet);
      pet.timeline.unshift(this.buildOwnerDiaryNoteEvent(pet.name, dto));
      this.pets.set(petNo, pet);

      return this.toProfile(pet, this.getMemoryTaskCompletionsForPet(petNo));
    }

    const petRecord = await this.prisma.virtualPet.findUnique({
      where: { petNo },
      select: { id: true, name: true }
    });

    if (!petRecord) {
      throw new NotFoundException("Cloud pet not found");
    }

    await this.assertOwnerDiaryNoteQuotaForDatabase(petRecord.id);

    const pet = await this.prisma.virtualPet.update({
      where: { petNo },
      data: {
        timeline: {
          create: this.buildOwnerDiaryNoteEvent(petRecord.name, dto)
        }
      },
      include: {
        taskCompletions: { orderBy: [{ completedDate: "desc" }, { createdAt: "desc" }] },
        timeline: { orderBy: { createdAt: "desc" } }
      }
    });

    return this.toProfile(pet, this.toCompletionRecords(pet.taskCompletions));
  }

  async updateDiaryNote(
    petNo: string,
    noteId: string,
    dto: CreateCloudPetDiaryNoteDto
  ): Promise<CloudPetProfile> {
    const body = dto.body.trim();

    if (!body) {
      throw new BadRequestException("Diary note body is required");
    }

    if (!this.isDatabaseConfigured()) {
      const pet = this.pets.get(petNo);

      if (!pet) {
        throw new NotFoundException("Cloud pet not found");
      }

      const note = pet.timeline.find(
        (event) => event.type === "owner_note" && this.getTimelineEventId(event) === noteId
      );

      if (!note) {
        throw new NotFoundException("Diary note not found");
      }

      note.title = dto.title?.trim() || note.title;
      note.body = body;
      this.pets.set(petNo, pet);

      return this.toProfile(pet, this.getMemoryTaskCompletionsForPet(petNo));
    }

    const result = await this.prisma.virtualPetEvent.updateMany({
      where: { id: noteId, pet: { petNo }, type: "owner_note" },
      data: {
        ...(dto.title?.trim() ? { title: dto.title.trim() } : {}),
        body
      }
    });

    if (result.count === 0) {
      throw new NotFoundException("Diary note not found");
    }

    return this.getPet(petNo);
  }

  async deleteDiaryNote(petNo: string, noteId: string): Promise<CloudPetProfile> {
    if (!this.isDatabaseConfigured()) {
      const pet = this.pets.get(petNo);

      if (!pet) {
        throw new NotFoundException("Cloud pet not found");
      }

      const originalLength = pet.timeline.length;
      pet.timeline = pet.timeline.filter(
        (event) => !(event.type === "owner_note" && this.getTimelineEventId(event) === noteId)
      );

      if (pet.timeline.length === originalLength) {
        throw new NotFoundException("Diary note not found");
      }

      this.pets.set(petNo, pet);

      return this.toProfile(pet, this.getMemoryTaskCompletionsForPet(petNo));
    }

    const result = await this.prisma.virtualPetEvent.deleteMany({
      where: { id: noteId, pet: { petNo }, type: "owner_note" }
    });

    if (result.count === 0) {
      throw new NotFoundException("Diary note not found");
    }

    return this.getPet(petNo);
  }
  async getHomepageArchive(
    petNo: string,
    eventType?: string
  ): Promise<CloudPetHomepageArchive> {
    const pet = await this.getPet(petNo);
    const selectedType = eventType && eventType !== "all" ? eventType : null;
    const filteredItems = selectedType
      ? pet.timeline.filter((event) =>
          selectedType === "daily_diary"
            ? isCloudPetDiaryEventType(event.type)
            : event.type === selectedType
        )
      : pet.timeline;
    const items = this.toPublicTimelineEvents(filteredItems);
    const publicTimeline = this.toPublicTimelineEvents(pet.timeline);

    return {
      petNo: pet.petNo,
      share: {
        title: pet.homepage.headline,
        description: pet.homepage.ownerStory,
        url: "/cloud-pets/" + pet.petNo,
        ctaLabel: "打开宠物主页"
      },
      commerceReward: await this.buildCommerceReward(pet),
      engagement: {
        homepageVisitCount: await this.countHomepageVisits(petNo)
      },
      filters: this.buildArchiveFilters(publicTimeline),
      items
    };
  }

  async generateDailyDiariesForToday(): Promise<CloudPetDailyDiaryGenerationResult> {
    const task = this.getPrimaryDailyTask();
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
    visitorId: string,
    source = "direct"
  ): Promise<CloudPetHomepageVisitRecord> {
    const normalizedSource = source.trim() || "direct";
    const normalizedVisitorId = visitorId.trim();

    if (!/^[a-zA-Z0-9_-]{1,40}$/.test(normalizedSource)) {
      throw new BadRequestException("Invalid homepage visit source");
    }
    if (!/^[a-zA-Z0-9_-]{16,64}$/.test(normalizedVisitorId)) {
      throw new BadRequestException("Invalid homepage visitor");
    }

    const visitDate = this.getTaskDate();
    const visitorKey = createHash("sha256")
      .update(normalizedVisitorId)
      .digest("hex")
      .slice(0, 32);

    if (!this.isDatabaseConfigured()) {
      const pet = this.pets.get(petNo);

      if (!pet) {
        throw new NotFoundException("Cloud pet not found");
      }

      const visitKey = [
        petNo,
        normalizedSource,
        visitorKey,
        visitDate
      ].join(":");
      const existingVisit = this.homepageVisits.get(visitKey);

      if (existingVisit) {
        return {
          ...existingVisit,
          visitCount: this.countMemoryHomepageVisits(petNo)
        };
      }

      const record = {
        petNo,
        source: normalizedSource,
        visitCount: 1,
        createdAt: new Date().toISOString()
      };
      this.homepageVisits.set(visitKey, record);

      return {
        ...record,
        visitCount: this.countMemoryHomepageVisits(petNo)
      };
    }

    const pet = await this.prisma.virtualPet.findUnique({
      where: { petNo },
      select: { id: true }
    });

    if (!pet) {
      throw new NotFoundException("Cloud pet not found");
    }

    const visit = await this.prisma.virtualPetHomepageVisit.upsert({
      where: {
        petNo_source_visitorKey_visitDate: {
          petNo,
          source: normalizedSource,
          visitorKey,
          visitDate
        }
      },
      create: {
        petId: pet.id,
        petNo,
        source: normalizedSource,
        visitorKey,
        visitDate
      },
      update: {}
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
    const speciesLabel = pet.species === "cat" ? "猫咪" : "狗狗";

    return products
      .filter(
        (product) => product.petType === pet.species || product.petType === "both"
      )
      .map((product) => ({
        ...product,
        reason: `适合${pet.name}的${speciesLabel}互动需求。`
      }));
  }

  private normalizeCreatePetInput(dto: CreateCloudPetDto): CreateCloudPetDto {
    const ownerName = dto.ownerName.trim();
    const name = dto.name.trim();
    const personality = dto.personality.trim();

    if (!ownerName) {
      throw new BadRequestException("宠物主人姓名不能为空");
    }

    if (!name) {
      throw new BadRequestException("宠物名称不能为空");
    }

    if (!personality) {
      throw new BadRequestException("宠物性格描述不能为空");
    }

    return {
      ...dto,
      name,
      ownerName,
      personality
    };
  }

  private createPetRecord(
    petNo: string,
    dto: CreateCloudPetDto
  ): CloudPetRecord {
    const avatarUrl =
      dto.species === "cat"
        ? "/brand/naigai-niangao/naigai-standard.png"
        : "/brand/naigai-niangao/niangao-standard.png";
    const speciesLabel = dto.species === "cat" ? "猫咪" : "狗狗";

    return {
      petNo,
      ownerName: dto.ownerName,
      ownerPhone: dto.ownerPhone,
      name: dto.name,
      species: dto.species,
      personality: dto.personality,
      avatarUrl,
      bio: `${dto.name}是${dto.ownerName}专属的云养${speciesLabel}，性格是${dto.personality}。`,
      homepageTheme: "sunny",
      homepageHeadline: dto.name + "的云养宠主页",
      homepageOwnerStory: "记录每日成长、珍贵回忆与专属商品推荐。",
      homepageShowGrowthArchive: true,
      homepageShowMallRecommendations: true,
      mood: 72,
      energy: 68,
      intimacy: 15,
      timeline: [
        {
          type: "adoption",
          title: dto.name + "来到云养宠之家",
          body: "第一天，从熟悉这里的节奏、气味、光线和主人的声音开始。",
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
        id: this.getTimelineEventId(event),
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

  private toPublicTimelineEvents(
    timeline: CloudPetProfile["timeline"]
  ): CloudPetProfile["timeline"] {
    return timeline.map((event) => ({
      ...event,
      type: isCloudPetDiaryEventType(event.type) ? "daily_diary" : event.type
    }));
  }

  private buildHomepageProfile(pet: CloudPetRecord): CloudPetHomepageProfile {
    return {
      theme: this.getHomepageTheme(pet.homepageTheme),
      headline: pet.homepageHeadline || pet.name + "的云养宠主页",
      ownerStory:
        pet.homepageOwnerStory ||
        "记录每日成长、珍贵回忆与专属商品推荐。",
      showGrowthArchive: pet.homepageShowGrowthArchive ?? true,
      showMallRecommendations: pet.homepageShowMallRecommendations ?? true
    };
  }

  private normalizeHomepageSettings(dto: UpdateCloudPetHomepageDto): UpdateCloudPetHomepageDto {
    const settings: UpdateCloudPetHomepageDto = { ...dto };

    if (dto.headline !== undefined) {
      const headline = dto.headline.trim();

      if (!headline) {
        throw new BadRequestException("Homepage headline cannot be blank");
      }

      settings.headline = headline;
    }

    if (dto.ownerStory !== undefined) {
      const ownerStory = dto.ownerStory.trim();

      if (!ownerStory) {
        throw new BadRequestException("Homepage owner story cannot be blank");
      }

      settings.ownerStory = ownerStory;
    }

    return settings;
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
      adoption: "初次相遇",
      growth_task: "成长任务",
      daily_diary: "成长日记",
      care_daily_diary: "成长日记",
      presence_daily_diary: "成长日记",
      owner_note: "主人手记"
    };

    return [
      { key: "all", label: "全部", count: events.length },
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
    return Array.from(this.homepageVisits.values())
      .filter((visit) => visit.petNo === petNo)
      .reduce((total, visit) => total + visit.visitCount, 0);
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
        title: "完成今日照护任务",
        description:
          "完成一项云养宠成长任务，即可解锁主页商城奖励。",
        ctaHref: "/member",
        ctaLabel: "去完成任务",
        recommendedProductSlug: recommendedProduct?.slug,
        recommendedProductTitle: recommendedProduct?.title
      };
    }

    return {
      status: "unlocked" as const,
      title: "今日云养宠商城奖励",
      description:
        "今日照护已完成，可在宠物商城推荐中使用 WELCOME20。",
      couponCode: "WELCOME20",
      discountCents: 2000,
      ctaHref: "/shop",
      ctaLabel: "去商城使用奖励",
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
        title: "查看宠物专属主页",
        description: `今天的“${task.title}”已加入成长归档。`,
        href: "/cloud-pets/" + petNo,
        ctaLabel: "打开主页"
      },
      {
        key: "share-community",
        title: "分享今日照护时刻",
        description:
          "把刚完成的任务写成社区动态，留下今天的互动记忆。",
        href: "/cloud-pets#community",
        ctaLabel: "发布动态"
      },
      {
        key: "shop-reward",
        title: "使用商城奖励",
        description: "今日照护已解锁宠物专属商品推荐。",
        href: "/shop",
        ctaLabel: "前往商城"
      },
      {
        key: "continue-care",
        title: "规划明日连续照护",
        description: "明天继续回来照护，让成长日历保持活跃。",
        href: "/member",
        ctaLabel: "查看会员中心"
      }
    ];
  }

  private buildGrowthProfile(
    pet: CloudPetRecord,
    completions: GrowthTaskCompletionRecord[]
  ): CloudPetGrowthProfile {
    const taskPoints = completions.reduce((total, completion) => {
      const task = this.findGrowthTask(completion.taskKey);
      return total + (task?.points ?? 0);
    }, 0);
    const experiencePoints = pet.intimacy + taskPoints;
    const level = this.getGrowthLevel(experiencePoints);
    const currentLevelExperience = this.getLevelThreshold(level);
    const nextLevelExperience = this.getLevelThreshold(level + 1);
    const progressRange = Math.max(nextLevelExperience - currentLevelExperience, 1);
    const todayCompletions = completions.filter(
      (completion) => completion.completedDate === this.getTaskDate()
    );
    const todayCompletedTaskCount = todayCompletions.length;
    const todayCompletedTaskKeys = Array.from(
      new Set(todayCompletions.map((completion) => completion.taskKey))
    );
    const isCareCompleteToday = todayCompletedTaskCount > 0;
    const careStreak = this.buildCareStreak(completions);
    const careScoreRules = this.careScoreRules;
    const careScore = Math.min(
      100,
      Math.round((pet.mood + pet.energy + pet.intimacy) / 3) +
        todayCompletedTaskCount * careScoreRules.dailyTaskBonus
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
      careState: this.getCareState(todayCompletedTaskCount, careScore, careScoreRules),
      careScore,
      todayCompletedTaskCount,
      todayCompletedTaskKeys,
      isCareCompleteToday,
      careStreakDays: careStreak.careStreakDays,
      lastCareDate: careStreak.lastCareDate,
      nextCarePrompt: this.buildNextCarePrompt(isCareCompleteToday, careStreak.careStreakDays)
    };
  }

  private buildCareStreak(completions: GrowthTaskCompletionRecord[]) {
    const completedDates = Array.from(
      new Set(completions.map((completion) => completion.completedDate))
    ).sort((left, right) => right.localeCompare(left));

    if (completedDates.length === 0) {
      return { careStreakDays: 0, lastCareDate: undefined };
    }

    const completedDateSet = new Set(completedDates);
    const today = this.getTaskDate();
    let cursor = completedDateSet.has(today) ? today : this.addDays(today, -1);
    let careStreakDays = 0;

    while (completedDateSet.has(cursor)) {
      careStreakDays += 1;
      cursor = this.addDays(cursor, -1);
    }

    return {
      careStreakDays,
      lastCareDate: completedDates[0]
    };
  }

  private buildNextCarePrompt(isCareCompleteToday: boolean, careStreakDays: number) {
    if (!isCareCompleteToday) {
      return "完成一个照顾任务，保住今天的成长记录";
    }

    if (careStreakDays >= 3) {
      return "已形成连续照顾节奏，明天继续累积";
    }

    return "今天已照顾，明天回来继续累积连续天数";
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
    careScore: number,
    rules: CloudPetCareScoreRules
  ): CloudPetCareState {
    const canThrive = rules.thrivingRequiresCareToday
      ? todayCompletedTaskCount > 0
      : true;

    if (canThrive && careScore >= rules.thrivingMinScore) {
      return "thriving";
    }

    if (careScore >= rules.steadyMinScore) {
      return "steady";
    }

    return "needs_care";
  }

  private findGrowthTask(taskKey: string) {
    return this.growthTaskTemplates.find((task) => task.key === taskKey);
  }

  private getPrimaryDailyTask() {
    return this.growthTaskTemplates[0];
  }

  private cloneGrowthTask(task: GrowthTask): GrowthTask {
    return {
      ...task,
      rewards: { ...task.rewards }
    };
  }

  private normalizeGrowthTaskTemplate(
    input: UpdateGrowthTaskTemplateInput
  ): Partial<Omit<GrowthTask, "key" | "rewards">> {
    const normalized: Partial<Omit<GrowthTask, "key" | "rewards">> = {};

    if (input.title !== undefined) {
      const title = input.title.trim();
      if (title.length < 2 || title.length > 80) {
        throw new BadRequestException("title must be 2 to 80 characters");
      }
      normalized.title = title;
    }

    if (input.description !== undefined) {
      const description = input.description.trim();
      if (description.length < 10 || description.length > 240) {
        throw new BadRequestException("description must be 10 to 240 characters");
      }
      normalized.description = description;
    }

    if (input.points !== undefined) {
      normalized.points = this.normalizeCareScoreNumber(input.points, "points", 0, 100);
    }

    return normalized;
  }

  private normalizeGrowthTaskRewards(
    rewards: Partial<GrowthTask["rewards"]>
  ): Partial<GrowthTask["rewards"]> {
    const normalized: Partial<GrowthTask["rewards"]> = {};

    if (rewards.mood !== undefined) {
      normalized.mood = this.normalizeCareScoreNumber(rewards.mood, "rewards.mood", 0, 50);
    }

    if (rewards.energy !== undefined) {
      normalized.energy = this.normalizeCareScoreNumber(rewards.energy, "rewards.energy", 0, 50);
    }

    if (rewards.intimacy !== undefined) {
      normalized.intimacy = this.normalizeCareScoreNumber(rewards.intimacy, "rewards.intimacy", 0, 50);
    }

    return normalized;
  }

  private normalizeCareScoreRules(
    input: UpdateCloudPetCareScoreRulesInput
  ): Partial<CloudPetCareScoreRules> {
    const normalized: Partial<CloudPetCareScoreRules> = {};

    if (input.dailyTaskBonus !== undefined) {
      normalized.dailyTaskBonus = this.normalizeCareScoreNumber(
        input.dailyTaskBonus,
        "dailyTaskBonus",
        0,
        50
      );
    }

    if (input.steadyMinScore !== undefined) {
      normalized.steadyMinScore = this.normalizeCareScoreNumber(
        input.steadyMinScore,
        "steadyMinScore",
        0,
        100
      );
    }

    if (input.thrivingMinScore !== undefined) {
      normalized.thrivingMinScore = this.normalizeCareScoreNumber(
        input.thrivingMinScore,
        "thrivingMinScore",
        0,
        100
      );
    }

    if (input.thrivingRequiresCareToday !== undefined) {
      normalized.thrivingRequiresCareToday = Boolean(input.thrivingRequiresCareToday);
    }

    return normalized;
  }

  private normalizeCareScoreNumber(
    value: number,
    field: string,
    min: number,
    max: number
  ) {
    if (!Number.isFinite(value) || !Number.isInteger(value) || value < min || value > max) {
      throw new BadRequestException(field + " must be an integer from " + min + " to " + max);
    }

    return value;
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

  private assertOwnerDiaryNoteQuota(pet: CloudPetRecord) {
    const ownerNoteCountToday = pet.timeline.filter(
      (event) => event.type === "owner_note" && this.toIsoDate(event.createdAt) === this.getTaskDate()
    ).length;

    if (ownerNoteCountToday >= MAX_OWNER_DIARY_NOTES_PER_DAY) {
      throw new ConflictException("Daily owner diary note limit reached");
    }
  }

  private async assertOwnerDiaryNoteQuotaForDatabase(petId: string) {
    const { start, end } = getCloudPetBusinessDayRange(this.getTaskDate());
    const ownerNoteCountToday = await this.prisma.virtualPetEvent.count({
      where: {
        petId,
        type: "owner_note",
        createdAt: {
          gte: start,
          lt: end
        }
      }
    });

    if (ownerNoteCountToday >= MAX_OWNER_DIARY_NOTES_PER_DAY) {
      throw new ConflictException("Daily owner diary note limit reached");
    }
  }

  private buildOwnerDiaryNoteEvent(
    petName: string,
    dto: CreateCloudPetDiaryNoteDto
  ): CloudPetTimelineEventInput {
    const title = dto.title?.trim() || petName + "的主人手记";

    return {
      id: "note_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8),
      type: "owner_note",
      title,
      body: dto.body.trim(),
      createdAt: new Date()
    };
  }

  private buildGrowthTaskEvent(task: GrowthTask): CloudPetTimelineEventInput {
    return {
      type: "growth_task",
      title: "完成“" + task.title + "”",
      body: task.description + " 获得 " + task.points + " 成长积分。",
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
      ? " 推荐商品：" + this.getProductDisplayTitle(recommendedProduct.title) + "。"
      : " 商品目录准备好后会刷新推荐。";

    return {
      type: "care_daily_diary",
      title: pet.name + "的成长日记",
      body: `${pet.name}今天完成了“${task.title}”，获得 ${task.points} 成长积分。今日宠物商城奖励可使用 WELCOME20。${productSentence}`,
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
      ? " 推荐商品：" + this.getProductDisplayTitle(recommendedProduct.title) + "。"
      : " 商品目录准备好后会刷新推荐。";

    return {
      type: "presence_daily_diary",
      title: pet.name + "的成长日记",
      body: `${pet.name}在 ${date} 度过了安静的一天。今天没有完成新的成长任务，这条陪伴记录已补入日记。${productSentence}`,
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

  private getProductDisplayTitle(title: string) {
    return {
      "Durable bite rope": "耐咬棉绳玩具",
      "Cat teaser wand set": "猫咪逗趣羽毛杆套装"
    }[title] ?? title;
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
      (event) =>
        isCloudPetDiaryEventType(event.type) &&
        this.toIsoDate(event.createdAt) === date
    );
  }

  private getLatestTimelineDailyDiaryDate(timeline: CloudPetProfile["timeline"]) {
    const latestDiary = timeline.find((event) => isCloudPetDiaryEventType(event.type));

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
            this.getPrimaryDailyTask(),
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
        isCloudPetDiaryEventType(event.type) &&
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
    const { start, end } = getCloudPetBusinessDayRange(this.getTaskDate());

    return this.prisma.virtualPetEvent.findFirst({
      where: {
        petId,
        type: { in: [...DAILY_DIARY_EVENT_TYPES] },
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
    return getCloudPetBusinessDateKey(value);
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

  private getTimelineEventId(event: { id?: string; createdAt: Date | string }) {
    return event.id ?? this.toEventDate(event.createdAt);
  }

  private toEventDate(createdAt: Date | string) {
    return createdAt instanceof Date ? createdAt.toISOString() : createdAt;
  }
  private addDays(date: string, dayDelta: number) {
    return addCloudPetBusinessDays(date, dayDelta);
  }

  private getTaskDate() {
    return getCloudPetBusinessDateKey();
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
    return (
      this.configService.get<string>("KZT_USE_MEMORY_STORE") !== "true" &&
      Boolean(this.configService.get<string>("DATABASE_URL"))
    );
  }
}
