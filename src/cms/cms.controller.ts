import { Controller, Get, Param } from "@nestjs/common";
import { CmsService } from "./cms.service";

@Controller("cms")
export class CmsController {
  constructor(private readonly cmsService: CmsService) {}

  @Get("slots/:slotPrefix")
  async listPublishedBlocks(@Param("slotPrefix") slotPrefix: string) {
    return {
      items: await this.cmsService.listPublishedBlocksBySlotPrefix(slotPrefix)
    };
  }
}
