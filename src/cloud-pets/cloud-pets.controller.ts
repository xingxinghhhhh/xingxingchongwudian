import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { CloudPetsService } from "./cloud-pets.service";
import { CreateCloudPetDto } from "./dto/create-cloud-pet.dto";
import { RecordCloudPetHomepageVisitDto } from "./dto/record-cloud-pet-homepage-visit.dto";
import { UpdateCloudPetHomepageDto } from "./dto/update-cloud-pet-homepage.dto";

@Controller("cloud-pets")
export class CloudPetsController {
  constructor(private readonly cloudPetsService: CloudPetsService) {}

  @Post()
  createPet(@Body() dto: CreateCloudPetDto) {
    return this.cloudPetsService.createPet(dto);
  }

  @Get(":petNo")
  getPet(@Param("petNo") petNo: string) {
    return this.cloudPetsService.getPet(petNo);
  }

  @Patch(":petNo/homepage")
  updateHomepage(
    @Param("petNo") petNo: string,
    @Body() dto: UpdateCloudPetHomepageDto
  ) {
    return this.cloudPetsService.updateHomepage(petNo, dto);
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
    return this.cloudPetsService.recordHomepageVisit(petNo, dto.source);
  }

  @Get(":petNo/recommendations")
  async getRecommendations(@Param("petNo") petNo: string) {
    return {
      items: await this.cloudPetsService.getRecommendations(petNo)
    };
  }

  @Post(":petNo/growth-tasks/:taskKey/complete")
  completeGrowthTask(
    @Param("petNo") petNo: string,
    @Param("taskKey") taskKey: string
  ) {
    return this.cloudPetsService.completeGrowthTask(petNo, taskKey);
  }
}
