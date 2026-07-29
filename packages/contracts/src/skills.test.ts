import { describe, expect, it } from "vitest";

import {
  createSkillInputSchema,
  reviewSkillInputSchema,
  reviseSkillInputSchema,
} from "./index.js";

describe("skill contracts", () => {
  it("accepts concise natural-language skill drafts and revisions", () => {
    expect(createSkillInputSchema.parse({ name: "Invoice review", goal: "Review invoices and produce an exception report." })).toEqual({
      name: "Invoice review",
      goal: "Review invoices and produce an exception report.",
    });
    expect(reviseSkillInputSchema.parse({ change: "Require approval before sending email." })).toEqual({
      change: "Require approval before sending email.",
    });
  });

  it("rejects empty drafts and invalid review decisions", () => {
    expect(createSkillInputSchema.safeParse({ name: "", goal: "" }).success).toBe(false);
    expect(reviewSkillInputSchema.safeParse({ decision: "MAYBE" }).success).toBe(false);
  });
});
