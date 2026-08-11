import { resolvePublicPetViewerMode } from "./public-pet-viewer-mode";

describe("resolvePublicPetViewerMode", () => {
  it("treats an anonymous visitor as a visitor", () => {
    expect(
      resolvePublicPetViewerMode({
        authStatus: "unauthenticated",
        ownedPetNos: null,
        petNo: "VP001"
      })
    ).toBe("visitor");
  });

  it("recognizes an owned pet as the owner view", () => {
    expect(
      resolvePublicPetViewerMode({
        authStatus: "authenticated",
        ownedPetNos: ["VP001"],
        petNo: "VP001"
      })
    ).toBe("owner");
  });

  it("does not identify another member's pet as owned", () => {
    expect(
      resolvePublicPetViewerMode({
        authStatus: "authenticated",
        ownedPetNos: ["VP001"],
        petNo: "VP002"
      })
    ).toBe("visitor");
  });

  it("recognizes a non-active owned pet from the full owned collection", () => {
    expect(
      resolvePublicPetViewerMode({
        authStatus: "authenticated",
        ownedPetNos: ["VP001", "VP002"],
        petNo: "VP002"
      })
    ).toBe("owner");
  });

  it("fails closed while ownership is loading", () => {
    expect(
      resolvePublicPetViewerMode({
        authStatus: "loading",
        ownedPetNos: null,
        petNo: "VP001"
      })
    ).toBe("unknown");
  });
});
