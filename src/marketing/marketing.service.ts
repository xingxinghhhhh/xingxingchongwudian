import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../database/prisma.service";
import { CouponStatus } from "./dto/update-coupon-status.dto";

export type CouponDiscountType = "fixed_amount";

export interface CouponCampaign {
  code: string;
  title: string;
  description?: string;
  status: CouponStatus;
  discountType: CouponDiscountType;
  discountValueCents: number;
  minSpendCents: number;
  usageLimitPerMember?: number;
  startsAt?: string;
  endsAt?: string;
  usageCount: number;
}

export interface CouponDiscount {
  couponCode?: string;
  discountCents: number;
}

type CouponRecord = Omit<CouponCampaign, "usageCount">;

interface IssuedCoupon {
  couponCode: string;
  memberPhone: string;
  sourceId: string;
  usedOrderNo?: string;
}

const defaultCoupons: CouponRecord[] = [
  {
    code: "WELCOME20",
    title: "Member welcome coupon",
    description: "New member cloud-pet welcome coupon. Deducts CNY 20 at checkout.",
    status: "active",
    discountType: "fixed_amount",
    discountValueCents: 2000,
    minSpendCents: 0,
    usageLimitPerMember: 1
  },
  {
    code: "POINTS8",
    title: "80-point redemption coupon",
    description: "Redeemed from member points. Deducts CNY 8 at checkout.",
    status: "active",
    discountType: "fixed_amount",
    discountValueCents: 800,
    minSpendCents: 3000
  },
  {
    code: "POINTS20",
    title: "180-point premium redemption coupon",
    description: "Redeemed from member points. Deducts CNY 20 on larger orders.",
    status: "active",
    discountType: "fixed_amount",
    discountValueCents: 2000,
    minSpendCents: 8000
  }
];

