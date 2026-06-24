import { FormEvent, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import type {
  AuthSession,
  BootstrapConfig,
  ChatSession,
  ConstitutionRule,
  Decision,
  DesktopRequest,
  Memory,
  PaneDefinition,
  Project,
  ViewStatus,
} from "./types";

type LayoutPaneId = "primary" | "secondary";
type BottomTab = "cowork" | "logs" | "handover";

const ACTIVITY_ITEMS = [
  { id: "workspace", label: "工作台", icon: "WB" },
  { id: "search", label: "搜尋", icon: "SR" },
  { id: "graph", label: "流程", icon: "FL" },
  { id: "shield", label: "治理", icon: "GV" },
  { id: "notes", label: "記錄", icon: "NT" },
] as const;

const STATUS_COLORS: Record<ViewStatus["state"], string> = {
  loading: "is-loading",
  ready: "is-ready",
  failed: "is-failed",
};

function providerLabel(session: ChatSession): string {
  const provider = (session.provider_site || "").toLowerCase();
  if (provider === "chatgpt") {
    return "ChatGPT (Web)";
  }
  if (provider === "claude") {
    return "Claude (Web)";
  }
  if (provider === "gemini") {
    return "Gemini (Web)";
  }
  if (provider === "perplexity") {
    return "Perplexity (Web)";
  }
  if (session.workspace_url?.includes("chatgpt")) {
    return "ChatGPT (Web)";
  }
  if (session.workspace_url?.includes("claude")) {
    return "Claude (Web)";
  }
  if (session.workspace_url?.includes("gemini")) {
    return "Gemini (Web)";
  }
  if (session.workspace_url?.includes("perplexity")) {
    return "Perplexity (Web)";
  }
  return "External Workspace";
}

function roleStatus(status?: ViewStatus): string {
  if (!status) {
    return "待命";
  }
  if (status.state === "ready") {
    return "Working";
  }
  if (status.state === "loading") {
    return "載入中";
  }
  return "異常";
}

function decisionTone(status: string): string {
  const normalized = status.toLowerCase();
  if (normalized === "approved") {
    return "decision-approved";
  }
  if (normalized === "pending" || normalized === "proposed") {
    return "decision-pending";
  }
  return "decision-neutral";
}

function formatClock(value: string): string {
  return new Intl.DateTimeFormat("zh-TW", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

async function request<T>(payload: DesktopRequest): Promise<T> {
  return window.cortexDesktop.request<T>(payload);
}

export function App() {
  const [bootstrap, setBootstrap] = useState<BootstrapConfig | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [rules, setRules] = useState<ConstitutionRule[]>([]);
  const [viewStatuses, setViewStatuses] = useState<Record<string, ViewStatus>>({});
  const [activeSidebar, setActiveSidebar] = useState<(typeof ACTIVITY_ITEMS)[number]["id"]>("workspace");
  const [bottomTab, setBottomTab] = useState<BottomTab>("cowork");
  const [primarySessionId, setPrimarySessionId] = useState("");
  const [secondarySessionId, setSecondarySessionId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isLoadingWorkspace, setIsLoadingWorkspace] = useState(false);
  const primaryViewportRef = useRef<HTMLDivElement | null>(null);
  const secondaryViewportRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    void window.cortexDesktop.getBootstrap().then((config) => {
      setBootstrap(config);
      setEmail(config.defaultEmail);
      setPassword(config.defaultPassword);
      setSelectedProjectId(config.defaultProjectId);
      setToken(config.presetToken);
    });
  }, []);

  useEffect(() => {
    const unsubscribe = window.cortexDesktop.onViewStatus((status) => {
      setViewStatuses((current) => ({
        ...current,
        [status.sessionId]: status,
      }));
    });

    void window.cortexDesktop.getViewStatuses().then((statuses) => {
      setViewStatuses(Object.fromEntries(statuses.map((entry) => [entry.sessionId, entry])));
    });

    return unsubscribe;
  }, []);

  const bindableSessions = useMemo(
    () =>
      sessions
        .filter((session) => Boolean(session.workspace_url))
        .sort((left, right) => left.title.localeCompare(right.title, "en")),
    [sessions]
  );

  useEffect(() => {
    if (bindableSessions.length === 0) {
      setPrimarySessionId("");
      setSecondarySessionId("");
      return;
    }

    setPrimarySessionId((current) => current || bindableSessions[0].id);
    setSecondarySessionId((current) => current || bindableSessions[1]?.id || bindableSessions[0].id);
  }, [bindableSessions]);

  const primarySession = bindableSessions.find((session) => session.id === primarySessionId) ?? null;
  const secondarySession = bindableSessions.find((session) => session.id === secondarySessionId) ?? null;
  const activeProject = projects.find((project) => project.id === selectedProjectId) ?? null;
  const activeViewCount = bindableSessions.filter((session) => viewStatuses[session.id]?.state === "ready").length;
  const activeSidebarLabel = ACTIVITY_ITEMS.find((item) => item.id === activeSidebar)?.label ?? "工作台";

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!bootstrap) {
      return;
    }

    try {
      setIsAuthenticating(true);
      setError(null);
      const session = await request<AuthSession>({
        baseUrl: bootstrap.apiBaseUrl,
        path: "/auth/login",
        method: "POST",
        body: { email, password },
      });
      setToken(session.token);
      setMessage(`已連線到桌面工作台：${session.user.display_name}`);
      const nextProjects = await request<Project[]>({
        baseUrl: bootstrap.apiBaseUrl,
        path: "/projects",
        token: session.token,
      });
      setProjects(nextProjects);
      if (!selectedProjectId && nextProjects[0]) {
        setSelectedProjectId(nextProjects[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "登入失敗");
    } finally {
      setIsAuthenticating(false);
    }
  }

  async function loadWorkspace() {
    if (!bootstrap || !token || !selectedProjectId) {
      return;
    }

    try {
      setIsLoadingWorkspace(true);
      setError(null);
      const [sessionData, decisionData, memoryData, ruleData] = await Promise.all([
        request<ChatSession[]>({
          baseUrl: bootstrap.apiBaseUrl,
          path: `/projects/${selectedProjectId}/chat-sessions`,
          token,
        }),
        request<Decision[]>({
          baseUrl: bootstrap.apiBaseUrl,
          path: `/projects/${selectedProjectId}/decisions`,
          token,
        }),
        request<Memory[]>({
          baseUrl: bootstrap.apiBaseUrl,
          path: `/projects/${selectedProjectId}/memories`,
          token,
        }),
        request<ConstitutionRule[]>({
          baseUrl: bootstrap.apiBaseUrl,
          path: "/constitution/rules",
          token,
        }),
      ]);
      setSessions(sessionData);
      setDecisions(decisionData);
      setMemories(memoryData);
      setRules(ruleData);
      setMessage(`已載入 ${sessionData.length} 個角色工作視窗`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "載入工作台失敗");
    } finally {
      setIsLoadingWorkspace(false);
    }
  }

  useEffect(() => {
    if (bootstrap?.presetToken && !projects.length) {
      void request<Project[]>({
        baseUrl: bootstrap.apiBaseUrl,
        path: "/projects",
        token: bootstrap.presetToken,
      })
        .then((nextProjects) => {
          setProjects(nextProjects);
          if (!selectedProjectId && (bootstrap.defaultProjectId || nextProjects[0]?.id)) {
            setSelectedProjectId(bootstrap.defaultProjectId || nextProjects[0]!.id);
          }
        })
        .catch(() => {});
    }
  }, [bootstrap, projects.length, selectedProjectId]);

  useEffect(() => {
    if (token && selectedProjectId) {
      void loadWorkspace();
    }
  }, [token, selectedProjectId]);

  function buildPaneDefinitions(): PaneDefinition[] {
    const panes: PaneDefinition[] = [];

    const collectPane = (paneId: LayoutPaneId, session: ChatSession | null, element: HTMLDivElement | null) => {
      if (!session || !session.workspace_url || !element) {
        return;
      }
      const rect = element.getBoundingClientRect();
      panes.push({
        paneId,
        sessionId: session.id,
        title: session.title,
        workspaceUrl: session.workspace_url,
        bounds: {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        },
      });
    };

    collectPane("primary", primarySession, primaryViewportRef.current);
    collectPane("secondary", secondarySession, secondaryViewportRef.current);

    return panes;
  }

  useLayoutEffect(() => {
    const sync = () => {
      window.cortexDesktop.syncViews(buildPaneDefinitions());
    };

    sync();
    const observer = new ResizeObserver(sync);
    if (primaryViewportRef.current) {
      observer.observe(primaryViewportRef.current);
    }
    if (secondaryViewportRef.current) {
      observer.observe(secondaryViewportRef.current);
    }
    window.addEventListener("resize", sync);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", sync);
    };
  }, [primarySession, secondarySession, sessions]);

  const workspaceTree = useMemo(
    () => [
      {
        title: "chat_sessions",
        items: bindableSessions.map((session) => `${session.title}.session`),
      },
      {
        title: "memory",
        items: ["snapshot.index", "locked.memories"],
      },
      {
        title: "constitution",
        items: ["ruleset.yaml"],
      },
      {
        title: "handover",
        items: ["next-step.md"],
      },
    ],
    [bindableSessions]
  );

  return (
    <main className="desktop-shell">
      <header className="window-frame">
        <div className="window-title">
          <div className="app-cube">C</div>
          <span>CORTEX Workspace</span>
        </div>
        <div className="window-controls">
          <span />
          <span />
          <span />
        </div>
      </header>

      {message ? <p className="status-banner">{message}</p> : null}
      {error ? <p className="error-banner">{error}</p> : null}

      <section className="workbench-shell">
        <aside className="activity-bar">
          <div className="activity-logo">CX</div>
          <div className="activity-stack">
            {ACTIVITY_ITEMS.map((item) => (
              <button
                aria-label={item.label}
                className={item.id === activeSidebar ? "activity-button is-active" : "activity-button"}
                key={item.id}
                onClick={() => setActiveSidebar(item.id)}
                type="button"
              >
                <span>{item.icon}</span>
              </button>
            ))}
          </div>
          <div className="activity-stack footer">
            <button className="activity-button" type="button">
              <span>ME</span>
            </button>
            <button className="activity-button" type="button">
              <span>ST</span>
            </button>
          </div>
        </aside>

        <aside className="sidebar-column">
          <div className="sidebar-section brand-section">
            <div className="sidebar-label">{activeSidebarLabel}</div>
            <div className="project-title">CORTEX</div>
          </div>

          {!token ? (
            <form className="sidebar-section auth-section" onSubmit={handleLogin}>
              <div className="sidebar-heading-row">
                <strong>桌面登入</strong>
                <span>Desktop Session</span>
              </div>
              <label className="sidebar-field">
                <span>帳號</span>
                <input value={email} onChange={(event) => setEmail(event.target.value)} />
              </label>
              <label className="sidebar-field">
                <span>密碼</span>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </label>
              <button className="primary-button" disabled={isAuthenticating} type="submit">
                {isAuthenticating ? "連線中..." : "登入工作台"}
              </button>
            </form>
          ) : null}

          <section className="sidebar-section roles-section">
            <div className="sidebar-heading-row">
              <strong>LOADED ROLES</strong>
              <div className="sidebar-actions">
                <button className="tiny-icon-button" onClick={() => void loadWorkspace()} type="button">
                  ↻
                </button>
              </div>
            </div>
            <div className="role-cards">
              {bindableSessions.map((session) => {
                const status = viewStatuses[session.id];
                const isSelected = primarySessionId === session.id || secondarySessionId === session.id;
                return (
                  <button
                    className={isSelected ? "role-card is-selected" : "role-card"}
                    key={session.id}
                    onClick={() => {
                      setPrimarySessionId(session.id);
                      if (secondarySessionId === session.id) {
                        const fallback = bindableSessions.find((entry) => entry.id !== session.id);
                        setSecondarySessionId(fallback?.id ?? session.id);
                      }
                    }}
                    type="button"
                  >
                    <div className="role-card-top">
                      <div className="role-avatar">{session.title.slice(0, 1)}</div>
                      <strong>{session.title}</strong>
                      <span className={`mini-status ${status ? STATUS_COLORS[status.state] : ""}`}>
                        {roleStatus(status)}
                      </span>
                    </div>
                    <div className="role-card-sub">
                      <span>{providerLabel(session)}</span>
                      <span className="external-mark">↗</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="sidebar-section tree-section">
            <div className="sidebar-heading-row">
              <strong>WORKSPACE</strong>
              <span>{activeProject?.name ?? "未選擇專案"}</span>
            </div>
            <div className="workspace-tree">
              {workspaceTree.map((group) => (
                <div className="tree-group" key={group.title}>
                  <div className="tree-title">{group.title}</div>
                  {group.items.map((item) => (
                    <div className="tree-item" key={item}>
                      {item}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </section>

          <section className="sidebar-section status-section">
            <div className="sidebar-heading-row">
              <strong>STATUS</strong>
              <span>{isLoadingWorkspace ? "同步中" : "已就緒"}</span>
            </div>
            <div className="status-grid">
              <div className="status-row">
                <span>Active Roles</span>
                <strong>
                  {activeViewCount} / {bindableSessions.length}
                </strong>
              </div>
              <div className="status-row">
                <span>CoWork Channel</span>
                <strong>{bottomTab === "cowork" ? "Online" : "Standby"}</strong>
              </div>
              <div className="status-row">
                <span>Memory Sync</span>
                <strong>{memories.length > 0 ? "OK" : "待建立"}</strong>
              </div>
              <div className="status-row">
                <span>Project</span>
                <select
                  className="inline-project-select"
                  value={selectedProjectId}
                  onChange={(event) => setSelectedProjectId(event.target.value)}
                >
                  <option value="">選擇專案</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>
        </aside>

        <section className="editor-column">
          <div className="tab-bar">
            {bindableSessions.map((session) => {
              const status = viewStatuses[session.id];
              return (
                <button
                  className={session.id === primarySessionId ? "tab-button is-active" : "tab-button"}
                  key={session.id}
                  onClick={() => setPrimarySessionId(session.id)}
                  type="button"
                >
                  <span className={`tab-dot ${status ? STATUS_COLORS[status.state] : ""}`} />
                  <span>{session.title}.chat</span>
                </button>
              );
            })}
            <button className="tab-button add-button" type="button">
              <span>+</span>
            </button>
          </div>

          <div className="pane-split">
            <section className="workspace-pane">
              <div className="pane-toolbar">
                <div className="pane-toolbar-title">
                  <strong>{primarySession?.title ?? "角色工作視窗"} / Chat Workspace</strong>
                  <div className="pane-toolbar-sub">
                    <span className={`pane-status-badge ${STATUS_COLORS[viewStatuses[primarySession?.id ?? ""]?.state ?? "loading"]}`}>
                      {primarySession ? roleStatus(viewStatuses[primarySession.id]) : "待選擇"}
                    </span>
                    <span>{primarySession ? providerLabel(primarySession) : "尚未綁定"}</span>
                  </div>
                </div>
                <div className="pane-toolbar-actions">
                  {primarySession ? (
                    <button
                      className="toolbar-button"
                      onClick={() => window.cortexDesktop.refreshView(primarySession.id)}
                      type="button"
                    >
                      重新載入
                    </button>
                  ) : null}
                </div>
              </div>
              <div className="pane-surface">
                <div className="pane-viewport" ref={primaryViewportRef}>
                  {!primarySession ? <div className="viewport-placeholder">選擇左側角色以載入真實工作視窗</div> : null}
                </div>
              </div>
            </section>

            <section className="workspace-pane">
              <div className="pane-toolbar">
                <div className="pane-toolbar-title">
                  <strong>{secondarySession?.title ?? "角色工作視窗"} / Chat Workspace</strong>
                  <div className="pane-toolbar-sub">
                    <span className={`pane-status-badge ${STATUS_COLORS[viewStatuses[secondarySession?.id ?? ""]?.state ?? "loading"]}`}>
                      {secondarySession ? roleStatus(viewStatuses[secondarySession.id]) : "待選擇"}
                    </span>
                    <span>{secondarySession ? providerLabel(secondarySession) : "尚未綁定"}</span>
                  </div>
                </div>
                <div className="pane-toolbar-actions">
                  {secondarySession ? (
                    <button
                      className="toolbar-button"
                      onClick={() => window.cortexDesktop.refreshView(secondarySession.id)}
                      type="button"
                    >
                      重新載入
                    </button>
                  ) : null}
                </div>
              </div>
              <div className="pane-surface">
                <div className="pane-viewport" ref={secondaryViewportRef}>
                  {!secondarySession ? <div className="viewport-placeholder">選擇第二個角色以分割工作窗</div> : null}
                </div>
              </div>
            </section>
          </div>

          <section className="bottom-panel">
            <div className="bottom-tabs">
              <button
                className={bottomTab === "cowork" ? "bottom-tab is-active" : "bottom-tab"}
                onClick={() => setBottomTab("cowork")}
                type="button"
              >
                COWORK
              </button>
              <button
                className={bottomTab === "logs" ? "bottom-tab is-active" : "bottom-tab"}
                onClick={() => setBottomTab("logs")}
                type="button"
              >
                LOGS
              </button>
              <button
                className={bottomTab === "handover" ? "bottom-tab is-active" : "bottom-tab"}
                onClick={() => setBottomTab("handover")}
                type="button"
              >
                HANDOVER
              </button>
            </div>

            {bottomTab === "cowork" ? (
              <div className="bottom-content cowork-layout">
                <div className="cowork-stream">
                  <div className="cowork-header">
                    <strong># CoWork Channel</strong>
                    <span>全角色協作頻道</span>
                  </div>
                  <div className="cowork-messages">
                    {decisions.slice(0, 3).map((decision, index) => (
                      <article className="cowork-line" key={decision.id}>
                        <div className={`cowork-avatar avatar-${index + 1}`}>{decision.title.slice(0, 1)}</div>
                        <div className="cowork-body">
                          <div className="cowork-meta">
                            <strong>{decision.title}</strong>
                            <span>{formatClock(decision.created_at)}</span>
                          </div>
                          <p>{decision.summary}</p>
                        </div>
                      </article>
                    ))}
                    {decisions.length === 0 ? (
                      <article className="cowork-line">
                        <div className="cowork-avatar avatar-0">C</div>
                        <div className="cowork-body">
                          <div className="cowork-meta">
                            <strong>CoWork</strong>
                            <span>--:--</span>
                          </div>
                          <p>CoWork 是主要協作區。這一區會保留跨角色的協作摘要、交辦與 handover。</p>
                        </div>
                      </article>
                    ) : null}
                  </div>
                  <div className="cowork-input">
                    <span>輸入訊息、@提及角色、記錄協作重點...</span>
                    <button type="button">➤</button>
                  </div>
                </div>

                <div className="participants-panel">
                  <div className="cowork-header">
                    <strong>PARTICIPANTS ({bindableSessions.length})</strong>
                    <span>同步狀態</span>
                  </div>
                  <div className="participant-list">
                    {bindableSessions.map((session) => {
                      const status = viewStatuses[session.id];
                      return (
                        <div className="participant-row" key={session.id}>
                          <div className="participant-avatar">{session.title.slice(0, 1)}</div>
                          <div className="participant-copy">
                            <strong>{session.title}</strong>
                            <span>{roleStatus(status)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : null}

            {bottomTab === "logs" ? (
              <div className="bottom-content simple-grid">
                {bindableSessions.map((session) => {
                  const status = viewStatuses[session.id];
                  return (
                    <article className="info-card" key={session.id}>
                      <strong>{session.title}</strong>
                      <span>{status?.currentUrl || session.workspace_url}</span>
                      <p>{status?.pageTitle || "尚未取得頁面標題"}</p>
                    </article>
                  );
                })}
              </div>
            ) : null}

            {bottomTab === "handover" ? (
              <div className="bottom-content simple-grid">
                <article className="info-card">
                  <strong>目前專案</strong>
                  <p>{activeProject?.name ?? "尚未選擇專案"}</p>
                </article>
                <article className="info-card">
                  <strong>下一步</strong>
                  <p>由角色工作窗帶回真實對話結果，再進入 CoWork 進行彙整與 handover。</p>
                </article>
                <article className="info-card">
                  <strong>治理狀態</strong>
                  <p>右側欄持續維護 decision / memory / constitution，不再假造角色聊天畫面。</p>
                </article>
              </div>
            ) : null}
          </section>
        </section>

        <aside className="governance-column">
          <div className="governance-title">GOVERNANCE</div>

          <section className="governance-block">
            <div className="governance-head">
              <strong>DECISION BOARD</strong>
              <button type="button">View All</button>
            </div>
            <div className="governance-cards">
              {decisions.slice(0, 3).map((decision) => (
                <article className="governance-card" key={decision.id}>
                  <div className="governance-card-top">
                    <span className={`decision-badge ${decisionTone(decision.status)}`}>{decision.status}</span>
                    <span>{formatClock(decision.created_at)}</span>
                  </div>
                  <strong>{decision.title}</strong>
                  <p>{decision.summary}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="governance-block">
            <div className="governance-head">
              <strong>MEMORY SNAPSHOT</strong>
              <button type="button">View All</button>
            </div>
            <div className="governance-cards">
              {memories.slice(0, 3).map((memory) => (
                <article className="governance-card compact" key={memory.id}>
                  <div className="governance-card-top">
                    <span>{memory.memory_type}</span>
                    <span>{memory.status}</span>
                  </div>
                  <p>{memory.content}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="governance-block">
            <div className="governance-head">
              <strong>CONSTITUTION</strong>
              <button type="button">View All</button>
            </div>
            <div className="governance-cards">
              {rules.slice(0, 5).map((rule) => (
                <article className="governance-card compact" key={rule.id}>
                  <div className="constitution-row">
                    <span className="constitution-check">✓</span>
                    <div>
                      <strong>{rule.name}</strong>
                      <p>{rule.description}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </aside>
      </section>

      <footer className="statusbar">
        <div className="statusbar-left">
          <span>main*</span>
          <span>{activeViewCount} 視窗在線</span>
          <span>{decisions.length} 決策</span>
        </div>
        <div className="statusbar-right">
          <span>Workspace: {activeProject?.name ?? "CORTEX"}</span>
          <span>{isLoadingWorkspace ? "同步中" : "已就緒"}</span>
        </div>
      </footer>
    </main>
  );
}
