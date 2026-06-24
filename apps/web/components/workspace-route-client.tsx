"use client";

import { useEffect, useState } from "react";

import { WorkspaceClient } from "@/components/workspace-client";
import { listProjects, Project } from "@/lib/api";
import { getStoredToken } from "@/lib/auth";

type WorkspaceRouteClientProps = {
  projectId: string;
};

export function WorkspaceRouteClient({ projectId }: WorkspaceRouteClientProps) {
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadProject() {
      if (!getStoredToken()) {
        setError("請先登入，才能進入 CORTEX 工作台。");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const projects = await listProjects();
        const match = projects.find((entry) => entry.id === projectId) ?? null;
        if (!match) {
          setError("找不到這個專案。");
          return;
        }
        setProject(match);
      } catch (err) {
        setError(err instanceof Error ? err.message : "載入專案時發生問題。");
      } finally {
        setLoading(false);
      }
    }

    void loadProject();
  }, [projectId]);

  if (loading) {
    return (
      <main className="workspace-shell">
        <section className="surface">
          <p className="empty-state">正在載入 CORTEX 工作台...</p>
        </section>
      </main>
    );
  }

  if (error || !project) {
    return (
      <main className="workspace-shell">
        <section className="surface">
          <p className="error-text">{error ?? "找不到這個專案。"}</p>
        </section>
      </main>
    );
  }

  return <WorkspaceClient project={project} />;
}
