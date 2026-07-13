import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { MarketingService, CouponCampaign, CouponDiscount } from "./marketing.service";
import { UpdateCouponStatusDto } from "./dto/update-coupon-status.dto";

@Controller("marketing")
export class MarketingController {
  constructor(private readonly marketingService: MarketingService) {}

  @Get("coupons")
  listCoupons(): Promise<CouponCampaign[]> {
    return this.marketingService.listCoupons();
  }

  @Patch("coupons/:code/status")
  updateCouponStatus(
    @Param("code") code: string,
    @Body() dto: UpdateCouponStatusDto
  ): Promise<CouponCampaign> {
    return this.marketingService.updateCouponStatus(code, dto.status);
  }

  @Post("calculate")
  calculateDiscount(@Body() body: {
    couponCodes?: string[];
    subtotalCents: number;
    memberPhone?: string;
  }): Promise<CouponDiscount> {
    return this.marketingService.resolveCoupons(
      body.couponCodes,
      body.subtotalCents,
      body.memberPhone
    );
  }

  @Get("calculate")
  calculateDiscountGet(
    @Query("codes") codes?: string,
    @Query("subtotalCents") subtotalCents?: string,
    @Query("memberPhone") memberPhone?: string
  ): Promise<CouponDiscount> {
    const couponCodes = codes ? codes.split(",").map((c) => c.trim()) : [];
    const cents = subtotalCents ? Number(subtotalCents) : 0;
    return this.marketingService.resolveCoupons(couponCodes, cents, memberPhone);
  }
}
