import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SkillStudio } from "./skill-studio";

describe("SkillStudio", () => {
  it("creates a conversational draft for the selected creator team", async () => {
    const create = vi.fn().mockResolvedValue(undefined);
    render(<SkillStudio
      load={async () => ({ memberships: [{ teamId: "team-1", role: "SKILL_CREATOR", team: { name: "Acme" } }], drafts: [], published: [], reviews: [] })}
      create={create}
    />);
    await screen.findByText("새 Skill 만들기");
    fireEvent.change(screen.getByLabelText("Skill 이름"), { target: { value: "Invoice review" } });
    fireEvent.change(screen.getByLabelText("업무 목표"), { target: { value: "Review invoices and list exceptions." } });
    fireEvent.click(screen.getByRole("button", { name: "초안 생성" }));
    await waitFor(() => expect(create).toHaveBeenCalledWith("team-1", "Invoice review", "Review invoices and list exceptions."));
  });
});
