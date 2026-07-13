import {
  adminLogin,
  adminLogout,
  createAdminProduct,
  backfillDailyDiaryCoverage,
  createCustomerFollowUp,
  createCmsBlock,
  generateCloudPetDailyDiaries,
  getAdminMe,
  getDailyDiaryCoverage,
  getCloudPetDailyDiaryStatus,
  getAdminCustomer,
  getCurrentAdminStaff,
  getAdminDashboard,
  getMerchantAnalytics,
  listAdminCustomers,
  listAdminCoupons,
  listAdminRefunds,
  fulfillOrder,
  listAdminCloudPets,
  listAdminCommunityPosts,
  listAdminCommunityReports,
  listAdminOrders,
  listAdminPayments,
  getAdminPayment,
  expireOverduePayments,
  listAdminProducts,
  listAdminReviews,
  listAdminCmsBlocks,
  listOperationLogs,
  listLowStockVariants,
  recordShipmentEvent,
  updateProductStatus,
  updateCouponStatus,
  updateCustomerCrm,
  updateRefundStatus,
  updateReviewStatus,
  updateCmsBlockStatus,
  updateVariantStock,
  updateCommunityPostStatus,
  updateCommunityReportStatus
} from "./admin-api";

describe("admin api client", () => {
  const token = "dev-admin-key";

  it("loads merchant dashboard metrics with the admin token", async () => {
    const fetcher = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        activeProductCount: 2,
        cloudPetCount: 3,
        dailyDiaryCoveredCount: 2,
        dailyDiaryMissingCount: 1,
        dailyDiaryCoverageRate: 0.67,
        communityPostCount: 4,
        lowStockVariantCount: 1,
        orderCount: 5,
        pendingOrderCount: 1,
        pendingRefundCount: 2,
        expeditedRefundCount: 1,
        blockedRefundCount: 0,
        dueSoonRefundCount: 1,
        overdueRefundCount: 0,
        pendingRefundAmountCents: 7980,
        paymentIntentCount: 6,
        pendingPaymentIntentCount: 2,
        failedPaymentIntentCount: 1,
        overduePaymentIntentCount: 1,
        operationLogCount: 4,
        highRiskOperationCount: 3,
        permissionDeniedCount: 1,
        hiddenCommunityPostCount: 0
      })
    });

    await expect(getAdminDashboard(token, fetcher)).resolves.toMatchObject({
      cloudPetCount: 3,
      dailyDiaryCoveredCount: 2,
      dailyDiaryMissingCount: 1,
      dailyDiaryCoverageRate: 0.67,
      lowStockVariantCount: 1,
      orderCount: 5,
      pendingRefundCount: 2,
      expeditedRefundCount: 1,
      dueSoonRefundCount: 1,
      overdueRefundCount: 0,
      pendingRefundAmountCents: 7980,
      paymentIntentCount: 6,
      pendingPaymentIntentCount: 2,
      failedPaymentIntentCount: 1,
      overduePaymentIntentCount: 1,
      operationLogCount: 4,
      highRiskOperationCount: 3,
      permissionDeniedCount: 1
    });
    expect(fetcher).toHaveBeenCalledWith(
      "http://localhost:3000/api/admin/dashboard",
      {
        cache: "no-store",
        headers: { "X-Admin-Token": token }
      }
    );
  });

  it("logs in and logs out an admin session", async () => {
    const loginFetcher = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        sessionToken: "admin_202606030001_0001",
        staff: {
          staffNo: "STAFF_OWNER",
          name: "Owner Admin",
          role: "owner",
          permissions: ["audit:read", "catalog:write"]
        }
      })
    });
    const logoutFetcher = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true })
    });

    await expect(
      adminLogin(
        {
          email: "owner@example.com",
          password: "owner123456"
        },
        loginFetcher
      )
    ).resolves.toMatchObject({
      sessionToken: "admin_202606030001_0001",
      staff: {
        staffNo: "STAFF_OWNER",
        role: "owner"
      }
    });
    expect(loginFetcher).toHaveBeenCalledWith(
      "http://localhost:3000/api/admin/auth/login",
      {
        body: JSON.stringify({
          email: "owner@example.com",
          password: "owner123456"
        }),
        cache: "no-store",
        headers: {
          "Content-Type": "application/json"
        },
        method: "POST"
      }
    );

    await expect(
      adminLogout("admin_202606030001_0001", logoutFetcher)
    ).resolves.toEqual({ success: true });
    expect(logoutFetcher).toHaveBeenCalledWith(
      "http://localhost:3000/api/admin/auth/logout",
      {
        body: JSON.stringify({}),
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Session": "admin_202606030001_0001"
        },
        method: "POST"
      }
    );
  });

  it("loads the current admin auth session via /auth/me", async () => {
    const fetcher = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        staffNo: "STAFF_OWNER",
        name: "Owner Admin",
        role: "owner",
        permissions: ["audit:read", "cms:write"]
      })
    });

    await expect(getAdminMe("admin_202606030001_0001", fetcher)).resolves.toMatchObject({
      staffNo: "STAFF_OWNER",
      role: "owner"
    });
    expect(fetcher).toHaveBeenCalledWith(
      "http://localhost:3000/api/admin/auth/me",
      {
        cache: "no-store",
        headers: { "X-Admin-Session": "admin_202606030001_0001" }
      }
    );
  });

  it("normalizes forbidden admin API responses for the console", async () => {
    const fetcher = jest.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ message: "Missing admin permission: cms:write" })
    });

    await expect(getAdminMe("admin_202606030001_0001", fetcher)).rejects.toThrow(
      "\u6743\u9650\u4e0d\u8db3\uff0c\u65e0\u6cd5\u6267\u884c\u8be5\u64cd\u4f5c"
    );
  });

  it("loads merchant analytics for revenue and retention decisions", async () => {
    const fetcher = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        revenue: {
          gmvCents: 7980,
          paidOrderCount: 2,
          averageOrderValueCents: 3990
        },
        conversion: {
          orderCount: 3,
          paidOrderRate: 66.7,
          statusBreakdown: { paid: 2, pending_payment: 1 }
        },
        customers: {
          customerCount: 1,
          repeatCustomerCount: 1,
          repeatPurchaseRate: 100
        },
        productRankings: [
          {
            skuCode: "DBR-GREEN-M",
            title: "Durable bite rope",
            quantitySold: 2,
            revenueCents: 7980
          }
        ],
        customerSegments: [
          {
            key: "high_value_pet_parent",
            title: "High-value cloud-pet parents",
            description: "Members ready for VIP bundles.",
            memberCount: 1,
            samplePhones: ["13600136988"],
            actionLabel: "Send VIP bundle offer",
            priority: "high"
          }
        ],
        retentionFunnel: [
          {
            key: "cloud_pet_created",
            title: "Cloud pet created",
            count: 2,
            conversionRate: 100,
            dropOffCount: 0,
            actionLabel: "Keep pet onboarding active"
          },
          {
            key: "paid_customer",
            title: "Paid customer",
            count: 1,
            conversionRate: 50,
            dropOffCount: 1,
            actionLabel: "Issue post-purchase task"
          }
        ],
        retentionSignals: {
          cloudPetCount: 2,
          homepageVisitCount: 1,
          communityPostCount: 3,
          reviewCount: 1,
          pendingReviewCount: 1,
          pendingCommunityReportCount: 0
        }
      })
    });

    await expect(getMerchantAnalytics(token, fetcher)).resolves.toMatchObject({
      revenue: { gmvCents: 7980, paidOrderCount: 2 },
      customers: { repeatCustomerCount: 1 },
      productRankings: [expect.objectContaining({ skuCode: "DBR-GREEN-M" })],
      customerSegments: [
        expect.objectContaining({
          key: "high_value_pet_parent",
          actionLabel: "Send VIP bundle offer"
        })
      ],
      retentionFunnel: [
        expect.objectContaining({
          key: "cloud_pet_created",
          conversionRate: 100
        }),
        expect.objectContaining({
          key: "paid_customer",
          actionLabel: "Issue post-purchase task"
        })
      ]
    });
    expect(fetcher).toHaveBeenCalledWith(
      "http://localhost:3000/api/admin/analytics",
      {
        cache: "no-store",
        headers: { "X-Admin-Token": token }
      }
    );
  });

  it("loads current staff permissions and operation logs", async () => {
    const staffFetcher = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        staffNo: "STAFF_OWNER",
        name: "Owner Admin",
        role: "owner",
        permissions: ["audit:read", "catalog:write"]
      })
    });
    const logsFetcher = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          {
            logNo: "OP202605270001",
            staffNo: "STAFF_OWNER",
            action: "catalog.variant_stock.update",
            targetType: "product_variant",
            targetId: "DBR-GREEN-M"
          }
        ]
      })
    });

    await expect(getCurrentAdminStaff(token, staffFetcher)).resolves.toMatchObject({
      staffNo: "STAFF_OWNER",
      permissions: expect.arrayContaining(["catalog:write"])
    });
    expect(staffFetcher).toHaveBeenCalledWith(
      "http://localhost:3000/api/admin/staff/me",
      {
        cache: "no-store",
        headers: { "X-Admin-Token": token }
      }
    );

    await expect(listOperationLogs(token, logsFetcher)).resolves.toEqual([
      expect.objectContaining({
        action: "catalog.variant_stock.update",
        targetId: "DBR-GREEN-M"
      })
    ]);
    expect(logsFetcher).toHaveBeenCalledWith(
      "http://localhost:3000/api/admin/operation-logs",
      {
        cache: "no-store",
        headers: { "X-Admin-Token": token }
      }
    );
  });

  it("loads and updates admin customer CRM profiles", async () => {
    const listFetcher = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          {
            phone: "13600137988",
            name: "CRM Customer",
            paidOrderCount: 1,
            totalPaidCents: 3990,
            petCount: 1,
            communityPostCount: 1,
            tags: ["vip_candidate"],
            nextBestAction: {
              key: "vip_bundle",
              title: "Grow repeat purchase",
              ctaLabel: "Offer VIP bundle"
            }
          }
        ]
      })
    });
    const detailFetcher = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        phone: "13600137988",
        name: "CRM Customer",
        summary: {
          orderCount: 1,
          paidOrderCount: 1,
          pendingOrderCount: 0,
          totalPaidCents: 3990,
          petCount: 1,
          homepageVisitCount: 1,
          communityPostCount: 1,
          reviewCount: 0
        },
        crm: {
          tags: ["vip_candidate"],
          note: "Prefers bundles.",
          followUps: []
        },
        orders: [],
        pets: [],
        communityPosts: [],
        reviews: []
      })
    });
    const updateFetcher = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        phone: "13600137988",
        crm: { tags: ["vip_candidate"], note: "Prefers bundles.", followUps: [] }
      })
    });
    const followUpFetcher = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        followUpNo: "FU202606020001",
        type: "wechat",
        summary: "Sent VIP bundle.",
        createdAt: "2026-06-02T10:00:00.000Z"
      })
    });

    await expect(listAdminCustomers(token, listFetcher)).resolves.toEqual([
      expect.objectContaining({ phone: "13600137988", tags: ["vip_candidate"] })
    ]);
    expect(listFetcher).toHaveBeenCalledWith(
      "http://localhost:3000/api/admin/customers",
      {
        cache: "no-store",
        headers: { "X-Admin-Token": token }
      }
    );

    await expect(
      getAdminCustomer("13600137988", token, detailFetcher)
    ).resolves.toMatchObject({
      phone: "13600137988",
      summary: { petCount: 1 }
    });

    await expect(
      updateCustomerCrm(
        "13600137988",
        { tags: ["vip_candidate"], note: "Prefers bundles." },
        token,
        updateFetcher
      )
    ).resolves.toMatchObject({
      crm: { tags: ["vip_candidate"] }
    });
    expect(updateFetcher).toHaveBeenCalledWith(
      "http://localhost:3000/api/admin/customers/13600137988/crm",
      {
        body: JSON.stringify({
          tags: ["vip_candidate"],
          note: "Prefers bundles."
        }),
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Token": token
        },
        method: "PATCH"
      }
    );

    await expect(
      createCustomerFollowUp(
        "13600137988",
        { type: "wechat", summary: "Sent VIP bundle." },
        token,
        followUpFetcher
      )
    ).resolves.toMatchObject({ type: "wechat" });
  });

  it("creates, lists, and updates CMS content blocks", async () => {
    const listFetcher = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          {
            blockNo: "CMS202605270001",
            slotKey: "homepage.campaign",
            title: "Daily campaign",
            status: "published"
          }
        ]
      })
    });
    const createFetcher = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        blockNo: "CMS202605270002",
        slotKey: "homepage.campaign",
        title: "New campaign",
        status: "published"
      })
    });
    const statusFetcher = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        blockNo: "CMS202605270002",
        status: "archived"
      })
    });

    await expect(listAdminCmsBlocks(token, listFetcher)).resolves.toEqual([
      expect.objectContaining({ blockNo: "CMS202605270001" })
    ]);
    expect(listFetcher).toHaveBeenCalledWith(
      "http://localhost:3000/api/admin/cms/blocks",
      {
        cache: "no-store",
        headers: { "X-Admin-Token": token }
      }
    );

    await expect(
      createCmsBlock(
        {
          slotKey: "homepage.campaign",
          title: "New campaign",
          body: "A CMS-managed campaign.",
          status: "published"
        },
        token,
        createFetcher
      )
    ).resolves.toMatchObject({ status: "published" });

    await expect(
      updateCmsBlockStatus(
        "CMS202605270002",
        "archived",
        token,
        statusFetcher
      )
    ).resolves.toMatchObject({ status: "archived" });
  });

  it("loads coupons and updates marketing campaign status", async () => {
    const listFetcher = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          {
            code: "WELCOME20",
            status: "active",
            discountType: "fixed_amount",
            discountValueCents: 2000,
            minSpendCents: 0,
            usageCount: 3
          }
        ]
      })
    });
    const statusFetcher = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        code: "WELCOME20",
        status: "paused"
      })
    });

    await expect(listAdminCoupons(token, listFetcher)).resolves.toEqual([
      expect.objectContaining({ code: "WELCOME20", usageCount: 3 })
    ]);
    expect(listFetcher).toHaveBeenCalledWith(
      "http://localhost:3000/api/admin/coupons",
      {
        cache: "no-store",
        headers: { "X-Admin-Token": token }
      }
    );

    await expect(
      updateCouponStatus("WELCOME20", "paused", token, statusFetcher)
    ).resolves.toMatchObject({ code: "WELCOME20", status: "paused" });
    expect(statusFetcher).toHaveBeenCalledWith(
      "http://localhost:3000/api/admin/coupons/WELCOME20/status",
      {
        body: JSON.stringify({ status: "paused" }),
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Token": token
        },
        method: "PATCH"
      }
    );
  });

  it("loads and resolves refund requests for after-sales operations", async () => {
    const listFetcher = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          {
            refundNo: "REF202605260001",
            orderNo: "KZT202605260001",
            status: "pending_review",
            requestedAmountCents: 3990,
            refundableBalanceCents: 3990,
            remainingAfterRequestCents: 0,
            reviewRisk: {
              level: "medium",
              priority: "expedite",
              reason: "Request will fully refund the order"
            },
            reviewSla: {
              policyHours: 24,
              dueAt: "2026-05-27T08:00:00.000Z",
              hoursUntilDue: 3,
              status: "due_soon"
            }
          }
        ]
      })
    });
    const statusFetcher = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        refundNo: "REF202605260001",
        status: "approved",
        refundedAmountCents: 3990
      })
    });

    await expect(listAdminRefunds(token, listFetcher)).resolves.toEqual([
      expect.objectContaining({
        refundNo: "REF202605260001",
        status: "pending_review",
        refundableBalanceCents: 3990,
        remainingAfterRequestCents: 0,
        reviewRisk: {
          level: "medium",
          priority: "expedite",
          reason: "Request will fully refund the order"
        },
        reviewSla: {
          policyHours: 24,
          dueAt: "2026-05-27T08:00:00.000Z",
          hoursUntilDue: 3,
          status: "due_soon"
        }
      })
    ]);
    expect(listFetcher).toHaveBeenCalledWith(
      "http://localhost:3000/api/admin/refunds",
      {
        cache: "no-store",
        headers: { "X-Admin-Token": token }
      }
    );

    await expect(
      updateRefundStatus(
        "REF202605260001",
        "approved",
        "Approved",
        token,
        statusFetcher
      )
    ).resolves.toMatchObject({ status: "approved" });
    expect(statusFetcher).toHaveBeenCalledWith(
      "http://localhost:3000/api/admin/refunds/REF202605260001/status",
      {
        body: JSON.stringify({ status: "approved", note: "Approved" }),
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Token": token
        },
        method: "PATCH"
      }
    );
  });

  it("loads and moderates product reviews", async () => {
    const listFetcher = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          {
            reviewNo: "REV202605270001",
            status: "pending_review",
            rating: 5
          }
        ]
      })
    });
    const statusFetcher = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        reviewNo: "REV202605270001",
        status: "visible"
      })
    });

    await expect(listAdminReviews(token, listFetcher)).resolves.toEqual([
      expect.objectContaining({
        reviewNo: "REV202605270001",
        status: "pending_review"
      })
    ]);
    expect(listFetcher).toHaveBeenCalledWith(
      "http://localhost:3000/api/admin/reviews",
      {
        cache: "no-store",
        headers: { "X-Admin-Token": token }
      }
    );

    await expect(
      updateReviewStatus("REV202605270001", "visible", token, statusFetcher)
    ).resolves.toMatchObject({ status: "visible" });
    expect(statusFetcher).toHaveBeenCalledWith(
      "http://localhost:3000/api/admin/reviews/REV202605270001/status",
      {
        body: JSON.stringify({ status: "visible" }),
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Token": token
        },
        method: "PATCH"
      }
    );
  });

  it("loads cloud pets and community posts for operations", async () => {
    const petsFetcher = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [{ petNo: "VP001", name: "Pet One", communityPostCount: 2 }]
      })
    });
    const postsFetcher = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [{ postNo: "POST001", petName: "Pet One", status: "visible" }]
      })
    });

    await expect(listAdminCloudPets(token, petsFetcher)).resolves.toEqual([
      expect.objectContaining({ petNo: "VP001" })
    ]);
    expect(petsFetcher).toHaveBeenCalledWith(
      "http://localhost:3000/api/admin/cloud-pets",
      {
        cache: "no-store",
        headers: { "X-Admin-Token": token }
      }
    );

    await expect(listAdminCommunityPosts(token, postsFetcher)).resolves.toEqual([
      expect.objectContaining({ postNo: "POST001" })
    ]);
    expect(postsFetcher).toHaveBeenCalledWith(
      "http://localhost:3000/api/admin/community/posts",
      {
        cache: "no-store",
        headers: { "X-Admin-Token": token }
      }
    );
  });

  it("generates missing cloud-pet daily diaries from admin operations", async () => {
    const fetcher = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        date: "2026-06-03",
        generatedCount: 1,
        skippedCount: 2,
        items: [
          {
            petNo: "VP001",
            name: "Diary Pet",
            status: "generated",
            reason: "Generated today's cloud-pet diary"
          }
        ]
      })
    });

    await expect(
      generateCloudPetDailyDiaries(token, fetcher)
    ).resolves.toMatchObject({
      generatedCount: 1,
      skippedCount: 2
    });
    expect(fetcher).toHaveBeenCalledWith(
      "http://localhost:3000/api/admin/cloud-pets/daily-diaries/generate",
      {
        body: JSON.stringify({}),
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Token": token
        },
        method: "POST"
      }
    );
  });

  it("loads cloud-pet daily diary coverage status", async () => {
    const fetcher = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        date: "2026-06-03",
        totalPetCount: 2,
        generatedTodayCount: 1,
        missingTodayCount: 1,
        coverageRate: 0.5,
        items: [
          {
            petNo: "VP001",
            name: "Covered Pet",
            status: "covered",
            latestDailyDiaryAt: "2026-06-03T08:00:00.000Z"
          },
          {
            petNo: "VP002",
            name: "Missing Pet",
            status: "missing"
          }
        ]
      })
    });

    await expect(
      getCloudPetDailyDiaryStatus(token, fetcher)
    ).resolves.toMatchObject({
      generatedTodayCount: 1,
      missingTodayCount: 1,
      coverageRate: 0.5
    });
    expect(fetcher).toHaveBeenCalledWith(
      "http://localhost:3000/api/admin/cloud-pets/daily-diaries/status",
      {
        cache: "no-store",
        headers: {
          "X-Admin-Token": token
        }
      }
    );
  });

  it("loads cloud-pet daily diary coverage gaps", async () => {
    const fetcher = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        date: "2026-06-03",
        coveredCount: 2,
        missingCount: 1,
        coverageRate: 0.67,
        missingPets: [
          {
            petId: "VP002",
            petNo: "VP002",
            petName: "Missing Pet",
            memberId: "13900139995",
            memberPhone: "13900139995",
            growthLevel: 1,
            careState: "needs_care",
            lastDiaryDate: "2026-06-02",
            reason: "NO_TASK_COMPLETED"
          }
        ]
      })
    });

    await expect(
      getDailyDiaryCoverage(token, "2026-06-03", fetcher)
    ).resolves.toMatchObject({
      coveredCount: 2,
      missingPets: [expect.objectContaining({ petId: "VP002" })]
    });
    expect(fetcher).toHaveBeenCalledWith(
      "http://localhost:3000/api/admin/pets/daily-diary-coverage?date=2026-06-03",
      {
        cache: "no-store",
        headers: {
          "X-Admin-Token": token
        }
      }
    );
  });

  it("backfills cloud-pet daily diary coverage gaps", async () => {
    const fetcher = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        date: "2026-06-03",
        mode: "selected",
        attemptedCount: 1,
        successCount: 1,
        skippedCount: 0,
        failedCount: 0,
        results: [
          {
            petId: "VP002",
            petNo: "VP002",
            petName: "Missing Pet",
            status: "created",
            reason: "NO_TASK_COMPLETED"
          }
        ]
      })
    });

    await expect(
      backfillDailyDiaryCoverage(
        token,
        {
          date: "2026-06-03",
          mode: "selected",
          petIds: ["VP002"]
        },
        fetcher
      )
    ).resolves.toMatchObject({
      successCount: 1,
      results: [expect.objectContaining({ status: "created" })]
    });
    expect(fetcher).toHaveBeenCalledWith(
      "http://localhost:3000/api/admin/pets/daily-diary-coverage/backfill",
      {
        body: JSON.stringify({
          date: "2026-06-03",
          mode: "selected",
          petIds: ["VP002"]
        }),
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Token": token
        },
        method: "POST"
      }
    );
  });

  it("updates a community post moderation status", async () => {
    const fetcher = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        postNo: "POST001",
        status: "hidden"
      })
    });

    await expect(
      updateCommunityPostStatus("POST001", "hidden", token, fetcher)
    ).resolves.toMatchObject({
      postNo: "POST001",
      status: "hidden"
    });
    expect(fetcher).toHaveBeenCalledWith(
      "http://localhost:3000/api/admin/community/posts/POST001/status",
      {
        body: JSON.stringify({ status: "hidden" }),
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Token": token
        },
        method: "PATCH"
      }
    );
  });

  it("loads and resolves community reports", async () => {
    const listFetcher = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [{ reportNo: "RPT001", status: "pending_review" }]
      })
    });
    const statusFetcher = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        reportNo: "RPT001",
        status: "dismissed",
        note: "No violation"
      })
    });

    await expect(listAdminCommunityReports(token, listFetcher)).resolves.toEqual([
      expect.objectContaining({ reportNo: "RPT001" })
    ]);
    expect(listFetcher).toHaveBeenCalledWith(
      "http://localhost:3000/api/admin/community/reports",
      {
        cache: "no-store",
        headers: { "X-Admin-Token": token }
      }
    );

    await expect(
      updateCommunityReportStatus(
        "RPT001",
        "dismissed",
        "No violation",
        token,
        statusFetcher
      )
    ).resolves.toMatchObject({ status: "dismissed" });
    expect(statusFetcher).toHaveBeenCalledWith(
      "http://localhost:3000/api/admin/community/reports/RPT001/status",
      {
        body: JSON.stringify({ status: "dismissed", note: "No violation" }),
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Token": token
        },
        method: "PATCH"
      }
    );
  });

  it("loads products and orders for merchant operations", async () => {
    const productsFetcher = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          {
            slug: "durable-bite-rope",
            status: "active",
            variants: [{ skuCode: "DBR-GREEN-M", stock: 50 }]
          }
        ]
      })
    });
    const ordersFetcher = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          {
            orderNo: "KZT20260525083000",
            status: "paid",
            totalCents: 3990
          }
        ]
      })
    });

    await expect(listAdminProducts(token, productsFetcher)).resolves.toEqual([
      expect.objectContaining({ slug: "durable-bite-rope" })
    ]);
    expect(productsFetcher).toHaveBeenCalledWith(
      "http://localhost:3000/api/admin/products",
      {
        cache: "no-store",
        headers: { "X-Admin-Token": token }
      }
    );

    await expect(listAdminOrders(token, ordersFetcher)).resolves.toEqual([
      expect.objectContaining({ orderNo: "KZT20260525083000" })
    ]);
    expect(ordersFetcher).toHaveBeenCalledWith(
      "http://localhost:3000/api/admin/orders",
      {
        cache: "no-store",
        headers: { "X-Admin-Token": token }
      }
    );
  });

  it("creates a product and loads low-stock inventory signals", async () => {
    const createFetcher = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        slug: "merchant-training-ball",
        title: "Merchant training ball",
        status: "active"
      })
    });
    const lowStockFetcher = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          {
            productSlug: "merchant-training-ball",
            skuCode: "MTB-RED-S",
            stock: 3,
            threshold: 5
          }
        ]
      })
    });

    await expect(
      createAdminProduct(
        {
          slug: "merchant-training-ball",
          title: "Merchant training ball",
          description: "Created by merchant",
          petType: "dog",
          toyType: "training",
          status: "active",
          images: ["/toy.png"],
          variants: [
            {
              skuCode: "MTB-RED-S",
              name: "Red / Small",
              priceCents: 2590,
              stock: 3
            }
          ]
        },
        token,
        createFetcher
      )
    ).resolves.toMatchObject({ slug: "merchant-training-ball" });
    expect(createFetcher).toHaveBeenCalledWith(
      "http://localhost:3000/api/admin/products",
      {
        body: JSON.stringify({
          slug: "merchant-training-ball",
          title: "Merchant training ball",
          description: "Created by merchant",
          petType: "dog",
          toyType: "training",
          status: "active",
          images: ["/toy.png"],
          variants: [
            {
              skuCode: "MTB-RED-S",
              name: "Red / Small",
              priceCents: 2590,
              stock: 3
            }
          ]
        }),
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Token": token
        },
        method: "POST"
      }
    );

    await expect(listLowStockVariants(token, lowStockFetcher)).resolves.toEqual([
      expect.objectContaining({ skuCode: "MTB-RED-S", stock: 3 })
    ]);
  });

  it("updates product status, variant stock, and order fulfillment", async () => {
    const productStatusFetcher = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        slug: "durable-bite-rope",
        status: "archived"
      })
    });
    const stockFetcher = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        skuCode: "DBR-GREEN-M",
        stock: 7
      })
    });
    const shipmentFetcher = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        orderNo: "KZT20260525083000",
        status: "shipped",
        shipment: {
          carrier: "SF Express",
          trackingNumber: "SF1234567890"
        }
      })
    });

    await expect(
      updateProductStatus("durable-bite-rope", "archived", token, productStatusFetcher)
    ).resolves.toMatchObject({ status: "archived" });
    expect(productStatusFetcher).toHaveBeenCalledWith(
      "http://localhost:3000/api/admin/products/durable-bite-rope/status",
      {
        body: JSON.stringify({ status: "archived" }),
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Token": token
        },
        method: "PATCH"
      }
    );

    await expect(
      updateVariantStock("DBR-GREEN-M", 7, token, stockFetcher)
    ).resolves.toMatchObject({ stock: 7 });
    expect(stockFetcher).toHaveBeenCalledWith(
      "http://localhost:3000/api/admin/products/variants/DBR-GREEN-M/stock",
      {
        body: JSON.stringify({ stock: 7 }),
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Token": token
        },
        method: "PATCH"
      }
    );

    await expect(
      fulfillOrder(
        "KZT20260525083000",
        { carrier: "SF Express", trackingNumber: "SF1234567890" },
        token,
        shipmentFetcher
      )
    ).resolves.toMatchObject({ status: "shipped" });
    expect(shipmentFetcher).toHaveBeenCalledWith(
      "http://localhost:3000/api/admin/orders/KZT20260525083000/shipments",
      {
        body: JSON.stringify({
          carrier: "SF Express",
          trackingNumber: "SF1234567890"
        }),
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Token": token
        },
        method: "POST"
      }
    );

    const shipmentEventFetcher = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        orderNo: "KZT20260525083000",
        status: "completed",
        shipment: {
          status: "delivered",
          events: [
            {
              status: "delivered",
              location: "Shenzhen",
              description: "Signed"
            }
          ]
        }
      })
    });

    await expect(
      recordShipmentEvent(
        "KZT20260525083000",
        {
          status: "delivered",
          location: "Shenzhen",
          description: "Signed"
        },
        token,
        shipmentEventFetcher
      )
    ).resolves.toMatchObject({ status: "completed" });
    expect(shipmentEventFetcher).toHaveBeenCalledWith(
      "http://localhost:3000/api/admin/orders/KZT20260525083000/shipments/events",
      {
        body: JSON.stringify({
          status: "delivered",
          location: "Shenzhen",
          description: "Signed"
        }),
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Token": token
        },
        method: "POST"
      }
    );
  });
});

