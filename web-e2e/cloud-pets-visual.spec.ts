import { APIRequestContext, expect, Page, test } from "@playwright/test";
import path from "node:path";
import { loginAsVerifiedMember } from "./helpers/member-auth";

const API_BASE = "http://localhost:3000/api";
const VISUAL_SNAPSHOT_STYLES = path.join(__dirname, "visual-snapshot.css");

async function createVisualBaselinePet(
  request: APIRequestContext,
  input: { phonePrefix: string; petName: string }
) {
  const runId = Date.now().toString().slice(-8);
  const phone = `${input.phonePrefix}${runId}`;
  const ownerName = `Visual Owner ${runId}`;
  const login = await loginAsVerifiedMember(request, { name: ownerName, phone });
  const headers = { "X-Member-Token": login.sessionToken };
  const createResponse = await request.post(`${API_BASE}/cloud-pets`, {
    data: {
      ownerName,
      ownerPhone: phone,
      name: input.petName,
      species: "cat",
      personality: "温柔、好奇，喜欢每天被陪伴"
    },
    headers
  });
  expect(createResponse.ok()).toBeTruthy();
  const pet = (await createResponse.json()) as { petNo: string };

  const homepageResponse = await request.patch(
    `${API_BASE}/cloud-pets/${pet.petNo}/homepage`,
    {
      data: {
        headline: `${input.petName}的成长主页`,
        ownerStory: "记录每天的照护、心情与温暖成长。",
        showGrowthArchive: false,
        showMallRecommendations: false,
        theme: "forest"
      },
      headers
    }
  );
  expect(homepageResponse.ok()).toBeTruthy();

  return pet.petNo;
}

async function expectPublicProfileVisualBaseline(
  page: Page,
  request: APIRequestContext,
  input: { phonePrefix: string; petName: string; snapshotName: string }
) {
  const petNo = await createVisualBaselinePet(request, input);
  await page.goto(`/cloud-pets/${petNo}`);

  const profile = page.getByTestId("pet-public-profile");
  const petImage = profile.getByRole("img", { name: input.petName });
  await expect(profile).toBeVisible();
  await expect(petImage).toBeVisible();
  await expect
    .poll(() =>
      petImage.evaluate(
        (image: HTMLImageElement) => image.complete && image.naturalWidth > 0
      )
    )
    .toBe(true);

  await expect(profile).toHaveScreenshot(input.snapshotName, {
    animations: "disabled",
    mask: [
      page.getByTestId("pet-public-pet-no"),
      page.getByTestId("pet-public-share-url"),
      page.getByTestId("pet-public-visit-count")
    ],
    maskColor: "#d9d4ce",
    maxDiffPixelRatio: 0.01,
    threshold: 0.3,
    stylePath: VISUAL_SNAPSHOT_STYLES
  });
}

test("public cloud pet homepage matches the desktop visual baseline", async ({
  page,
  request
}) => {
  await expectPublicProfileVisualBaseline(page, request, {
    petName: "星河",
    phonePrefix: "132",
    snapshotName: "cloud-pet-public-profile-desktop.png"
  });
});

test.describe("public cloud pet homepage mobile visual baseline", () => {
  test.use({
    isMobile: true,
    viewport: { width: 390, height: 844 }
  });

  test("matches the 390x844 visual baseline", async ({ page, request }) => {
    await expectPublicProfileVisualBaseline(page, request, {
      petName: "晨光",
      phonePrefix: "133",
      snapshotName: "cloud-pet-public-profile-mobile.png"
    });
  });
});
