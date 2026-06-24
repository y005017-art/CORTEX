"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

import {
  approveDecision,
  ChatSession,
  ConstitutionRule,
  createChatSession,
  createDecision,
  createMessage,
  Decision,
  listChatSessions,
  listDecisions,
  listMemories,
  listMessages,
  listRoles,
  listRules,
  Memory,
  Message,
  Project,
  Role,
  runCoWork,
  transitionMemory,
} from "@/lib/api";

type WorkspaceClientProps = {
  project: Project;
};

type RoleWindowDefinition = {
  id: string;
  name: string;
  role_type: string;
  status: string;
  description: string;
  roleId: string | null;
};

type ProviderTemplate = {
  key: string;
  label: string;
  workspaceUrl: string;
  guidance: string;
};

type ActivityView = "roles" | "files" | "search" | "graph" | "launch" | "shield";
type BottomView = "cowork" | "logs" | "handover";
type MessageMap = Record<string, Message[]>;
type DraftMap = Record<string, string>;
type BusyMap = Record<string, boolean>;
type StatusMap = Record<string, string | null>;
type ProviderSelectionMap = Record<string, string>;

const DEFAULT_ROLE_BLUEPRINTS: RoleWindowDefinition[] = [
  {
    id: "preset-architect",
    name: "Architect",
    role_type: "architecture",
    status: "standby",
    description: "Owns system framing, decomposition, and cross-role direction.",
    roleId: null,
  },
  {
    id: "preset-engineer",
    name: "Engineer",
    role_type: "implementation",
    status: "standby",
    description: "Builds product slices, integrations, and delivery details.",
    roleId: null,
  },
  {
    id: "preset-reviewer",
    name: "Reviewer",
    role_type: "quality",
    status: "standby",
    description: "Checks risk, regressions, and missing validation paths.",
    roleId: null,
  },
  {
    id: "preset-pm",
    name: "PM",
    role_type: "planning",
    status: "standby",
    description: "Tracks goal clarity, sequencing, and decision readiness.",
    roleId: null,
  },
];

const PROVIDER_TEMPLATES: ProviderTemplate[] = [
  {
    key: "chatgpt",
    label: "ChatGPT",
    workspaceUrl: "https://chatgpt.com",
    guidance: "Open the external chat, paste the startup prompt, and treat it as the role workspace.",
  },
  {
    key: "claude",
    label: "Claude",
    workspaceUrl: "https://claude.ai",
    guidance: "Use Claude as a dedicated role window for analysis or implementation work.",
  },
  {
    key: "gemini",
    label: "Gemini",
    workspaceUrl: "https://gemini.google.com",
    guidance: "Use Gemini when the role needs a separate browser-based workspace.",
  },
  {
    key: "deepseek",
    label: "DeepSeek",
    workspaceUrl: "https://chat.deepseek.com",
    guidance: "Use DeepSeek as an alternate role workspace for focused technical tasks.",
  },
];

const ACTIVITY_ITEMS: Array<{ id: ActivityView; label: string; icon: string }> = [
  { id: "roles", label: "Roles", icon: "AI" },
  { id: "files", label: "Workspace", icon: "WS" },
  { id: "search", label: "Search", icon: "S" },
  { id: "graph", label: "Flow", icon: "F" },
  { id: "launch", label: "Launch", icon: "L" },
  { id: "shield", label: "Govern", icon: "G" },
];

