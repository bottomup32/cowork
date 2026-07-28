import { describe, expect, it } from "vitest";
import { canManageTeam, canReadPrivateTask, canUseProject } from "./authorization.js";

describe("authorization", () => {
  it("allows only TEAM_ADMIN to manage a team", () => {
    expect(canManageTeam("TEAM_ADMIN")).toBe(true);
    expect(canManageTeam("SKILL_CREATOR")).toBe(false);
    expect(canManageTeam("MEMBER")).toBe(false);
  });

  it("requires both team and project membership to use a project", () => {
    expect(canUseProject({ teamMember: true, projectMember: true })).toBe(true);
    expect(canUseProject({ teamMember: true, projectMember: false })).toBe(false);
    expect(canUseProject({ teamMember: false, projectMember: true })).toBe(false);
  });

  it("allows only the owner to read a private task", () => {
    expect(canReadPrivateTask("user-a", "user-a")).toBe(true);
    expect(canReadPrivateTask("user-b", "user-a")).toBe(false);
  });
});
