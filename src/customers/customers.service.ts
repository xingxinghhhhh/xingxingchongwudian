import { Injectable } from "@nestjs/common";
import {
  CloudPetProfile,
  CloudPetsService
} from "../cloud-pets/cloud-pets.service";
import {
  CommunityPostResponse,
  CommunityService
} from "../community/community.service";
import {
  CreatedOrder,
  OrdersService,
  OrderStatus
} from "../orders/orders.service";
import { ReviewsService } from "../reviews/reviews.service";
import { CreateCustomerFollowUpDto } from "./dto/create-customer-follow-up.dto";
import { CreateCustomerAddressDto } from "./dto/create-customer-address.dto";
import { UpdateCustomerCrmDto } from "./dto/update-customer-crm.dto";

const PAID_ORDER_STATUSES = new Set<OrderStatus>([
  "paid",
  "refunding",
  "shipped",
  "completed"
]);

export interface CustomerFollowUp {
  followUpNo: string;
  type: "call" | "wechat" | "note";
  summary: string;
  createdAt: string;
  nextActionAt?: string;
}

export interface CustomerCrmRecord {
  tags: string[];
  note?: string;
  ownerStaffName?: string;
  followUps: CustomerFollowUp[];
}

export interface CustomerAddressRecord {
  addressNo: string;
  receiverName: string;
  phone: string;
  province: string;
  city: string;
  district: string;
  detail: string;
  isDefault: boolean;
  createdAt: string;
}

export interface CustomerListItem {
  phone: string;
  name: string;
  paidOrderCount: number;
  totalPaidCents: number;
  petCount: number;
  communityPostCount: number;
  tags: string[];
  nextBestAction: CustomerNextBestAction;
}

export interface CustomerNextBestAction {
  key:
    | "create_pet"
    | "first_order_coupon"
    | "share_homepage"
    | "vip_bundle"
    | "payment_recovery";
  title: string;
  ctaLabel: string;
}

export interface AdminCustomerProfile {
  phone: string;
  name: string;
  summary: {
    orderCount: number;
    paidOrderCount: number;
    pendingOrderCount: number;
    totalPaidCents: number;
    petCount: number;
    homepageVisitCount: number;
    communityPostCount: number;
    reviewCount: number;
  };
  segmentKeys: string[];
  nextBestAction: CustomerNextBestAction;
  crm: CustomerCrmRecord;
  orders: CreatedOrder[];
  pets: CloudPetProfile[];
  communityPosts: CommunityPostResponse[];
  reviews: Awaited<ReturnType<ReviewsService["listReviewsByCustomerPhone"]>>;
}

interface CustomerSignals {
  phone: string;
  name: string;
  orders: CreatedOrder[];
  pets: CloudPetProfile[];
  communityPosts: CommunityPostResponse[];
  homepageVisitCount: number;
}

@Injectable()
export class CustomersService {
  private readonly crmRecords = new Map<string, CustomerCrmRecord>();
  private readonly addresses = new Map<string, CustomerAddressRecord[]>();
  private followUpSequence = 0;
  private addressSequence = 0;

  constructor(
    private readonly ordersService: OrdersService,
    private readonly cloudPetsService: CloudPetsService,
    private readonly communityService: CommunityService,
    private readonly reviewsService: ReviewsService
  ) {}

  async listCustomers(): Promise<CustomerListItem[]> {
    const signals = await this.getAllCustomerSignals();

    return signals
      .map((signal) => {
        const summary = this.buildSummary(signal, 0);
        const crm = this.getCrmRecord(signal.phone);

        return {
          phone: signal.phone,
          name: signal.name,
          paidOrderCount: summary.paidOrderCount,
          totalPaidCents: summary.totalPaidCents,
          petCount: summary.petCount,
          communityPostCount: summary.communityPostCount,
          tags: crm.tags,
          nextBestAction: this.getNextBestAction(summary)
        };
      })
      .sort((left, right) => {
        const revenueDiff = right.totalPaidCents - left.totalPaidCents;

        if (revenueDiff !== 0) {
          return revenueDiff;
        }

        return left.phone.localeCompare(right.phone);
      });
  }

