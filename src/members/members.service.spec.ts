import { CloudPetsService } from "../cloud-pets/cloud-pets.service";
import { CmsService } from "../cms/cms.service";
import { CommunityService } from "../community/community.service";
import { CustomersService } from "../customers/customers.service";
import { LoyaltyService } from "../loyalty/loyalty.service";
import { MarketingService } from "../marketing/marketing.service";
import { NotificationsService } from "../notifications/notifications.service";
import { OrdersService } from "../orders/orders.service";
import { PersonalizationService } from "../personalization/personalization.service";
import { ReviewsService } from "../reviews/reviews.service";
import { MembersService } from "./members.service";

describe("MembersService", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it("returns member task activity with streaks and a recent calendar", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-05-26T10:00:00.000Z"));

    const cloudPetsService = {
      listPetsByOwnerPhone: jest.fn().mockResolvedValue([
        {
          petNo: "VP001",
          ownerName: "Activity Owner",
          stats: { intimacy: 25 }
        }
      ]),
      getRecommendations: jest.fn().mockResolvedValue([]),
      listGrowthTasks: jest.fn().mockReturnValue([
        { key: "daily-care", title: "Daily care", points: 20 },
        { key: "community-share", title: "Community share", points: 30 },
        { key: "shop-gift", title: "Shop gift", points: 40 }
      ]),
      listTaskCompletionsByOwnerPhone: jest.fn().mockResolvedValue([
        {
          petNo: "VP001",
          taskKey: "daily-care",
          completedDate: "2026-05-26",
          createdAt: "2026-05-26T10:00:00.000Z"
        },
        {
          petNo: "VP001",
          taskKey: "community-share",
          completedDate: "2026-05-25",
          createdAt: "2026-05-25T10:00:00.000Z"
        },
        {
          petNo: "VP001",
          taskKey: "shop-gift",
          completedDate: "2026-05-23",
          createdAt: "2026-05-23T10:00:00.000Z"
        }
      ]),
      countHomepageVisitsByOwnerPhone: jest.fn().mockResolvedValue(0)
    };
    const communityService = {
      listAdminPosts: jest.fn().mockResolvedValue([]),
      getEngagementByMemberPhone: jest.fn().mockResolvedValue({
        likedPostCount: 0,
        commentCount: 0,
        followingPetCount: 0,
        reportCount: 0
      })
    };
    const ordersService = {
      listOrdersByCustomerPhone: jest.fn().mockResolvedValue([])
    };
    const reviewsService = {
      listReviewsByCustomerPhone: jest.fn().mockResolvedValue([])
    };
    const cmsService = {
      listPublishedBlocksBySlotPrefix: jest.fn().mockResolvedValue([])
    };
    const customersService = {
      listAddresses: jest.fn().mockReturnValue([])
    };
    const marketingService = {
      registerIssuedCoupon: jest.fn()
    };
    const service = new MembersService(
      cloudPetsService as unknown as CloudPetsService,
      communityService as unknown as CommunityService,
      ordersService as unknown as OrdersService,
      new LoyaltyService(),
      reviewsService as unknown as ReviewsService,
      new NotificationsService(),
      cmsService as unknown as CmsService,
      new PersonalizationService(),
      customersService as unknown as CustomersService,
      marketingService as unknown as MarketingService
    );

    await expect(service.getProfile("13600136005")).resolves.toMatchObject({
      member: {
        tier: "silver",
        points: 115
      },
      loyalty: {
        summary: {
          tier: "silver",
          lifetimePoints: 115,
          availablePoints: 115,
          nextTier: "gold",
          pointsToNextTier: 185,
          progressPercent: 8
        },
        ledger: expect.arrayContaining([
          expect.objectContaining({
            eventType: "growth_task",
            points: 20,
            sourceId: "VP001:daily-care:2026-05-26"
          }),
          expect.objectContaining({
            eventType: "pet_bond",
            points: 25,
            sourceId: "VP001"
          })
        ])
      },
      commercePlan: {
        tierProgress: {
          currentTier: "silver",
          nextTier: "gold",
          pointsToNextTier: 185,
          progressPercent: 8
        },
        benefits: expect.arrayContaining([
          expect.objectContaining({
            key: "welcome-gift",
            unlocked: true,
            href: "/shop"
          })
        ]),
        nextBestActions: expect.arrayContaining([
          expect.objectContaining({
            key: "continue-streak",
            href: "/member"
          })
        ])
      },
      taskActivity: {
        totalCompletedTasks: 3,
        activeDays: 3,
        currentStreakDays: 2,
        longestStreakDays: 2,
        nextMilestone: {
          targetDays: 3,
          remainingDays: 1
        },
        calendar: expect.arrayContaining([
          {
            date: "2026-05-26",
            completedCount: 1,
            taskKeys: ["daily-care"]
          },
          {
            date: "2026-05-25",
            completedCount: 1,
            taskKeys: ["community-share"]
          }
        ])
      },
      notifications: expect.arrayContaining([
        expect.objectContaining({
          type: "coupon_available",
          actionHref: "/shop"
        }),
        expect.objectContaining({
          type: "growth_task_completed",
          sourceId: "VP001"
        })
      ]),
      reviews: [],
      personalizedRecommendations: expect.any(Array),
      personalizationSummary: {
        petCount: 1,
        orderCount: 0,
        communitySignalCount: 0,
        reviewCount: 0,
        cmsSignalCount: 0,
        topReasonCodes: expect.any(Array)
      },
      communityEngagement: {
        likedPostCount: 0,
        commentCount: 0,
        followingPetCount: 0,
        reportCount: 0
      }
    });
  });
});
