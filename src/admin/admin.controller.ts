import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards
} from "@nestjs/common";
import {
  ConflictException,
  InternalServerErrorException,
  BadRequestException
} from "@nestjs/common";
import { AfterSalesService } from "../after-sales/after-sales.service";
import { UpdateRefundStatusDto } from "../after-sales/dto/update-refund-status.dto";
import { AnalyticsService } from "../analytics/analytics.service";
import { AuthService } from "../auth/auth.service";
import {
  CloudPetsService,
  UpdateCloudPetCareScoreRulesInput,
  UpdateGrowthTaskTemplateInput
} from "../cloud-pets/cloud-pets.service";
import { CmsService } from "../cms/cms.service";
import { CreateCmsBlockDto } from "../cms/dto/create-cms-block.dto";
import { UpdateCmsBlockStatusDto } from "../cms/dto/update-cms-block-status.dto";
import {
  CommunityReportStatus,
  CommunityService
} from "../community/community.service";
import { CustomersService } from "../customers/customers.service";
import { CreateCustomerFollowUpDto } from "../customers/dto/create-customer-follow-up.dto";
import { UpdateCustomerCrmDto } from "../customers/dto/update-customer-crm.dto";
import { MarketingService } from "../marketing/marketing.service";
import { OrdersService } from "../orders/orders.service";
import { PaymentsService } from "../payments/payments.service";
import { ProductsService } from "../products/products.service";
import { ReviewsService } from "../reviews/reviews.service";
import { UpdateReviewStatusDto } from "../reviews/dto/update-review-status.dto";
import {
  AdminPermission,
  AdminRequest,
  AdminStaff,
  StaffService
} from "../staff/staff.service";
import { AdminTokenGuard } from "./admin-token.guard";
import { BackfillCloudPetDailyDiaryDto } from "./dto/backfill-cloud-pet-daily-diary.dto";
import { isCloudPetDiaryEventType } from "../cloud-pets/cloud-pet-event-types";
import { CreateAdminProductDto } from "./dto/create-admin-product.dto";
import { CreateShipmentEventDto } from "./dto/create-shipment-event.dto";
import { CreateShipmentDto } from "./dto/create-shipment.dto";
import { UpdateCouponStatusDto } from "../marketing/dto/update-coupon-status.dto";
import { UpdateCommunityPostStatusDto } from "./dto/update-community-post-status.dto";
import { UpdateCommunityReportStatusDto } from "../community/dto/update-community-report-status.dto";
import { UpdateOrderStatusDto } from "./dto/update-order-status.dto";
import { UpdateProductStatusDto } from "./dto/update-product-status.dto";
import { UpdateVariantStockDto } from "./dto/update-variant-stock.dto";
import { CloudPetOpsMetricsService } from "../observability/cloud-pet-ops-metrics";
import { SqliteRecoveryStatusService } from "../observability/sqlite-recovery-status";
import { CloudPetDeploymentReadinessService } from "../observability/cloud-pet-deployment-readiness";
import { SqliteRecoveryAutoRefreshService } from "../observability/sqlite-recovery-auto-refresh";
import { CloudPetLaunchReadinessService } from "../observability/cloud-pet-launch-readiness";
import {
  SqliteRecoveryNotConfiguredError,
  SqliteRecoveryOperationsService,
  SqliteRecoveryRunInProgressError
} from "../observability/sqlite-recovery-operations";
import { asSqliteRecoveryError } from "../operations/sqlite-recovery";

