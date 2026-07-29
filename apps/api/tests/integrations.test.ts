import { describe, expect, it } from "vitest";
import { integrationStatus } from "../src/modules/integrations/service.js";

describe("integration configuration", () => {
  it("reports only services that have usable server configuration", () => {
    expect(integrationStatus({ NOTION_API_KEY: "secret", COMPOSIO_API_KEY: "secret", COMPOSIO_GOOGLE_AUTH_CONFIG_ID: "ac_google" })).toEqual([
      { id: "notion", name: "Notion", status: "READY", capability: "Team knowledge search" },
      { id: "google", name: "Google Docs & Sheets", status: "READY", capability: "Composio OAuth connection" },
      { id: "composio", name: "Composio", status: "READY", capability: "External tool execution" },
    ]);
    expect(integrationStatus({})).toEqual(expect.arrayContaining([expect.objectContaining({ id: "notion", status: "NEEDS_CONFIGURATION" })]));
  });
});
