export type User = { id: string; email: string; displayName: string };

export type Project = { id: string; name: string; teamId: string; updatedAt: string };

export type TaskSummary = {
  id: string;
  projectId: string;
  title: string;
  status: "OPEN" | "COMPLETED" | "CANCELLED";
};

export type Message = {
  id: string;
  role: "USER" | "ASSISTANT" | "SYSTEM";
  content: string;
  createdAt: string;
};

export type TaskDetail = TaskSummary & { conversation: { messages: Message[] } | null };

export type TeamMembership = {
  teamId: string;
  role: "MEMBER" | "SKILL_CREATOR" | "TEAM_ADMIN";
  team: { name: string };
};

export type SkillVersion = {
  id: string;
  version: number;
  status: "DRAFT" | "TESTED" | "REVIEW" | "PUBLISHED";
  definition: { goal: string; steps: string[]; outputFormat: string; approvalPolicy: string };
  changeNote: string;
};

export type SkillDashboard = {
  memberships: TeamMembership[];
  drafts: Array<{ id: string; teamId: string; name: string; latestVersion: SkillVersion }>;
  published: Array<{ id: string; teamId: string; name: string; activeVersion: SkillVersion }>;
  reviews: Array<{
    id: string;
    requestedBy: { displayName: string };
    skillVersion: SkillVersion & { skill: { id: string; name: string; teamId: string } };
  }>;
};

export type Approval = {
  id: string;
  taskId: string;
  teamId: string;
  service: string;
  action: string;
  summary: string;
  payload: Record<string, unknown>;
  risk: "REVERSIBLE_WRITE" | "ALWAYS_APPROVE";
  status: "PENDING" | "APPROVED" | "REJECTED" | "EXECUTED" | "CANCELLED";
  note: string | null;
  createdAt: string;
  decidedAt: string | null;
  requestedBy?: { displayName: string };
};

export type ApprovalDashboard = { mine: Approval[]; pending: Approval[] };

export type ExcelFile = {
  id: string;
  taskId: string;
  name: string;
  size: number;
  sha256: string;
  workbookSummary: { sheets: Array<{ name: string; rowCount: number; columnCount: number; preview: unknown[][] }> };
  createdAt: string;
};

export type IntegrationState = {
  id: "notion" | "google" | "composio";
  name: string;
  status: "READY" | "NEEDS_CONFIGURATION";
  capability: string;
};