  async getCustomerProfile(phone: string): Promise<AdminCustomerProfile> {
    const signal = await this.getCustomerSignals(phone);
    const reviews = await this.reviewsService.listReviewsByCustomerPhone(phone);
    const summary = this.buildSummary(signal, reviews.length);

    return {
      phone,
      name: signal.name,
      summary,
      segmentKeys: this.getSegmentKeys(summary),
      nextBestAction: this.getNextBestAction(summary),
      crm: this.getCrmRecord(phone),
      orders: signal.orders,
      pets: signal.pets,
      communityPosts: signal.communityPosts,
      reviews
    };
  }

  async updateCrm(
    phone: string,
    dto: UpdateCustomerCrmDto
  ): Promise<AdminCustomerProfile> {
    const current = this.getCrmRecord(phone);
    this.crmRecords.set(phone, {
      ...current,
      tags: dto.tags ? this.normalizeTags(dto.tags) : current.tags,
      note: dto.note ?? current.note,
      ownerStaffName: dto.ownerStaffName ?? current.ownerStaffName
    });

    return this.getCustomerProfile(phone);
  }

  addFollowUp(phone: string, dto: CreateCustomerFollowUpDto): CustomerFollowUp {
    const current = this.getCrmRecord(phone);
    const followUp = {
      followUpNo: this.createFollowUpNo(),
      type: dto.type,
      summary: dto.summary,
      createdAt: new Date().toISOString(),
      nextActionAt: dto.nextActionAt
    } satisfies CustomerFollowUp;

    this.crmRecords.set(phone, {
      ...current,
      followUps: [followUp, ...current.followUps]
    });

    return followUp;
  }

  addAddress(phone: string, dto: CreateCustomerAddressDto): CustomerAddressRecord {
    const currentAddresses = this.addresses.get(phone) ?? [];
    const shouldBeDefault = dto.isDefault ?? currentAddresses.length === 0;
    const address = {
      addressNo: this.createAddressNo(),
      receiverName: dto.receiverName,
      phone: dto.phone,
      province: dto.province,
      city: dto.city,
      district: dto.district,
      detail: dto.detail,
      isDefault: shouldBeDefault,
      createdAt: new Date().toISOString()
    } satisfies CustomerAddressRecord;
    const nextAddresses = shouldBeDefault
      ? currentAddresses.map((item) => ({ ...item, isDefault: false }))
      : currentAddresses;

    this.addresses.set(phone, [address, ...nextAddresses]);

    return address;
  }

  listAddresses(phone: string): CustomerAddressRecord[] {
    return this.addresses.get(phone) ?? [];
  }

  getDefaultAddress(phone: string): CustomerAddressRecord | null {
    return (
      this.listAddresses(phone).find((address) => address.isDefault) ??
      this.listAddresses(phone)[0] ??
      null
    );
  }

  private async getAllCustomerSignals() {
    const [orders, pets, posts] = await Promise.all([
      this.ordersService.listOrders(),
      this.cloudPetsService.listAdminPets(),
      this.communityService.listAdminPosts()
    ]);
    const phones = new Set<string>();

    orders.forEach((order) => phones.add(order.customer.phone));
    pets.forEach((pet) => phones.add(pet.ownerPhone));
    this.crmRecords.forEach((_, phone) => phones.add(phone));

    return Array.from(phones).map((phone) =>
      this.buildSignalsForPhone(phone, orders, pets, posts)
    );
  }

  private async getCustomerSignals(phone: string) {
    const [orders, pets, posts] = await Promise.all([
      this.ordersService.listOrders(),
      this.cloudPetsService.listAdminPets(),
      this.communityService.listAdminPosts()
    ]);

    return this.buildSignalsForPhone(phone, orders, pets, posts);
  }

  private buildSignalsForPhone(
    phone: string,
    orders: CreatedOrder[],
    pets: Awaited<ReturnType<CloudPetsService["listAdminPets"]>>,
    posts: CommunityPostResponse[]
  ): CustomerSignals {
    const customerOrders = orders.filter((order) => order.customer.phone === phone);
    const customerPets = pets.filter((pet) => pet.ownerPhone === phone);
    const petNos = new Set(customerPets.map((pet) => pet.petNo));
    const communityPosts = posts.filter((post) => petNos.has(post.petNo));
    const name =
      customerOrders[0]?.customer.name ??
      customerPets[0]?.ownerName ??
      `Member ${phone.slice(-4)}`;

    return {
      phone,
      name,
      orders: customerOrders,
      pets: customerPets,
      communityPosts,
      homepageVisitCount: customerPets.reduce(
        (total, pet) => total + (pet.homepageVisitCount ?? 0),
        0
      )
    };
  }

