import {
  createCloudPet,
  createCommunityPost,
  getCloudPet,
  listCommunityPosts
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
});
