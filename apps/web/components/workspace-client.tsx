"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

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

type MessageMap = Record<string, Message[]>;
type DraftMap = Record<string, string>;
type BusyMap = Record<string, boolean>;
type StatusMap = Record<string, string | null>;
type ProviderSelectionMap = Record<string, string>;

const DEFAULT_ROLE_BLUEPRINTS: RoleWindowDefinition[] = [
  {
    id: "preset-lead",
    name: "LEAD",
    role_type: "lead",
    status: "standby",
    description: "負責拆解任務、整合進度、推進跨角色協作。",
    roleId: null,
  },
  {
    id: "preset-dba",
    name: "DBA",
    role_type: "database",
    status: "standby",
    description: "負責資料結構、查詢、遷移與資料治理風險。",
    roleId: null,
  },
  {
    id: "preset-mcp",
    name: "MCP",
    role_type: "tools",
    status: "standby",
    description: "負責工具能力、連接器與外部工作面接軌。",
    roleId: null,
  },
  {
    id: "preset-skill",
    name: "SKILL",
    role_type: "prompting",
    status: "standby",
    description: "負責技能、工作方法、提示結構與操作準則。",
    roleId: null,
  },
  {
    id: "preset-front",
    name: "FRONT",
    role_type: "frontend",
    status: "standby",
    description: "負責介面、互動流程、視窗體驗與可用性。",
    roleId: null,
  },
  {
    id: "preset-security",
    name: "SECURITY",
    role_type: "security",
    status: "standby",
    description: "負責權限、風險邊界、訊息與記憶污染防護。",
    roleId: null,
  },
  {
    id: "preset-aibe",
    name: "AIBE",
    role_type: "governance",
    status: "standby",
    description: "負責治理規格、決策路由、合規與階段門檻。",
    roleId: null,
  },
  {
    id: "preset-cmo",
    name: "CMO",
    role_type: "strategy",
    status: "standby",
    description: "負責對外敘事、商業視角與交付包裝。",
    roleId: null,
  },
];

const PROVIDER_TEMPLATES: ProviderTemplate[] = [
  {
    key: "chatgpt",
    label: "ChatGPT",
    workspaceUrl: "https://chatgpt.com",
    guidance: "適合統整任務、快速拆解與多步協作指令。",
  },
  {
    key: "claude",
    label: "Claude",
    workspaceUrl: "https://claude.ai",
    guidance: "適合長文分析、規格檢查與高密度推理工作。",
  },
  {
    key: "gemini",
    label: "Gemini",
    workspaceUrl: "https://gemini.google.com",
    guidance: "適合研究、整理資料與 Google 生態協作。",
  },
  {
    key: "deepseek",
    label: "DeepSeek",
    workspaceUrl: "https://chat.deepseek.com",
    guidance: "適合工程討論、程式推理與成本敏感場景。",
  },
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
  const projectSummary = project.description?.trim() || "尚未補充專案描述。";

  return [
    `你現在是 CORTEX 專案「${project.name}」中的角色工作視窗。`,
    `角色名稱：${role.name}`,
    `角色職責：${role.description}`,
    `專案說明：${projectSummary}`,
    "",
    "請遵守以下工作方式：",
    "1. 只從這個角色的責任範圍回應。",
    "2. 先整理需求，再提出可執行工作項目。",
    "3. 回覆時標示：收件、分析、下一步、風險。",
    "4. 不直接跳過治理與決策流程。",
    "5. 若資訊不足，先提出你需要的補充上下文。",
  ].join("\n");
}

function summarizeRole(role: Role): string {
  return role.description || "此角色尚未補充工作說明。";
}

