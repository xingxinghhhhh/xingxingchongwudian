import { listCmsSlotBlocks } from "./cms-content-api";

describe("cms content api", () => {
  it("loads published blocks for a public slot prefix", async () => {
    const fetcher = jest.fn().mockResolvedValue({
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

    await expect(listCmsSlotBlocks("homepage", fetcher)).resolves.toEqual([
      expect.objectContaining({
        blockNo: "CMS202605270001",
        slotKey: "homepage.campaign"
      })
    ]);
    expect(fetcher).toHaveBeenCalledWith(
      "http://localhost:3000/api/cms/slots/homepage",
      { cache: "no-store" }
    );
  });
});
