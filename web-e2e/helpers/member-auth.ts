import {
  APIRequestContext,
  expect,
  Page
} from "@playwright/test";

const API_BASE = "http://localhost:3000/api";

export async function isolateMemberAuthTestClient(page: Page, phone: string) {
  await page.context().setExtraHTTPHeaders({
    "X-Test-Client-Id": getMemberAuthTestClientId(phone)
  });
}

export async function verifyMemberInCloudPetWorkspace(
  page: Page,
  input: { name: string; phone: string }
) {
  await isolateMemberAuthTestClient(page, input.phone);
  await page.getByTestId("cloud-member-name").fill(input.name);
  await page.getByTestId("cloud-member-phone").fill(input.phone);
  await page.getByTestId("cloud-member-request-code").click();
  await expect(page.getByTestId("cloud-member-code")).toHaveValue(/^\d{6}$/);
  await page.getByTestId("cloud-member-sync").click();
}

export async function loginAsVerifiedMember(
  request: APIRequestContext,
  input: { name: string; phone: string }
) {
  const headers = {
    "X-Test-Client-Id": getMemberAuthTestClientId(input.phone)
  };
  const challengeResponse = await request.post(
    `${API_BASE}/auth/verification-codes`,
    { data: input, headers }
  );
  expect(challengeResponse.ok()).toBeTruthy();
  const challenge = await challengeResponse.json();
  expect(challenge.developmentCode).toMatch(/^\d{6}$/);

  const loginResponse = await request.post(`${API_BASE}/auth/login`, {
    data: {
      challengeId: challenge.challengeId,
      code: challenge.developmentCode
    },
    headers
  });
  expect(loginResponse.ok()).toBeTruthy();

  return loginResponse.json() as Promise<{
    sessionToken: string;
    member: { name: string; phone: string };
  }>;
}

function getMemberAuthTestClientId(phone: string) {
  return `member-${phone}`;
}
