import type { LucideIcon } from "lucide-react";

type Props = { icon: LucideIcon; title: string; description: string; status: string };

export function StatusPage({ icon: Icon, title, description, status }: Props) {
  return <section className="workspace-page status-page">
    <div className="page-heading"><h1>{title}</h1><p>{description}</p></div>
    <div className="status-card" aria-label={`Status: ${status}`}>
      <Icon aria-hidden="true" size={20} strokeWidth={1.8} />
      <span>{status}</span>
    </div>
  </section>;
}
