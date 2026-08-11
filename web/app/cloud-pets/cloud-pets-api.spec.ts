import {
  commentOnCommunityPost,
  createCloudPet,
  createCloudPetDiaryNote,
  deleteCloudPetDiaryNote,
  createCommunityPost,
  followCloudPet,
  getCloudPet,
  getCommunityPost,
  getCloudPetHomepageArchive,
  getCloudPetRecommendations,
  likeCommunityPost,
  listCommunityComments,
  listCommunityPosts,
  listFollowedCommunityPosts,
  reportCommunityPost,
  updateCommunityPost,
  withdrawCommunityPost,
  updateCloudPetDiaryNote,
  recordCloudPetHomepageVisit,
  updateCloudPetHomepage,
  withdrawCommunityComment
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
        "member_202607140001",
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
        headers: {
          "Content-Type": "application/json",
          "X-Member-Token": "member_202607140001"
        },
        method: "POST"
      }
    );
  });

  it("sends the member token when creating a cloud pet from a synced workspace", async () => {
    const fetcher = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        petNo: "VP202605250830000009",
        ownerName: "Session Owner",
        ownerPhone: "13800138009"
      })
    });

    await createCloudPet(
      {
        ownerName: "Session Owner",
        ownerPhone: "13800138009",
        name: "Session Pet",
        species: "dog",
        personality: "Created from a synced workspace"
      },
      "member_202607140009",
      fetcher
    );

    expect(fetcher).toHaveBeenCalledWith(
      "http://localhost:3000/api/cloud-pets",
      {
        body: JSON.stringify({
          ownerName: "Session Owner",
          ownerPhone: "13800138009",
          name: "Session Pet",
          species: "dog",
          personality: "Created from a synced workspace"
        }),
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          "X-Member-Token": "member_202607140009"
        },
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
        "member_202607140002",
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
        headers: {
          "Content-Type": "application/json",
          "X-Member-Token": "member_202607140002"
        },
        method: "PATCH"
      }
    );
  });


  it("saves an owner diary note", async () => {
    const fetcher = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        petNo: "VP202605250830000001",
        timeline: [
          {
            type: "owner_note",
            title: "Owner note for Archive Pet",
            body: "Owner noticed a calmer care rhythm today.",
            createdAt: "2026-06-03T08:00:00.000Z"
          }
        ]
      })
    });

    await expect(
      createCloudPetDiaryNote(
        "VP202605250830000001",
        { body: "Owner noticed a calmer care rhythm today." },
        "member_202607140002",
        fetcher
      )
    ).resolves.toMatchObject({
      timeline: [expect.objectContaining({ type: "owner_note" })]
    });
    expect(fetcher).toHaveBeenCalledWith(
      "http://localhost:3000/api/cloud-pets/VP202605250830000001/diary-notes",
      {
        body: JSON.stringify({ body: "Owner noticed a calmer care rhythm today." }),
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          "X-Member-Token": "member_202607140002"
        },
        method: "POST"
      }
    );
  });


  it("updates and deletes owner diary notes", async () => {
    const updateFetcher = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        petNo: "VP202605250830000001",
        timeline: [{ id: "note_001", type: "owner_note", body: "Edited note" }]
      })
    });
    const deleteFetcher = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        petNo: "VP202605250830000001",
        timeline: []
      })
    });

    await expect(
      updateCloudPetDiaryNote(
        "VP202605250830000001",
        "note_001",
        { body: "Edited note" },
        "member_202607140002",
        updateFetcher
      )
    ).resolves.toMatchObject({
      timeline: [expect.objectContaining({ body: "Edited note" })]
    });
    expect(updateFetcher).toHaveBeenCalledWith(
      "http://localhost:3000/api/cloud-pets/VP202605250830000001/diary-notes/note_001",
      {
        body: JSON.stringify({ body: "Edited note" }),
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          "X-Member-Token": "member_202607140002"
        },
        method: "PATCH"
      }
    );

    await expect(
      deleteCloudPetDiaryNote(
        "VP202605250830000001",
        "note_001",
        "member_202607140002",
        deleteFetcher
      )
    ).resolves.toMatchObject({ timeline: [] });
    expect(deleteFetcher).toHaveBeenCalledWith(
      "http://localhost:3000/api/cloud-pets/VP202605250830000001/diary-notes/note_001",
      {
        cache: "no-store",
        headers: { "X-Member-Token": "member_202607140002" },
        method: "DELETE"
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
        {
          source: "share_link",
          visitorId: "visitor_202607230001"
        },
        fetcher
      )
    ).resolves.toMatchObject({
      source: "share_link",
      visitCount: 1
    });
    expect(fetcher).toHaveBeenCalledWith(
      "http://localhost:3000/api/cloud-pets/VP202605250830000001/homepage/visits",
      {
        body: JSON.stringify({
          source: "share_link",
          visitorId: "visitor_202607230001"
        }),
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
        "member_community_001",
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
        headers: {
          "Content-Type": "application/json",
          "X-Member-Token": "member_community_001"
        },
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

  it("loads followed community posts with member auth", async () => {
    const fetcher = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [{ postNo: "POST_FOLLOWED", petNo: "VP001", body: "Followed post" }]
      })
    });

    await expect(
      listFollowedCommunityPosts("member_following_001", fetcher)
    ).resolves.toEqual([
      expect.objectContaining({ postNo: "POST_FOLLOWED" })
    ]);
    expect(fetcher).toHaveBeenCalledWith(
      "http://localhost:3000/api/community/posts/following",
      {
        cache: "no-store",
        headers: { "X-Member-Token": "member_following_001" }
      }
    );
  });

  it("loads a community post detail by its stable post number", async () => {
    const fetcher = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        postNo: "POST_DETAIL",
        petNo: "VP001",
        body: "A stable discussion link"
      })
    });

    await expect(getCommunityPost("POST_DETAIL", fetcher)).resolves.toMatchObject({
      postNo: "POST_DETAIL",
      body: "A stable discussion link"
    });
    expect(fetcher).toHaveBeenCalledWith(
      "http://localhost:3000/api/community/posts/POST_DETAIL",
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
    const listCommentsFetcher = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          { commentNo: "CMT001", authorName: "Community Owner", body: "Nice post" }
        ]
      })
    });
    const followFetcher = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        petNo: "VP001",
        following: true,
        created: true,
        followerCount: 1
      })
    });
    const reportFetcher = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ reportNo: "RPT001", status: "pending_review" })
    });

    await expect(
      likeCommunityPost(
        "POST001",
        { memberPhone: "13600136788", authorName: "Community Owner" },
        "member_community_002",
        likeFetcher
      )
    ).resolves.toMatchObject({ liked: true, likeCount: 1 });
    expect(likeFetcher).toHaveBeenCalledWith(
      "http://localhost:3000/api/community/posts/POST001/likes",
      expect.objectContaining({
        headers: {
          "Content-Type": "application/json",
          "X-Member-Token": "member_community_002"
        },
        method: "POST"
      })
    );

    await expect(
      commentOnCommunityPost(
        "POST001",
        {
          memberPhone: "13600136788",
          authorName: "Community Owner",
          body: "Nice post"
        },
        "member_community_003",
        commentFetcher
      )
    ).resolves.toMatchObject({ status: "visible" });
    await expect(
      listCommunityComments("POST001", listCommentsFetcher)
    ).resolves.toEqual([
      expect.objectContaining({ commentNo: "CMT001", body: "Nice post" })
    ]);
    expect(listCommentsFetcher).toHaveBeenCalledWith(
      "http://localhost:3000/api/community/posts/POST001/comments",
      { cache: "no-store" }
    );

    const withdrawCommentFetcher = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        commentNo: "CMT001",
        authorDeletedAt: "2026-08-11T00:00:00.000Z"
      })
    });
    await expect(
      withdrawCommunityComment(
        "CMT001",
        "member_community_003",
        withdrawCommentFetcher
      )
    ).resolves.toMatchObject({ commentNo: "CMT001" });
    expect(withdrawCommentFetcher).toHaveBeenCalledWith(
      "http://localhost:3000/api/community/comments/CMT001",
      {
        cache: "no-store",
        headers: { "X-Member-Token": "member_community_003" },
        method: "DELETE"
      }
    );

    await expect(
      followCloudPet(
        "VP001",
        { followerPhone: "13600136788", followerName: "Community Owner" },
        "member_community_004",
        followFetcher
      )
    ).resolves.toMatchObject({ following: true, created: true });
    await expect(
      reportCommunityPost(
        "POST001",
        {
          memberPhone: "13600136788",
          reporterName: "Community Owner",
          reason: "Report reason"
        },
        "member_community_005",
        reportFetcher
      )
    ).resolves.toMatchObject({ status: "pending_review" });

    const withdrawFetcher = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        postNo: "POST001",
        authorDeletedAt: "2026-08-11T00:00:00.000Z"
      })
    });

    await expect(
      withdrawCommunityPost("POST001", "member_community_006", withdrawFetcher)
    ).resolves.toMatchObject({ postNo: "POST001" });
    expect(withdrawFetcher).toHaveBeenCalledWith(
      "http://localhost:3000/api/community/posts/POST001",
      {
        cache: "no-store",
        headers: { "X-Member-Token": "member_community_006" },
        method: "DELETE"
      }
    );

    const updateFetcher = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ postNo: "POST001", body: "Updated post body" })
    });
    await expect(
      updateCommunityPost(
        "POST001",
        { body: "Updated post body" },
        "member_community_007",
        updateFetcher
      )
    ).resolves.toMatchObject({ postNo: "POST001", body: "Updated post body" });
    expect(updateFetcher).toHaveBeenCalledWith(
      "http://localhost:3000/api/community/posts/POST001",
      {
        body: JSON.stringify({ body: "Updated post body" }),
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          "X-Member-Token": "member_community_007"
        },
        method: "PATCH"
      }
    );
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
