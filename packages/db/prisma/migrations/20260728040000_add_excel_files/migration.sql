CREATE TABLE "FileAsset" (
  "id" TEXT NOT NULL, "taskId" TEXT NOT NULL, "ownerId" TEXT NOT NULL,
  "name" TEXT NOT NULL, "mediaType" TEXT NOT NULL, "size" INTEGER NOT NULL,
  "sha256" TEXT NOT NULL, "content" BYTEA NOT NULL, "workbookSummary" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FileAsset_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "FileAsset_taskId_createdAt_idx" ON "FileAsset"("taskId", "createdAt");
CREATE INDEX "FileAsset_ownerId_createdAt_idx" ON "FileAsset"("ownerId", "createdAt");
ALTER TABLE "FileAsset" ADD CONSTRAINT "FileAsset_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FileAsset" ADD CONSTRAINT "FileAsset_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
