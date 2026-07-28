"use client";

import { use } from "react";
import { TaskWorkspace } from "../../../../components/task-workspace";

export default function TaskPage({ params }: { params: Promise<{ taskId: string }> }) {
  return <TaskWorkspace taskId={use(params).taskId} />;
}
