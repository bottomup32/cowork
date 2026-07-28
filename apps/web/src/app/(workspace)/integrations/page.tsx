import { Plug } from "lucide-react";
import { StatusPage } from "../../../components/status-page";
export default function IntegrationsPage() { return <section className="workspace-page integrations-page"><div className="page-heading"><h1>Integrations</h1><p>Connections will be available in a future product slice.</p></div><div className="integration-grid">{["Notion", "Google Workspace", "Composio"].map((name) => <StatusPage key={name} icon={Plug} title={name} description="" status={"\uC5F0\uACB0 \uC900\uBE44 \uC911"} />)}</div></section>; }
