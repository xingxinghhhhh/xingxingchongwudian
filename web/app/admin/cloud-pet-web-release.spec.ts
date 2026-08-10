import {
  compareCloudPetWebApiRelease,
  getCloudPetEffectiveLaunchStatus,
  getCloudPetWebReleaseAttention,
  resolveCloudPetWebRelease
} from "./cloud-pet-web-release";

describe("cloud-pet web release identity", () => {
  const apiRelease = { status: "identified" as const, id: "release-a" };

  it("normalizes a build-time release id", () => {
    expect(resolveCloudPetWebRelease(" release-a ")).toEqual({
      status: "identified",
      id: "release-a"
    });
    expect(resolveCloudPetWebRelease("")).toEqual({
      status: "unidentified",
      id: null
    });
  });

  it("compares Web and API identities without reading runtime API state", () => {
    expect(
      compareCloudPetWebApiRelease(resolveCloudPetWebRelease("release-a"), apiRelease)
    ).toBe("matched");
    expect(
      compareCloudPetWebApiRelease(resolveCloudPetWebRelease("release-b"), apiRelease)
    ).toBe("mismatch");
    expect(
      compareCloudPetWebApiRelease(resolveCloudPetWebRelease(""), apiRelease)
    ).toBe("unidentified");
  });

  it("creates local Owner attention only when the API release is authoritative", () => {
    expect(
      getCloudPetWebReleaseAttention(resolveCloudPetWebRelease("release-a"), apiRelease)
    ).toEqual([]);
    expect(
      getCloudPetWebReleaseAttention(resolveCloudPetWebRelease("release-b"), apiRelease)
    ).toEqual(["WEB_API_RELEASE_MISMATCH"]);
    expect(
      getCloudPetWebReleaseAttention(resolveCloudPetWebRelease(""), apiRelease)
    ).toEqual(["WEB_RELEASE_UNIDENTIFIED"]);
    expect(
      getCloudPetWebReleaseAttention(resolveCloudPetWebRelease(""), {
        status: "unidentified",
        id: null
      })
    ).toEqual([]);
  });

  it("tightens the Owner status without changing backend readiness", () => {
    expect(getCloudPetEffectiveLaunchStatus("passed", [])).toBe("passed");
    expect(
      getCloudPetEffectiveLaunchStatus("passed", ["WEB_API_RELEASE_MISMATCH"])
    ).toBe("needs_attention");
    expect(getCloudPetEffectiveLaunchStatus("needs_attention", [])).toBe(
      "needs_attention"
    );
  });
});
