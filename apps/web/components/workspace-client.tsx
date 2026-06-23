"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import {
  createMessage,
  createThread,
  listMessages,
  listThreads,
  Message,
  Project,
  Thread,
} from "@/lib/api";


type WorkspaceClientProps = {
  project: Project;
};

export function WorkspaceClient({ project }: WorkspaceClientProps) {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [threadTitle, setThreadTitle] = useState("");
  const [messageDraft, setMessageDraft] = useState("");
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [submittingThread, setSubmittingThread] = useState(false);
  const [submittingMessage, setSubmittingMessage] = useState(false);
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

  useEffect(() => {
    void refreshThreads();
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

      <section className="workspace-grid">
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
      </section>
    </main>
  );
}
