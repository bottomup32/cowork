import type { TeamRole } from "@cowork/contracts";

export type SkillDefinition = {
  name: string;
  goal: string;
  steps: string[];
  allowedTools: string[];
  outputFormat: string;
  approvalPolicy: string;
};

export function canCreateSkill(role: TeamRole): boolean {
  return role === "SKILL_CREATOR" || role === "TEAM_ADMIN";
}

export function canPublishSkill(role: TeamRole): boolean {
  return role === "TEAM_ADMIN";
}

export function compileSkillDraft(name: string, goal: string, change?: string): SkillDefinition {
  return {
    name,
    goal: change ? `${goal}\n\nRevision: ${change}` : goal,
    steps: ["Validate the supplied inputs", "Perform the requested work in an isolated workspace", "Produce the declared output and action preview"],
    allowedTools: [],
    outputFormat: "Structured markdown report",
    approvalPolicy: "REQUIRED_FOR_EXTERNAL_WRITE",
  };
}

export function validateSkillDefinition(definition: SkillDefinition): string[] {
  const errors: string[] = [];
  if (definition.steps.length === 0) errors.push("STEPS_REQUIRED");
  if (!definition.approvalPolicy.trim()) errors.push("APPROVAL_POLICY_REQUIRED");
  return errors;
}
