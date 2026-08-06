PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_VirtualPetHomepageVisit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "petId" TEXT NOT NULL,
    "petNo" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'direct',
    "visitorKey" TEXT NOT NULL,
    "visitDate" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VirtualPetHomepageVisit_petId_fkey" FOREIGN KEY ("petId") REFERENCES "VirtualPet" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "new_VirtualPetHomepageVisit" (
    "createdAt",
    "id",
    "petId",
    "petNo",
    "source",
    "visitDate",
    "visitorKey"
)
SELECT
    "createdAt",
    "id",
    "petId",
    "petNo",
    "source",
    substr("createdAt", 1, 10),
    'legacy:' || "id"
FROM "VirtualPetHomepageVisit";

DROP TABLE "VirtualPetHomepageVisit";
ALTER TABLE "new_VirtualPetHomepageVisit" RENAME TO "VirtualPetHomepageVisit";

CREATE INDEX "VirtualPetHomepageVisit_petId_idx" ON "VirtualPetHomepageVisit"("petId");
CREATE INDEX "VirtualPetHomepageVisit_petNo_idx" ON "VirtualPetHomepageVisit"("petNo");
CREATE INDEX "VirtualPetHomepageVisit_createdAt_idx" ON "VirtualPetHomepageVisit"("createdAt");
CREATE UNIQUE INDEX "VirtualPetHomepageVisit_petNo_source_visitorKey_visitDate_key"
ON "VirtualPetHomepageVisit"("petNo", "source", "visitorKey", "visitDate");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
