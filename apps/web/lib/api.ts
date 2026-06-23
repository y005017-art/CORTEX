const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

type RequestOptions = RequestInit & {
  json?: unknown;
};

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
    body: options.json !== undefined ? JSON.stringify(options.json) : options.body,
    cache: "no-store",
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}

export type Project = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  created_at: string;
};

export type Thread = {
  id: string;
  project_id: string;
  title: string;
  status: string;
  created_at: string;
};

export type Message = {
  id: string;
  project_id: string;
  thread_id: string;
  message_type: string;
  sender_type: string;
  sender_role_id: string | null;
  visibility: string;
  content_text: string;
  payload_json: string | null;
  created_at: string;
};

export async function listProjects(): Promise<Project[]> {
  return request<Project[]>("/projects");
}

export async function createProject(input: {
  name: string;
  description?: string;
}): Promise<Project> {
  return request<Project>("/projects", {
    method: "POST",
    json: input,
  });
}

export async function listThreads(projectId: string): Promise<Thread[]> {
  return request<Thread[]>(`/projects/${projectId}/threads`);
}

export async function createThread(
  projectId: string,
  input: { title: string }
): Promise<Thread> {
  return request<Thread>(`/projects/${projectId}/threads`, {
    method: "POST",
    json: input,
  });
}

export async function listMessages(threadId: string): Promise<Message[]> {
  return request<Message[]>(`/threads/${threadId}/messages`);
}

export async function createMessage(
  threadId: string,
  input: {
    message_type: string;
    sender_type: string;
    visibility: string;
    content_text: string;
  }
): Promise<Message> {
  return request<Message>(`/threads/${threadId}/messages`, {
    method: "POST",
    json: input,
  });
}
