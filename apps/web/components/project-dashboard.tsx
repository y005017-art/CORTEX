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
      setError(err instanceof Error ? err.message : "載入專案失敗。");
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
      setError("專案名稱為必填。");
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
      setError(err instanceof Error ? err.message : "建立專案失敗。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="dashboard-shell">
      <section className="dashboard-hero">
        <div>
          <p className="eyebrow">CORTEX 基礎版</p>
          <h1>工作平台入口</h1>
          <p className="summary">
            建立專案、進入工作空間，並從第一個結構化聊天視窗開始推進工作。
          </p>
        </div>
      </section>

      <section className="dashboard-grid">
        <div className="stack-gap">
          {currentUser ? (
            <section className="panel stack-gap">
              <div className="panel-header">
                <h2>登入狀態</h2>
                <span>{currentUser.display_name}</span>
              </div>
              <p className="summary compact-summary">
                目前登入帳號為 {currentUser.email}。已可使用受保護的工作空間功能。
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
                登出
              </button>
            </section>
          ) : (
            <AuthPanel onAuthenticated={setCurrentUser} />
          )}

          <form className="panel stack-gap" onSubmit={handleSubmit}>
            <div className="panel-header">
              <h2>建立專案</h2>
              <span>專案管理</span>
            </div>

            <label className="field">
              <span>名稱</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="CORTEX 核心 MVP"
              />
            </label>

            <label className="field">
              <span>描述</span>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="可填入目前目標、驗證內容或正在進行的產品工作"
                rows={4}
              />
            </label>

            {error ? <p className="error-text">{error}</p> : null}

            <button
              className="primary-button"
              disabled={submitting || !currentUser}
              type="submit"
            >
              {submitting ? "建立中..." : "建立專案"}
            </button>
          </form>
        </div>

        <section className="panel stack-gap">
          <div className="panel-header">
            <h2>專案清單</h2>
            <span>{loading ? "載入中" : `共 ${projects.length} 個`}</span>
          </div>

          <div className="project-list">
            {loading ? <p className="empty-state">正在載入專案...</p> : null}

            {!loading && currentUser && projects.length === 0 ? (
              <p className="empty-state">目前還沒有專案，先建立第一個專案。</p>
            ) : null}

            {!loading && !currentUser ? (
              <p className="empty-state">請先登入以讀取受保護的專案。</p>
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
                <p>{project.description || "尚未填寫描述。"}</p>
              </Link>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
