export type ActionRisk = "READ" | "REVERSIBLE_WRITE" | "ALWAYS_APPROVE";

const alwaysApprove = ["gmail.send", "email.send", "delete", "permission", "accounting.write", "overwrite_original"];

export function classifyAction(action: string): ActionRisk {
  const normalized = action.toLowerCase();
  if (alwaysApprove.some((value) => normalized.includes(value))) return "ALWAYS_APPROVE";
  if (/(create|update|write|move|rename|append|upload)/.test(normalized)) return "REVERSIBLE_WRITE";
  return "READ";
}
