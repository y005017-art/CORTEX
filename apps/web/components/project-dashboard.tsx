"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

import { AuthPanel } from "@/components/auth-panel";
import { createProject, listProjects, me, Project } from "@/lib/api";
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
      setError(err instanceof Error ? err.message : "讀取專案清單時發生問題。");
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
      setError("請先輸入專案名稱。");
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
      setError(err instanceof Error ? err.message : "建立專案時發生問題。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="dashboard-shell">
      <section className="hero-band">
        <div className="hero-copy">
          <p className="eyebrow">CORTEX</p>
          <h1>多角色工作 Chat 平台</h1>
          <p className="summary">
            每個角色都有自己的工作視窗，能獨立接收任務、保留上下文、累積決策與記憶。你建立的每個專案，都會變成一面可持續協作的角色工作牆。
          </p>
        </div>
        <div className="hero-stats">
          <div className="hero-stat">
            <strong>{projects.length}</strong>
            <span>專案</span>
          </div>
          <div className="hero-stat">
            <strong>{currentUser ? "已登入" : "未登入"}</strong>
            <span>目前狀態</span>
          </div>
        </div>
      </section>

      <section className="dashboard-layout">
        <div className="dashboard-rail">
          {currentUser ? (
            <section className="surface stack-gap">
              <div className="surface-header">
                <div>
                  <p className="section-kicker">帳號</p>
                  <h2>{currentUser.display_name}</h2>
                </div>
                <span className="section-meta">已登入</span>
              </div>
              <p className="surface-copy">{currentUser.email}</p>
              <button
                className="secondary-button"
                onClick={() => {
                  clearSession();
                  setCurrentUser(null);
                  setProjects([]);
                }}
                type="button"
              >
                登出
              </button>
            </section>
          ) : (
            <AuthPanel onAuthenticated={setCurrentUser} />
          )}

          <form className="surface stack-gap" onSubmit={handleSubmit}>
            <div className="surface-header">
              <div>
                <p className="section-kicker">新專案</p>
                <h2>建立角色工作牆</h2>
              </div>
              <span className="section-meta">建立後立即進入工作台</span>
            </div>

            <label className="field">
              <span>專案名稱</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="例如：CORTEX 第一階段"
              />
            </label>

            <label className="field">
              <span>專案說明</span>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="描述這個專案的目標、協作方式與邊界"
                rows={4}
              />
            </label>

            {error ? <p className="error-text">{error}</p> : null}

            <button className="primary-button" disabled={submitting || !currentUser} type="submit">
              {submitting ? "建立中..." : "建立專案"}
            </button>
          </form>
        </div>

        <section className="surface project-hub">
          <div className="surface-header">
            <div>
              <p className="section-kicker">專案列表</p>
              <h2>進入既有工作牆</h2>
            </div>
            <span className="section-meta">{loading ? "載入中" : `${projects.length} 個專案`}</span>
          </div>

          {loading ? <p className="empty-state">正在載入專案列表...</p> : null}

          {!loading && currentUser && projects.length === 0 ? (
            <p className="empty-state">目前還沒有專案，先建立第一面角色工作牆。</p>
          ) : null}

          {!loading && !currentUser ? (
            <p className="empty-state">請先登入，登入後就能建立專案並進入工作台。</p>
          ) : null}

          <div className="project-grid">
            {projects.map((project) => (
              <Link className="project-tile" href={`/projects/${project.id}`} key={project.id}>
                <div className="project-tile-head">
                  <strong>{project.name}</strong>
                  <span>{project.status}</span>
                </div>
                <p>{project.description || "尚未填寫專案說明。"}</p>
                <div className="project-tile-foot">
                  <span>進入角色工作牆</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
