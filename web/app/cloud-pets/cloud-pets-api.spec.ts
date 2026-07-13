import {
  commentOnCommunityPost,
  createCloudPet,
  createCommunityPost,
  followCloudPet,
  getCloudPet,
  getCloudPetHomepageArchive,
  getCloudPetRecommendations,
  likeCommunityPost,
  listCommunityPosts,
  reportCommunityPost,
  recordCloudPetHomepageVisit,
  updateCloudPetHomepage
} from "./cloud-pets-api";

describe("cloud pets api client", () => {
  it("creates a custom cloud pet through the API", async () => {
    const fetcher = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        petNo: "VP202605250830000001",
        name: "小奶球",
        species: "cat",
        stats: { mood: 72, energy: 68, intimacy: 15 }
      })
    });

    await expect(
      createCloudPet(
        {
          ownerName: "Demo Owner",
          ownerPhone: "13800138000",
          name: "小奶球",
          species: "cat",
          personality: "嘴硬但会偷偷靠近"
        },
        fetcher
      )
    ).resolves.toMatchObject({
      petNo: "VP202605250830000001",
      name: "小奶球"
    });
    expect(fetcher).toHaveBeenCalledWith(
      "http://localhost:3000/api/cloud-pets",
      {
        body: JSON.stringify({
          ownerName: "Demo Owner",
          ownerPhone: "13800138000",
          name: "小奶球",
          species: "cat",
          personality: "嘴硬但会偷偷靠近"
        }),
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        method: "POST"
      }
    );
  });

  it("loads a pet dedicated homepage profile", async () => {
    const fetcher = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        petNo: "VP202605250830000001",
        name: "小奶球",
        timeline: [{ title: "小奶球来到这个小家" }]
      })
    });

    await expect(
      getCloudPet("VP202605250830000001", fetcher)
    ).resolves.toMatchObject({
      petNo: "VP202605250830000001",
      timeline: [expect.objectContaining({ title: "小奶球来到这个小家" })]
    });
    expect(fetcher).toHaveBeenCalledWith(
      "http://localhost:3000/api/cloud-pets/VP202605250830000001",
      { cache: "no-store" }
    );
  });

  it("updates a pet dedicated homepage builder profile", async () => {
    const fetcher = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        petNo: "VP202605250830000001",
        homepage: {
          theme: "forest",
          headline: "Builder Pet's warm little homepage",
          ownerStory: "Every visit should feel like a fresh growth archive.",
          showGrowthArchive: false,
          showMallRecommendations: true
        }
      })
    });

    await expect(
      updateCloudPetHomepage(
        "VP202605250830000001",
        {
          theme: "forest",
          headline: "Builder Pet's warm little homepage",
          ownerStory: "Every visit should feel like a fresh growth archive.",
          showGrowthArchive: false,
          showMallRecommendations: true
        },
        fetcher
      )
    ).resolves.toMatchObject({
      homepage: {
        theme: "forest",
        showGrowthArchive: false
      }
    });
    expect(fetcher).toHaveBeenCalledWith(
      "http://localhost:3000/api/cloud-pets/VP202605250830000001/homepage",
      {
        body: JSON.stringify({
          theme: "forest",
          headline: "Builder Pet's warm little homepage",
          ownerStory: "Every visit should feel like a fresh growth archive.",
          showGrowthArchive: false,
          showMallRecommendations: true
        }),
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        method: "PATCH"
      }
    );
  });

  it("loads a pet homepage archive with share metadata", async () => {
    const fetcher = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        petNo: "VP202605250830000001",
        share: {
          title: "Archive Pet's growth archive",
          description: "A public timeline for daily care and memories.",
          url: "/cloud-pets/VP202605250830000001",
          ctaLabel: "Open pet homepage"
        },
        commerceReward: {
          status: "unlocked",
          couponCode: "WELCOME20",
          discountCents: 2000,
          ctaHref: "/shop",
          recommendedProductSlug: "durable-bite-rope"
        },
        filters: [
          { key: "all", label: "All", count: 2 },
          { key: "growth_task", label: "Growth tasks", count: 1 }
        ],
        items: [
          {
            type: "growth_task",
            title: "Completed daily care",
            body: "Daily care completed",
            createdAt: "2026-05-31T00:00:00.000Z"
          }
        ]
      })
    });

    await expect(
      getCloudPetHomepageArchive(
        "VP202605250830000001",
        { eventType: "growth_task" },
        fetcher
      )
    ).resolves.toMatchObject({
      share: {
        url: "/cloud-pets/VP202605250830000001"
      },
      commerceReward: {
        status: "unlocked",
        couponCode: "WELCOME20"
      },
      items: [expect.objectContaining({ type: "growth_task" })]
    });
    expect(fetcher).toHaveBeenCalledWith(
      "http://localhost:3000/api/cloud-pets/VP202605250830000001/homepage/archive?eventType=growth_task",
      { cache: "no-store" }
    );
  });

  it("records a pet homepage visit signal", async () => {
    const fetcher = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        petNo: "VP202605250830000001",
        source: "share_link",
        visitCount: 1
      })
    });

    await expect(
      recordCloudPetHomepageVisit(
        "VP202605250830000001",
        { source: "share_link" },
        fetcher
      )
    ).resolves.toMatchObject({
      source: "share_link",
      visitCount: 1
    });
    expect(fetcher).toHaveBeenCalledWith(
      "http://localhost:3000/api/cloud-pets/VP202605250830000001/homepage/visits",
      {
        body: JSON.stringify({ source: "share_link" }),
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        method: "POST"
      }
    );
  });

  it("creates and lists community posts", async () => {
    const createFetcher = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        postNo: "POST202605250830000001",
        petName: "年糕糕",
        body: "今天主动分享玩具。"
      })
    });
    const listFetcher = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          {
            postNo: "POST202605250830000001",
            petName: "年糕糕",
            body: "今天主动分享玩具。"
          }
        ]
      })
    });

    await expect(
      createCommunityPost(
        {
          petNo: "VP202605250830000001",
          authorName: "Demo Owner",
          body: "今天主动分享玩具。"
        },
        createFetcher
      )
    ).resolves.toMatchObject({ petName: "年糕糕" });
    expect(createFetcher).toHaveBeenCalledWith(
      "http://localhost:3000/api/community/posts",
      {
        body: JSON.stringify({
          petNo: "VP202605250830000001",
          authorName: "Demo Owner",
          body: "今天主动分享玩具。"
        }),
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        method: "POST"
      }
    );

    await expect(listCommunityPosts(listFetcher)).resolves.toEqual([
      expect.objectContaining({ petName: "年糕糕" })
    ]);
    expect(listFetcher).toHaveBeenCalledWith(
      "http://localhost:3000/api/community/posts",
      { cache: "no-store" }
    );
  });

  it("runs community engagement actions", async () => {
    const likeFetcher = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ postNo: "POST001", liked: true, likeCount: 1 })
    });
    const commentFetcher = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ commentNo: "CMT001", status: "visible" })
    });
    const followFetcher = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ petNo: "VP001", following: true, followerCount: 1 })
    });
    const reportFetcher = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ reportNo: "RPT001", status: "pending_review" })
    });

    await expect(
      likeCommunityPost(
        "POST001",
        { memberPhone: "13600136788", authorName: "Community Owner" },
        likeFetcher
      )
    ).resolves.toMatchObject({ liked: true, likeCount: 1 });
    expect(likeFetcher).toHaveBeenCalledWith(
      "http://localhost:3000/api/community/posts/POST001/likes",
      expect.objectContaining({ method: "POST" })
    );

    await expect(
      commentOnCommunityPost(
        "POST001",
        {
          memberPhone: "13600136788",
          authorName: "Community Owner",
          body: "Nice post"
        },
        commentFetcher
      )
    ).resolves.toMatchObject({ status: "visible" });
    await expect(
      followCloudPet(
        "VP001",
        { followerPhone: "13600136788", followerName: "Community Owner" },
        followFetcher
      )
    ).resolves.toMatchObject({ following: true });
    await expect(
      reportCommunityPost(
        "POST001",
        {
          memberPhone: "13600136788",
          reporterName: "Community Owner",
          reason: "Report reason"
        },
        reportFetcher
      )
    ).resolves.toMatchObject({ status: "pending_review" });
  });

  it("loads product recommendations for a cloud pet", async () => {
    const fetcher = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          {
            slug: "cat-teaser-wand",
            petType: "cat",
            reason: "适合小奶球的猫猫互动需求"
          }
        ]
      })
    });

    await expect(
      getCloudPetRecommendations("VP202605250830000001", fetcher)
    ).resolves.toEqual([
      expect.objectContaining({
        slug: "cat-teaser-wand",
        reason: "适合小奶球的猫猫互动需求"
      })
    ]);
    expect(fetcher).toHaveBeenCalledWith(
      "http://localhost:3000/api/cloud-pets/VP202605250830000001/recommendations",
      { cache: "no-store" }
    );
  });
});