@Injectable()
export class MarketingService {
  private readonly coupons = new Map<string, CouponRecord>([
    ...defaultCoupons.map((coupon) => [coupon.code, coupon] as const)
  ]);
  private readonly issuedCoupons = new Map<string, IssuedCoupon[]>();

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService
  ) {}

  async listCoupons(
    usageCounts: Record<string, number> = {}
  ): Promise<CouponCampaign[]> {
    const coupons = this.isDatabaseConfigured()
      ? await this.listDatabaseCoupons()
      : Array.from(this.coupons.values());

    return coupons.map((coupon) => ({
      ...coupon,
      usageCount: usageCounts[coupon.code] ?? 0
    }));
  }

  async updateCouponStatus(
    code: string,
    status: CouponStatus,
    usageCounts: Record<string, number> = {}
  ): Promise<CouponCampaign> {
    const normalizedCode = this.normalizeCode(code);

    if (this.isDatabaseConfigured()) {
      await this.ensureDefaultCoupons();
      const coupon = await this.prisma.coupon.update({
        where: { code: normalizedCode },
        data: { status }
      });

      return this.toCouponCampaign(coupon, usageCounts);
    }

    const coupon = this.coupons.get(normalizedCode);

    if (!coupon) {
      throw new NotFoundException("Coupon not found");
    }

    const nextCoupon = { ...coupon, status };
    this.coupons.set(normalizedCode, nextCoupon);

    return {
      ...nextCoupon,
      usageCount: usageCounts[normalizedCode] ?? 0
    };
  }

  async resolveCoupon(
    couponCode: string | undefined,
    subtotalCents: number,
    memberPhone?: string
  ): Promise<CouponDiscount> {
    return this.resolveCoupons(
      couponCode ? [couponCode] : [],
      subtotalCents,
      memberPhone
    );
  }

  async resolveCoupons(
    couponCodes: Array<string | undefined> | undefined,
    subtotalCents: number,
    memberPhone?: string
  ): Promise<CouponDiscount> {
    const normalizedCodes = Array.from(
      new Set(
        (couponCodes ?? [])
          .map((couponCode) => couponCode?.trim().toUpperCase())
          .filter((couponCode): couponCode is string => Boolean(couponCode))
      )
    );

    if (normalizedCodes.length === 0) {
      return {
        discountCents: 0
      };
    }

    if (normalizedCodes.length > 1) {
      throw new BadRequestException("Coupon combination is not allowed");
    }

    const [normalizedCode] = normalizedCodes;
    const coupon = await this.findCoupon(normalizedCode);

    if (!coupon) {
      throw new BadRequestException("Coupon not found");
    }

    this.assertIssuedCouponUsable(coupon, memberPhone);

    if (coupon.status !== "active") {
      throw new BadRequestException("Coupon is not active");
    }

    const now = Date.now();
    const startsAt = coupon.startsAt ? new Date(coupon.startsAt).getTime() : null;
    const endsAt = coupon.endsAt ? new Date(coupon.endsAt).getTime() : null;

    if (startsAt && startsAt > now) {
      throw new BadRequestException("Coupon is not active");
    }

    if (endsAt && endsAt < now) {
      throw new BadRequestException("Coupon is not active");
    }

    if (subtotalCents < coupon.minSpendCents) {
      throw new BadRequestException("Coupon minimum spend not reached");
    }

    return {
      couponCode: coupon.code,
      discountCents: Math.min(coupon.discountValueCents, subtotalCents)
    };
  }

  registerIssuedCoupon(input: {
    couponCode: string;
    memberPhone: string;
    sourceId: string;
  }) {
    const couponCode = this.normalizeCode(input.couponCode);
    const issuedCoupons = this.issuedCoupons.get(couponCode) ?? [];

    this.issuedCoupons.set(couponCode, [
      {
        couponCode,
        memberPhone: input.memberPhone,
        sourceId: input.sourceId
      },
      ...issuedCoupons
    ]);
  }

  markCouponUsed(input: {
    couponCode: string | undefined;
    memberPhone: string;
    orderNo: string;
  }) {
    const couponCode = input.couponCode
      ? this.normalizeCode(input.couponCode)
      : undefined;

    if (!couponCode || !this.isIssuedCouponCode(couponCode)) {
      return;
    }

    const issuedCoupon = this.findUnusedIssuedCoupon(
      couponCode,
      input.memberPhone
    );

    if (issuedCoupon) {
      issuedCoupon.usedOrderNo = input.orderNo;
    }
  }

  getUsageLimitPerMember(couponCode: string | undefined) {
    if (!couponCode) {
      return undefined;
    }

    return this.coupons.get(this.normalizeCode(couponCode))?.usageLimitPerMember;
  }

  private async findCoupon(code: string): Promise<CouponRecord | undefined> {
    if (this.isDatabaseConfigured()) {
      await this.ensureDefaultCoupons();
      const coupon = await this.prisma.coupon.findUnique({
        where: { code }
      });

      return coupon ? this.toCouponRecord(coupon) : undefined;
    }

    return this.coupons.get(code);
  }

  private async listDatabaseCoupons(): Promise<CouponRecord[]> {
    await this.ensureDefaultCoupons();
    const coupons = await this.prisma.coupon.findMany({
      orderBy: { createdAt: "desc" }
    });

    return coupons.map((coupon) => this.toCouponRecord(coupon));
  }

  private async ensureDefaultCoupons() {
    await Promise.all(
      defaultCoupons.map((coupon) =>
        this.prisma.coupon.upsert({
          where: { code: coupon.code },
          update: {},
          create: {
            code: coupon.code,
            title: coupon.title,
            description: coupon.description,
            status: coupon.status,
            discountType: coupon.discountType,
            discountValueCents: coupon.discountValueCents,
            minSpendCents: coupon.minSpendCents
          }
        })
      )
    );
  }

  private toCouponCampaign(
    coupon: {
      code: string;
      title: string;
      description: string | null;
      status: CouponStatus;
      discountType: CouponDiscountType;
      discountValueCents: number;
      minSpendCents: number;
      startsAt: Date | null;
      endsAt: Date | null;
    },
    usageCounts: Record<string, number>
  ): CouponCampaign {
    return {
      ...this.toCouponRecord(coupon),
      usageCount: usageCounts[coupon.code] ?? 0
    };
  }

  private toCouponRecord(coupon: {
    code: string;
    title: string;
    description: string | null;
    status: CouponStatus;
    discountType: CouponDiscountType;
    discountValueCents: number;
    minSpendCents: number;
    startsAt: Date | null;
    endsAt: Date | null;
  }): CouponRecord {
    return {
      code: coupon.code,
      title: coupon.title,
      description: coupon.description ?? undefined,
      status: coupon.status,
      discountType: coupon.discountType,
      discountValueCents: coupon.discountValueCents,
      minSpendCents: coupon.minSpendCents,
      usageLimitPerMember: this.getUsageLimitPerMember(coupon.code),
      startsAt: coupon.startsAt?.toISOString(),
      endsAt: coupon.endsAt?.toISOString()
    };
  }

  private normalizeCode(code: string) {
    return code.trim().toUpperCase();
  }

  private assertIssuedCouponUsable(
    coupon: CouponRecord,
    memberPhone: string | undefined
  ) {
    if (!this.isIssuedCouponCode(coupon.code)) {
      return;
    }

    if (!memberPhone) {
      throw new BadRequestException("Coupon requires a member phone");
    }

    const unusedCoupon = this.findUnusedIssuedCoupon(coupon.code, memberPhone);

    if (unusedCoupon) {
      return;
    }

    const issuedCoupons = this.issuedCoupons.get(coupon.code) ?? [];
    const memberCoupons = issuedCoupons.filter(
      (issuedCoupon) => issuedCoupon.memberPhone === memberPhone
    );

    if (memberCoupons.length > 0) {
      throw new BadRequestException("Coupon has already been used");
    }

    throw new BadRequestException("Coupon is not issued to this member");
  }

  private findUnusedIssuedCoupon(couponCode: string, memberPhone: string) {
    return (this.issuedCoupons.get(this.normalizeCode(couponCode)) ?? []).find(
      (issuedCoupon) =>
        issuedCoupon.memberPhone === memberPhone && !issuedCoupon.usedOrderNo
    );
  }

  private isIssuedCouponCode(couponCode: string) {
    return couponCode.startsWith("POINTS");
  }

  private isDatabaseConfigured() {
    return Boolean(this.configService.get<string>("DATABASE_URL"));
  }
}
