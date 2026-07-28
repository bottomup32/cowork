import { cleanup, render, screen } from "@testing-library/react";
import { CircleAlert } from "lucide-react";
import { afterEach, describe, expect, it } from "vitest";

import { StatusPage } from "./status-page";

describe("StatusPage", () => {
  afterEach(cleanup);
  it("renders semantic content and no unavailable action", () => {
    render(<StatusPage icon={CircleAlert} title="Approvals" description="Risk approvals are the next product slice." status="No approvals are waiting." />);
    expect(screen.getByRole("heading", { name: "Approvals" })).toBeInTheDocument();
    expect(screen.getByText("Risk approvals are the next product slice.")).toBeInTheDocument();
    expect(screen.getByLabelText("Status: No approvals are waiting.")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
