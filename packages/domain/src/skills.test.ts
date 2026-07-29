import { describe, expect, it } from "vitest";

import { canCreateSkill, canPublishSkill, compileSkillDraft, validateSkillDefinition } from "./skills.js";

describe("skill lifecycle", () => {
  it("limits authoring to creators and publishing to admins", () => {
    expect(canCreateSkill("MEMBER")).toBe(false);
    expect(canCreateSkill("SKILL_CREATOR")).toBe(true);
    expect(canCreateSkill("TEAM_ADMIN")).toBe(true);
    expect(canPublishSkill("SKILL_CREATOR")).toBe(false);
    expect(canPublishSkill("TEAM_ADMIN")).toBe(true);
  });

  it("compiles a deterministic, dry-run-safe definition", () => {
    const definition = compileSkillDraft("Reconcile invoices", "Compare the workbook with Notion and draft an exception report.");
    expect(definition.name).toBe("Reconcile invoices");
    expect(definition.steps).toHaveLength(3);
    expect(definition.allowedTools).toEqual([]);
    expect(definition.approvalPolicy).toBe("REQUIRED_FOR_EXTERNAL_WRITE");
    expect(validateSkillDefinition(definition)).toEqual([]);
  });

  it("blocks review when steps or approval policy are missing", () => {
    expect(validateSkillDefinition({ name: "Bad", goal: "Bad", steps: [], allowedTools: [], outputFormat: "text", approvalPolicy: "" }))
      .toEqual(["STEPS_REQUIRED", "APPROVAL_POLICY_REQUIRED"]);
  });
});
