"use client";

import { useEffect, useState } from "react";

import { listProjects, Project } from "@/lib/api";
import { getStoredToken } from "@/lib/auth";
import { WorkspaceClient } from "@/components/workspace-client";


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
        setError("請先從首頁登入，再進入工作空間。");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const projects = await listProjects();
        const match = projects.find((entry) => entry.id === projectId) ?? null;
        if (!match) {
          setError("找不到專案。");
          return;
        }
        setProject(match);
      } catch (err) {
        setError(err instanceof Error ? err.message : "載入專案失敗。");
      } finally {
        setLoading(false);
      }
    }

    void loadProject();
  }, [projectId]);

  if (loading) {
    return (
      <main className="workspace-shell">
        <section className="panel">
          <p className="empty-state">正在載入工作空間...</p>
        </section>
      </main>
    );
  }

  if (error || !project) {
    return (
      <main className="workspace-shell">
        <section className="panel">
          <p className="error-text">{error ?? "找不到專案。"}</p>
        </section>
      </main>
    );
  }

  return <WorkspaceClient project={project} />;
}
