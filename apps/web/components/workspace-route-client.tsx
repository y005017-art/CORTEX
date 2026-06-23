"use client";

import { useEffect, useState } from "react";

import { listProjects, Project } from "@/lib/api";
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
      try {
        setLoading(true);
        const projects = await listProjects();
        const match = projects.find((entry) => entry.id === projectId) ?? null;
        if (!match) {
          setError("Project not found.");
          return;
        }
        setProject(match);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load project.");
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
          <p className="empty-state">Loading workspace...</p>
        </section>
      </main>
    );
  }

  if (error || !project) {
    return (
      <main className="workspace-shell">
        <section className="panel">
          <p className="error-text">{error ?? "Project not found."}</p>
        </section>
      </main>
    );
  }

  return <WorkspaceClient project={project} />;
}
