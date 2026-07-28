import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Home from "./page";

describe("Home", () => {
  it("renders the branded workspace status in the main landmark", () => {
    render(<Home />);

    expect(screen.getByRole("main")).toHaveTextContent("Team Cowork");
    expect(screen.getByText("업무 공간을 준비하고 있습니다.")).toBeInTheDocument();
  });
});
