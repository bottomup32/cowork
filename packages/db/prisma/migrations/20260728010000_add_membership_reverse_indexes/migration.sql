-- Support user-scoped project and team authorization lookups.
CREATE INDEX "TeamMembership_userId_teamId_idx" ON "TeamMembership"("userId", "teamId");

CREATE INDEX "ProjectMember_userId_projectId_idx" ON "ProjectMember"("userId", "projectId");
