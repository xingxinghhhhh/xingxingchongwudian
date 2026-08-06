import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  UseGuards
} from "@nestjs/common";
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";
import { AuthService } from "../auth/auth.service";
import { CloudPetsService } from "./cloud-pets.service";
import { CreateCloudPetDto } from "./dto/create-cloud-pet.dto";
import { CreateCloudPetDiaryNoteDto } from "./dto/create-cloud-pet-diary-note.dto";
import { RecordCloudPetHomepageVisitDto } from "./dto/record-cloud-pet-homepage-visit.dto";
import { UpdateCloudPetHomepageDto } from "./dto/update-cloud-pet-homepage.dto";

@Controller("cloud-pets")
export class CloudPetsController {
  constructor(
    private readonly authService: AuthService,
    private readonly cloudPetsService: CloudPetsService
  ) {}

  @Post()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60 * 60 * 1_000 } })
  async createPet(
    @Body() dto: CreateCloudPetDto,
    @Headers("x-member-token") sessionToken?: string
  ) {
    const session = await this.authService.getSession(sessionToken);

    return this.cloudPetsService.createPet({
      ...dto,
      ownerName: session.name,
      ownerPhone: session.phone
    });
  }

  @Get(":petNo")
  getPet(@Param("petNo") petNo: string) {
    return this.cloudPetsService.getPublicPet(petNo);
  }

  @Patch(":petNo/homepage")
  async updateHomepage(
    @Param("petNo") petNo: string,
    @Body() dto: UpdateCloudPetHomepageDto,
    @Headers("x-member-token") sessionToken?: string
  ) {
    const [session, pet] = await Promise.all([
      this.authService.getSession(sessionToken),
      this.cloudPetsService.getPet(petNo)
    ]);

    if (pet.ownerPhone !== session.phone) {
      throw new ForbiddenException("Pet does not belong to current member");
    }

    return this.cloudPetsService.updateHomepage(petNo, dto);
  }

  @Post(":petNo/diary-notes")
  async createDiaryNote(
    @Param("petNo") petNo: string,
    @Body() dto: CreateCloudPetDiaryNoteDto,
    @Headers("x-member-token") sessionToken?: string
  ) {
    const [session, pet] = await Promise.all([
      this.authService.getSession(sessionToken),
      this.cloudPetsService.getPet(petNo)
    ]);

    if (pet.ownerPhone !== session.phone) {
      throw new ForbiddenException("Pet does not belong to current member");
    }

    return this.cloudPetsService.createDiaryNote(petNo, dto);
  }

  @Patch(":petNo/diary-notes/:noteId")
  async updateDiaryNote(
    @Param("petNo") petNo: string,
    @Param("noteId") noteId: string,
    @Body() dto: CreateCloudPetDiaryNoteDto,
    @Headers("x-member-token") sessionToken?: string
  ) {
    const [session, pet] = await Promise.all([
      this.authService.getSession(sessionToken),
      this.cloudPetsService.getPet(petNo)
    ]);

    if (pet.ownerPhone !== session.phone) {
      throw new ForbiddenException("Pet does not belong to current member");
    }

    return this.cloudPetsService.updateDiaryNote(petNo, noteId, dto);
  }

  @Delete(":petNo/diary-notes/:noteId")
  async deleteDiaryNote(
    @Param("petNo") petNo: string,
    @Param("noteId") noteId: string,
    @Headers("x-member-token") sessionToken?: string
  ) {
    const [session, pet] = await Promise.all([
      this.authService.getSession(sessionToken),
      this.cloudPetsService.getPet(petNo)
    ]);

    if (pet.ownerPhone !== session.phone) {
      throw new ForbiddenException("Pet does not belong to current member");
    }

    return this.cloudPetsService.deleteDiaryNote(petNo, noteId);
  }
  @Get(":petNo/homepage/archive")
  getHomepageArchive(
    @Param("petNo") petNo: string,
    @Query("eventType") eventType?: string
  ) {
    return this.cloudPetsService.getHomepageArchive(petNo, eventType);
  }

  @Post(":petNo/homepage/visits")
  recordHomepageVisit(
    @Param("petNo") petNo: string,
    @Body() dto: RecordCloudPetHomepageVisitDto
  ) {
    return this.cloudPetsService.recordHomepageVisit(
      petNo,
      dto.visitorId,
      dto.source
    );
  }

  @Get(":petNo/recommendations")
  async getRecommendations(@Param("petNo") petNo: string) {
    return {
      items: await this.cloudPetsService.getRecommendations(petNo)
    };
  }

  @Post(":petNo/growth-tasks/:taskKey/complete")
  async completeGrowthTask(
    @Param("petNo") petNo: string,
    @Param("taskKey") taskKey: string,
    @Headers("x-member-token") sessionToken?: string
  ) {
    const [session, pet] = await Promise.all([
      this.authService.getSession(sessionToken),
      this.cloudPetsService.getPet(petNo)
    ]);

    if (pet.ownerPhone !== session.phone) {
      throw new ForbiddenException("Pet does not belong to current member");
    }

    return this.cloudPetsService.completeGrowthTask(petNo, taskKey);
  }
}
