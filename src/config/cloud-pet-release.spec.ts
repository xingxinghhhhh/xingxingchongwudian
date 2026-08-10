import {
  CLOUD_PET_RELEASE_ID,
  resolveCloudPetReleaseId
} from "./cloud-pet-release";

describe("cloud-pet release id", () => {
  it("allows a missing release id for development and test", () => {
    expect(resolveCloudPetReleaseId({ NODE_ENV: "test" })).toBeNull();
  });

  it.each([
    "production-smoke-release",
    "cloud-pet-20260809.3",
    "4552f44"
  ])("accepts %s", (releaseId) => {
    expect(resolveCloudPetReleaseId({ [CLOUD_PET_RELEASE_ID]: releaseId })).toBe(
      releaseId
    );
  });

  it.each(["release with spaces", "release/path", "release#1", "x".repeat(81)])(
    "rejects invalid release id %s",
    (releaseId) => {
      expect(() =>
        resolveCloudPetReleaseId({ [CLOUD_PET_RELEASE_ID]: releaseId })
      ).toThrow("CLOUD_PET_RELEASE_ID");
    }
  );
});
