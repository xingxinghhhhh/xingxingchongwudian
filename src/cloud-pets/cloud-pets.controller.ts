import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { CloudPetsService } from "./cloud-pets.service";
import { CreateCloudPetDto } from "./dto/create-cloud-pet.dto";

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
}
