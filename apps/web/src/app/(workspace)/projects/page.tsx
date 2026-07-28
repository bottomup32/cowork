"use client";

import { useRouter } from "next/navigation";
import { ProjectsList } from "../../../components/projects-list";

export default function ProjectsPage() {
  const router = useRouter();
  return <ProjectsList onUnauthenticated={() => router.replace("/login")} />;
}
