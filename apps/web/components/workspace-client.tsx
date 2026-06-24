"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import {
  approveDecision,
  ChatSession,
  createChatSession,
  createMessage,
  createDecision,
  Decision,
  listMemories,
  listDecisions,
  listRoles,
  listRules,
  listChatSessions,
  Memory,
  listMessages,
  Message,
  Project,
  Role,
  ConstitutionRule,
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
      setError(err instanceof Error ? err.message : "Failed to load chat sessions.");
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
      setError(err instanceof Error ? err.message : "Failed to load messages.");
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
      setError(err instanceof Error ? err.message : "Failed to load workspace panels.");
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
      setError("Session title is required.");
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
      setError(err instanceof Error ? err.message : "Failed to create chat session.");
    } finally {
      setSubmittingSession(false);
    }
  }

  async function handleCreateMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedThreadId) {
      setError("Create a chat session before sending a message.");
      return;
    }

    if (!messageDraft.trim()) {
      setError("Message is required.");
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
      setError(err instanceof Error ? err.message : "Failed to send message.");
    } finally {
      setSubmittingMessage(false);
    }
  }

  async function handleCreateDecision(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!decisionTitle.trim() || !decisionSummary.trim()) {
      setError("Decision title and summary are required.");
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
      setError(err instanceof Error ? err.message : "Failed to create decision.");
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
      setError(err instanceof Error ? err.message : "Failed to approve decision.");
    }
  }

  async function handleTransitionMemory(memoryId: string, status: string) {
    try {
      setError(null);
      await transitionMemory(memoryId, status);
      await refreshPanels();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update memory.");
    }
  }

  async function handleRunCoWork() {
    if (!selectedThreadId) {
      setError("Select a chat session before running CoWork.");
      return;
    }

    try {
      setRunningCoWork(true);
      setError(null);
      const result = await runCoWork(selectedThreadId);
      const providerLabel = result.provider_key ? ` via ${result.provider_key}` : "";
      setCoworkStatus(
        result.deduplicated
          ? `CoWork reused the latest analysis for this goal${providerLabel}.`
          : `CoWork generated a fresh analysis and proposal${providerLabel}.`
      );
      await Promise.all([refreshMessages(selectedThreadId), refreshPanels()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run CoWork.");
    } finally {
      setRunningCoWork(false);
    }
  }

  return (
    <main className="workspace-shell">
      <section className="workspace-header">
        <div>
          <p className="eyebrow">Workspace</p>
          <h1>{project.name}</h1>
          <p className="summary">
            {project.description || "Structured project workspace connected to the live CORTEX API."}
          </p>
        </div>
      </section>

      <section className="workspace-grid workspace-grid-wide">
        <aside className="panel sidebar stack-gap">
          <div className="panel-header">
            <h2>Chat Sessions</h2>
            <span>{chatSessions.length} total</span>
          </div>

          <form className="stack-gap compact-form" onSubmit={handleCreateChatSession}>
            <label className="field">
              <span>New session</span>
              <input
                value={sessionTitle}
                onChange={(event) => setSessionTitle(event.target.value)}
                placeholder="Initial planning window"
              />
            </label>

            <button className="secondary-button" disabled={submittingSession} type="submit">
              {submittingSession ? "Creating..." : "Create Session"}
            </button>
          </form>

          <div className="thread-list">
            {loadingSessions ? <p className="empty-state">Loading chat sessions...</p> : null}

            {!loadingSessions && chatSessions.length === 0 ? (
              <p className="empty-state">No chat sessions yet.</p>
            ) : null}

            {chatSessions.map((session) => (
              <button
                className={session.id === selectedSessionId ? "thread-item active" : "thread-item"}
                key={session.id}
                onClick={() => setSelectedSessionId(session.id)}
                type="button"
              >
                <strong>{session.title}</strong>
                <span>{session.session_type}</span>
              </button>
            ))}
          </div>
        </aside>

        <section className="panel conversation stack-gap">
          <div className="panel-header">
            <h2>{selectedSession?.title ?? "Group Chat"}</h2>
            <span>{selectedSession ? selectedSession.status : "No session selected"}</span>
          </div>

          <div className="inline-actions">
            <span className="mini-meta">
              Run CoWork to analyze the latest user goal in this thread.
            </span>
            <button
              className="secondary-button"
              disabled={!selectedSession || runningCoWork}
              onClick={() => void handleRunCoWork()}
              type="button"
            >
              {runningCoWork ? "Running..." : "Run CoWork"}
            </button>
          </div>

          {coworkStatus ? <p className="mini-meta">{coworkStatus}</p> : null}

          {error ? <p className="error-text">{error}</p> : null}

          <div className="message-stream">
            {loadingMessages ? <p className="empty-state">Loading messages...</p> : null}

            {!loadingMessages && !selectedSession ? (
              <p className="empty-state">Create or select a chat session to begin.</p>
            ) : null}

            {!loadingMessages && selectedSession && messages.length === 0 ? (
              <p className="empty-state">No messages yet. Send the first goal.</p>
            ) : null}

            {messages.map((message) => (
              <article className="message-card" key={message.id}>
                <div className="message-meta">
                  <strong>{message.sender_type}</strong>
                  <span>{message.message_type}</span>
                </div>
                <p>{message.content_text}</p>
              </article>
            ))}
          </div>

          <form className="composer" onSubmit={handleCreateMessage}>
            <label className="field">
              <span>Message</span>
              <textarea
                disabled={!selectedSession}
                onChange={(event) => setMessageDraft(event.target.value)}
                placeholder="Describe the next goal or instruction for this chat session"
                rows={5}
                value={messageDraft}
              />
            </label>

            <button
              className="primary-button"
              disabled={!selectedSession || submittingMessage}
              type="submit"
            >
              {submittingMessage ? "Sending..." : "Send Message"}
            </button>
          </form>
        </section>

        <aside className="panel detail-sidebar stack-gap">
          <section className="stack-gap">
            <div className="panel-header">
              <h2>Decisions</h2>
              <span>{decisions.length} total</span>
            </div>

            <form className="compact-form" onSubmit={handleCreateDecision}>
              <label className="field">
                <span>Decision title</span>
                <input
                  onChange={(event) => setDecisionTitle(event.target.value)}
                  placeholder="Foundation next step"
                  value={decisionTitle}
                />
              </label>

              <label className="field">
                <span>Summary</span>
                <textarea
                  onChange={(event) => setDecisionSummary(event.target.value)}
                  placeholder="Describe the decision clearly"
                  rows={4}
                  value={decisionSummary}
                />
              </label>

              <button className="secondary-button" disabled={submittingDecision} type="submit">
                {submittingDecision ? "Creating..." : "Create Decision"}
              </button>
            </form>

            <div className="stack-gap">
              {loadingPanels ? <p className="empty-state">Loading decisions...</p> : null}
              {decisions.map((decision) => (
                <article className="message-card" key={decision.id}>
                  <div className="message-meta">
                    <strong>{decision.title}</strong>
                    <span>{decision.status}</span>
                  </div>
                  <p>{decision.summary}</p>
                  <div className="inline-actions">
                    <span className="mini-meta">
                      {decision.approved_by
                        ? `Approved by ${decision.approved_by}`
                        : `Proposed by ${decision.proposed_by ?? "unknown"}`}
                    </span>
                    {decision.status !== "approved" ? (
                      <button
                        className="text-button"
                        onClick={() => void handleApproveDecision(decision.id)}
                        type="button"
                      >
                        Approve
                      </button>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="stack-gap">
            <div className="panel-header">
              <h2>Roles</h2>
              <span>{roles.length} total</span>
            </div>
            <div className="stack-gap">
              {loadingPanels ? <p className="empty-state">Loading roles...</p> : null}
              {roles.map((role) => (
                <article className="message-card" key={role.id}>
                  <div className="message-meta">
                    <strong>{role.name}</strong>
                    <span>{role.role_type}</span>
                  </div>
                  <p>{role.description ?? "No description."}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="stack-gap">
            <div className="panel-header">
              <h2>Constitution</h2>
              <span>{rules.length} rules</span>
            </div>
            <div className="stack-gap">
              {loadingPanels ? <p className="empty-state">Loading rules...</p> : null}
              {rules.map((rule) => (
                <article className="message-card" key={rule.id}>
                  <div className="message-meta">
                    <strong>{rule.rule_code}</strong>
                    <span>{rule.enforcement_action}</span>
                  </div>
                  <p>{rule.description}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="stack-gap">
            <div className="panel-header">
              <h2>Memory</h2>
              <span>{memories.length} items</span>
            </div>
            <div className="stack-gap">
              {loadingPanels ? <p className="empty-state">Loading memory...</p> : null}
              {memories.map((memory) => (
                <article className="message-card" key={memory.id}>
                  <div className="message-meta">
                    <strong>{memory.memory_type}</strong>
                    <span>{memory.status}</span>
                  </div>
                  <p>{memory.content}</p>
                  <span className="mini-meta">
                    {memory.approved_by
                      ? `Approved by ${memory.approved_by}`
                      : "Awaiting approval metadata"}
                  </span>
                  <div className="inline-actions">
                    <span className="mini-meta">
                      {memory.source_decision_id
                        ? `Decision ${memory.source_decision_id.slice(0, 8)}`
                        : "Manual source"}
                    </span>
                    <div className="inline-actions">
                      {memory.status === "verified" ? (
                        <button
                          className="text-button"
                          onClick={() => void handleTransitionMemory(memory.id, "locked")}
                          type="button"
                        >
                          Lock
                        </button>
                      ) : null}
                      {memory.status === "draft" ? (
                        <button
                          className="text-button"
                          onClick={() => void handleTransitionMemory(memory.id, "verified")}
                          type="button"
                        >
                          Verify
                        </button>
                      ) : null}
                      {memory.status !== "archived" ? (
                        <button
                          className="text-button"
                          onClick={() => void handleTransitionMemory(memory.id, "archived")}
                          type="button"
                        >
                          Archive
                        </button>
                      ) : null}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </aside>
      </section>
    </main>
  );
}
