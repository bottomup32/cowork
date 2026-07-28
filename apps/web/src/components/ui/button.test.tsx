import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Button } from "./button";

describe("Button", () => {
  it("renders a submit button with the primary style", () => {
    render(<Button type="submit">실행</Button>);

    const button = screen.getByRole("button", { name: "실행" });
    expect(button).toHaveAttribute("type", "submit");
    expect(button).toHaveClass("button-primary");
  });
});