it("lists and loads admin payment ledger data", async () => {
  const listFetcher = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      items: [
        {
          id: "PAY202606190001",
          orderId: "KZT202606190001",
          memberId: "13800138000",
          amount: 3990,
          currency: "CNY",
          provider: "mock_wechat",
          status: "paid",
          idempotencyKey: "payment_intent:PAY202606190001",
          payUrl: "/mock-pay/wechat/KZT202606190001",
          createdAt: "2026-06-19T08:00:00.000Z",
          updatedAt: "2026-06-19T08:01:00.000Z",
          paidAt: "2026-06-19T08:01:00.000Z",
          orderStatus: "paid"
        }
      ]
    })
  });
  const detailFetcher = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      paymentIntent: {
        id: "PAY202606190001",
        orderId: "KZT202606190001",
        memberId: "13800138000",
        amount: 3990,
        currency: "CNY",
        provider: "mock_wechat",
        status: "paid",
        idempotencyKey: "payment_intent:PAY202606190001",
        payUrl: "/mock-pay/wechat/KZT202606190001",
        createdAt: "2026-06-19T08:00:00.000Z",
        updatedAt: "2026-06-19T08:01:00.000Z",
        paidAt: "2026-06-19T08:01:00.000Z",
        orderStatus: "paid"
      },
      ledger: [
        {
          id: "PL202606190001",
          orderId: "KZT202606190001",
          paymentIntentId: "PAY202606190001",
          memberId: "13800138000",
          type: "payment",
          direction: "credit",
          amount: 3990,
          currency: "CNY",
          provider: "mock_wechat",
          status: "success",
          eventType: "payment_confirmed",
          idempotencyKey: "payment_intent:PAY202606190001:payment_confirmed",
          createdAt: "2026-06-19T08:01:00.000Z"
        }
      ]
    })
  });

  await expect(
    listAdminPayments(
      "admin_202606190001",
      {
        orderId: "KZT202606190001",
        provider: "mock_wechat",
        status: "paid"
      },
      listFetcher
    )
  ).resolves.toEqual([
    expect.objectContaining({ id: "PAY202606190001", status: "paid" })
  ]);
  expect(listFetcher).toHaveBeenCalledWith(
    "http://localhost:3000/api/admin/payments?orderId=KZT202606190001&status=paid&provider=mock_wechat",
    {
      cache: "no-store",
      headers: {
        "X-Admin-Session": "admin_202606190001"
      }
    }
  );

  await expect(
    getAdminPayment("PAY202606190001", "admin_202606190001", detailFetcher)
  ).resolves.toMatchObject({
    paymentIntent: expect.objectContaining({ id: "PAY202606190001" }),
    ledger: [expect.objectContaining({ eventType: "payment_confirmed" })]
  });
});



