import { z } from "zod";

export const teamRoleSchema = z.enum(["MEMBER", "SKILL_CREATOR", "TEAM_ADMIN"]);
export type TeamRole = z.infer<typeof teamRoleSchema>;

export const loginInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});
export const createProjectInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
});
export const createTaskInputSchema = z.object({
  title: z.string().trim().min(1).max(160),
});
export const createMessageInputSchema = z.object({
  content: z.string().trim().min(1).max(20_000),
});
export const createSkillInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  goal: z.string().trim().min(1).max(10_000),
});
export const reviseSkillInputSchema = z.object({
  change: z.string().trim().min(1).max(10_000),
});
export const reviewSkillInputSchema = z.object({
  decision: z.enum(["APPROVE", "REJECT"]),
  note: z.string().trim().max(2_000).optional(),
});
export const requestApprovalInputSchema = z.object({
  service: z.string().trim().min(1).max(80),
  action: z.string().trim().min(1).max(160),
  summary: z.string().trim().min(1).max(2_000),
  payload: z.record(z.string(), z.unknown()).default({}),
});
export const decideApprovalInputSchema = z.object({
  decision: z.enum(["APPROVE", "REJECT"]),
  note: z.string().trim().max(2_000).optional(),
});

export type LoginInput = z.infer<typeof loginInputSchema>;
export type CreateProjectInput = z.infer<typeof createProjectInputSchema>;
export type CreateTaskInput = z.infer<typeof createTaskInputSchema>;
export type CreateMessageInput = z.infer<typeof createMessageInputSchema>;
export type CreateSkillInput = z.infer<typeof createSkillInputSchema>;
export type ReviseSkillInput = z.infer<typeof reviseSkillInputSchema>;
export type ReviewSkillInput = z.infer<typeof reviewSkillInputSchema>;
export type RequestApprovalInput = z.infer<typeof requestApprovalInputSchema>;
export type DecideApprovalInput = z.infer<typeof decideApprovalInputSchema>;
