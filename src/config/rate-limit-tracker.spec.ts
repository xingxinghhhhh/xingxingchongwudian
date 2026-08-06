import { resolveRateLimitTracker } from "./rate-limit-tracker";

describe("getRateLimitTracker", () => {
  it("keeps authenticated writes scoped to the member session", () => {
    expect(
      resolveRateLimitTracker(
        {
          headers: {
            "x-member-token": "member_session",
            "x-test-client-id": "browser-a"
          },
          ip: "127.0.0.1"
        },
        "test"
      )
    ).toBe("member:member_session");
  });

  it("isolates anonymous test clients without weakening production tracking", () => {
    const request = {
      headers: { "x-test-client-id": "browser-a" },
      ip: "127.0.0.1"
    };

    expect(resolveRateLimitTracker(request, "test")).toBe(
      "test-client:browser-a"
    );
    expect(resolveRateLimitTracker(request, "production")).toBe(
      "ip:127.0.0.1"
    );
  });

  it("ignores malformed test client identifiers", () => {
    expect(
      resolveRateLimitTracker(
        {
          headers: { "x-test-client-id": "invalid client id" },
          ip: "127.0.0.1"
        },
        "test"
      )
    ).toBe("ip:127.0.0.1");
  });
});
