import { Body, Controller, Post } from "@nestjs/common";
import { AfterSalesService } from "./after-sales.service";
import { CreateRefundRequestDto } from "./dto/create-refund-request.dto";

@Controller("after-sales")
export class AfterSalesController {
  constructor(private readonly afterSalesService: AfterSalesService) {}

  @Post("refunds")
  createRefundRequest(@Body() dto: CreateRefundRequestDto) {
    return this.afterSalesService.createRefundRequest(dto);
  }
}
