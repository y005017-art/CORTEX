export type AuthUser = {
  id: string;
  email: string;
  display_name: string;
  created_at: string;
};

export type AuthSession = {
  token: string;
  user: AuthUser;
};

export type Project = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  created_at: string;
};

export type ChatSession = {
  id: string;
  project_id: string;
  thread_id: string;
  title: string;
  session_type: string;
  role_id: string | null;
  provider_site: string | null;
  workspace_url: string | null;
  launch_mode: string;
  startup_prompt: string | null;
  status: string;
  created_at: string;
};

export type Decision = {
  id: string;
  title: string;
  summary: string;
  status: string;
  created_at: string;
};

export type Memory = {
  id: string;
  memory_type: string;
  status: string;
  content: string;
  created_at: string;
};

export type ConstitutionRule = {
  id: string;
  rule_code: string;
  name: string;
  description: string;
  severity: string;
};

export type BootstrapConfig = {
  apiBaseUrl: string;
  defaultProjectId: string;
  defaultEmail: string;
  defaultPassword: string;
  runtimeLogPath: string;
  presetToken: string;
};

export type ViewStatus = {
  sessionId: string;
  title: string;
  workspaceUrl: string;
  currentUrl: string;
  pageTitle: string;
  state: "loading" | "ready" | "failed";
  error?: string;
};

export type PaneDefinition = {
  paneId: "primary" | "secondary";
  sessionId: string;
  title: string;
  workspaceUrl: string;
  bounds: { x: number; y: number; width: number; height: number };
};

export type DesktopRequest = {
  baseUrl: string;
  path: string;
  token?: string;
  method?: string;
  body?: unknown;
};