@Controller("admin")
@UseGuards(AdminTokenGuard)
export class AdminController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly ordersService: OrdersService,
    private readonly cloudPetsService: CloudPetsService,
    private readonly communityService: CommunityService,
    private readonly marketingService: MarketingService,
    private readonly afterSalesService: AfterSalesService,
    private readonly paymentsService: PaymentsService,
    private readonly reviewsService: ReviewsService,
    private readonly analyticsService: AnalyticsService,
    private readonly authService: AuthService,
    private readonly staffService: StaffService,
    private readonly cmsService: CmsService,
    private readonly customersService: CustomersService,
    private readonly cloudPetOpsMetricsService: CloudPetOpsMetricsService,
    private readonly sqliteRecoveryStatusService: SqliteRecoveryStatusService,
    private readonly sqliteRecoveryOperationsService: SqliteRecoveryOperationsService,
    private readonly cloudPetDeploymentReadinessService: CloudPetDeploymentReadinessService,
    private readonly sqliteRecoveryAutoRefreshService: SqliteRecoveryAutoRefreshService,
    private readonly cloudPetLaunchReadinessService: CloudPetLaunchReadinessService
  ) {}

  @Get("dashboard")
  async getDashboard() {
    const [
      activeProducts,
      lowStockVariants,
      orders,
      cloudPetMetrics,
      dailyDiaryStatus,
      communityMetrics,
      refunds,
      operationAuditMetrics,
      payments,
      memberVerificationMetrics
    ] = await Promise.all([
      this.productsService.listActiveProducts(),
      this.productsService.listLowStockVariants(),
      this.ordersService.listOrders(),
      this.cloudPetsService.getMetrics(),
      this.cloudPetsService.getDailyDiaryStatusForToday(),
      this.communityService.getMetrics(),
      this.afterSalesService.listRefundRequests(),
      this.staffService.getOperationAuditMetrics(),
      this.paymentsService.listAdminPayments(),
      this.authService.getVerificationMetrics()
    ]);
    const pendingRefunds = refunds.filter(
      (refund) => refund.status === "pending_review"
    );
    const paymentItems = payments.items;
    const activePaymentIntents = paymentItems.filter((payment) =>
      ["created", "pending"].includes(payment.status)
    );

    return {
      activeProductCount: activeProducts.length,
      lowStockVariantCount: lowStockVariants.length,
      orderCount: orders.length,
      pendingOrderCount: orders.filter(
        (order) => order.status === "pending_payment"
      ).length,
      pendingRefundCount: pendingRefunds.length,
      expeditedRefundCount: pendingRefunds.filter(
        (refund) => refund.reviewRisk?.priority === "expedite"
      ).length,
      blockedRefundCount: pendingRefunds.filter(
        (refund) => refund.reviewRisk?.priority === "blocked"
      ).length,
      dueSoonRefundCount: pendingRefunds.filter(
        (refund) => refund.reviewSla?.status === "due_soon"
      ).length,
      overdueRefundCount: pendingRefunds.filter(
        (refund) => refund.reviewSla?.status === "overdue"
      ).length,
      pendingRefundAmountCents: pendingRefunds.reduce(
        (total, refund) => total + refund.requestedAmountCents,
        0
      ),
      paymentIntentCount: paymentItems.length,
      pendingPaymentIntentCount: activePaymentIntents.length,
      failedPaymentIntentCount: paymentItems.filter(
        (payment) => payment.status === "failed"
      ).length,
      overduePaymentIntentCount: activePaymentIntents.filter(
        (payment) => payment.remainingSeconds === 0
      ).length,
      dailyDiaryCoveredCount: dailyDiaryStatus.generatedTodayCount,
      dailyDiaryMissingCount: dailyDiaryStatus.missingTodayCount,
      dailyDiaryCoverageRate: dailyDiaryStatus.coverageRate,
      memberVerificationIssuedCount: memberVerificationMetrics.issuedCount,
      memberVerificationSuccessCount: memberVerificationMetrics.successCount,
      memberVerificationActiveCount: memberVerificationMetrics.activeCount,
      memberVerificationExpiredCount: memberVerificationMetrics.expiredCount,
      memberVerificationLockedCount: memberVerificationMetrics.lockedCount,
      memberVerificationFailedAttemptCount:
        memberVerificationMetrics.failedAttemptCount,
      memberVerificationSuccessRate: memberVerificationMetrics.successRate,
      ...operationAuditMetrics,
      ...cloudPetMetrics,
      ...communityMetrics
    };
  }

  @Get("analytics")
  getAnalytics() {
    return this.analyticsService.getMerchantAnalytics();
  }

  @Get("ops/cloud-pet-health")
  @Header("Cache-Control", "no-store")
  getCloudPetOpsHealth(@Req() request: AdminRequest) {
    this.requireStaff(request, "audit:read");
    return this.cloudPetOpsMetricsService.getAdminHealthSnapshot();
  }

  @Get("ops/deployment-readiness")
  @Header("Cache-Control", "no-store")
  getDeploymentReadiness(@Req() request: AdminRequest) {
    this.requireStaff(request, "audit:read");
    return this.cloudPetDeploymentReadinessService.getReadiness();
  }

  @Get("ops/cloud-pet-launch-readiness")
  @Header("Cache-Control", "no-store")
  getCloudPetLaunchReadiness(@Req() request: AdminRequest) {
    this.requireStaff(request, "audit:read");
    return this.cloudPetLaunchReadinessService.getReadiness();
  }

  @Get("ops/sqlite-recovery-status")
  @Header("Cache-Control", "no-store")
  async getSqliteRecoveryStatus(@Req() request: AdminRequest) {
    this.requireStaff(request, "audit:read");
    return {
      ...(await this.sqliteRecoveryStatusService.getStatus()),
      autoRefreshEnabled: this.sqliteRecoveryAutoRefreshService.isEnabled(),
      autoRefreshRuntime: this.sqliteRecoveryAutoRefreshService.getRuntimeStatus()
    };
  }

  @Post("ops/sqlite-recovery/run")
  @Header("Cache-Control", "no-store")
  async createAndVerifySqliteRecovery(@Req() request: AdminRequest) {
    const staff = this.requireStaff(request, "audit:read");

    try {
      const status = await this.sqliteRecoveryOperationsService.createAndVerify();
      await this.recordOperation(staff, {
        action: "ops.sqlite_recovery.run",
        targetType: "sqlite_recovery",
        targetId: "status",
        summary: "Created and verified a SQLite backup"
      });
      return {
        ok: true,
        status: status.status,
        freshness: status.freshness,
        completedAt: new Date().toISOString()
      };
    } catch (error) {
      const recoveryError = asSqliteRecoveryError(error);
      await this.recordOperation(staff, {
        action: "ops.sqlite_recovery.run",
        targetType: "sqlite_recovery",
        targetId: "status",
        summary: `SQLite backup verification failed: ${
          error instanceof SqliteRecoveryRunInProgressError ||
          error instanceof SqliteRecoveryNotConfiguredError
            ? error.code
            : recoveryError.code
        }`
      });

      if (error instanceof SqliteRecoveryRunInProgressError) {
        throw new ConflictException({ code: error.code, message: "SQLite recovery is already running" });
      }
      if (error instanceof SqliteRecoveryNotConfiguredError) {
        throw new BadRequestException({ code: error.code, message: error.message });
      }
      throw new InternalServerErrorException({
        code: recoveryError.code,
        message: "SQLite backup verification failed"
      });
    }
  }

  @Get("customers")
  async listCustomers() {
    return {
      items: await this.customersService.listCustomers()
    };
  }

  @Get("customers/:phone")
  getCustomerProfile(@Param("phone") phone: string) {
    return this.customersService.getCustomerProfile(phone);
  }

  @Patch("customers/:phone/crm")
  async updateCustomerCrm(
    @Param("phone") phone: string,
    @Body() dto: UpdateCustomerCrmDto,
    @Req() request: AdminRequest
  ) {
    const staff = this.requireStaff(request, "customers:write");
    const profile = await this.customersService.updateCrm(phone, dto);
    await this.recordOperation(staff, {
      action: "customers.crm.update",
      targetType: "customer",
      targetId: phone,
      summary: `Updated customer CRM profile for ${phone}`
    });

    return profile;
  }

  @Post("customers/:phone/follow-ups")
  async createCustomerFollowUp(
    @Param("phone") phone: string,
    @Body() dto: CreateCustomerFollowUpDto,
    @Req() request: AdminRequest
  ) {
    const staff = this.requireStaff(request, "customers:write");
    const followUp = this.customersService.addFollowUp(phone, dto);
    await this.recordOperation(staff, {
      action: "customers.follow_up.create",
      targetType: "customer",
      targetId: phone,
      summary: `Created customer follow-up ${followUp.followUpNo} for ${phone}`
    });

    return followUp;
  }

  @Get("staff/me")
  getCurrentStaff(@Req() request: AdminRequest) {
    return this.requireStaff(request);
  }

  @Get("operation-logs")
  async listOperationLogs(@Req() request: AdminRequest) {
    this.requireStaff(request, "audit:read");

    return {
      items: await this.staffService.listOperationLogs()
    };
  }

  @Get("cms/blocks")
  async listCmsBlocks() {
    return {
      items: await this.cmsService.listAdminBlocks()
    };
  }

  @Post("cms/blocks")
  async createCmsBlock(
    @Body() dto: CreateCmsBlockDto,
    @Req() request: AdminRequest
  ) {
    const staff = this.requireStaff(request, "cms:write");
    const block = await this.cmsService.createBlock(dto);
    await this.recordOperation(staff, {
      action: "cms.block.create",
      targetType: "cms_block",
      targetId: block.blockNo,
      summary: `Created CMS block ${block.blockNo} for ${block.slotKey}`
    });

    return block;
  }

  @Patch("cms/blocks/:blockNo/status")
  async updateCmsBlockStatus(
    @Param("blockNo") blockNo: string,
    @Body() dto: UpdateCmsBlockStatusDto,
    @Req() request: AdminRequest
  ) {
    const staff = this.requireStaff(request, "cms:write");
    const block = await this.cmsService.updateBlockStatus(blockNo, dto.status);
    await this.recordOperation(staff, {
      action: "cms.block_status.update",
      targetType: "cms_block",
      targetId: blockNo,
      summary: `Updated CMS block ${blockNo} status to ${dto.status}`
    });

    return block;
  }

  @Get("products")
  async listProducts() {
    return {
      items: await this.productsService.listAdminProducts()
    };
  }

  @Post("products")
  async createProduct(@Body() dto: CreateAdminProductDto, @Req() request: AdminRequest) {
    const staff = this.requireStaff(request, "catalog:write");
    const product = await this.productsService.createAdminProduct(dto);
    await this.recordOperation(staff, {
      action: "catalog.product.create",
      targetType: "product",
      targetId: product.slug,
      summary: `Created product ${product.slug}`
    });

    return product;
  }

  @Get("inventory/low-stock")
  async listLowStockVariants() {
    return {
      items: await this.productsService.listLowStockVariants()
    };
  }

  @Patch("products/:slug/status")
  updateProductStatus(
    @Param("slug") slug: string,
    @Body() dto: UpdateProductStatusDto,
    @Req() request: AdminRequest
  ) {
    const staff = this.requireStaff(request, "catalog:write");

    return this.productsService.updateProductStatus(slug, dto.status).then(
      async (product) => {
        await this.recordOperation(staff, {
          action: "catalog.product_status.update",
          targetType: "product",
          targetId: slug,
          summary: `Updated product ${slug} status to ${dto.status}`
        });

        return product;
      }
    );
  }

  @Patch("products/variants/:skuCode/stock")
  async updateVariantStock(
    @Param("skuCode") skuCode: string,
    @Body() dto: UpdateVariantStockDto,
    @Req() request: AdminRequest
  ) {
    const staff = this.requireStaff(request, "catalog:write");
    const variant = await this.productsService.updateVariantStock(
      skuCode,
      dto.stock
    );
    await this.recordOperation(staff, {
      action: "catalog.variant_stock.update",
      targetType: "product_variant",
      targetId: skuCode,
      summary: `Updated ${skuCode} stock to ${dto.stock}`
    });

    return variant;
  }

  @Get("orders")
  async listOrders() {
    return {
      items: await this.ordersService.listOrders()
    };
  }

  @Get("refunds")
  async listRefunds() {
    return {
      items: await this.afterSalesService.listRefundRequests()
    };
  }

  @Get("reviews")
  async listReviews() {
    return {
      items: await this.reviewsService.listAdminReviews()
    };
  }

  @Patch("reviews/:reviewNo/status")
  updateReviewStatus(
    @Param("reviewNo") reviewNo: string,
    @Body() dto: UpdateReviewStatusDto,
    @Req() request: AdminRequest
  ) {
    const staff = this.requireStaff(request, "reviews:moderate");

    return this.reviewsService.updateReviewStatus(reviewNo, dto.status).then(
      async (review) => {
        await this.recordOperation(staff, {
          action: "reviews.status.update",
          targetType: "product_review",
          targetId: reviewNo,
          summary: `Updated review ${reviewNo} status to ${dto.status}`
        });

        return review;
      }
    );
  }

  @Patch("refunds/:refundNo/status")
  updateRefundStatus(
    @Param("refundNo") refundNo: string,
    @Body() dto: UpdateRefundStatusDto,
    @Req() request: AdminRequest
  ) {
    const staff = this.requireStaff(request, "refunds:write");

    return this.afterSalesService.updateRefundStatus(
      refundNo,
      dto.status,
      dto.note
    ).then(async (refund) => {
      await this.recordOperation(staff, {
        action: "after_sales.refund_status.update",
        targetType: "refund_request",
        targetId: refundNo,
        summary: `Updated refund ${refundNo} status to ${dto.status}`
      });

      return refund;
    });
  }

  @Get("coupons")
  async listCoupons() {
    return {
      items: await this.marketingService.listCoupons(
        this.getCouponUsageCounts(await this.ordersService.listOrders())
      )
    };
  }

  @Patch("coupons/:code/status")
  async updateCouponStatus(
    @Param("code") code: string,
    @Body() dto: UpdateCouponStatusDto,
    @Req() request: AdminRequest
  ) {
    const staff = this.requireStaff(request, "marketing:write");
    const coupon = await this.marketingService.updateCouponStatus(
      code,
      dto.status,
      this.getCouponUsageCounts(await this.ordersService.listOrders())
    );
    await this.recordOperation(staff, {
      action: "marketing.coupon_status.update",
      targetType: "coupon",
      targetId: code,
      summary: `Updated coupon ${code} status to ${dto.status}`
    });

    return coupon;
  }

  @Get("payments")
  async listPayments(
    @Query("orderId") orderId: string | undefined,
    @Query("status") status: string | undefined,
    @Query("provider") provider: string | undefined,
    @Query("overdue") overdue: string | undefined,
    @Query("failureCode") failureCode: string | undefined,
    @Req() request: AdminRequest
  ) {
    this.requireStaff(request, "audit:read");

    return this.paymentsService.listAdminPayments({
      failureCode: failureCode as
        | "INSUFFICIENT_BALANCE"
        | "PAYMENT_DECLINED"
        | "PROVIDER_UNAVAILABLE"
        | "USER_CANCELLED_PAYMENT"
        | "UNKNOWN_PROVIDER_ERROR"
        | undefined,
      orderId,
      overdue: overdue === "true",
      provider: provider as "mock_wechat" | "mock_alipay" | undefined,
      status: status as
        | "created"
        | "pending"
        | "paid"
        | "failed"
        | "expired"
        | "cancelled"
        | undefined
    });
  }

  @Post("payments/expire-overdue")
  async expireOverduePayments(
    @Body() dto: { limit?: number },
    @Req() request: AdminRequest
  ) {
    const staff = this.requireStaff(request, "audit:read");
    const result = await this.paymentsService.scanExpiredPayments({
      limit: dto?.limit
    });
    await this.recordOperation(staff, {
      action: "payments.expire_overdue",
      targetType: "payment",
      targetId: "overdue",
      summary: `Expired ${result.expiredIntentCount} overdue payment intents; scanned=${result.scannedCount}, closed=${result.closedOrderCount}, inventoryReleased=${result.inventoryReleasedCount}, failed=${result.failedCount}, skipped=${result.skippedCount}`
    });

    return result;
  }
  @Get("payments/:paymentIntentId")
  async getPayment(
    @Param("paymentIntentId") paymentIntentId: string,
    @Req() request: AdminRequest
  ) {
    this.requireStaff(request, "audit:read");

    return this.paymentsService.getAdminPayment(paymentIntentId);
  }

  @Get("cloud-pets/retention-metrics")
  async getCloudPetRetentionMetrics() {
    const [pets, dailyDiaryStatus, communityMetrics] = await Promise.all([
      this.cloudPetsService.listAdminPets(),
      this.cloudPetsService.getDailyDiaryStatusForToday(),
      this.communityService.getMetrics()
    ]);
    const totalPetCount = pets.length;
    const careCompletedTodayCount = pets.filter(
      (pet) => pet.growth.isCareCompleteToday
    ).length;
    const careScoreTotal = pets.reduce(
      (total, pet) => total + pet.growth.careScore,
      0
    );
    const homepageVisitCount = pets.reduce(
      (total, pet) => total + (pet.homepageVisitCount ?? 0),
      0
    );

    return {
      date: dailyDiaryStatus.date,
      totalPetCount,
      careCompletedTodayCount,
      careCompletionRate: totalPetCount > 0 ? careCompletedTodayCount / totalPetCount : 0,
      averageCareScore: totalPetCount > 0 ? Math.round(careScoreTotal / totalPetCount) : 0,
      maxCareStreakDays: pets.reduce(
        (max, pet) => Math.max(max, pet.growth.careStreakDays),
        0
      ),
      careStateCounts: {
        needsCare: pets.filter((pet) => pet.growth.careState === "needs_care").length,
        steady: pets.filter((pet) => pet.growth.careState === "steady").length,
        thriving: pets.filter((pet) => pet.growth.careState === "thriving").length
      },
      dailyDiaryCoveredCount: dailyDiaryStatus.generatedTodayCount,
      dailyDiaryMissingCount: dailyDiaryStatus.missingTodayCount,
      dailyDiaryCoverageRate: dailyDiaryStatus.coverageRate,
      homepageVisitCount,
      communityPostCount: communityMetrics.communityPostCount,
      pendingCommunityReportCount: communityMetrics.pendingCommunityReportCount
    };
  }

  @Get("cloud-pets/growth-tasks")
  async getCloudPetGrowthTaskOperations() {
    const [tasks, pets] = await Promise.all([
      this.cloudPetsService.listGrowthTasks(),
      this.cloudPetsService.listAdminPets()
    ]);
    const totalPetCount = pets.length;

    return {
      totalPetCount,
      items: tasks.map((task) => {
        const completedTodayCount = pets.filter((pet) =>
          pet.growth.todayCompletedTaskKeys.includes(task.key)
        ).length;

        return {
          ...task,
          completedTodayCount,
          completionRate: totalPetCount > 0 ? completedTodayCount / totalPetCount : 0
        };
      })
    };
  }

  @Patch("cloud-pets/growth-tasks/:taskKey")
  async updateCloudPetGrowthTaskTemplate(
    @Param("taskKey") taskKey: string,
    @Body() dto: UpdateGrowthTaskTemplateInput,
    @Req() request: AdminRequest
  ) {
    const staff = this.requireStaff(request, "cloud_pets:write");
    const task = await this.cloudPetsService.updateGrowthTaskTemplate(taskKey, dto);
    await this.recordOperation(staff, {
      action: "cloud_pets.growth_task_template.update",
      targetType: "cloud_pet_growth_task",
      targetId: task.key,
      summary:
        "Updated cloud-pet growth task template " +
        task.key +
        ": points=" +
        task.points +
        ", rewards=" +
        task.rewards.mood +
        "/" +
        task.rewards.energy +
        "/" +
        task.rewards.intimacy
    });

    return task;
  }

  @Get("cloud-pets/care-score-rules")
  getCloudPetCareScoreRules() {
    return this.cloudPetsService.getCareScoreRules();
  }

  @Patch("cloud-pets/care-score-rules")
  async updateCloudPetCareScoreRules(
    @Body() dto: UpdateCloudPetCareScoreRulesInput,
    @Req() request: AdminRequest
  ) {
    const staff = this.requireStaff(request, "cloud_pets:write");
    const rules = await this.cloudPetsService.updateCareScoreRules(dto);
    await this.recordOperation(staff, {
      action: "cloud_pets.care_score_rules.update",
      targetType: "cloud_pet_care_score_rules",
      targetId: "active",
      summary:
        "Updated cloud-pet care score rules: dailyTaskBonus=" +
        rules.dailyTaskBonus +
        ", steadyMinScore=" +
        rules.steadyMinScore +
        ", thrivingMinScore=" +
        rules.thrivingMinScore
    });

    return rules;
  }

  @Get("cloud-pets")
  async listCloudPets(
    @Query("q") q?: string,
    @Query("species") species?: "cat" | "dog",
    @Query("careState") careState?: "needs_care" | "steady" | "thriving"
  ) {
    const [pets, posts] = await Promise.all([
      this.cloudPetsService.listAdminPets(),
      this.communityService.listAdminPosts()
    ]);
    const keyword = q?.trim().toLowerCase();
    const filteredPets = pets.filter((pet) => {
      const matchesKeyword = keyword
        ? [pet.petNo, pet.name, pet.ownerName, pet.ownerPhone].some((value) =>
            value.toLowerCase().includes(keyword)
          )
        : true;
      const matchesSpecies = species ? pet.species === species : true;
      const matchesCareState = careState ? pet.growth.careState === careState : true;

      return matchesKeyword && matchesSpecies && matchesCareState;
    });

    return {
      filters: {
        q: q?.trim() || undefined,
        species,
        careState
      },
      totalCount: pets.length,
      filteredCount: filteredPets.length,
      items: filteredPets.map((pet) => ({
        ...pet,
        communityPostCount: posts.filter((post) => post.petNo === pet.petNo).length,
      })),
    };
  }
  @Delete("cloud-pets/:petNo/diary-notes/:noteId")
  async removeCloudPetDiaryNote(
    @Param("petNo") petNo: string,
    @Param("noteId") noteId: string,
    @Req() request: AdminRequest
  ) {
    const staff = this.requireStaff(request, "community:moderate");
    const pet = await this.cloudPetsService.deleteDiaryNote(petNo, noteId);
    await this.recordOperation(staff, {
      action: "cloud_pets.diary_note.remove",
      targetType: "cloud_pet_diary_note",
      targetId: noteId,
      summary: "Removed owner diary note " + noteId + " from cloud pet " + petNo
    });

    return pet;
  }

  @Get("cloud-pets/:petNo/detail")
  async getCloudPetOperationalDetail(@Param("petNo") petNo: string) {
    const [pet, archive, posts, reports] = await Promise.all([
      this.cloudPetsService.getPet(petNo),
      this.cloudPetsService.getHomepageArchive(petNo),
      this.communityService.listAdminPosts(),
      this.communityService.listReports()
    ]);
    const petPosts = posts.filter((post) => post.petNo === pet.petNo);
    const petPostNos = new Set(petPosts.map((post) => post.postNo));
    const petReports = reports.filter((report) => petPostNos.has(report.postNo));
    const diaryEntries = archive.items.filter(
      (item) => isCloudPetDiaryEventType(item.type) || item.type === "owner_note"
    );
    const ownerNoteEntries = archive.items.filter((item) => item.type === "owner_note");

    return {
      pet,
      archive,
      community: {
        posts: petPosts,
        postCount: petPosts.length,
        likeCount: petPosts.reduce((total, post) => total + post.likeCount, 0),
        commentCount: petPosts.reduce((total, post) => total + post.commentCount, 0),
        reportCount: petReports.length,
        pendingReportCount: petReports.filter(
          (report) => report.status === "pending_review"
        ).length
      },
      diary: {
        entryCount: diaryEntries.length,
        latestEntry: diaryEntries[0],
        latestOwnerNote: ownerNoteEntries[0]
      }
    };
  }

  @Get("cloud-pets/daily-diaries/status")
  getCloudPetDailyDiaryStatus() {
    return this.cloudPetsService.getDailyDiaryStatusForToday();
  }

  @Get("pets/daily-diary-coverage")
  getCloudPetDailyDiaryCoverage(@Query("date") date?: string) {
    return this.cloudPetsService.getDailyDiaryCoverage(date);
  }

  @Post("pets/daily-diary-coverage/backfill")
  async backfillCloudPetDailyDiaryCoverage(
    @Body() dto: BackfillCloudPetDailyDiaryDto,
    @Req() request: AdminRequest
  ) {
    const staff = this.requireStaff(request, "cms:write");
    const result = await this.cloudPetsService.backfillDailyDiaryCoverage(dto);
    await this.recordOperation(staff, {
      action: "cloud_pets.daily_diary.backfill",
      targetType: "cloud_pet_daily_diary_coverage",
      targetId: dto.date,
      summary:
        `Backfilled cloud-pet daily diaries for ${dto.date} in ${dto.mode} mode; ` +
        `attempted ${result.attemptedCount}, created ${result.successCount}, ` +
        `skipped ${result.skippedCount}, failed ${result.failedCount}`
    });

    return result;
  }

  @Post("cloud-pets/daily-diaries/generate")
  async generateCloudPetDailyDiaries(@Req() request: AdminRequest) {
    const staff = this.requireStaff(request, "cms:write");
    const result = await this.cloudPetsService.generateDailyDiariesForToday();
    await this.recordOperation(staff, {
      action: "cloud_pets.daily_diary.generate",
      targetType: "cloud_pet_daily_diary",
      targetId: result.date,
      summary: `Generated ${result.generatedCount} daily cloud-pet diaries; skipped ${result.skippedCount}`
    });

    return result;
  }

  @Get("community/posts")
  async listCommunityPosts() {
    return {
      items: await this.communityService.listAdminPosts()
    };
  }

  @Get("community/reports")
  async listCommunityReports(
    @Query("status") status?: CommunityReportStatus,
    @Query("postNo") postNo?: string,
    @Query("memberPhone") memberPhone?: string
  ) {
    return {
      items: await this.communityService.listReports({
        status,
        postNo: postNo?.trim() || undefined,
        memberPhone: memberPhone?.trim() || undefined
      })
    };
  }

  @Patch("community/posts/:postNo/status")
  updateCommunityPostStatus(
    @Param("postNo") postNo: string,
    @Body() dto: UpdateCommunityPostStatusDto,
    @Req() request: AdminRequest
  ) {
    const staff = this.requireStaff(request, "community:moderate");

    return this.communityService.updatePostStatus(postNo, dto.status).then(
      async (post) => {
        await this.recordOperation(staff, {
          action: "community.post_status.update",
          targetType: "community_post",
          targetId: postNo,
          summary: `Updated community post ${postNo} status to ${dto.status}`
        });

        return post;
      }
    );
  }

  @Patch("community/reports/:reportNo/status")
  async updateCommunityReportStatus(
    @Param("reportNo") reportNo: string,
    @Body() dto: UpdateCommunityReportStatusDto,
    @Req() request: AdminRequest
  ) {
    const staff = this.requireStaff(request, "community:moderate");
    const report = await this.communityService.updateReportStatus(
      reportNo,
      dto.status,
      dto.note
    );
    await this.recordOperation(staff, {
      action: "community.report_status.update",
      targetType: "community_report",
      targetId: reportNo,
      summary: `Updated community report ${reportNo} status to ${dto.status}`
    });

    return report;
  }

  @Patch("orders/:orderNo/status")
  async updateOrderStatus(
    @Param("orderNo") orderNo: string,
    @Body() dto: UpdateOrderStatusDto,
    @Req() request: AdminRequest
  ) {
    const staff = this.requireStaff(request, "fulfillment:write");
    const order = await this.ordersService.updateOrderStatus(orderNo, dto.status);
    await this.recordOperation(staff, {
      action: "orders.status.update",
      targetType: "order",
      targetId: orderNo,
      summary: `Updated order ${orderNo} status to ${dto.status}`
    });

    return order;
  }

  @Post("orders/:orderNo/shipments")
  async createShipment(
    @Param("orderNo") orderNo: string,
    @Body() dto: CreateShipmentDto,
    @Req() request: AdminRequest
  ) {
    const staff = this.requireStaff(request, "fulfillment:write");
    const order = await this.ordersService.fulfillOrder(orderNo, dto);
    await this.recordOperation(staff, {
      action: "orders.shipment.create",
      targetType: "order",
      targetId: orderNo,
      summary: `Recorded shipment ${dto.trackingNumber} for order ${orderNo}`
    });

    return {
      orderNo: order.orderNo,
      status: order.status,
      shipment: order.shipment
    };
  }

  @Post("orders/:orderNo/shipments/events")
  async recordShipmentEvent(
    @Param("orderNo") orderNo: string,
    @Body() dto: CreateShipmentEventDto,
    @Req() request: AdminRequest
  ) {
    const staff = this.requireStaff(request, "fulfillment:write");
    const order = await this.ordersService.recordShipmentEvent(orderNo, dto);
    await this.recordOperation(staff, {
      action: "orders.shipment_event.create",
      targetType: "order",
      targetId: orderNo,
      summary: `Recorded shipment event ${dto.status} for order ${orderNo}`
    });

    return order;
  }

  private requireStaff(
    request: AdminRequest,
    permission?: AdminPermission
  ): AdminStaff {
    const staff = request.adminStaff;

    if (permission) {
      this.staffService.ensurePermission(staff, permission, {
        method: request.method,
        path: request.originalUrl ?? request.url
      });
    }

    return staff as AdminStaff;
  }

  private recordOperation(
    staff: AdminStaff,
    input: Parameters<StaffService["recordOperation"]>[1]
  ) {
    return this.staffService.recordOperation(staff, input);
  }

  private getCouponUsageCounts(orders: Awaited<ReturnType<OrdersService["listOrders"]>>) {
    return orders.reduce<Record<string, number>>((counts, order) => {
      if (order.couponCode) {
        counts[order.couponCode] = (counts[order.couponCode] ?? 0) + 1;
      }

      return counts;
    }, {});
  }
}