function getProviderTemplate(providerKey?: string | null): ProviderTemplate {
  return (
    PROVIDER_TEMPLATES.find((entry) => entry.key === providerKey) ?? PROVIDER_TEMPLATES[0]
  );
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

  const roleDefinitions = useMemo<RoleWindowDefinition[]>(() => {
    if (roles.length === 0) {
      return DEFAULT_ROLE_BLUEPRINTS;
    }

    return [...roles]
      .sort((left, right) => {
        if (left.is_permanent !== right.is_permanent) {
          return left.is_permanent ? -1 : 1;
        }
        return left.name.localeCompare(right.name, "zh-Hant");
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

  const externalChatSessions = useMemo(
    () => roleWindows.filter((entry) => Boolean(entry.session)).length,
    [roleWindows]
  );

  async function refreshMessages(sessions: ChatSession[]) {
    if (sessions.length === 0) {
      setMessagesByThread({});
      return;
    }

    setLoadingMessages(true);
    try {
      const entries = await Promise.all(
        sessions.map(async (session) => [session.thread_id, await listMessages(session.thread_id)] as const)
      );
      setMessagesByThread(Object.fromEntries(entries));
    } catch (err) {
      setError(err instanceof Error ? err.message : "讀取聊天紀錄時發生問題。");
    } finally {
      setLoadingMessages(false);
    }
  }

  async function refreshWorkspace() {
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
      setChatSessions(sessionData);
      setDecisions(decisionData);
      setMemories(memoryData);
      setRoles(roleData);
      setRules(ruleData);
      await refreshMessages(sessionData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "載入工作台時發生問題。");
    } finally {
      setLoadingWorkspace(false);
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
      setError("已產生啟動提示，但這次無法自動複製到剪貼簿。");
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
      const session = await createChatSession(project.id, {
        title: role.name,
        session_type: "role_chat",
        role_id: role.roleId ?? undefined,
        provider_site: provider.key,
        workspace_url: provider.workspaceUrl,
        launch_mode: "external_tab",
        startup_prompt: startupPrompt,
      });

      if (popup && session.workspace_url) {
        popup.location.href = session.workspace_url;
      }

      await copyPrompt(startupPrompt, `已為 ${role.name} 建立 ${provider.label} 工作視窗，啟動提示也已複製。`);
      await refreshWorkspace();
    } catch (err) {
      popup?.close();
      setError(err instanceof Error ? err.message : "建立角色工作視窗時發生問題。");
    } finally {
      setCreatingRoleSessionId(null);
    }
  }

  async function handleCreateQuickSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!quickSessionTitle.trim()) {
      setError("請先輸入協調視窗名稱。");
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
      setError(err instanceof Error ? err.message : "建立協調視窗時發生問題。");
    } finally {
      setCreatingQuickSession(false);
    }
  }

  async function handleSendMessage(session: ChatSession) {
    const draft = messageDrafts[session.thread_id]?.trim() ?? "";
    if (!draft) {
      setError(`請先輸入要記錄到 ${session.title} 的工作摘記。`);
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
      await refreshMessages(chatSessions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "寫入工作摘記時發生問題。");
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
      const providerText = result.provider_key ? ` / 來源 ${result.provider_key}` : "";
      setCoworkStatus((current) => ({
        ...current,
        [session.thread_id]: result.deduplicated
          ? `CoWork 已完成，結果已與既有決策整合${providerText}`
          : `CoWork 已完成，已新增分析結果${providerText}`,
      }));
      await Promise.all([refreshMessages(chatSessions), refreshWorkspace()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "執行 CoWork 時發生問題。");
    } finally {
      setRunningCoWork((current) => ({ ...current, [session.thread_id]: false }));
    }
  }

  async function handleCreateDecision(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!decisionTitle.trim() || !decisionSummary.trim()) {
      setError("請完整輸入決策標題與摘要。");
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
      setError(err instanceof Error ? err.message : "建立決策時發生問題。");
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
      setError(err instanceof Error ? err.message : "核准決策時發生問題。");
    }
  }

  async function handleTransitionMemory(memoryId: string, status: string) {
    try {
      setError(null);
      setNotice(null);
      await transitionMemory(memoryId, status);
      await refreshWorkspace();
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新記憶狀態時發生問題。");
    }
  }

  return (
    <main className="workspace-shell">
      <section className="workspace-hero">
        <div className="workspace-hero-copy">
          <p className="eyebrow">CORTEX</p>
          <h1>{project.name}</h1>
          <p className="summary">
            {project.description || "這個專案會以多角色 chat workspace 的方式同步推進。"}
          </p>
        </div>
        <div className="workspace-hero-stats">
          <div className="hero-stat">
            <strong>{roleWindows.length}</strong>
            <span>角色工作位</span>
          </div>
          <div className="hero-stat">
            <strong>{externalChatSessions}</strong>
            <span>已綁定外部 Chat</span>
          </div>
          <div className="hero-stat">
            <strong>{decisions.length}</strong>
            <span>決策</span>
          </div>
          <div className="hero-stat">
            <strong>{memories.length}</strong>
            <span>記憶</span>
          </div>
        </div>
      </section>

      {notice ? <p className="status-banner workspace-banner">{notice}</p> : null}
      {error ? <p className="error-text workspace-banner">{error}</p> : null}

      <section className="workspace-layout-v2">
        <section className="surface command-surface">
          <div className="surface-header">
            <div>
              <p className="section-kicker">總覽</p>
              <h2>角色工作台控制面</h2>
            </div>
            <span className="section-meta">{loadingWorkspace ? "載入中" : "已同步"}</span>
          </div>

          <div className="command-grid">
            <div className="command-card">
              <strong>已啟用角色</strong>
              <span>
                {roleWindows.filter((entry) => entry.session).length} / {roleWindows.length}
              </span>
            </div>
            <div className="command-card">
              <strong>外部 Chat</strong>
              <span>{externalChatSessions}</span>
            </div>
            <div className="command-card">
              <strong>規則條目</strong>
              <span>{rules.length}</span>
            </div>
            <div className="command-card">
              <strong>有效記憶</strong>
              <span>{memories.filter((entry) => entry.status !== "archived").length}</span>
            </div>
          </div>

          <div className="surface-note">
            主流 chat web 多半禁止直接嵌入頁面，所以 CORTEX 這一層改成管理每個角色的真實 chat 工作視窗。
          </div>

          <form className="compact-form command-form" onSubmit={handleCreateQuickSession}>
            <label className="field">
              <span>新增協調視窗</span>
              <input
                value={quickSessionTitle}
                onChange={(event) => setQuickSessionTitle(event.target.value)}
                placeholder="例如：整體協調、交付審查、風險彙整"
              />
            </label>
            <button className="secondary-button" disabled={creatingQuickSession} type="submit">
              {creatingQuickSession ? "建立中..." : "建立協調視窗"}
            </button>
          </form>
        </section>

        <section className="role-chat-wall">
          <div className="surface-header role-wall-header">
            <div>
              <p className="section-kicker">主工作區</p>
              <h2>角色 Chat Workspace 牆</h2>
            </div>
            <span className="section-meta">每個角色綁定自己的真實 chat 工作頁</span>
          </div>

          {loadingWorkspace ? <p className="empty-state">正在載入角色工作牆...</p> : null}

          <div className="role-chat-grid">
            {roleWindows.map(({ role, session }) => {
              const threadId = session?.thread_id ?? "";
              const messages = threadId ? messagesByThread[threadId] ?? [] : [];
              const latestMessage = messages[messages.length - 1] ?? null;
              const draft = threadId ? messageDrafts[threadId] ?? "" : "";
              const isSending = threadId ? submittingMessages[threadId] ?? false : false;
              const isRunning = threadId ? runningCoWork[threadId] ?? false : false;
              const statusText = threadId ? coworkStatus[threadId] : null;
              const provider = getProviderTemplate(session?.provider_site ?? providerSelections[role.id]);
              const startupPrompt = session?.startup_prompt ?? buildStartupPrompt(project, role);
              const resolvedWorkspaceUrl = session?.workspace_url || provider.workspaceUrl;

              return (
                <article className="role-window" key={role.id}>
                  <div className="role-window-head">
                    <div>
                      <p className="role-window-kicker">{role.role_type}</p>
                      <h3>{role.name}</h3>
                    </div>
                    <div className="role-window-badges">
                      <span className="mini-badge">{role.status}</span>
                      <span className={session ? "mini-badge ready" : "mini-badge idle"}>
                        {session ? "已綁定" : "未建立"}
                      </span>
                    </div>
                  </div>

                  <p className="role-window-description">{role.description}</p>

                  {session ? (
                    <>
                      <div className="session-workspace-card">
                        <div className="session-workspace-head">
                          <strong>{provider.label}</strong>
                          <span>{session.launch_mode === "external_tab" ? "外部工作視窗" : session.launch_mode}</span>
                        </div>
                        <p>{provider.guidance}</p>
                        <div className="role-window-meta">
                          <span>Session：{session.session_type}</span>
                          <span>訊息數：{messages.length}</span>
                        </div>
                        <div className="role-window-actions">
                          <button
                            className="secondary-button"
                            onClick={() => {
                              if (resolvedWorkspaceUrl) {
                                window.open(resolvedWorkspaceUrl, "_blank", "noopener,noreferrer");
                              }
                            }}
                            type="button"
                          >
                            開啟 {provider.label}
                          </button>
                          <button
                            className="secondary-button"
                            onClick={() => void copyPrompt(startupPrompt, `${role.name} 的啟動提示已複製。`)}
                            type="button"
                          >
                            複製啟動提示
                          </button>
                        </div>
                        <pre className="prompt-preview">{startupPrompt}</pre>
                      </div>

                      {statusText ? <p className="status-banner compact">{statusText}</p> : null}

                      <div className="role-window-stream">
                        {loadingMessages && messages.length === 0 ? (
                          <p className="empty-state">正在同步工作摘記...</p>
                        ) : null}
                        {messages.length === 0 ? (
                          <p className="empty-state">這個角色已綁定外部 Chat，現在可以開始派工與記錄進度。</p>
                        ) : null}
                        {messages.slice(-4).map((message) => (
                          <article className="chat-line" key={message.id}>
                            <div className="chat-line-head">
                              <span className="message-chip">{message.sender_type}</span>
                              <span className="mini-meta">{formatTime(message.created_at)}</span>
                            </div>
                            <p>{message.content_text}</p>
                          </article>
                        ))}
                      </div>

                      <div className="role-window-summary">
                        <strong>目前狀態</strong>
                        <p>{latestMessage ? latestMessage.content_text : "尚未收到角色回報。"}</p>
                      </div>

                      <label className="field">
                        <span>記錄這個角色從外部 Chat 帶回來的工作摘記</span>
                        <textarea
                          rows={4}
                          value={draft}
                          onChange={(event) => updateDraft(threadId, event.target.value)}
                          placeholder={`把 ${role.name} 在外部 chat 的結果、摘要或下一步記錄回 CORTEX`}
                        />
                      </label>

                      <div className="role-window-actions">
                        <button
                          className="primary-button"
                          disabled={isSending}
                          onClick={() => void handleSendMessage(session)}
                          type="button"
                        >
                          {isSending ? "寫入中..." : "寫回 CORTEX 記錄"}
                        </button>
                        <button
                          className="secondary-button"
                          disabled={isRunning}
                          onClick={() => void handleRunCoWork(session)}
                          type="button"
                        >
                          {isRunning ? "執行中..." : "執行 CoWork"}
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="role-window-empty">
                      <div className="field">
                        <span>選擇這個角色要使用的 Chat 工作站</span>
                        <select
                          className="provider-select"
                          value={providerSelections[role.id] ?? PROVIDER_TEMPLATES[0].key}
                          onChange={(event) => updateProviderSelection(role.id, event.target.value)}
                        >
                          {PROVIDER_TEMPLATES.map((entry) => (
                            <option key={entry.key} value={entry.key}>
                              {entry.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <p>{provider.guidance}</p>
                      <pre className="prompt-preview">{startupPrompt}</pre>
                      <button
                        className="primary-button"
                        disabled={creatingRoleSessionId === role.id}
                        onClick={() => void handleCreateRoleSession(role)}
                        type="button"
                      >
                        {creatingRoleSessionId === role.id
                          ? "建立中..."
                          : `建立 ${provider.label} 工作視窗`}
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>

        <aside className="workspace-sidepanel">
          <section className="surface stack-gap">
            <div className="surface-header">
              <div>
                <p className="section-kicker">治理</p>
                <h2>決策板</h2>
              </div>
              <span className="section-meta">{decisions.length} 筆</span>
            </div>

            <form className="compact-form" onSubmit={handleCreateDecision}>
              <label className="field">
                <span>決策標題</span>
                <input
                  value={decisionTitle}
                  onChange={(event) => setDecisionTitle(event.target.value)}
                  placeholder="例如：以多角色外部 Chat 方式推進第一階段"
                />
              </label>
              <label className="field">
                <span>決策摘要</span>
                <textarea
                  rows={4}
                  value={decisionSummary}
                  onChange={(event) => setDecisionSummary(event.target.value)}
                  placeholder="記下採用原因、適用範圍與限制"
                />
              </label>
              <button className="secondary-button" disabled={creatingDecision} type="submit">
                {creatingDecision ? "建立中..." : "新增決策"}
              </button>
            </form>

            <div className="context-list">
              {decisions.map((decision) => (
                <article className="context-card" key={decision.id}>
                  <div className="context-card-head">
                    <strong>{decision.title}</strong>
                    <span>{decision.status}</span>
                  </div>
                  <p>{decision.summary}</p>
                  <div className="context-card-foot">
                    <span>{decision.approved_by ? `核准者：${decision.approved_by}` : "待核准"}</span>
                    {decision.status !== "approved" ? (
                      <button
                        className="text-button"
                        onClick={() => void handleApproveDecision(decision.id)}
                        type="button"
                      >
                        核准
                      </button>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="surface stack-gap">
            <div className="surface-header">
              <div>
                <p className="section-kicker">記憶</p>
                <h2>專案記憶庫</h2>
              </div>
              <span className="section-meta">{memories.length} 筆</span>
            </div>

            <div className="context-list">
              {memories.map((memory) => (
                <article className="context-card" key={memory.id}>
                  <div className="context-card-head">
                    <strong>{memory.memory_type}</strong>
                    <span>{memory.status}</span>
                  </div>
                  <p>{memory.content}</p>
                  <div className="context-card-foot">
                    <span>{memory.approved_by ? `核准者：${memory.approved_by}` : "尚未核准"}</span>
                    <div className="inline-actions">
                      {memory.status === "draft" ? (
                        <button
                          className="text-button"
                          onClick={() => void handleTransitionMemory(memory.id, "verified")}
                          type="button"
                        >
                          驗證
                        </button>
                      ) : null}
                      {memory.status === "verified" ? (
                        <button
                          className="text-button"
                          onClick={() => void handleTransitionMemory(memory.id, "locked")}
                          type="button"
                        >
                          鎖定
                        </button>
                      ) : null}
                      {memory.status !== "archived" ? (
                        <button
                          className="text-button"
                          onClick={() => void handleTransitionMemory(memory.id, "archived")}
                          type="button"
                        >
                          封存
                        </button>
                      ) : null}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="surface stack-gap">
            <div className="surface-header">
              <div>
                <p className="section-kicker">規則</p>
                <h2>Constitution</h2>
              </div>
              <span className="section-meta">{rules.length} 條</span>
            </div>

            <div className="context-list">
              {rules.slice(0, 6).map((rule) => (
                <article className="context-card" key={rule.id}>
                  <div className="context-card-head">
                    <strong>{rule.rule_code}</strong>
                    <span>{rule.severity}</span>
                  </div>
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
