import {
  DEFAULT_API_BODY_LIMIT_BYTES,
  MAX_API_BODY_LIMIT_BYTES,
  MIN_API_BODY_LIMIT_BYTES,
  resolveApiBodyLimit
} from "./request-body";

describe("resolveApiBodyLimit", () => {
  it("uses a conservative default when unset", () => {
    expect(resolveApiBodyLimit({})).toBe(DEFAULT_API_BODY_LIMIT_BYTES);
  });

  it("accepts integer byte overrides within the supported range", () => {
    expect(
      resolveApiBodyLimit({ API_BODY_LIMIT_BYTES: String(MIN_API_BODY_LIMIT_BYTES) })
    ).toBe(MIN_API_BODY_LIMIT_BYTES);
    expect(
      resolveApiBodyLimit({ API_BODY_LIMIT_BYTES: String(MAX_API_BODY_LIMIT_BYTES) })
    ).toBe(MAX_API_BODY_LIMIT_BYTES);
  });

  it.each(["0", "-1", "16383", "1048577", "100kb", "1mb", "1.5"]) (
    "rejects invalid API_BODY_LIMIT_BYTES=%s",
    (value) => {
      expect(() => resolveApiBodyLimit({ API_BODY_LIMIT_BYTES: value })).toThrow(
        "API_BODY_LIMIT_BYTES must be an integer"
      );
    }
  );
});