it("filters overdue admin payments and expires overdue payments", async () => {
  const listFetcher = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ items: [] })
  });
  const expireFetcher = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      scannedCount: 1,
      expiredIntentCount: 1,
      closedOrderCount: 1,
      inventoryReleasedCount: 1,
      skippedCount: 0,
      failedCount: 0,
      results: [
        {
          paymentIntentId: "PAY202606190002",
          orderId: "KZT202606190002",
          status: "expired"
        }
      ]
    })
  });

  await expect(
    listAdminPayments(
      "admin_202606190001",
      { overdue: true, status: "pending" },
      listFetcher
    )
  ).resolves.toEqual([]);
  expect(listFetcher).toHaveBeenCalledWith(
    "http://localhost:3000/api/admin/payments?status=pending&overdue=true",
    {
      cache: "no-store",
      headers: {
        "X-Admin-Session": "admin_202606190001"
      }
    }
  );

  await expect(
    expireOverduePayments("admin_202606190001", { limit: 10 }, expireFetcher)
  ).resolves.toMatchObject({ expiredIntentCount: 1 });
  expect(expireFetcher).toHaveBeenCalledWith(
    "http://localhost:3000/api/admin/payments/expire-overdue",
    {
      body: JSON.stringify({ limit: 10 }),
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        "X-Admin-Session": "admin_202606190001"
      },
      method: "POST"
    }
  );
});
it("filters admin payments by failure code and loads related intents", async () => {
  const listFetcher = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      items: [
        {
          id: "PAY202606190003",
          orderId: "KZT202606190003",
          memberId: "13800138000",
          amount: 3990,
          currency: "CNY",
          provider: "mock_alipay",
          status: "failed",
          failureCode: "INSUFFICIENT_BALANCE",
          failureMessage: "The mock Alipay provider reported insufficient balance.",
          attemptNo: 1,
          idempotencyKey: "payment_intent:PAY202606190003",
          payUrl: "/mock-pay/alipay/KZT202606190003",
          createdAt: "2026-06-19T08:00:00.000Z",
          updatedAt: "2026-06-19T08:01:00.000Z",
          failedAt: "2026-06-19T08:01:00.000Z",
          orderStatus: "pending_payment",
          canRetry: true
        }
      ]
    })
  });
  const detailFetcher = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      paymentIntent: {
        id: "PAY202606190004",
        orderId: "KZT202606190004",
        memberId: "13800138000",
        amount: 3990,
        currency: "CNY",
        provider: "mock_wechat",
        status: "paid",
        attemptNo: 2,
        previousPaymentIntentId: "PAY202606190003",
        idempotencyKey: "payment_intent:PAY202606190004",
        payUrl: "/mock-pay/wechat/KZT202606190004",
        createdAt: "2026-06-19T08:02:00.000Z",
        updatedAt: "2026-06-19T08:03:00.000Z",
        paidAt: "2026-06-19T08:03:00.000Z",
        orderStatus: "paid"
      },
      ledger: [],
      relatedIntents: [
        {
          id: "PAY202606190003",
          orderId: "KZT202606190004",
          memberId: "13800138000",
          amount: 3990,
          currency: "CNY",
          provider: "mock_alipay",
          status: "failed",
          failureCode: "INSUFFICIENT_BALANCE",
          failureMessage: "The mock Alipay provider reported insufficient balance.",
          attemptNo: 1,
          idempotencyKey: "payment_intent:PAY202606190003",
          payUrl: "/mock-pay/alipay/KZT202606190004",
          createdAt: "2026-06-19T08:00:00.000Z",
          updatedAt: "2026-06-19T08:01:00.000Z",
          failedAt: "2026-06-19T08:01:00.000Z",
          orderStatus: "pending_payment"
        },
        {
          id: "PAY202606190004",
          orderId: "KZT202606190004",
          memberId: "13800138000",
          amount: 3990,
          currency: "CNY",
          provider: "mock_wechat",
          status: "paid",
          attemptNo: 2,
          previousPaymentIntentId: "PAY202606190003",
          idempotencyKey: "payment_intent:PAY202606190004",
          payUrl: "/mock-pay/wechat/KZT202606190004",
          createdAt: "2026-06-19T08:02:00.000Z",
          updatedAt: "2026-06-19T08:03:00.000Z",
          paidAt: "2026-06-19T08:03:00.000Z",
          orderStatus: "paid"
        }
      ]
    })
  });

  await expect(
    listAdminPayments(
      "admin_202606190001",
      {
        status: "failed",
        failureCode: "INSUFFICIENT_BALANCE"
      },
      listFetcher
    )
  ).resolves.toEqual([
    expect.objectContaining({ id: "PAY202606190003", failureCode: "INSUFFICIENT_BALANCE" })
  ]);
  expect(listFetcher).toHaveBeenCalledWith(
    "http://localhost:3000/api/admin/payments?status=failed&failureCode=INSUFFICIENT_BALANCE",
    {
      cache: "no-store",
      headers: {
        "X-Admin-Session": "admin_202606190001"
      }
    }
  );

  await expect(
    getAdminPayment("PAY202606190004", "admin_202606190001", detailFetcher)
  ).resolves.toMatchObject({
    relatedIntents: expect.arrayContaining([
      expect.objectContaining({ id: "PAY202606190003", status: "failed" })
    ])
  });



});
