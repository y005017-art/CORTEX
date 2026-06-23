"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

import { createProject, listProjects, me, Project } from "@/lib/api";
import { AuthPanel } from "@/components/auth-panel";
import { AuthUser, clearSession, getStoredUser } from "@/lib/auth";


export function ProjectDashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadProjects() {
    if (!getStoredUser()) {
      setProjects([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await listProjects();
      setProjects(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load projects.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const stored = getStoredUser();
    if (stored) {
      setCurrentUser(stored);
      void me()
        .then((user) => setCurrentUser(user))
        .catch(() => {
          clearSession();
          setCurrentUser(null);
          setProjects([]);
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProjects();
  }, [currentUser]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) {
      setError("Project name is required.");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await createProject({
        name: name.trim(),
        description: description.trim() || undefined,
      });
      setName("");
      setDescription("");
      await loadProjects();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="dashboard-shell">
      <section className="dashboard-hero">
        <div>
          <p className="eyebrow">CORTEX Foundation</p>
          <h1>Workspace Bootstrap</h1>
          <p className="summary">
            Create a project, open its workspace, and start the first structured
            thread against the live API skeleton.
          </p>
        </div>
      </section>

      <section className="dashboard-grid">
        <div className="stack-gap">
          {currentUser ? (
            <section className="panel stack-gap">
              <div className="panel-header">
                <h2>Session</h2>
                <span>{currentUser.display_name}</span>
              </div>
              <p className="summary compact-summary">
                Authenticated as {currentUser.email}. Protected workspace routes
                are enabled.
              </p>
              <button
                className="secondary-button"
                onClick={() => {
                  clearSession();
                  setCurrentUser(null);
                  setProjects([]);
                }}
                type="button"
              >
                Sign Out
              </button>
            </section>
          ) : (
            <AuthPanel onAuthenticated={setCurrentUser} />
          )}

        <form className="panel stack-gap" onSubmit={handleSubmit}>
          <div className="panel-header">
            <h2>Create Project</h2>
            <span>Projects API</span>
          </div>

          <label className="field">
            <span>Name</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="CORTEX Core MVP"
            />
          </label>

          <label className="field">
            <span>Description</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Foundation validation or active product work"
              rows={4}
            />
          </label>

          {error ? <p className="error-text">{error}</p> : null}

          <button
            className="primary-button"
            disabled={submitting || !currentUser}
            type="submit"
          >
            {submitting ? "Creating..." : "Create Project"}
          </button>
        </form>
        </div>

        <section className="panel stack-gap">
          <div className="panel-header">
            <h2>Projects</h2>
            <span>{loading ? "Loading" : `${projects.length} total`}</span>
          </div>

          <div className="project-list">
            {loading ? <p className="empty-state">Loading projects...</p> : null}

            {!loading && currentUser && projects.length === 0 ? (
              <p className="empty-state">No projects yet. Create the first one.</p>
            ) : null}

            {!loading && !currentUser ? (
              <p className="empty-state">Sign in to load protected projects.</p>
            ) : null}

            {projects.map((project) => (
              <Link
                className="project-card"
                href={`/projects/${project.id}`}
                key={project.id}
              >
                <div className="project-card-header">
                  <strong>{project.name}</strong>
                  <span>{project.status}</span>
                </div>
                <p>{project.description || "No description yet."}</p>
              </Link>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
