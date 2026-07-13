import {
  completeGrowthTask,
  createMemberAddress,
  getCurrentMemberProfile,
  getMemberProfile,
  loginMember,
  redeemMemberPoints
} from "./member-api";

describe("member api client", () => {
  it("loads a connected member profile", async () => {
    const fetcher = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        member: {
          phone: "13800138000",
          name: "Member Owner",
          tier: "bronze",
          points: 54
        },
        loyalty: {
          summary: {
            tier: "bronze",
            tierLabel: "Bronze companion",
            lifetimePoints: 54,
            availablePoints: 54,
            nextTier: "silver",
            pointsToNextTier: 46,
            progressPercent: 54
          },
          ledger: [
            {
              eventType: "order_purchase",
              sourceId: "KZT001",
              points: 29,
              description: "Order KZT001 purchase reward",
              createdAt: "2026-05-26T00:00:00.000Z"
            }
          ],
          rules: [
            {
              eventType: "order_purchase",
              title: "Order purchase",
              description: "Earn 1 point for every CNY 1 actually paid."
            }
          ]
        },
        pets: [{ petNo: "VP001", name: "留存小猫" }],
        orders: [{ orderNo: "KZT001", totalCents: 2990 }],
        addresses: [
          {
            addressNo: "ADDR001",
            receiverName: "Member Owner",
            phone: "13800138000",
            province: "Guangdong",
            city: "Shenzhen",
            district: "Nanshan",
            detail: "Cloud Pet Avenue 9",
            isDefault: true
          }
        ],
        defaultAddress: {
          addressNo: "ADDR001",
          receiverName: "Member Owner",
          phone: "13800138000",
          province: "Guangdong",
          city: "Shenzhen",
          district: "Nanshan",
          detail: "Cloud Pet Avenue 9",
          isDefault: true
        },
        communityPosts: [{ postNo: "POST001", petNo: "VP001" }],
        recommendations: [{ slug: "cat-teaser-wand" }],
        personalizedRecommendations: [
          {
            type: "product",
            targetId: "cat-teaser-wand",
            title: "Cat teaser wand set",
            score: 98,
            reasonCodes: ["pet_profile_match"]
          }
        ],
        personalizationSummary: {
          petCount: 1,
          orderCount: 1,
          communitySignalCount: 1,
          homepageVisitCount: 2,
          reviewCount: 0,
          cmsSignalCount: 1,
          topReasonCodes: ["pet_profile_match"]
        },
        growthTasks: [{ key: "daily-care", title: "每日陪伴" }]
      })
    });

    await expect(getMemberProfile("13800138000", fetcher)).resolves.toMatchObject({
      member: {
        phone: "13800138000",
        points: 54
      },
      loyalty: {
        summary: {
          availablePoints: 54,
          nextTier: "silver"
        },
        ledger: [
          expect.objectContaining({
            eventType: "order_purchase",
            points: 29
          })
        ]
      },
      pets: [expect.objectContaining({ name: "留存小猫" })],
      addresses: [expect.objectContaining({ isDefault: true })],
      defaultAddress: expect.objectContaining({
        detail: "Cloud Pet Avenue 9"
      }),
      personalizedRecommendations: [
        expect.objectContaining({
          type: "product",
          reasonCodes: ["pet_profile_match"]
        })
      ],
      personalizationSummary: {
        homepageVisitCount: 2,
        cmsSignalCount: 1
      }
    });
    expect(fetcher).toHaveBeenCalledWith(
      "http://localhost:3000/api/members/13800138000",
      { cache: "no-store" }
    );
  });

  it("logs in a member and stores the session token contract", async () => {
    const fetcher = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        sessionToken: "member_202605260001",
        member: {
          name: "Session Owner",
          phone: "13600136000"
        }
      })
    });

    await expect(
      loginMember(
        {
          name: "Session Owner",
          phone: "13600136000"
        },
        fetcher
      )
    ).resolves.toMatchObject({
      sessionToken: "member_202605260001",
      member: {
        phone: "13600136000"
      }
    });
    expect(fetcher).toHaveBeenCalledWith(
      "http://localhost:3000/api/auth/login",
      {
        body: JSON.stringify({
          name: "Session Owner",
          phone: "13600136000"
        }),
        cache: "no-store",
        headers: {
          "Content-Type": "application/json"
        },
        method: "POST"
      }
    );
  });

  it("creates a member address book entry", async () => {
    const fetcher = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        addressNo: "ADDR202606020001",
        receiverName: "Member Owner",
        phone: "13800138000",
        province: "Guangdong",
        city: "Shenzhen",
        district: "Nanshan",
        detail: "Cloud Pet Avenue 9",
        isDefault: true
      })
    });

    await expect(
      createMemberAddress(
        "13800138000",
        {
          receiverName: "Member Owner",
          phone: "13800138000",
          province: "Guangdong",
          city: "Shenzhen",
          district: "Nanshan",
          detail: "Cloud Pet Avenue 9",
          isDefault: true
        },
        fetcher
      )
    ).resolves.toMatchObject({
      addressNo: "ADDR202606020001",
      isDefault: true
    });
    expect(fetcher).toHaveBeenCalledWith(
      "http://localhost:3000/api/members/13800138000/addresses",
      {
        body: JSON.stringify({
          receiverName: "Member Owner",
          phone: "13800138000",
          province: "Guangdong",
          city: "Shenzhen",
          district: "Nanshan",
          detail: "Cloud Pet Avenue 9",
          isDefault: true
        }),
        cache: "no-store",
        headers: {
          "Content-Type": "application/json"
        },
        method: "POST"
      }
    );
  });

  it("redeems member points for a checkout coupon", async () => {
    const fetcher = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        redemptionNo: "LPR2026060300010001",
        rewardKey: "points-coupon-8",
        couponCode: "POINTS8",
        pointsCost: 80,
        discountCents: 800,
        remainingPoints: 24,
        status: "issued"
      })
    });

    await expect(
      redeemMemberPoints(
        "13800138000",
        {
          rewardKey: "points-coupon-8"
        },
        fetcher
      )
    ).resolves.toMatchObject({
      couponCode: "POINTS8",
      remainingPoints: 24
    });
    expect(fetcher).toHaveBeenCalledWith(
      "http://localhost:3000/api/members/13800138000/points/redemptions",
      {
        body: JSON.stringify({
          rewardKey: "points-coupon-8"
        }),
        cache: "no-store",
        headers: {
          "Content-Type": "application/json"
        },
        method: "POST"
      }
    );
  });

  it("loads the current member profile from a session token", async () => {
    const fetcher = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        member: {
          phone: "13600136000",
          name: "Session Owner",
          tier: "bronze",
          points: 25
        },
        loyalty: {
          summary: {
            tier: "bronze",
            tierLabel: "Bronze companion",
            lifetimePoints: 25,
            availablePoints: 25,
            nextTier: "silver",
            pointsToNextTier: 75,
            progressPercent: 25
          },
          ledger: [],
          rules: []
        },
        pets: [{ petNo: "VP001", name: "Session Pet" }],
        orders: [],
        communityPosts: [],
        recommendations: [],
        personalizedRecommendations: [],
        personalizationSummary: {
          petCount: 1,
          orderCount: 0,
          communitySignalCount: 0,
          homepageVisitCount: 0,
          reviewCount: 0,
          cmsSignalCount: 0,
          topReasonCodes: []
        },
        growthTasks: []
      })
    });

    await expect(
      getCurrentMemberProfile("member_202605260001", fetcher)
    ).resolves.toMatchObject({
      member: {
        phone: "13600136000"
      }
    });
    expect(fetcher).toHaveBeenCalledWith(
      "http://localhost:3000/api/members/me",
      {
        cache: "no-store",
        headers: {
          "X-Member-Token": "member_202605260001"
        }
      }
    );
  });

  it("completes a pet growth task", async () => {
    const fetcher = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        completedTask: {
          key: "daily-care",
          points: 20
        },
        pet: {
          petNo: "VP001",
          stats: {
            mood: 80,
            energy: 72,
            intimacy: 25
          }
        },
        nextActions: [
          {
            key: "shop-reward",
            title: "Use the mall reward",
            href: "/shop",
            ctaLabel: "Visit shop"
          }
        ]
      })
    });

    await expect(
      completeGrowthTask("VP001", "daily-care", fetcher)
    ).resolves.toMatchObject({
      completedTask: {
        key: "daily-care"
      },
      pet: {
        stats: {
          intimacy: 25
        }
      },
      nextActions: [
        expect.objectContaining({
          key: "shop-reward",
          href: "/shop"
        })
      ]
    });
    expect(fetcher).toHaveBeenCalledWith(
      "http://localhost:3000/api/cloud-pets/VP001/growth-tasks/daily-care/complete",
      {
        cache: "no-store",
        method: "POST"
      }
    );
  });
});