  private buildSummary(signal: CustomerSignals, reviewCount: number) {
    const paidOrders = signal.orders.filter((order) =>
      PAID_ORDER_STATUSES.has(order.status)
    );
    const pendingOrderCount = signal.orders.filter(
      (order) => order.status === "pending_payment"
    ).length;

    return {
      orderCount: signal.orders.length,
      paidOrderCount: paidOrders.length,
      pendingOrderCount,
      totalPaidCents: paidOrders.reduce(
        (total, order) => total + order.totalCents,
        0
      ),
      petCount: signal.pets.length,
      homepageVisitCount: signal.homepageVisitCount,
      communityPostCount: signal.communityPosts.length,
      reviewCount
    };
  }

  private getSegmentKeys(summary: ReturnType<CustomersService["buildSummary"]>) {
    const keys: string[] = [];

    if (summary.petCount > 0 && summary.paidOrderCount >= 2) {
      keys.push("high_value_pet_parent");
    }

    if (summary.petCount > 0 && summary.paidOrderCount === 0) {
      keys.push("pet_parent_activation");
    }

    if (summary.paidOrderCount > 0 && summary.petCount === 0) {
      keys.push("commerce_without_pet");
    }

    if (
      summary.homepageVisitCount + summary.communityPostCount > 0 &&
      summary.paidOrderCount < 2
    ) {
      keys.push("community_growth_fan");
    }

    if (summary.pendingOrderCount > 0 && summary.paidOrderCount === 0) {
      keys.push("payment_recovery");
    }

    return keys;
  }

  private getNextBestAction(
    summary: ReturnType<CustomersService["buildSummary"]>
  ): CustomerNextBestAction {
    if (summary.pendingOrderCount > 0 && summary.paidOrderCount === 0) {
      return {
        key: "payment_recovery",
        title: "挽回待支付订单",
        ctaLabel: "发送支付提醒"
      };
    }

    if (summary.petCount === 0) {
      return {
        key: "create_pet",
        title: "邀请创建云养宠",
        ctaLabel: "创建云养宠"
      };
    }

    if (summary.paidOrderCount === 0) {
      return {
        key: "first_order_coupon",
        title: "激活首笔订单",
        ctaLabel: "推送首单优惠券"
      };
    }

    if (summary.homepageVisitCount + summary.communityPostCount === 0) {
      return {
        key: "share_homepage",
        title: "建立留存触点",
        ctaLabel: "推广宠物主页"
      };
    }

    return {
      key: "vip_bundle",
      title: "促进复购",
      ctaLabel: "提供会员组合权益"
    };
  }

  private getCrmRecord(phone: string): CustomerCrmRecord {
    return (
      this.crmRecords.get(phone) ?? {
        tags: [],
        followUps: []
      }
    );
  }

  private normalizeTags(tags: string[]) {
    return Array.from(
      new Set(tags.map((tag) => tag.trim()).filter((tag) => tag.length > 0))
    ).slice(0, 12);
  }

  private createFollowUpNo() {
    this.followUpSequence += 1;
    const now = new Date();
    const timestamp = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
      String(now.getHours()).padStart(2, "0"),
      String(now.getMinutes()).padStart(2, "0"),
      String(now.getSeconds()).padStart(2, "0")
    ].join("");

    return `FU${timestamp}${String(this.followUpSequence).padStart(4, "0")}`;
  }

  private createAddressNo() {
    this.addressSequence += 1;
    const now = new Date();
    const timestamp = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
      String(now.getHours()).padStart(2, "0"),
      String(now.getMinutes()).padStart(2, "0"),
      String(now.getSeconds()).padStart(2, "0")
    ].join("");

    return `ADDR${timestamp}${String(this.addressSequence).padStart(4, "0")}`;
  }
}
