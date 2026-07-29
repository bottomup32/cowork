import { Composio } from "@composio/core";
import { Client as NotionClient } from "@notionhq/client";

type Environment = Record<string, string | undefined>;
export type IntegrationProvider = "notion" | "google";
export type IntegrationState = { id: "notion" | "google" | "composio"; name: string; status: "READY" | "NEEDS_CONFIGURATION"; capability: string };

export function integrationStatus(environment: Environment): IntegrationState[] {
  const composioReady = Boolean(environment.COMPOSIO_API_KEY);
  return [
    { id: "notion", name: "Notion", status: environment.NOTION_API_KEY ? "READY" : "NEEDS_CONFIGURATION", capability: "Team knowledge search" },
    { id: "google", name: "Google Docs & Sheets", status: composioReady && environment.COMPOSIO_GOOGLE_AUTH_CONFIG_ID ? "READY" : "NEEDS_CONFIGURATION", capability: "Composio OAuth connection" },
    { id: "composio", name: "Composio", status: composioReady ? "READY" : "NEEDS_CONFIGURATION", capability: "External tool execution" },
  ];
}

export interface IntegrationPort {
  status(): IntegrationState[];
  connect(provider: IntegrationProvider, userId: string): Promise<{ redirectUrl: string }>;
  searchNotion(query: string): Promise<Array<{ id: string; object: string; url?: string; lastEditedTime?: string }>>;
}

export class ConfiguredIntegrations implements IntegrationPort {
  private readonly composio: Composio | null;
  private readonly notion: NotionClient | null;

  constructor(private readonly environment: Environment, private readonly callbackUrl: string) {
    this.composio = environment.COMPOSIO_API_KEY ? new Composio({ apiKey: environment.COMPOSIO_API_KEY }) : null;
    this.notion = environment.NOTION_API_KEY ? new NotionClient({ auth: environment.NOTION_API_KEY, notionVersion: "2026-03-11" }) : null;
  }

  status() { return integrationStatus(this.environment); }

  async connect(provider: IntegrationProvider, userId: string) {
    if (!this.composio) throw new Error("COMPOSIO_NOT_CONFIGURED");
    const authConfigId = provider === "google" ? this.environment.COMPOSIO_GOOGLE_AUTH_CONFIG_ID : this.environment.COMPOSIO_NOTION_AUTH_CONFIG_ID;
    if (!authConfigId) throw new Error("AUTH_CONFIG_NOT_CONFIGURED");
    const request = await this.composio.connectedAccounts.link(userId, authConfigId, { callbackUrl: this.callbackUrl });
    if (!request.redirectUrl) throw new Error("CONNECT_URL_UNAVAILABLE");
    return { redirectUrl: request.redirectUrl };
  }

  async searchNotion(query: string) {
    if (!this.notion) throw new Error("NOTION_NOT_CONFIGURED");
    const response = await this.notion.search({ query, page_size: 20 });
    return response.results.map((result) => ({
      id: result.id,
      object: result.object,
      ...("url" in result && typeof result.url === "string" ? { url: result.url } : {}),
      ...("last_edited_time" in result && typeof result.last_edited_time === "string" ? { lastEditedTime: result.last_edited_time } : {}),
    }));
  }
}
