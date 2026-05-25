import { Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../database/prisma.service";
import { CreateCloudPetDto } from "./dto/create-cloud-pet.dto";

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
  timeline: Array<{
    type: string;
    title: string;
    body: string;
    createdAt: string;
  }>;
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

@Injectable()
export class CloudPetsService {
  private readonly pets = new Map<string, CloudPetRecord>();
  private sequence = 0;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService
  ) {}

  async createPet(dto: CreateCloudPetDto): Promise<CloudPetProfile> {
    const petNo = this.createPetNo();
    const pet = this.createPetRecord(petNo, dto);

    if (!this.isDatabaseConfigured()) {
      this.pets.set(pet.petNo, pet);
      return this.toProfile(pet);
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

    return this.toProfile(savedPet);
  }

  async getPet(petNo: string): Promise<CloudPetProfile> {
    if (!this.isDatabaseConfigured()) {
      const pet = this.pets.get(petNo);

      if (!pet) {
        throw new NotFoundException("Cloud pet not found");
      }

      return this.toProfile(pet);
    }

    const pet = await this.prisma.virtualPet.findUnique({
      where: { petNo },
      include: { timeline: { orderBy: { createdAt: "desc" } } }
    });

    if (!pet) {
      throw new NotFoundException("Cloud pet not found");
    }

    return this.toProfile(pet);
  }

  async getPetRecord(petNo: string): Promise<CloudPetProfile> {
    return this.getPet(petNo);
  }

  private createPetRecord(
    petNo: string,
    dto: CreateCloudPetDto
  ): CloudPetRecord {
    const avatarUrl =
      dto.species === "cat"
        ? "/brand/naigai-niangao/naigai-standard.png"
        : "/brand/naigai-niangao/niangao-standard.png";
    const speciesLabel = dto.species === "cat" ? "小猫" : "小狗";

    return {
      petNo,
      ownerName: dto.ownerName,
      ownerPhone: dto.ownerPhone,
      name: dto.name,
      species: dto.species,
      personality: dto.personality,
      avatarUrl,
      bio: `${dto.name} 是 ${dto.ownerName} 定制的云养${speciesLabel}，性格是${dto.personality}。`,
      mood: 72,
      energy: 68,
      intimacy: 15,
      timeline: [
        {
          type: "adoption",
          title: `${dto.name}来到这个小家`,
          body: "第一天先熟悉气味、光线和主人的声音。它还没有完全放松，但已经开始记住这个新家的节奏。",
          createdAt: new Date()
        }
      ]
    };
  }

  private toProfile(pet: CloudPetRecord): CloudPetProfile {
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

    return `VP${timestamp}${String(this.sequence).padStart(4, "0")}`;
  }

  private isDatabaseConfigured() {
    return Boolean(this.configService.get<string>("DATABASE_URL"));
  }
}
