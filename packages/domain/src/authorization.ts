import type { TeamRole } from "@cowork/contracts";

export function canManageTeam(role: TeamRole): boolean {
  return role === "TEAM_ADMIN";
}

export function canUseProject(input: {
  teamMember: boolean;
  projectMember: boolean;
}): boolean {
  return input.teamMember && input.projectMember;
}

export function canReadPrivateTask(
  requestingUserId: string,
  taskOwnerId: string,
): boolean {
  return requestingUserId === taskOwnerId;
}
