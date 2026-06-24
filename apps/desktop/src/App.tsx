import { FormEvent, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import type {
  AuthSession,
  BootstrapConfig,
  ChatSession,
  ConstitutionRule,
  DesktopRequest,
  Decision,
  Memory,
  PaneDefinition,
  Project,
  ViewStatus,
} from "./types";

type LayoutPaneId = "primary" | "secondary";

const ACTIVITY_ITEMS = [
  { id: "roles", label: "Roles", icon: "AI" },
  { id: "workspace", label: "Workspace", icon: "WS" },
  { id: "search", label: "Search", icon: "S" },
  { id: "governance", label: "Governance", icon: "G" },
] as const;

const STATUS_COLORS: Record<ViewStatus["state"], string> = {
  loading: "is-loading",
  ready: "is-ready",
  failed: "is-failed",
};

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
  const [activeSidebar, setActiveSidebar] = useState<(typeof ACTIVITY_ITEMS)[number]["id"]>("roles");
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
      console.log("bootstrap", config);
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
    setSecondarySessionId((current) => {
      if (current) {
        return current;
      }
      return bindableSessions[1]?.id ?? bindableSessions[0].id;
    });
  }, [bindableSessions]);

  const primarySession = bindableSessions.find((session) => session.id === primarySessionId) ?? null;
  const secondarySession = bindableSessions.find((session) => session.id === secondarySessionId) ?? null;

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
      setMessage(`Connected as ${session.user.display_name}`);
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
      setError(err instanceof Error ? err.message : "Login failed");
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
      console.log("loadWorkspace:start", selectedProjectId);
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
      console.log("loadWorkspace:ok", {
        sessions: sessionData.length,
        decisions: decisionData.length,
        memories: memoryData.length,
        rules: ruleData.length,
      });
      setMessage(`Loaded ${sessionData.length} chat sessions into the desktop workbench.`);
    } catch (err) {
      console.error("loadWorkspace:failed", err);
      setError(err instanceof Error ? err.message : "Failed to load workbench.");
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
      const panes = buildPaneDefinitions();
      if (panes.length > 0) {
        console.log("syncViews", panes);
        window.cortexDesktop.syncViews(panes);
      }
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

  const activeProject = projects.find((project) => project.id === selectedProjectId) ?? null;

  return (
    <main className="desktop-shell">
      <header className="titlebar">
        <div className="brand">
          <div className="brand-mark">C</div>
          <div>
            <strong>CORTEX Desktop Workbench</strong>
            <span>{activeProject?.name ?? "Connect to a project"}</span>
          </div>
        </div>
        <div className="titlebar-meta">
          <span>{bindableSessions.length} external role workspaces</span>
          <span>{bootstrap?.runtimeLogPath ?? "Waiting for runtime log path..."}</span>
        </div>
      </header>

      {message ? <p className="status-banner">{message}</p> : null}
      {error ? <p className="error-banner">{error}</p> : null}

      <section className="workbench-grid">
        <aside className="activity-bar">
          <div className="activity-brand">CX</div>
          <div className="activity-buttons">
            {ACTIVITY_ITEMS.map((item) => (
              <button
                className={item.id === activeSidebar ? "activity-button is-active" : "activity-button"}
                key={item.id}
                onClick={() => setActiveSidebar(item.id)}
                type="button"
              >
                <span>{item.icon}</span>
              </button>
            ))}
          </div>
        </aside>

        <aside className="sidebar">
          <div className="sidebar-head">
            <strong>{activeSidebar}</strong>
            <span>{isLoadingWorkspace ? "syncing" : "ready"}</span>
          </div>

          <form className="connection-card" onSubmit={handleLogin}>
            <strong>Desktop Session</strong>
            <label>
              <span>Email</span>
              <input value={email} onChange={(event) => setEmail(event.target.value)} />
            </label>
            <label>
              <span>Password</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            <button className="primary-button" disabled={isAuthenticating} type="submit">
              {isAuthenticating ? "Connecting..." : "Connect"}
            </button>
          </form>

          <div className="connection-card">
            <strong>Project</strong>
            <label>
              <span>Target project</span>
              <select
                value={selectedProjectId}
                onChange={(event) => setSelectedProjectId(event.target.value)}
              >
                <option value="">Select a project</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </label>
            <button className="secondary-button" onClick={() => void loadWorkspace()} type="button">
              Reload Workspace
            </button>
          </div>

          <div className="sidebar-section">
            <div className="section-head">
              <strong>Loaded Roles</strong>
              <span>{bindableSessions.length}</span>
            </div>
            <div className="session-list">
              {bindableSessions.map((session) => {
                const status = viewStatuses[session.id];
                return (
                  <button
                    className="session-list-item"
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
                    <div>
                      <strong>{session.title}</strong>
                      <span>{session.workspace_url}</span>
                    </div>
                    <span className={`status-dot ${status ? STATUS_COLORS[status.state] : ""}`}>
                      {status?.state ?? "idle"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        <section className="editor-area">
          <div className="editor-tabs">
            {bindableSessions.map((session) => (
              <button
                className={session.id === primarySessionId ? "editor-tab is-active" : "editor-tab"}
                key={session.id}
                onClick={() => setPrimarySessionId(session.id)}
                type="button"
              >
                <span className="tab-indicator" />
                <span>{session.title}</span>
              </button>
            ))}
          </div>

          <div className="split-tab-row">
            <div className="split-tabs">
              {bindableSessions.map((session) => (
                <button
                  className={session.id === primarySessionId ? "split-tab is-active" : "split-tab"}
                  key={`primary-${session.id}`}
                  onClick={() => setPrimarySessionId(session.id)}
                  type="button"
                >
                  {session.title}
                </button>
              ))}
            </div>
            <div className="split-tabs">
              {bindableSessions.map((session) => (
                <button
                  className={session.id === secondarySessionId ? "split-tab is-active" : "split-tab"}
                  key={`secondary-${session.id}`}
                  onClick={() => setSecondarySessionId(session.id)}
                  type="button"
                >
                  {session.title}
                </button>
              ))}
            </div>
          </div>

          <div className="pane-grid">
            <section className="pane-shell">
              <div className="pane-head">
                <div>
                  <strong>{primarySession?.title ?? "Primary pane"}</strong>
                  <span>{primarySession?.workspace_url ?? "Select a role workspace"}</span>
                </div>
                {primarySession ? (
                  <button
                    className="ghost-button"
                    onClick={() => window.cortexDesktop.refreshView(primarySession.id)}
                    type="button"
                  >
                    Refresh
                  </button>
                ) : null}
              </div>
              <div className="pane-status">
                {primarySession ? (
                  <>
                    <span className={`status-dot ${STATUS_COLORS[viewStatuses[primarySession.id]?.state ?? "loading"]}`} />
                    <span>{viewStatuses[primarySession.id]?.pageTitle || "Waiting for external chat view..."}</span>
                  </>
                ) : (
                  <span>No primary session selected.</span>
                )}
              </div>
              <div className="pane-viewport" ref={primaryViewportRef}>
                <div className="viewport-mask">Real external chat workspace renders here via WebContentsView</div>
              </div>
            </section>

            <section className="pane-shell">
              <div className="pane-head">
                <div>
                  <strong>{secondarySession?.title ?? "Secondary pane"}</strong>
                  <span>{secondarySession?.workspace_url ?? "Select a role workspace"}</span>
                </div>
                {secondarySession ? (
                  <button
                    className="ghost-button"
                    onClick={() => window.cortexDesktop.refreshView(secondarySession.id)}
                    type="button"
                  >
                    Refresh
                  </button>
                ) : null}
              </div>
              <div className="pane-status">
                {secondarySession ? (
                  <>
                    <span className={`status-dot ${STATUS_COLORS[viewStatuses[secondarySession.id]?.state ?? "loading"]}`} />
                    <span>{viewStatuses[secondarySession.id]?.pageTitle || "Waiting for external chat view..."}</span>
                  </>
                ) : (
                  <span>No secondary session selected.</span>
                )}
              </div>
              <div className="pane-viewport" ref={secondaryViewportRef}>
                <div className="viewport-mask">Independent role workspace renders here via WebContentsView</div>
              </div>
            </section>
          </div>

          <section className="bottom-panel">
            <div className="panel-tabs">
              <button className="panel-tab is-active" type="button">
                CoWork
              </button>
              <button className="panel-tab" type="button">
                Logs
              </button>
              <button className="panel-tab" type="button">
                Handover
              </button>
            </div>
            <div className="panel-body">
              <div className="cowork-card">
                <strong>CoWork</strong>
                <p>This panel stays primary in the shell, but no fake chat UI is rendered inside the role panes.</p>
              </div>
              <div className="cowork-card">
                <strong>Live Views</strong>
                <p>{bindableSessions.length} role workspaces are eligible for external loading.</p>
              </div>
              <div className="cowork-card">
                <strong>Verification</strong>
                <p>Load state and page title are streamed back from the Electron main process.</p>
              </div>
            </div>
          </section>
        </section>

        <aside className="governance-sidebar">
          <div className="sidebar-head">
            <strong>Governance</strong>
            <span>Decision / Memory / Constitution</span>
          </div>

          <section className="governance-section">
            <div className="section-head">
              <strong>Decision Board</strong>
              <span>{decisions.length}</span>
            </div>
            <div className="governance-list">
              {decisions.slice(0, 5).map((decision) => (
                <article className="governance-card" key={decision.id}>
                  <strong>{decision.title}</strong>
                  <span>{decision.status}</span>
                  <p>{decision.summary}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="governance-section">
            <div className="section-head">
              <strong>Memory Snapshot</strong>
              <span>{memories.length}</span>
            </div>
            <div className="governance-list">
              {memories.slice(0, 5).map((memory) => (
                <article className="governance-card" key={memory.id}>
                  <strong>{memory.memory_type}</strong>
                  <span>{memory.status}</span>
                  <p>{memory.content}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="governance-section">
            <div className="section-head">
              <strong>Constitution</strong>
              <span>{rules.length}</span>
            </div>
            <div className="governance-list">
              {rules.slice(0, 6).map((rule) => (
                <article className="governance-card" key={rule.id}>
                  <strong>{rule.rule_code}</strong>
                  <span>{rule.severity}</span>
                  <p>{rule.description}</p>
                </article>
              ))}
            </div>
          </section>
        </aside>
      </section>
    </main>
  );
}
