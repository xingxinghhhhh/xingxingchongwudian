type RateLimitRequest = {
  headers?: Record<string, string | string[] | undefined>;
  ip?: string;
};

const testClientIdPattern = /^[a-zA-Z0-9:_-]{1,80}$/;

export function getRateLimitTracker(request: RateLimitRequest) {
  return resolveRateLimitTracker(request, process.env.NODE_ENV);
}

export function resolveRateLimitTracker(
  request: RateLimitRequest,
  environment: string | undefined
) {
  const sessionToken = firstHeaderValue(
    request.headers?.["x-member-token"]
  );

  if (sessionToken) {
    return `member:${sessionToken}`;
  }

  const testClientId = firstHeaderValue(
    request.headers?.["x-test-client-id"]
  );

  if (
    environment === "test" &&
    testClientId &&
    testClientIdPattern.test(testClientId)
  ) {
    return `test-client:${testClientId}`;
  }

  return `ip:${request.ip ?? "unknown"}`;
}

function firstHeaderValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
