import {
  cloudPetRiskReasonOptions,
  type CloudPetRiskLevel,
  type CloudPetRiskReasonCode
} from "./cloud-pet-risk";

export type CloudPetSpecies = "" | "cat" | "dog";
export type CloudPetCareState = "" | "needs_care" | "steady" | "thriving";
export type CloudPetRiskSort = "" | "risk_desc";

export type CloudPetStructuredFilters = {
  species: CloudPetSpecies;
  careState: CloudPetCareState;
  riskLevel: "" | CloudPetRiskLevel;
  riskReason: "" | CloudPetRiskReasonCode;
  sortBy: CloudPetRiskSort;
};

export const defaultCloudPetStructuredFilters: CloudPetStructuredFilters = {
  species: "",
  careState: "",
  riskLevel: "",
  riskReason: "",
  sortBy: ""
};

const cloudPetQueryKeys = [
  "q",
  "species",
  "careState",
  "riskLevel",
  "riskReason",
  "riskSort"
] as const;

function isCloudPetSpecies(value: string | null): value is Exclude<CloudPetSpecies, ""> {
  return value === "cat" || value === "dog";
}

function isCloudPetCareState(value: string | null): value is Exclude<CloudPetCareState, ""> {
  return value === "needs_care" || value === "steady" || value === "thriving";
}

function isCloudPetRiskLevel(value: string | null): value is CloudPetRiskLevel {
  return value === "high" || value === "medium" || value === "low";
}

function isCloudPetRiskReason(value: string | null): value is CloudPetRiskReasonCode {
  return cloudPetRiskReasonOptions.some((reason) => reason.code === value);
}

export function parseCloudPetFilterQuery(
  searchParams: URLSearchParams
): CloudPetStructuredFilters {
  const species = searchParams.get("species");
  const careState = searchParams.get("careState");
  const riskLevel = searchParams.get("riskLevel");
  const riskReason = searchParams.get("riskReason");

  return {
    species: isCloudPetSpecies(species) ? species : "",
    careState: isCloudPetCareState(careState) ? careState : "",
    riskLevel: isCloudPetRiskLevel(riskLevel) ? riskLevel : "",
    riskReason: isCloudPetRiskReason(riskReason) ? riskReason : "",
    sortBy: searchParams.get("riskSort") === "risk_desc" ? "risk_desc" : ""
  };
}

export function applyCloudPetFilterQuery(
  searchParams: URLSearchParams,
  filters: CloudPetStructuredFilters
) {
  const nextSearchParams = new URLSearchParams(searchParams);

  for (const key of cloudPetQueryKeys) {
    nextSearchParams.delete(key);
  }

  if (filters.species) {
    nextSearchParams.set("species", filters.species);
  }
  if (filters.careState) {
    nextSearchParams.set("careState", filters.careState);
  }
  if (filters.riskLevel) {
    nextSearchParams.set("riskLevel", filters.riskLevel);
  }
  if (filters.riskReason) {
    nextSearchParams.set("riskReason", filters.riskReason);
  }
  if (filters.sortBy) {
    nextSearchParams.set("riskSort", filters.sortBy);
  }

  return nextSearchParams;
}
