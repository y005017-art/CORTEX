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
  isPreset: boolean;
  description: string;
  roleId: string | null;
};

type MessageMap = Record<string, Message[]>;
type DraftMap = Record<string, string>;
type BusyMap = Record<string, boolean>;
type StatusMap = Record<string, string | null>;

const DEFAULT_ROLE_BLUEPRINTS: Array<Omit<RoleWindowDefinition, "isPreset" | "roleId">> = [
  {
    id: "preset-lead",
    name: "LEAD",
    role_type: "lead",
    status: "standby",
    description: "負責拆解任務、整合進度、推進跨角色協作。",
  },
  {
    id: "preset-dba",
    name: "DBA",
    role_type: "database",
    status: "standby",
    description: "負責資料結構、遷移策略、查詢與資料治理風險。",
  },
  {
    id: "preset-mcp",
    name: "MCP",
    role_type: "tools",
    status: "standby",
    description: "負責工具調度、系統連接、外部能力接軌。",
  },
  {
    id: "preset-skill",
    name: "SKILL",
    role_type: "prompting",
    status: "standby",
    description: "負責技能模組、工作方法、提示組裝與規則落地。",
  },
  {
    id: "preset-front",
    name: "FRONT",
    role_type: "frontend",
    status: "standby",
    description: "負責介面、互動流程、視窗體驗與使用者操作感。",
  },
  {
    id: "preset-security",
    name: "SECURITY",
    role_type: "security",
    status: "standby",
    description: "負責權限、風險邊界、訊息與記憶污染防護。",
  },
  {
    id: "preset-aibe",
    name: "AIBE",
    role_type: "governance",
    status: "standby",
    description: "負責治理規格、決策路由、合規與階段門檻。",
  },
  {
    id: "preset-cmo",
    name: "CMO",
    role_type: "strategy",
    status: "standby",
    description: "負責對外敘事、商業視角與交付包裝。",
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

function summarizeRole(role: Role): string {
  return role.description || "此角色尚未補充工作說明。";
}

export function WorkspaceClient({ project }: WorkspaceClientProps) {
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [messagesByThread, setMessagesByThread] = useState<MessageMap>({});
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [rules, setRules] = useState<ConstitutionRule[]>([]);
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
  const [error, setError] = useState<string | null>(null);

  const roleDefinitions = useMemo<RoleWindowDefinition[]>(() => {
    if (roles.length > 0) {
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
          isPreset: false,
          description: summarizeRole(role),
          roleId: role.id,
        }));
    }

    return DEFAULT_ROLE_BLUEPRINTS.map((role) => ({
      ...role,
      isPreset: true,
      roleId: null,
    }));
  }, [roles]);

  const roleWindows = useMemo(
    () =>
      roleDefinitions.map((role) => {
        const session =
          (role.roleId ? chatSessions.find((entry) => entry.role_id === role.roleId) : null) ??
          chatSessions.find((entry) => entry.title.trim().toUpperCase() === role.name.trim().toUpperCase()) ??
          null;
        return { role, session };
      }),
    [chatSessions, roleDefinitions]
  );

  const orphanSessions = useMemo(
    () => chatSessions.filter((session) => !session.role_id),
    [chatSessions]
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
      setError(err instanceof Error ? err.message : "讀取聊天內容時發生問題。");
    } finally {
      setLoadingMessages(false);
    }
  }

  async function refreshWorkspace() {
    setLoadingWorkspace(true);
    try {
      setError(null);
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

  function updateDraft(threadId: string, value: string) {
    setMessageDrafts((current) => ({
      ...current,
      [threadId]: value,
    }));
  }

  async function handleCreateRoleSession(role: RoleWindowDefinition) {
    try {
      setCreatingRoleSessionId(role.id);
      setError(null);
      await createChatSession(project.id, {
        title: role.name,
        session_type: "role_chat",
        role_id: role.roleId ?? undefined,
      });
      await refreshWorkspace();
    } catch (err) {
      setError(err instanceof Error ? err.message : "建立角色視窗時發生問題。");
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
      setError(`請先輸入 ${session.title} 的工作內容。`);
      return;
    }

    try {
      setSubmittingMessages((current) => ({ ...current, [session.thread_id]: true }));
      setError(null);
      await createMessage(session.thread_id, {
        message_type: "user_goal",
        sender_type: "user",
        visibility: "project",
        content_text: draft,
      });
      setMessageDrafts((current) => ({ ...current, [session.thread_id]: "" }));
      await refreshMessages(chatSessions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "送出訊息時發生問題。");
    } finally {
      setSubmittingMessages((current) => ({ ...current, [session.thread_id]: false }));
    }
  }

  async function handleRunCoWork(session: ChatSession) {
    try {
      setRunningCoWork((current) => ({ ...current, [session.thread_id]: true }));
      setError(null);
      const result = await runCoWork(session.thread_id);
      const providerText = result.provider_key ? ` / 來源 ${result.provider_key}` : "";
      setCoworkStatus((current) => ({
        ...current,
        [session.thread_id]: result.deduplicated
          ? `CoWork 已完成，結果與既有決策合併${providerText}`
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
      await approveDecision(decisionId);
      await refreshWorkspace();
    } catch (err) {
      setError(err instanceof Error ? err.message : "核准決策時發生問題。");
    }
  }

  async function handleTransitionMemory(memoryId: string, status: string) {
    try {
      setError(null);
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
            {project.description || "這個專案會以多角色工作 chat 的方式同步推進。"}
          </p>
        </div>
        <div className="workspace-hero-stats">
          <div className="hero-stat">
            <strong>{roleWindows.length}</strong>
            <span>角色視窗</span>
          </div>
          <div className="hero-stat">
            <strong>{chatSessions.length}</strong>
            <span>聊天工作區</span>
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

      {error ? <p className="error-text workspace-banner">{error}</p> : null}

      <section className="workspace-layout-v2">
        <section className="surface command-surface">
          <div className="surface-header">
            <div>
              <p className="section-kicker">總覽</p>
              <h2>協作指揮台</h2>
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
              <strong>協調視窗</strong>
              <span>{orphanSessions.length}</span>
            </div>
            <div className="command-card">
              <strong>規則條目</strong>
              <span>{rules.length}</span>
            </div>
            <div className="command-card">
              <strong>最新記憶</strong>
              <span>{memories.filter((entry) => entry.status !== "archived").length}</span>
            </div>
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
              <h2>角色工作 Chat 牆</h2>
            </div>
            <span className="section-meta">所有角色各自持有自己的工作視窗</span>
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
                        {session ? "已啟用" : "未建立"}
                      </span>
                    </div>
                  </div>

                  <p className="role-window-description">{role.description}</p>

                  {session ? (
                    <>
                      <div className="role-window-meta">
                        <span>視窗類型：{session.session_type}</span>
                        <span>訊息數：{messages.length}</span>
                      </div>

                      {statusText ? <p className="status-banner compact">{statusText}</p> : null}

                      <div className="role-window-stream">
                        {loadingMessages && messages.length === 0 ? (
                          <p className="empty-state">正在同步聊天內容...</p>
                        ) : null}

                        {messages.length === 0 ? (
                          <p className="empty-state">這個角色視窗已建立，現在可以派工作給它。</p>
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
                        <p>
                          {latestMessage
                            ? latestMessage.content_text
                            : "尚未收到工作指令。"}
                        </p>
                      </div>

                      <label className="field">
                        <span>派給 {role.name} 的工作內容</span>
                        <textarea
                          rows={4}
                          value={draft}
                          onChange={(event) => updateDraft(threadId, event.target.value)}
                          placeholder={`輸入要交給 ${role.name} 的任務、上下文或檢查要求`}
                        />
                      </label>

                      <div className="role-window-actions">
                        <button
                          className="primary-button"
                          disabled={isSending}
                          onClick={() => void handleSendMessage(session)}
                          type="button"
                        >
                          {isSending ? "送出中..." : "送進此角色視窗"}
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
                      <p>這個角色還沒有自己的聊天視窗。建立後就能獨立收任務、保留對話與工作狀態。</p>
                      <button
                        className="primary-button"
                        disabled={creatingRoleSessionId === role.id}
                        onClick={() => void handleCreateRoleSession(role)}
                        type="button"
                      >
                        {creatingRoleSessionId === role.id ? "建立中..." : "建立角色工作 Chat"}
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
                  placeholder="例如：第一階段先完成角色 chat 牆"
                />
              </label>
              <label className="field">
                <span>決策摘要</span>
                <textarea
                  rows={4}
                  value={decisionSummary}
                  onChange={(event) => setDecisionSummary(event.target.value)}
                  placeholder="記下這項決策的原因、範圍與限制"
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
