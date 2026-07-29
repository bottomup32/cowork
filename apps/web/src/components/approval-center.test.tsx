import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApprovalCenter } from "./approval-center";

describe("ApprovalCenter", () => {
  it("shows an action preview and sends an admin decision", async () => {
    const decide = vi.fn().mockResolvedValue(undefined);
    render(<ApprovalCenter load={async () => ({ mine: [], pending: [{ id: "a1", taskId: "t1", teamId: "team", service: "gmail", action: "gmail.send", summary: "Send report", payload: { to: "client@example.com" }, risk: "ALWAYS_APPROVE", status: "PENDING", note: null, createdAt: "now", decidedAt: null, requestedBy: { displayName: "Alice" } }] })} decide={decide} />);
    expect(await screen.findByText("Send report")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "승인" }));
    await waitFor(() => expect(decide).toHaveBeenCalledWith("a1", "APPROVE"));
  });
});
