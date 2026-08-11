export type PublicPetViewerMode = "owner" | "visitor" | "unknown";

export type PublicPetAuthStatus =
  | "authenticated"
  | "unauthenticated"
  | "loading";

export interface ResolvePublicPetViewerModeInput {
  authStatus: PublicPetAuthStatus;
  ownedPetNos: Iterable<string> | null;
  petNo: string;
}

export function resolvePublicPetViewerMode({
  authStatus,
  ownedPetNos,
  petNo
}: ResolvePublicPetViewerModeInput): PublicPetViewerMode {
  if (authStatus === "unauthenticated") {
    return "visitor";
  }

  if (authStatus === "loading" || ownedPetNos === null) {
    return "unknown";
  }

  return Array.from(ownedPetNos).includes(petNo) ? "owner" : "visitor";
}
