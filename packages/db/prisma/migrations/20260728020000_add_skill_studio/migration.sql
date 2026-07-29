CREATE TYPE "SkillVersionStatus" AS ENUM ('DRAFT', 'TESTED', 'REVIEW', 'PUBLISHED');
CREATE TYPE "SkillReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "Skill" (
  "id" TEXT NOT NULL,
  "teamId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "activeVersionId" TEXT,
  "disabledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Skill_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SkillVersion" (
  "id" TEXT NOT NULL,
  "skillId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "status" "SkillVersionStatus" NOT NULL DEFAULT 'DRAFT',
  "definition" JSONB NOT NULL,
  "changeNote" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SkillVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SkillTestRun" (
  "id" TEXT NOT NULL,
  "skillVersionId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "passed" BOOLEAN NOT NULL,
  "result" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SkillTestRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SkillReview" (
  "id" TEXT NOT NULL,
  "skillVersionId" TEXT NOT NULL,
  "requestedById" TEXT NOT NULL,
  "reviewedById" TEXT,
  "status" "SkillReviewStatus" NOT NULL DEFAULT 'PENDING',
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  CONSTRAINT "SkillReview_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Skill_activeVersionId_key" ON "Skill"("activeVersionId");
CREATE INDEX "Skill_teamId_updatedAt_idx" ON "Skill"("teamId", "updatedAt");
CREATE INDEX "Skill_createdById_updatedAt_idx" ON "Skill"("createdById", "updatedAt");
CREATE UNIQUE INDEX "SkillVersion_skillId_version_key" ON "SkillVersion"("skillId", "version");
CREATE INDEX "SkillVersion_skillId_createdAt_idx" ON "SkillVersion"("skillId", "createdAt");
CREATE INDEX "SkillTestRun_skillVersionId_createdAt_idx" ON "SkillTestRun"("skillVersionId", "createdAt");
CREATE INDEX "SkillReview_skillVersionId_status_idx" ON "SkillReview"("skillVersionId", "status");

ALTER TABLE "Skill" ADD CONSTRAINT "Skill_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Skill" ADD CONSTRAINT "Skill_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Skill" ADD CONSTRAINT "Skill_activeVersionId_fkey" FOREIGN KEY ("activeVersionId") REFERENCES "SkillVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SkillVersion" ADD CONSTRAINT "SkillVersion_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SkillVersion" ADD CONSTRAINT "SkillVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SkillTestRun" ADD CONSTRAINT "SkillTestRun_skillVersionId_fkey" FOREIGN KEY ("skillVersionId") REFERENCES "SkillVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SkillTestRun" ADD CONSTRAINT "SkillTestRun_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SkillReview" ADD CONSTRAINT "SkillReview_skillVersionId_fkey" FOREIGN KEY ("skillVersionId") REFERENCES "SkillVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SkillReview" ADD CONSTRAINT "SkillReview_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SkillReview" ADD CONSTRAINT "SkillReview_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
