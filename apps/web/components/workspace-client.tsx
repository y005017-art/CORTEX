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

export function WorkspaceClient({ project }: WorkspaceClientProps) {
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [rules, setRules] = useState<ConstitutionRule[]>([]);
  const [sessionTitle, setSessionTitle] = useState("");
  const [messageDraft, setMessageDraft] = useState("");
  const [decisionTitle, setDecisionTitle] = useState("");
  const [decisionSummary, setDecisionSummary] = useState("");
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingPanels, setLoadingPanels] = useState(true);
  const [submittingSession, setSubmittingSession] = useState(false);
  const [submittingMessage, setSubmittingMessage] = useState(false);
  const [submittingDecision, setSubmittingDecision] = useState(false);
  const [runningCoWork, setRunningCoWork] = useState(false);
  const [coworkStatus, setCoworkStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedSession = useMemo(
    () => chatSessions.find((session) => session.id === selectedSessionId) ?? null,
    [selectedSessionId, chatSessions]
  );

  const selectedThreadId = selectedSession?.thread_id ?? null;

  async function refreshChatSessions(preferredSessionId?: string) {
    setLoadingSessions(true);
    try {
      const data = await listChatSessions(project.id);
      setChatSessions(data);
      const nextSelected =
        preferredSessionId ??
        selectedSessionId ??
        (data.length > 0 ? data[0].id : null);
      setSelectedSessionId(nextSelected);
    } catch (err) {
      setError(err instanceof Error ? err.message : "載入聊天視窗失敗。");
    } finally {
      setLoadingSessions(false);
    }
  }

  async function refreshMessages(threadId: string) {
    setLoadingMessages(true);
    try {
      const data = await listMessages(threadId);
      setMessages(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "載入訊息失敗。");
    } finally {
      setLoadingMessages(false);
    }
  }

  async function refreshPanels() {
    setLoadingPanels(true);
    try {
      const [decisionData, roleData, ruleData] = await Promise.all([
        listDecisions(project.id),
        listRoles(),
        listRules(),
      ]);
      const memoryData = await listMemories(project.id);
      setDecisions(decisionData);
      setRoles(roleData);
      setRules(ruleData);
      setMemories(memoryData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "載入工作台側欄失敗。");
    } finally {
      setLoadingPanels(false);
    }
  }

  useEffect(() => {
    void refreshChatSessions();
  }, [project.id]);

  useEffect(() => {
    void refreshPanels();
  }, [project.id]);

  useEffect(() => {
    if (selectedSession?.thread_id) {
      void refreshMessages(selectedSession.thread_id);
    } else {
      setMessages([]);
    }
  }, [selectedSession]);

  async function handleCreateChatSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!sessionTitle.trim()) {
      setError("視窗名稱為必填。");
      return;
    }

    try {
      setSubmittingSession(true);
      setError(null);
      const session = await createChatSession(project.id, {
        title: sessionTitle.trim(),
        session_type: "group_chat",
      });
      setSessionTitle("");
      await refreshChatSessions(session.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "建立聊天視窗失敗。");
    } finally {
      setSubmittingSession(false);
    }
  }

  async function handleCreateMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedThreadId) {
      setError("請先建立或選擇聊天視窗。");
      return;
    }

    if (!messageDraft.trim()) {
      setError("訊息內容為必填。");
      return;
    }

    try {
      setSubmittingMessage(true);
      setError(null);
      await createMessage(selectedThreadId, {
        message_type: "user_goal",
        sender_type: "user",
        visibility: "project",
        content_text: messageDraft.trim(),
      });
      setMessageDraft("");
      await refreshMessages(selectedThreadId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "發送訊息失敗。");
    } finally {
      setSubmittingMessage(false);
    }
  }

  async function handleCreateDecision(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!decisionTitle.trim() || !decisionSummary.trim()) {
      setError("決策標題與摘要為必填。");
      return;
    }

    try {
      setSubmittingDecision(true);
      setError(null);
      await createDecision(project.id, {
        thread_id: selectedThreadId ?? undefined,
        title: decisionTitle.trim(),
        summary: decisionSummary.trim(),
      });
      setDecisionTitle("");
      setDecisionSummary("");
      await refreshPanels();
    } catch (err) {
      setError(err instanceof Error ? err.message : "建立決策失敗。");
    } finally {
      setSubmittingDecision(false);
    }
  }

  async function handleApproveDecision(decisionId: string) {
    try {
      setError(null);
      await approveDecision(decisionId);
      await Promise.all([
        refreshPanels(),
        selectedThreadId ? refreshMessages(selectedThreadId) : Promise.resolve(),
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "核准決策失敗。");
    }
  }

  async function handleTransitionMemory(memoryId: string, status: string) {
    try {
      setError(null);
      await transitionMemory(memoryId, status);
      await refreshPanels();
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新記憶失敗。");
    }
  }

  async function handleRunCoWork() {
    if (!selectedThreadId) {
      setError("請先選擇聊天視窗再執行 CoWork。");
      return;
    }

    try {
      setRunningCoWork(true);
      setError(null);
      const result = await runCoWork(selectedThreadId);
      const providerLabel = result.provider_key ? `，來源：${result.provider_key}` : "";
      setCoworkStatus(
        result.deduplicated
          ? `CoWork 已重用這個目標的最新分析${providerLabel}。`
          : `CoWork 已產生新的分析與提案${providerLabel}。`
      );
      await Promise.all([refreshMessages(selectedThreadId), refreshPanels()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "執行 CoWork 失敗。");
    } finally {
      setRunningCoWork(false);
    }
  }

  return (
    <main className="workspace-shell">
      <section className="workspace-topbar">
        <div>
          <p className="eyebrow">CORTEX 工作台</p>
          <h1>{project.name}</h1>
          <p className="summary">
            {project.description || "以多視窗聊天為主軸，整理工作脈絡、決策與記憶。"}
          </p>
        </div>
        <div className="workspace-stats">
          <div className="stat-card">
            <strong>{chatSessions.length}</strong>
            <span>聊天視窗</span>
          </div>
          <div className="stat-card">
            <strong>{decisions.length}</strong>
            <span>決策</span>
          </div>
          <div className="stat-card">
            <strong>{memories.length}</strong>
            <span>記憶</span>
          </div>
        </div>
      </section>

      <section className="workspace-platform">
        <aside className="surface workspace-column window-column">
          <div className="surface-header">
            <div>
              <p className="section-kicker">視窗總覽</p>
              <h2>聊天視窗</h2>
            </div>
            <span className="section-meta">共 {chatSessions.length} 個</span>
          </div>

          <form className="stack-gap compact-form" onSubmit={handleCreateChatSession}>
            <label className="field">
              <span>新增視窗</span>
              <input
                value={sessionTitle}
                onChange={(event) => setSessionTitle(event.target.value)}
                placeholder="例如：主規劃視窗"
              />
            </label>
            <button className="secondary-button" disabled={submittingSession} type="submit">
              {submittingSession ? "建立中..." : "建立視窗"}
            </button>
          </form>

          <div className="window-list">
            {loadingSessions ? <p className="empty-state">正在載入聊天視窗...</p> : null}
            {!loadingSessions && chatSessions.length === 0 ? (
              <p className="empty-state">目前還沒有聊天視窗。</p>
            ) : null}
            {chatSessions.map((session) => (
              <button
                className={session.id === selectedSessionId ? "window-card active" : "window-card"}
                key={session.id}
                onClick={() => setSelectedSessionId(session.id)}
                type="button"
              >
                <div className="window-card-head">
                  <strong>{session.title}</strong>
                  <span>{session.status}</span>
                </div>
                <p>{session.session_type === "group_chat" ? "群組視窗" : session.session_type}</p>
              </button>
            ))}
          </div>
        </aside>

        <section className="surface workspace-column active-column">
          <div className="surface-header">
            <div>
              <p className="section-kicker">目前視窗</p>
              <h2>{selectedSession?.title ?? "尚未選擇視窗"}</h2>
            </div>
            <span className="section-meta">{selectedSession?.status ?? "待選擇"}</span>
          </div>

          <div className="active-toolbar">
            <div className="active-toolbar-copy">
              <strong>工作流</strong>
              <span>在目前視窗推進目標、分析與後續決策。</span>
            </div>
            <button
              className="secondary-button"
              disabled={!selectedSession || runningCoWork}
              onClick={() => void handleRunCoWork()}
              type="button"
            >
              {runningCoWork ? "執行中..." : "執行 CoWork"}
            </button>
          </div>

          {coworkStatus ? <p className="status-banner">{coworkStatus}</p> : null}
          {error ? <p className="error-text">{error}</p> : null}

          <div className="message-surface">
            <div className="message-surface-head">
              <h3>訊息流</h3>
              <span>{messages.length} 則</span>
            </div>

            {loadingMessages ? <p className="empty-state">正在載入訊息...</p> : null}
            {!loadingMessages && !selectedSession ? (
              <p className="empty-state">請先建立或選擇聊天視窗。</p>
            ) : null}
            {!loadingMessages && selectedSession && messages.length === 0 ? (
              <p className="empty-state">目前還沒有訊息，先送出第一個目標。</p>
            ) : null}

            <div className="message-list">
              {messages.map((message) => (
                <article className="message-entry" key={message.id}>
                  <div className="message-entry-head">
                    <span className="message-chip">{message.sender_type}</span>
                    <span className="message-chip muted">{message.message_type}</span>
                  </div>
                  <p>{message.content_text}</p>
                </article>
              ))}
            </div>
          </div>

          <form className="composer-surface" onSubmit={handleCreateMessage}>
            <label className="field">
              <span>輸入訊息</span>
              <textarea
                disabled={!selectedSession}
                onChange={(event) => setMessageDraft(event.target.value)}
                placeholder="描述這個聊天視窗中的下一個目標或指令"
                rows={5}
                value={messageDraft}
              />
            </label>
            <button
              className="primary-button"
              disabled={!selectedSession || submittingMessage}
              type="submit"
            >
              {submittingMessage ? "發送中..." : "發送訊息"}
            </button>
          </form>
        </section>

        <aside className="workspace-column context-column">
          <section className="surface stack-gap">
            <div className="surface-header">
              <div>
                <p className="section-kicker">工作脈絡</p>
                <h2>決策</h2>
              </div>
              <span className="section-meta">共 {decisions.length} 筆</span>
            </div>

            <form className="compact-form" onSubmit={handleCreateDecision}>
              <label className="field">
                <span>決策標題</span>
                <input
                  onChange={(event) => setDecisionTitle(event.target.value)}
                  placeholder="例如：下一個核心步驟"
                  value={decisionTitle}
                />
              </label>
              <label className="field">
                <span>摘要</span>
                <textarea
                  onChange={(event) => setDecisionSummary(event.target.value)}
                  placeholder="清楚描述這項決策"
                  rows={4}
                  value={decisionSummary}
                />
              </label>
              <button className="secondary-button" disabled={submittingDecision} type="submit">
                {submittingDecision ? "建立中..." : "建立決策"}
              </button>
            </form>

            <div className="context-list">
              {loadingPanels ? <p className="empty-state">正在載入決策...</p> : null}
              {decisions.map((decision) => (
                <article className="context-card" key={decision.id}>
                  <div className="context-card-head">
                    <strong>{decision.title}</strong>
                    <span>{decision.status}</span>
                  </div>
                  <p>{decision.summary}</p>
                  <div className="context-card-foot">
                    <span>
                      {decision.approved_by
                        ? `核准者：${decision.approved_by}`
                        : `提案者：${decision.proposed_by ?? "未知"}`}
                    </span>
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
                <p className="section-kicker">工作脈絡</p>
                <h2>記憶</h2>
              </div>
              <span className="section-meta">共 {memories.length} 筆</span>
            </div>

            <div className="context-list">
              {loadingPanels ? <p className="empty-state">正在載入記憶...</p> : null}
              {memories.map((memory) => (
                <article className="context-card" key={memory.id}>
                  <div className="context-card-head">
                    <strong>{memory.memory_type}</strong>
                    <span>{memory.status}</span>
                  </div>
                  <p>{memory.content}</p>
                  <div className="context-card-foot">
                    <span>
                      {memory.approved_by
                        ? `核准者：${memory.approved_by}`
                        : "等待核准資訊"}
                    </span>
                    <div className="inline-actions">
                      {memory.status === "verified" ? (
                        <button
                          className="text-button"
                          onClick={() => void handleTransitionMemory(memory.id, "locked")}
                          type="button"
                        >
                          鎖定
                        </button>
                      ) : null}
                      {memory.status === "draft" ? (
                        <button
                          className="text-button"
                          onClick={() => void handleTransitionMemory(memory.id, "verified")}
                          type="button"
                        >
                          驗證
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
                <p className="section-kicker">角色與治理</p>
                <h2>角色</h2>
              </div>
              <span className="section-meta">共 {roles.length} 個</span>
            </div>

            <div className="context-list">
              {loadingPanels ? <p className="empty-state">正在載入角色...</p> : null}
              {roles.map((role) => (
                <article className="context-card" key={role.id}>
                  <div className="context-card-head">
                    <strong>{role.name}</strong>
                    <span>{role.role_type}</span>
                  </div>
                  <p>{role.description ?? "尚無描述。"}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="surface stack-gap">
            <div className="surface-header">
              <div>
                <p className="section-kicker">角色與治理</p>
                <h2>憲章規則</h2>
              </div>
              <span className="section-meta">共 {rules.length} 條</span>
            </div>

            <div className="context-list">
              {loadingPanels ? <p className="empty-state">正在載入規則...</p> : null}
              {rules.map((rule) => (
                <article className="context-card" key={rule.id}>
                  <div className="context-card-head">
                    <strong>{rule.rule_code}</strong>
                    <span>{rule.enforcement_action}</span>
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
