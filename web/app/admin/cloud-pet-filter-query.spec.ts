import {
  applyCloudPetFilterQuery,
  applyCloudPetSelectedPetNo,
  buildCloudPetSharePath,
  defaultCloudPetStructuredFilters,
  parseCloudPetFilterQuery,
  parseCloudPetSelectedPetNo,
  CloudPetStructuredFilters
} from "./cloud-pet-filter-query";

describe("cloud pet filter query", () => {
  it("uses defaults when the URL has no cloud pet filters", () => {
    expect(parseCloudPetFilterQuery(new URLSearchParams())).toEqual(
      defaultCloudPetStructuredFilters
    );
  });

  it("round-trips every structured filter without serializing text search", () => {
    const filters: CloudPetStructuredFilters = {
      species: "cat",
      careState: "needs_care",
      riskLevel: "high",
      riskReason: "care_incomplete_today",
      sortBy: "risk_desc"
    };

    const searchParams = applyCloudPetFilterQuery(
      new URLSearchParams("existingParam=keep&q=private-search"),
      filters
    );

    expect(searchParams.get("existingParam")).toBe("keep");
    expect(searchParams.has("q")).toBe(false);
    expect(parseCloudPetFilterQuery(searchParams)).toEqual(filters);
  });

  it("falls back to defaults for invalid and duplicate values", () => {
    const searchParams = new URLSearchParams(
      "species=cat&species=dog&careState=unknown&riskLevel=bad&riskReason=bad&riskSort=bad"
    );

    expect(parseCloudPetFilterQuery(searchParams)).toEqual({
      ...defaultCloudPetStructuredFilters,
      species: "cat"
    });
  });

  it("omits default values while retaining unrelated query parameters", () => {
    const searchParams = applyCloudPetFilterQuery(
      new URLSearchParams("reportStatus=pending_review&riskLevel=high"),
      defaultCloudPetStructuredFilters
    );

    expect(searchParams.toString()).toBe("reportStatus=pending_review");
  });

  it("round-trips a selected pet number without adding text search", () => {
    const searchParams = applyCloudPetSelectedPetNo(
      new URLSearchParams("riskReason=care_incomplete_today&q=private-search"),
      " VP123 "
    );

    expect(searchParams.get("riskReason")).toBe("care_incomplete_today");
    expect(searchParams.get("q")).toBe("private-search");
    expect(parseCloudPetSelectedPetNo(searchParams)).toBe("VP123");
  });

  it("uses the first selected pet number and clears it without touching other queries", () => {
    const searchParams = new URLSearchParams(
      "petNo=VP123&petNo=VP456&species=cat&other=keep"
    );

    expect(parseCloudPetSelectedPetNo(searchParams)).toBe("VP123");
    expect(
      applyCloudPetSelectedPetNo(searchParams, null).toString()
    ).toBe("species=cat&other=keep");
  });

  it("builds a share path from only the cloud-pet URL allowlist", () => {
    const filters: CloudPetStructuredFilters = {
      species: "cat",
      careState: "needs_care",
      riskLevel: "high",
      riskReason: "care_incomplete_today",
      sortBy: "risk_desc"
    };

    const path = buildCloudPetSharePath("/admin", filters, " VP123 ");
    const url = new URL(path, "https://merchant.example.test");

    expect(url.pathname).toBe("/admin");
    expect(url.hash).toBe("#admin-cloud-pets");
    expect(url.searchParams.get("species")).toBe("cat");
    expect(url.searchParams.get("careState")).toBe("needs_care");
    expect(url.searchParams.get("riskLevel")).toBe("high");
    expect(url.searchParams.get("riskReason")).toBe("care_incomplete_today");
    expect(url.searchParams.get("riskSort")).toBe("risk_desc");
    expect(url.searchParams.get("petNo")).toBe("VP123");
    expect(url.searchParams.has("q")).toBe(false);
    expect(url.searchParams.has("unknown")).toBe(false);
  });

  it("omits defaults and detail when building a general share path", () => {
    expect(
      buildCloudPetSharePath("/admin", defaultCloudPetStructuredFilters, null)
    ).toBe("/admin#admin-cloud-pets");
  });
});
