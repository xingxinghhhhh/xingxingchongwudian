-- CreateTable
CREATE TABLE "CloudPetGrowthTaskTemplate" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "rewardMood" INTEGER NOT NULL,
    "rewardEnergy" INTEGER NOT NULL,
    "rewardIntimacy" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CloudPetCareScoreConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dailyTaskBonus" INTEGER NOT NULL,
    "steadyMinScore" INTEGER NOT NULL,
    "thrivingMinScore" INTEGER NOT NULL,
    "thrivingRequiresCareToday" BOOLEAN NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