function formatTime(value: string): string {
  return new Intl.DateTimeFormat("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function buildStartupPrompt(project: Project, role: RoleWindowDefinition): string {
  const summary = project.description?.trim() || "No project summary yet.";

  return [
    `You are the ${role.name} role inside the CORTEX workspace for project "${project.name}".`,
    `Role focus: ${role.description}`,
    `Project summary: ${summary}`,
    "",
    "Working rules:",
    "1. Stay within your assigned role perspective.",
    "2. Produce outputs that can be handed back into the CORTEX workspace.",
    "3. Make decisions explicit, concise, and implementation-oriented.",
    "4. Flag uncertainty, blockers, and follow-up actions clearly.",
    "5. Keep context aligned with shared project governance.",
  ].join("\n");
}

function summarizeRole(role: Role): string {
  return role.description?.trim() || "Dedicated role workspace inside CORTEX.";
}

function getProviderTemplate(providerKey?: string | null): ProviderTemplate {
  return (
    PROVIDER_TEMPLATES.find((entry) => entry.key === providerKey) ?? PROVIDER_TEMPLATES[0]
  );
}

function getStatusTone(status: string): "working" | "idle" | "standby" {
  const normalized = status.toLowerCase();
  if (normalized.includes("work") || normalized.includes("active") || normalized.includes("online")) {
    return "working";
  }
  if (normalized.includes("idle")) {
    return "idle";
  }
  return "standby";
}

function getDecisionTone(status: string): "approved" | "pending" {
  return status.toLowerCase() === "approved" ? "approved" : "pending";
}

function getMemoryNextAction(status: string): { label: string; value: string } | null {
  if (status === "draft") {
    return { label: "Verify", value: "verified" };
  }
  if (status === "verified") {
    return { label: "Lock", value: "locked" };
  }
  if (status !== "archived") {
    return { label: "Archive", value: "archived" };
  }
  return null;
}

export function WorkspaceClient({ project }: WorkspaceClientProps) {
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [messagesByThread, setMessagesByThread] = useState<MessageMap>({});
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [rules, setRules] = useState<ConstitutionRule[]>([]);
  const [providerSelections, setProviderSelections] = useState<ProviderSelectionMap>({});
  const [messageDrafts, setMessageDrafts] = useState<DraftMap>({});
  const [submittingMessages, setSubmittingMessages] = useState<BusyMap>({});
  const [runningCoWork, setRunningCoWork] = useState<BusyMap>({});
  const [coworkStatus, setCoworkStatus] = useState<StatusMap>({});
  const [creatingRoleSessionId, setCreatingRoleSessionId] = useState<string | null>(null);
  const [creatingDecision, setCreatingDecision] = useState(false);
  const [decisionTitle, setDecisionTitle] = useState("");
  const [decisionSummary, setDecisionSummary] = useState("");
  const [quickSessionTitle, setQuickSessionTitle] = useState("");
  const [creatingQuickSession, setCreatingQuickSession] = useState(false);
  const [loadingWorkspace, setLoadingWorkspace] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activityView, setActivityView] = useState<ActivityView>("roles");
  const [bottomView, setBottomView] = useState<BottomView>("cowork");
  const [primaryTabId, setPrimaryTabId] = useState<string | null>(null);
  const [secondaryTabId, setSecondaryTabId] = useState<string | null>(null);
  const workspaceRequestId = useRef(0);

  const roleDefinitions = useMemo<RoleWindowDefinition[]>(() => {
    if (roles.length === 0) {
      return DEFAULT_ROLE_BLUEPRINTS;
    }

    return [...roles]
      .sort((left, right) => {
        if (left.is_permanent !== right.is_permanent) {
          return left.is_permanent ? -1 : 1;
        }
        return left.name.localeCompare(right.name, "en");
      })
      .map((role) => ({
        id: role.id,
        name: role.name,
        role_type: role.role_type,
        status: role.status,
        description: summarizeRole(role),
        roleId: role.id,
      }));
  }, [roles]);

  const roleWindows = useMemo(
    () =>
      roleDefinitions.map((role) => {
        const session =
          (role.roleId
            ? chatSessions.find((entry) => entry.role_id === role.roleId)
            : null) ??
          chatSessions.find(
            (entry) => entry.title.trim().toUpperCase() === role.name.trim().toUpperCase()
          ) ??
          null;
        return { role, session };
      }),
    [chatSessions, roleDefinitions]
  );

  const roleWindowMap = useMemo(
    () => Object.fromEntries(roleWindows.map((entry) => [entry.role.id, entry])),
    [roleWindows]
  );

  const activeRoleWindows = useMemo(
    () => roleWindows.filter((entry) => Boolean(entry.session)),
    [roleWindows]
  );

  const externalChatSessions = activeRoleWindows.length;

  useEffect(() => {
    if (roleWindows.length === 0) {
      setPrimaryTabId(null);
      setSecondaryTabId(null);
      return;
    }

    setPrimaryTabId((current) =>
      current && roleWindowMap[current] ? current : roleWindows[0]?.role.id ?? null
    );
    setSecondaryTabId((current) => {
      if (current && roleWindowMap[current]) {
        return current;
      }
      const fallback = roleWindows.find((entry) => entry.role.id !== primaryTabId);
      return fallback?.role.id ?? roleWindows[0]?.role.id ?? null;
    });
  }, [primaryTabId, roleWindowMap, roleWindows]);

  async function refreshMessages(sessions: ChatSession[], requestId: number) {
    if (sessions.length === 0) {
      if (workspaceRequestId.current === requestId) {
        setMessagesByThread({});
      }
      return;
    }

    if (workspaceRequestId.current === requestId) {
      setLoadingMessages(true);
    }
    try {
      const settled = await Promise.allSettled(
        sessions.map(async (session) => [session.thread_id, await listMessages(session.thread_id)] as const)
      );
      if (workspaceRequestId.current !== requestId) {
        return;
      }
      const entries = settled
        .filter((result): result is PromiseFulfilledResult<readonly [string, Message[]]> => result.status === "fulfilled")
        .map((result) => result.value);
      setMessagesByThread(Object.fromEntries(entries));
    } finally {
      if (workspaceRequestId.current === requestId) {
        setLoadingMessages(false);
      }
    }
  }

  async function refreshWorkspace() {
    const requestId = workspaceRequestId.current + 1;
    workspaceRequestId.current = requestId;
    setLoadingWorkspace(true);
    try {
      setError(null);
      setNotice(null);
      const [sessionData, decisionData, memoryData, roleData, ruleData] = await Promise.all([
        listChatSessions(project.id),
        listDecisions(project.id),
        listMemories(project.id),
        listRoles(),
        listRules(),
      ]);
      if (workspaceRequestId.current !== requestId) {
        return;
      }
      setChatSessions(sessionData);
      setDecisions(decisionData);
      setMemories(memoryData);
      setRoles(roleData);
      setRules(ruleData);
      await refreshMessages(sessionData, requestId);
    } catch (err) {
      if (workspaceRequestId.current === requestId) {
        setError(err instanceof Error ? err.message : "Failed to load the CORTEX workspace.");
      }
    } finally {
      if (workspaceRequestId.current === requestId) {
        setLoadingWorkspace(false);
      }
    }
  }

  useEffect(() => {
    void refreshWorkspace();
  }, [project.id]);

  useEffect(() => {
    setProviderSelections((current) => {
      const next = { ...current };
      for (const role of roleDefinitions) {
        if (!next[role.id]) {
          next[role.id] = PROVIDER_TEMPLATES[0].key;
        }
      }
      return next;
    });
  }, [roleDefinitions]);

  function updateDraft(threadId: string, value: string) {
    setMessageDrafts((current) => ({
      ...current,
      [threadId]: value,
    }));
  }

  function updateProviderSelection(roleId: string, providerKey: string) {
    setProviderSelections((current) => ({
      ...current,
      [roleId]: providerKey,
    }));
  }

  async function copyPrompt(prompt: string, successText: string) {
    try {
      await navigator.clipboard.writeText(prompt);
      setNotice(successText);
    } catch {
      setError("Unable to copy the startup prompt automatically.");
    }
  }

  async function handleCreateRoleSession(role: RoleWindowDefinition) {
    const provider = getProviderTemplate(providerSelections[role.id]);
    const startupPrompt = buildStartupPrompt(project, role);
    const popup = window.open("about:blank", "_blank", "noopener,noreferrer");

    try {
      setCreatingRoleSessionId(role.id);
      setError(null);
      setNotice(null);
      await createChatSession(project.id, {
        title: role.name,
        session_type: "role_chat",
        role_id: role.roleId ?? undefined,
        provider_site: provider.key,
        workspace_url: provider.workspaceUrl,
        launch_mode: "external_tab",
        startup_prompt: startupPrompt,
      });

      if (popup) {
        popup.location.href = provider.workspaceUrl;
      }

      await copyPrompt(startupPrompt, `${role.name} prompt copied. Paste it into ${provider.label}.`);
      await refreshWorkspace();
    } catch (err) {
      popup?.close();
      setError(err instanceof Error ? err.message : "Failed to create role workspace.");
    } finally {
      setCreatingRoleSessionId(null);
    }
  }

  async function handleCreateQuickSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!quickSessionTitle.trim()) {
      setError("Enter a tab name before creating a session.");
      return;
    }

    try {
      setCreatingQuickSession(true);
      setError(null);
      setNotice(null);
      await createChatSession(project.id, {
        title: quickSessionTitle.trim(),
        session_type: "group_chat",
      });
      setQuickSessionTitle("");
      await refreshWorkspace();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create session tab.");
    } finally {
      setCreatingQuickSession(false);
    }
  }

  async function handleSendMessage(session: ChatSession) {
    const draft = messageDrafts[session.thread_id]?.trim() ?? "";
    if (!draft) {
      setError(`Enter a message before sending it to ${session.title}.`);
      return;
    }

    try {
      setSubmittingMessages((current) => ({ ...current, [session.thread_id]: true }));
      setError(null);
      setNotice(null);
      await createMessage(session.thread_id, {
        message_type: "user_goal",
        sender_type: "user",
        visibility: "project",
        content_text: draft,
      });
      setMessageDrafts((current) => ({ ...current, [session.thread_id]: "" }));
      await refreshMessages(chatSessions, workspaceRequestId.current);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send workspace message.");
    } finally {
      setSubmittingMessages((current) => ({ ...current, [session.thread_id]: false }));
    }
  }

  async function handleRunCoWork(session: ChatSession) {
    try {
      setRunningCoWork((current) => ({ ...current, [session.thread_id]: true }));
      setError(null);
      setNotice(null);
      const result = await runCoWork(session.thread_id);
      const providerText = result.provider_key ? ` via ${result.provider_key}` : "";
      setCoworkStatus((current) => ({
        ...current,
        [session.thread_id]: result.deduplicated
          ? `CoWork generated a deduplicated update${providerText}.`
          : `CoWork generated a new update${providerText}.`,
      }));
      await Promise.all([refreshMessages(chatSessions, workspaceRequestId.current), refreshWorkspace()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run CoWork.");
    } finally {
      setRunningCoWork((current) => ({ ...current, [session.thread_id]: false }));
    }
  }

  async function handleCreateDecision(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!decisionTitle.trim() || !decisionSummary.trim()) {
      setError("Decision title and summary are both required.");
      return;
    }

    try {
      setCreatingDecision(true);
      setError(null);
      setNotice(null);
      await createDecision(project.id, {
        title: decisionTitle.trim(),
        summary: decisionSummary.trim(),
      });
      setDecisionTitle("");
      setDecisionSummary("");
      await refreshWorkspace();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create decision.");
    } finally {
      setCreatingDecision(false);
    }
  }

  async function handleApproveDecision(decisionId: string) {
    try {
      setError(null);
      setNotice(null);
      await approveDecision(decisionId);
      await refreshWorkspace();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to approve decision.");
    }
  }

  async function handleTransitionMemory(memoryId: string, status: string) {
    try {
      setError(null);
      setNotice(null);
      await transitionMemory(memoryId, status);
      await refreshWorkspace();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update memory status.");
    }
  }

  const primaryPane = primaryTabId ? roleWindowMap[primaryTabId] ?? roleWindows[0] : roleWindows[0];
  const secondaryPane = secondaryTabId
    ? roleWindowMap[secondaryTabId] ?? roleWindows[1] ?? roleWindows[0]
    : roleWindows[1] ?? roleWindows[0];

  function renderSidebarContent() {
    if (activityView === "roles") {
      return (
        <div className="sidebar-section">
          <div className="sidebar-section-header">
            <span>Loaded Roles</span>
            <span>{roleWindows.length}</span>
          </div>
          <div className="role-list">
            {roleWindows.map(({ role, session }) => {
              const tone = getStatusTone(session?.status ?? role.status);
              return (
                <button
                  className={`role-list-item tone-${tone}`}
                  key={role.id}
                  onClick={() => {
                    setPrimaryTabId(role.id);
                    if (secondaryTabId === role.id) {
                      const fallback = roleWindows.find((entry) => entry.role.id !== role.id);
                      setSecondaryTabId(fallback?.role.id ?? role.id);
                    }
                  }}
                  type="button"
                >
                  <div>
                    <strong>{role.name}</strong>
                    <span>{session?.provider_site ?? role.role_type}</span>
                  </div>
                  <span className="state-pill">{session ? session.status : "unbound"}</span>
                </button>
              );
            })}
          </div>
        </div>
      );
    }

    if (activityView === "files") {
      return (
        <div className="sidebar-section">
          <div className="sidebar-section-header">
            <span>Workspace</span>
            <span>CORTEX</span>
          </div>
          <div className="tree-list">
            <div className="tree-group">
              <strong>chat_sessions</strong>
              {roleWindows.map(({ role }) => (
                <span key={role.id}>{role.name}.session</span>
              ))}
            </div>
            <div className="tree-group">
              <strong>memory</strong>
              <span>snapshot.index</span>
              <span>locked.memories</span>
            </div>
            <div className="tree-group">
              <strong>constitution</strong>
              <span>ruleset.yaml</span>
            </div>
            <div className="tree-group">
              <strong>handover</strong>
              <span>next-step.md</span>
            </div>
          </div>
        </div>
      );
    }

    if (activityView === "search") {
      return (
        <div className="sidebar-section">
          <div className="sidebar-section-header">
            <span>Search</span>
            <span>Context</span>
          </div>
          <div className="search-card">
            <strong>Fast workspace signals</strong>
            <span>{externalChatSessions} external role workspaces connected</span>
            <span>{decisions.length} decisions in governance</span>
            <span>{memories.length} memories tracked</span>
          </div>
        </div>
      );
    }

    if (activityView === "graph") {
      return (
        <div className="sidebar-section">
          <div className="sidebar-section-header">
            <span>Flow</span>
            <span>Live</span>
          </div>
          <div className="tree-list">
            <div className="tree-group">
              <strong>Architect</strong>
              <span>Decision framing</span>
              <span>Role routing</span>
            </div>
            <div className="tree-group">
              <strong>Engineer</strong>
              <span>Implementation stream</span>
              <span>CoWork execution</span>
            </div>
            <div className="tree-group">
              <strong>Reviewer</strong>
              <span>Risk review</span>
              <span>Governance feedback</span>
            </div>
          </div>
        </div>
      );
    }

    if (activityView === "launch") {
      return (
        <div className="sidebar-section">
          <div className="sidebar-section-header">
            <span>Launch</span>
            <span>New Tab</span>
          </div>
          <form className="compact-form" onSubmit={handleCreateQuickSession}>
            <label className="field">
              <span>Session title</span>
              <input
                value={quickSessionTitle}
                onChange={(event) => setQuickSessionTitle(event.target.value)}
                placeholder="Planning room, sync tab, research desk..."
              />
            </label>
            <button className="secondary-button" disabled={creatingQuickSession} type="submit">
              {creatingQuickSession ? "Creating..." : "Create Session"}
            </button>
          </form>
        </div>
      );
    }

    return (
      <div className="sidebar-section">
        <div className="sidebar-section-header">
          <span>Status</span>
          <span>Governance</span>
        </div>
        <div className="status-grid">
          <div className="status-row">
            <span>Active Roles</span>
            <strong>
              {activeRoleWindows.length}/{roleWindows.length}
            </strong>
          </div>
          <div className="status-row">
            <span>Memory Sync</span>
            <strong>{memories.filter((entry) => entry.status !== "archived").length}</strong>
          </div>
          <div className="status-row">
            <span>Rules Online</span>
            <strong>{rules.length}</strong>
          </div>
          <div className="status-row">
            <span>Last Refresh</span>
            <strong>{loadingWorkspace ? "Loading" : "Ready"}</strong>
          </div>
        </div>
      </div>
    );
  }

  function renderPane(entry: { role: RoleWindowDefinition; session: ChatSession | null } | undefined, slot: string) {
    if (!entry) {
      return (
        <section className="workspace-pane empty-pane">
          <div className="pane-toolbar">
            <strong>{slot}</strong>
          </div>
          <div className="empty-pane-copy">No workspace is assigned to this pane yet.</div>
        </section>
      );
    }

    const { role, session } = entry;
    const provider = getProviderTemplate(session?.provider_site ?? providerSelections[role.id]);
    const startupPrompt = session?.startup_prompt ?? buildStartupPrompt(project, role);
    const messages = session ? messagesByThread[session.thread_id] ?? [] : [];
    const latestMessage = messages[messages.length - 1] ?? null;
    const draft = session ? messageDrafts[session.thread_id] ?? "" : "";
    const isSending = session ? submittingMessages[session.thread_id] ?? false : false;
    const isRunning = session ? runningCoWork[session.thread_id] ?? false : false;
    const statusText = session ? coworkStatus[session.thread_id] : null;
    const tone = getStatusTone(session?.status ?? role.status);

    return (
      <section className={`workspace-pane tone-${tone}`}>
        <div className="pane-toolbar">
          <div className="pane-title-group">
            <strong>{role.name}</strong>
            <span>{session ? `${provider.label} workspace` : "Role shell not bound yet"}</span>
          </div>
          <div className="pane-toolbar-actions">
            <span className={`state-pill tone-${tone}`}>{session ? session.status : role.status}</span>
            {session ? (
              <button
                className="ghost-button"
                onClick={() => {
                  const target = session.workspace_url || provider.workspaceUrl;
                  window.open(target, "_blank", "noopener,noreferrer");
                }}
                type="button"
              >
                Open in Browser
              </button>
            ) : null}
          </div>
        </div>

        {session ? (
          <>
            <div className="embedded-stage">
              <div className="embedded-stage-head">
                <span>{provider.label}</span>
                <span>{session.launch_mode}</span>
              </div>
              <div className="embedded-stage-body">
                <div className="embedded-placeholder-orb">{role.name.slice(0, 1)}</div>
                <h3>{role.name} / Chat Workspace</h3>
                <p>{provider.guidance}</p>
              </div>
            </div>

            <div className="pane-summary-strip">
              <div>
                <span>Messages</span>
                <strong>{messages.length}</strong>
              </div>
              <div>
                <span>Thread</span>
                <strong>{session.session_type}</strong>
              </div>
              <div>
                <span>Updated</span>
                <strong>{latestMessage ? formatTime(latestMessage.created_at) : "--"}</strong>
              </div>
            </div>

            {statusText ? <p className="status-banner compact">{statusText}</p> : null}

            <div className="pane-feed">
              {loadingMessages && messages.length === 0 ? (
                <p className="empty-state">Loading role messages...</p>
              ) : null}
              {messages.length === 0 ? (
                <p className="empty-state">No messages in CORTEX yet. Start from the external role chat.</p>
              ) : null}
              {messages.slice(-4).map((message) => (
                <article className="feed-line" key={message.id}>
                  <div className="feed-line-head">
                    <span className="message-chip">{message.sender_type}</span>
                    <span className="mini-meta">{formatTime(message.created_at)}</span>
                  </div>
                  <p>{message.content_text}</p>
                </article>
              ))}
            </div>

            <div className="pane-inspector">
              <strong>Latest Context</strong>
              <p>{latestMessage ? latestMessage.content_text : "Waiting for the first synced update."}</p>
            </div>

            <label className="field">
              <span>Send a workspace instruction back into CORTEX</span>
              <textarea
                rows={4}
                value={draft}
                onChange={(event) => updateDraft(session.thread_id, event.target.value)}
                placeholder={`Send the next instruction to ${role.name}...`}
              />
            </label>

            <div className="pane-actions">
              <button
                className="primary-button"
                disabled={isSending}
                onClick={() => void handleSendMessage(session)}
                type="button"
              >
                {isSending ? "Sending..." : "Send to Thread"}
              </button>
              <button
                className="secondary-button"
                disabled={isRunning}
                onClick={() => void handleRunCoWork(session)}
                type="button"
              >
                {isRunning ? "Running..." : "Run CoWork"}
              </button>
              <button
                className="ghost-button"
                onClick={() => void copyPrompt(startupPrompt, `${role.name} prompt copied.`)}
                type="button"
              >
                Copy Prompt
              </button>
            </div>
          </>
        ) : (
          <div className="pane-unbound">
            <div className="embedded-stage compact">
              <div className="embedded-stage-head">
                <span>Unbound Role Workspace</span>
                <span>{role.role_type}</span>
              </div>
              <div className="embedded-stage-body">
                <div className="embedded-placeholder-orb">{role.name.slice(0, 1)}</div>
                <h3>{role.name} / Ready to Launch</h3>
                <p>{role.description}</p>
              </div>
            </div>

            <label className="field">
              <span>Provider</span>
              <select
                className="provider-select"
                value={providerSelections[role.id] ?? PROVIDER_TEMPLATES[0].key}
                onChange={(event) => updateProviderSelection(role.id, event.target.value)}
              >
                {PROVIDER_TEMPLATES.map((entryOption) => (
                  <option key={entryOption.key} value={entryOption.key}>
                    {entryOption.label}
                  </option>
                ))}
              </select>
            </label>

            <p className="pane-help">{provider.guidance}</p>

            <pre className="prompt-preview">{startupPrompt}</pre>

            <div className="pane-actions">
              <button
                className="primary-button"
                disabled={creatingRoleSessionId === role.id}
                onClick={() => void handleCreateRoleSession(role)}
                type="button"
              >
                {creatingRoleSessionId === role.id ? "Creating..." : `Launch ${provider.label}`}
              </button>
              <button
                className="ghost-button"
                onClick={() => void copyPrompt(startupPrompt, `${role.name} prompt copied.`)}
                type="button"
              >
                Copy Prompt
              </button>
            </div>
          </div>
        )}
      </section>
    );
  }

  const coworkMessages = Object.values(messagesByThread)
    .flat()
    .sort((left, right) => new Date(left.created_at).getTime() - new Date(right.created_at).getTime())
    .slice(-8);

  return (
    <main className="workspace-shell ide-shell">
      <section className="ide-topbar">
        <div className="ide-brand">
          <div className="ide-brand-badge">C</div>
          <div>
            <strong>CORTEX Workspace</strong>
            <span>{project.name}</span>
          </div>
        </div>
        <div className="ide-topbar-meta">
          <span>{loadingWorkspace ? "Syncing workspace..." : "Workspace ready"}</span>
          <span>{externalChatSessions} role chats linked</span>
        </div>
      </section>

      {notice ? <p className="status-banner workspace-banner">{notice}</p> : null}
      {error ? <p className="error-text workspace-banner">{error}</p> : null}

      <section className="ide-frame">
        <aside className="activity-bar">
          <div className="activity-brand">CX</div>
          <div className="activity-items">
            {ACTIVITY_ITEMS.map((item) => (
              <button
                aria-label={item.label}
                className={item.id === activityView ? "activity-button is-active" : "activity-button"}
                key={item.id}
                onClick={() => setActivityView(item.id)}
                type="button"
              >
                <span>{item.icon}</span>
              </button>
            ))}
          </div>
          <div className="activity-footer">
            <button className="activity-button" type="button">
              <span>U</span>
            </button>
            <button className="activity-button" type="button">
              <span>S</span>
            </button>
          </div>
        </aside>

        <aside className="ide-sidebar">
          <div className="ide-sidebar-head">
            <strong>{ACTIVITY_ITEMS.find((item) => item.id === activityView)?.label}</strong>
            <span>{project.status}</span>
          </div>
          {renderSidebarContent()}
        </aside>

        <section className="workbench-area">
          <div className="editor-tabs">
            {roleWindows.map(({ role, session }) => (
              <button
                className={role.id === primaryTabId ? "editor-tab is-active" : "editor-tab"}
                key={role.id}
                onClick={() => setPrimaryTabId(role.id)}
                type="button"
              >
                <span className="tab-dot" />
                <span>{session?.title ?? `${role.name}.chat`}</span>
              </button>
            ))}
            <button className="editor-tab add-tab" type="button">
              <span>+</span>
            </button>
          </div>

          <div className="split-tabs">
            <div className="split-tab-strip">
              {roleWindows.map(({ role }) => (
                <button
                  className={role.id === primaryTabId ? "split-tab is-active" : "split-tab"}
                  key={`primary-${role.id}`}
                  onClick={() => setPrimaryTabId(role.id)}
                  type="button"
                >
                  {role.name}
                </button>
              ))}
            </div>
            <div className="split-tab-strip">
              {roleWindows.map(({ role }) => (
                <button
                  className={role.id === secondaryTabId ? "split-tab is-active" : "split-tab"}
                  key={`secondary-${role.id}`}
                  onClick={() => setSecondaryTabId(role.id)}
                  type="button"
                >
                  {role.name}
                </button>
              ))}
            </div>
          </div>

          <div className="workspace-split">
            {renderPane(primaryPane, "Pane A")}
            {renderPane(secondaryPane, "Pane B")}
          </div>

          <section className="bottom-panel">
            <div className="bottom-panel-tabs">
              <button
                className={bottomView === "cowork" ? "bottom-tab is-active" : "bottom-tab"}
                onClick={() => setBottomView("cowork")}
                type="button"
              >
                CoWork
              </button>
              <button
                className={bottomView === "logs" ? "bottom-tab is-active" : "bottom-tab"}
                onClick={() => setBottomView("logs")}
                type="button"
              >
                Logs
              </button>
              <button
                className={bottomView === "handover" ? "bottom-tab is-active" : "bottom-tab"}
                onClick={() => setBottomView("handover")}
                type="button"
              >
                Handover
              </button>
            </div>

            {bottomView === "cowork" ? (
              <div className="bottom-panel-body cowork-panel">
                <div className="panel-column">
                  <div className="panel-column-head">
                    <strong>CoWork Channel</strong>
                    <span>{coworkMessages.length} updates</span>
                  </div>
                  <div className="timeline-list">
                    {coworkMessages.length === 0 ? (
                      <p className="empty-state">No shared updates yet.</p>
                    ) : null}
                    {coworkMessages.map((message) => (
                      <article className="timeline-entry" key={message.id}>
                        <div className="timeline-avatar">{message.sender_type.slice(0, 1).toUpperCase()}</div>
                        <div>
                          <div className="timeline-head">
                            <strong>{message.sender_type}</strong>
                            <span>{formatTime(message.created_at)}</span>
                          </div>
                          <p>{message.content_text}</p>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
                <div className="panel-column participants-panel">
                  <div className="panel-column-head">
                    <strong>Participants</strong>
                    <span>{roleWindows.length}</span>
                  </div>
                  <div className="participant-list">
                    {roleWindows.map(({ role, session }) => {
                      const tone = getStatusTone(session?.status ?? role.status);
                      return (
                        <div className="participant-row" key={role.id}>
                          <div className={`participant-avatar tone-${tone}`}>{role.name.slice(0, 1)}</div>
                          <div>
                            <strong>{role.name}</strong>
                            <span>{session?.status ?? role.status}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : null}

            {bottomView === "logs" ? (
              <div className="bottom-panel-body">
                <div className="log-grid">
                  <div className="log-card">
                    <strong>Workspace Status</strong>
                    <span>{loadingWorkspace ? "Loading" : "Synced"}</span>
                    <span>{externalChatSessions} role windows linked</span>
                  </div>
                  <div className="log-card">
                    <strong>Decision Queue</strong>
                    <span>{decisions.length} items</span>
                    <span>{decisions.filter((entry) => entry.status === "approved").length} approved</span>
                  </div>
                  <div className="log-card">
                    <strong>Memory Index</strong>
                    <span>{memories.length} tracked</span>
                    <span>{memories.filter((entry) => entry.status === "locked").length} locked</span>
                  </div>
                </div>
              </div>
            ) : null}

            {bottomView === "handover" ? (
              <div className="bottom-panel-body handover-panel">
                <div className="handover-card">
                  <strong>Latest Decision</strong>
                  <p>{decisions[0]?.summary ?? "No decisions yet."}</p>
                </div>
                <div className="handover-card">
                  <strong>Latest Memory</strong>
                  <p>{memories[0]?.content ?? "No memory snapshot yet."}</p>
                </div>
                <div className="handover-card">
                  <strong>Next Operator Note</strong>
                  <p>
                    Continue from this shell by selecting a role tab, reviewing governance, and sending the next
                    instruction into the active workspace.
                  </p>
                </div>
              </div>
            ) : null}
          </section>
        </section>

        <aside className="governance-sidebar">
          <div className="governance-head">
            <strong>Governance</strong>
            <span>Decision / Memory / Constitution</span>
          </div>

          <section className="governance-section">
            <div className="governance-section-head">
              <strong>Decision Board</strong>
              <span>{decisions.length}</span>
            </div>
            <form className="compact-form" onSubmit={handleCreateDecision}>
              <label className="field">
                <span>Decision title</span>
                <input
                  value={decisionTitle}
                  onChange={(event) => setDecisionTitle(event.target.value)}
                  placeholder="Confirm shell layout, sync rule, launch policy..."
                />
              </label>
              <label className="field">
                <span>Decision summary</span>
                <textarea
                  rows={3}
                  value={decisionSummary}
                  onChange={(event) => setDecisionSummary(event.target.value)}
                  placeholder="Capture the exact governance or product decision..."
                />
              </label>
              <button className="secondary-button" disabled={creatingDecision} type="submit">
                {creatingDecision ? "Creating..." : "Create Decision"}
              </button>
            </form>
            <div className="governance-list">
              {decisions.map((decision) => {
                const tone = getDecisionTone(decision.status);
                return (
                  <article className="governance-card" key={decision.id}>
                    <div className="governance-card-head">
                      <span className={`status-tag tone-${tone}`}>{decision.status}</span>
                      <span>{formatTime(decision.created_at)}</span>
                    </div>
                    <strong>{decision.title}</strong>
                    <p>{decision.summary}</p>
                    {decision.status !== "approved" ? (
                      <button
                        className="text-button"
                        onClick={() => void handleApproveDecision(decision.id)}
                        type="button"
                      >
                        Approve
                      </button>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </section>

          <section className="governance-section">
            <div className="governance-section-head">
              <strong>Memory Snapshot</strong>
              <span>{memories.length}</span>
            </div>
            <div className="governance-list">
              {memories.map((memory) => {
                const nextAction = getMemoryNextAction(memory.status);
                return (
                  <article className="governance-card" key={memory.id}>
                    <div className="governance-card-head">
                      <span className="status-tag">{memory.status}</span>
                      <span>{memory.memory_type}</span>
                    </div>
                    <p>{memory.content}</p>
                    {nextAction ? (
                      <button
                        className="text-button"
                        onClick={() => void handleTransitionMemory(memory.id, nextAction.value)}
                        type="button"
                      >
                        {nextAction.label}
                      </button>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </section>

          <section className="governance-section">
            <div className="governance-section-head">
              <strong>Constitution</strong>
              <span>{rules.length}</span>
            </div>
            <div className="governance-list">
              {rules.slice(0, 6).map((rule) => (
                <article className="governance-card" key={rule.id}>
                  <div className="governance-card-head">
                    <span className="status-tag">{rule.severity}</span>
                    <span>{rule.rule_code}</span>
                  </div>
                  <strong>{rule.name}</strong>
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
