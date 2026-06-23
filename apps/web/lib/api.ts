import { AuthUser, getStoredToken } from "@/lib/auth";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

type RequestOptions = RequestInit & {
  json?: unknown;
};

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  const token = getStoredToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

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

export type Role = {
  id: string;
  name: string;
  role_type: string;
  is_permanent: boolean;
  status: string;
  prompt_key: string | null;
  description: string | null;
  created_at: string;
};

export type ConstitutionRule = {
  id: string;
  rule_code: string;
  name: string;
  scope: string;
  description: string;
  enforcement_action: string;
  severity: string;
  active: boolean;
  created_at: string;
};

export type Decision = {
  id: string;
  project_id: string;
  thread_id: string | null;
  title: string;
  summary: string;
  status: string;
  proposed_by: string | null;
  approved_by: string | null;
  created_at: string;
};

export type Memory = {
  id: string;
  project_id: string;
  memory_type: string;
  status: string;
  visibility: string;
  content: string;
  source_role_id: string | null;
  source_message_id: string | null;
  source_decision_id: string | null;
  approved_by: string | null;
  locked_at: string | null;
  created_at: string;
};

export type AuthSession = {
  token: string;
  user: AuthUser;
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

export async function register(input: {
  email: string;
  display_name: string;
  password: string;
}): Promise<AuthSession> {
  return request<AuthSession>("/auth/register", {
    method: "POST",
    json: input,
  });
}

export async function login(input: {
  email: string;
  password: string;
}): Promise<AuthSession> {
  return request<AuthSession>("/auth/login", {
    method: "POST",
    json: input,
  });
}

export async function me(): Promise<AuthUser> {
  return request<AuthUser>("/auth/me");
}

export async function listRoles(): Promise<Role[]> {
  return request<Role[]>("/roles");
}

export async function listRules(): Promise<ConstitutionRule[]> {
  return request<ConstitutionRule[]>("/constitution/rules");
}

export async function listDecisions(projectId: string): Promise<Decision[]> {
  return request<Decision[]>(`/projects/${projectId}/decisions`);
}

export async function createDecision(
  projectId: string,
  input: {
    thread_id?: string;
    title: string;
    summary: string;
  }
): Promise<Decision> {
  return request<Decision>(`/projects/${projectId}/decisions`, {
    method: "POST",
    json: input,
  });
}

export async function approveDecision(decisionId: string): Promise<Decision> {
  return request<Decision>(`/decisions/${decisionId}/approve`, {
    method: "POST",
  });
}

export async function listMemories(projectId: string): Promise<Memory[]> {
  return request<Memory[]>(`/projects/${projectId}/memories`);
}
