"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import {
  approveDecision,
  createMessage,
  createDecision,
  createThread,
  Decision,
  listMemories,
  listDecisions,
  listRoles,
  listRules,
  Memory,
  listMessages,
  listThreads,
  Message,
  Project,
  Role,
  Thread,
  ConstitutionRule,
  runCoWork,
  transitionMemory,
} from "@/lib/api";


type WorkspaceClientProps = {
  project: Project;
};

export function WorkspaceClient({ project }: WorkspaceClientProps) {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [rules, setRules] = useState<ConstitutionRule[]>([]);
  const [threadTitle, setThreadTitle] = useState("");
  const [messageDraft, setMessageDraft] = useState("");
  const [decisionTitle, setDecisionTitle] = useState("");
  const [decisionSummary, setDecisionSummary] = useState("");
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingPanels, setLoadingPanels] = useState(true);
  const [submittingThread, setSubmittingThread] = useState(false);
  const [submittingMessage, setSubmittingMessage] = useState(false);
  const [submittingDecision, setSubmittingDecision] = useState(false);
  const [runningCoWork, setRunningCoWork] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedThread = useMemo(
    () => threads.find((thread) => thread.id === selectedThreadId) ?? null,
    [selectedThreadId, threads]
  );

  async function refreshThreads(preferredThreadId?: string) {
    setLoadingThreads(true);
    try {
      const data = await listThreads(project.id);
      setThreads(data);
      const nextSelected =
        preferredThreadId ??
        selectedThreadId ??
        (data.length > 0 ? data[0].id : null);
      setSelectedThreadId(nextSelected);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load threads.");
    } finally {
      setLoadingThreads(false);
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
    void refreshThreads();
  }, [project.id]);

  useEffect(() => {
    void refreshPanels();
  }, [project.id]);

  useEffect(() => {
    if (selectedThreadId) {
      void refreshMessages(selectedThreadId);
    } else {
      setMessages([]);
    }
  }, [selectedThreadId]);

  async function handleCreateThread(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!threadTitle.trim()) {
      setError("Thread title is required.");
      return;
    }

    try {
      setSubmittingThread(true);
      setError(null);
      const thread = await createThread(project.id, { title: threadTitle.trim() });
      setThreadTitle("");
      await refreshThreads(thread.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create thread.");
    } finally {
      setSubmittingThread(false);
    }
  }

  async function handleCreateMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedThreadId) {
      setError("Create a thread before sending a message.");
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
      await refreshPanels();
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
      setError("Select a thread before running CoWork.");
      return;
    }

    try {
      setRunningCoWork(true);
      setError(null);
      await runCoWork(selectedThreadId);
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
            <h2>Threads</h2>
            <span>{threads.length} total</span>
          </div>

          <form className="stack-gap compact-form" onSubmit={handleCreateThread}>
            <label className="field">
              <span>New thread</span>
              <input
                value={threadTitle}
                onChange={(event) => setThreadTitle(event.target.value)}
                placeholder="Initial planning thread"
              />
            </label>

            <button className="secondary-button" disabled={submittingThread} type="submit">
              {submittingThread ? "Creating..." : "Create Thread"}
            </button>
          </form>

          <div className="thread-list">
            {loadingThreads ? <p className="empty-state">Loading threads...</p> : null}

            {!loadingThreads && threads.length === 0 ? (
              <p className="empty-state">No threads yet.</p>
            ) : null}

            {threads.map((thread) => (
              <button
                className={thread.id === selectedThreadId ? "thread-item active" : "thread-item"}
                key={thread.id}
                onClick={() => setSelectedThreadId(thread.id)}
                type="button"
              >
                <strong>{thread.title}</strong>
                <span>{thread.status}</span>
              </button>
            ))}
          </div>
        </aside>

        <section className="panel conversation stack-gap">
          <div className="panel-header">
            <h2>{selectedThread?.title ?? "Group Chat"}</h2>
            <span>{selectedThread ? selectedThread.status : "No thread selected"}</span>
          </div>

          <div className="inline-actions">
            <span className="mini-meta">
              Run CoWork to analyze the latest user goal in this thread.
            </span>
            <button
              className="secondary-button"
              disabled={!selectedThread || runningCoWork}
              onClick={() => void handleRunCoWork()}
              type="button"
            >
              {runningCoWork ? "Running..." : "Run CoWork"}
            </button>
          </div>

          {error ? <p className="error-text">{error}</p> : null}

          <div className="message-stream">
            {loadingMessages ? <p className="empty-state">Loading messages...</p> : null}

            {!loadingMessages && !selectedThread ? (
              <p className="empty-state">Create or select a thread to begin.</p>
            ) : null}

            {!loadingMessages && selectedThread && messages.length === 0 ? (
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
                disabled={!selectedThread}
                onChange={(event) => setMessageDraft(event.target.value)}
                placeholder="Describe the next goal or request for this thread"
                rows={5}
                value={messageDraft}
              />
            </label>

            <button
              className="primary-button"
              disabled={!selectedThread || submittingMessage}
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
