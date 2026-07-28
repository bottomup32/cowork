export type User = { id: string; email: string; displayName: string };

export type Project = { id: string; name: string; teamId: string; updatedAt: string };

export type TaskSummary = {
  id: string;
  projectId: string;
  title: string;
  status: "OPEN" | "COMPLETED" | "CANCELLED";
};

export type Message = {
  id: string;
  role: "USER" | "ASSISTANT" | "SYSTEM";
  content: string;
  createdAt: string;
};

export type TaskDetail = TaskSummary & { conversation: { messages: Message[] } | null };
