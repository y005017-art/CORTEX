import { FormEvent, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import type {
  AuthSession,
  BootstrapConfig,
  ChatSession,
  ConstitutionRule,
  Decision,
  DesktopRequest,
  Memory,
  PaneDefinition,
  Project,
  ViewStatus,
} from "./types";

type BottomTab = "cowork" | "logs" | "handover";
type Stage = "login" | "accounts" | "project" | "workspace";
type SidebarPage = "workspace" | "pinned" | "skills" | "roles" | "console";
type PaneId = "primary" | "secondary";
type ProviderKey = "chatgpt" | "claude" | "gemini" | "perplexity";

type ProviderConfig = {
  key: ProviderKey;
  label: string;
  url: string;
  loginUrl: string;
  description: string;
  colorClass: string;
};

type ProviderAccount = {
  provider: ProviderKey;
  connected: boolean;
  remembered: boolean;
  lastOpenedAt: string | null;
};

type SkillEntry = {
  id: string;
  name: string;
  summary: string;
  detail: string;
  tags: string[];
};

type RoleEntry = {
  id: string;
  name: string;
  provider: ProviderKey;
  summary: string;
  detail: string;
  pinned: boolean;
};

const PROVIDERS: ProviderConfig[] = [
  {
    key: "chatgpt",
    label: "ChatGPT",
    url: "https://chatgpt.com/",
    loginUrl: "https://chatgpt.com/auth/login",
    description: "適合架構設計、產品拆解、文件整理與全域協作推進。",
    colorClass: "provider-chatgpt",
  },
  {
    key: "claude",
    label: "Claude",
    url: "https://claude.ai/",
    loginUrl: "https://claude.ai/login",
    description: "適合工程實作、重構、長文分析與技術細節處理。",
    colorClass: "provider-claude",
  },
  {
    key: "gemini",
    label: "Gemini",
    url: "https://gemini.google.com/",
    loginUrl: "https://gemini.google.com/",
    description: "適合審查、交叉驗證、研究整合與品質檢核。",
    colorClass: "provider-gemini",
  },
  {
    key: "perplexity",
    label: "Perplexity",
    url: "https://www.perplexity.ai/",
    loginUrl: "https://www.perplexity.ai/",
    description: "適合專案管理、外部資訊查詢、任務推進與整理脈絡。",
    colorClass: "provider-perplexity",
  },
];

const SIDEBAR_ITEMS: Array<{ id: SidebarPage; label: string; icon: string }> = [
  { id: "workspace", label: "工作台", icon: "台" },
  { id: "pinned", label: "常駐區", icon: "常" },
  { id: "skills", label: "技能庫", icon: "技" },
  { id: "roles", label: "角色庫", icon: "角" },
  { id: "console", label: "主控台", icon: "控" },
];

const SKILLS: SkillEntry[] = [
  {
    id: "cowork",
    name: "CoWork 協作區",
    summary: "所有角色共同討論、交接、同步決策的主通道。",
    detail: "CoWork 是必要常駐區，不是附屬功能。任何角色的討論、風險、下一步都應該能回到這裡整合。",
    tags: ["必要", "協作", "交接"],
  },
  {
    id: "decision-board",
    name: "Decision Board",
    summary: "收攏批准、待確認與退回的專案決策。",
    detail: "Decision Board 負責保存角色間的重要決策，避免它們散落在各個外部聊天工作視窗中。",
    tags: ["治理", "決策", "追蹤"],
  },
  {
    id: "memory-snapshot",
    name: "Memory Snapshot",
    summary: "保存目標、背景、技術選型與上下文。",
    detail: "讓新加入角色或切換預設 AI 時，仍能快速承接目前專案的背景與已鎖定資訊。",
    tags: ["記憶", "同步", "脈絡"],
  },
  {
    id: "handover",
    name: "Handover 交接",
    summary: "把下一步、未完成事項與風險交給下一位角色。",
    detail: "任何角色退出當前回合之前，都應留下可被接手的摘要，而不是讓上下文中斷。",
    tags: ["交接", "節點", "延續"],
  },
];

const DEFAULT_ROLE_LIBRARY: RoleEntry[] = [
  {
    id: "architect",
    name: "Architect",
    provider: "chatgpt",
    summary: "負責定義產品結構、系統邊界與工作節奏。",
    detail: "Architect 角色聚焦架構設計、工作台規劃、角色分工與決策節點安排。",
    pinned: false,
  },
  {
    id: "engineer",
    name: "Engineer",
    provider: "claude",
    summary: "負責實作、重構、整合與處理技術風險。",
    detail: "Engineer 是主要執行者，會深入程式碼與資料流，把需求落成可運作功能。",
    pinned: false,
  },
  {
    id: "reviewer",
    name: "Reviewer",
    provider: "gemini",
    summary: "負責風險審查、品質把關與回歸檢查。",
    detail: "Reviewer 不是附庸，而是獨立角色，專門檢查需求、架構與實作是否偏離。",
    pinned: false,
  },
  {
    id: "pm",
    name: "PM",
    provider: "perplexity",
    summary: "負責節奏推進、外部脈絡與需求整合。",
    detail: "PM 角色關注專案里程碑、跨角色同步、外部資訊整理與下一步規劃。",
    pinned: false,
  },
];

const STATUS_COLORS: Record<ViewStatus["state"], string> = {
  loading: "is-loading",
  ready: "is-ready",
  failed: "is-failed",
};

const ACCOUNTS_STORAGE_KEY = "cortex.desktop.accounts";
const DEFAULT_PROVIDER_STORAGE_KEY = "cortex.desktop.defaultProvider";
const PINNED_ROLES_STORAGE_KEY = "cortex.desktop.pinnedRoles";
const PROVIDER_OVERRIDE_STORAGE_KEY = "cortex.desktop.providerOverrides";

const MOCK_BOOTSTRAP: BootstrapConfig = {
  apiBaseUrl: "http://127.0.0.1:8000",
  defaultProjectId: "demo-project",
  defaultEmail: "demo@cortex.local",
  defaultPassword: "",
  runtimeLogPath: "C:\\Users\\TIM\\AppData\\Roaming\\cortex-desktop\\cortex-desktop-runtime.log",
  presetToken: "",
};

const MOCK_PROJECTS: Project[] = [
  {
    id: "demo-project",
    name: "CORTEX Workspace 重構",
    description: "把現有介面改成 VS Code 風格 AI IDE 工作台。",
    status: "進行中",
    created_at: "2026-06-24T10:00:00Z",
  },
  {
    id: "demo-project-2",
    name: "多角色治理驗證",
    description: "驗證角色常駐區、技能庫與治理側欄的排版與流程。",
    status: "規劃中",
    created_at: "2026-06-24T09:00:00Z",
  },
];

const MOCK_SESSIONS: ChatSession[] = [
  {
    id: "architect-session",
    project_id: "demo-project",
    thread_id: "architect-thread",
    title: "Architect",
    session_type: "workspace",
    role_id: "architect",
    provider_site: "chatgpt",
    workspace_url: "https://chatgpt.com/",
    launch_mode: "desktop",
    startup_prompt: null,
    status: "active",
    created_at: "2026-06-24T10:00:00Z",
  },
  {
    id: "engineer-session",
    project_id: "demo-project",
    thread_id: "engineer-thread",
    title: "Engineer",
    session_type: "workspace",
    role_id: "engineer",
    provider_site: "claude",
    workspace_url: "https://claude.ai/",
    launch_mode: "desktop",
    startup_prompt: null,
    status: "active",
    created_at: "2026-06-24T10:00:00Z",
  },
  {
    id: "reviewer-session",
    project_id: "demo-project",
    thread_id: "reviewer-thread",
    title: "Reviewer",
    session_type: "workspace",
    role_id: "reviewer",
    provider_site: "gemini",
    workspace_url: "https://gemini.google.com/",
    launch_mode: "desktop",
    startup_prompt: null,
    status: "active",
    created_at: "2026-06-24T10:00:00Z",
  },
  {
    id: "pm-session",
    project_id: "demo-project",
    thread_id: "pm-thread",
    title: "PM",
    session_type: "workspace",
    role_id: "pm",
    provider_site: "perplexity",
    workspace_url: "https://www.perplexity.ai/",
    launch_mode: "desktop",
    startup_prompt: null,
    status: "active",
    created_at: "2026-06-24T10:00:00Z",
  },
];

const MOCK_DECISIONS: Decision[] = [
  {
    id: "decision-1",
    title: "採用 Electron 工作台殼層",
    summary: "避免 iframe 限制，每個角色改為真實外部聊天工作視窗。",
    status: "approved",
    created_at: "2026-06-24T11:35:00Z",
  },
  {
    id: "decision-2",
    title: "CoWork 作為必要常駐區",
    summary: "所有角色都必須回到 CoWork 同步進度與交接。",
    status: "pending",
    created_at: "2026-06-24T11:28:00Z",
  },
];

const MOCK_MEMORIES: Memory[] = [
  {
    id: "memory-1",
    memory_type: "Project Goal",
    status: "locked",
    content: "CORTEX 要做成 VS Code 風格的 AI IDE / workbench。",
    created_at: "2026-06-24T11:00:00Z",
  },
  {
    id: "memory-2",
    memory_type: "Architecture",
    status: "active",
    content: "每個角色透過獨立工作視窗載入外部 AI 聊天站點。",
    created_at: "2026-06-24T11:05:00Z",
  },
];

const MOCK_RULES: ConstitutionRule[] = [
  {
    id: "rule-1",
    rule_code: "ROLE-001",
    name: "角色必須對應真實工作視窗",
    description: "不得退回假卡片或自製聊天框，必須讓角色有真實外部聊天工作區。",
    severity: "high",
  },
  {
    id: "rule-2",
    rule_code: "GOV-001",
    name: "治理資訊固定可回看",
    description: "決策、記憶與憲章需要有固定位置，避免散落在不同頁面。",
    severity: "high",
  },
];

function providerFromSession(session: ChatSession): ProviderKey {
  const source = `${session.provider_site ?? ""} ${session.workspace_url ?? ""}`.toLowerCase();
  if (source.includes("claude")) {
    return "claude";
  }
  if (source.includes("gemini")) {
    return "gemini";
  }
  if (source.includes("perplexity")) {
    return "perplexity";
  }
  return "chatgpt";
}

function providerConfig(key: ProviderKey): ProviderConfig {
  return PROVIDERS.find((provider) => provider.key === key) ?? PROVIDERS[0];
}

function roleStatus(status?: ViewStatus): string {
  if (!status) {
    return "未啟動";
  }
  if (status.state === "ready") {
    return "工作中";
  }
  if (status.state === "loading") {
    return "載入中";
  }
  return "異常";
}

function decisionTone(status: string): string {
  const normalized = status.toLowerCase();
  if (normalized === "approved") {
    return "decision-approved";
  }
  if (normalized === "pending" || normalized === "proposed") {
    return "decision-pending";
  }
  return "decision-neutral";
}

function formatClock(value: string): string {
  return new Intl.DateTimeFormat("zh-TW", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function formatLongDate(value: string) {
  return new Intl.DateTimeFormat("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function sessionDisplayTitle(session: ChatSession): string {
  return session.title || "未命名角色";
}

function sessionRoleKey(session: ChatSession): string {
  return (session.role_id ?? session.title).toLowerCase();
}

function safeParse<T>(value: string | null, fallback: T): T {
  if (!value) {
    return fallback;
  }
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

async function request<T>(payload: DesktopRequest): Promise<T> {
  if (window.cortexDesktop) {
    return window.cortexDesktop.request<T>(payload);
  }

  if (payload.path === "/auth/login") {
    return {
      token: "mock-token",
      user: {
        id: "mock-user",
        email: "demo@cortex.local",
        display_name: "Demo User",
        created_at: "2026-06-24T00:00:00Z",
      },
    } as T;
  }

  if (payload.path === "/projects") {
    return MOCK_PROJECTS as T;
  }

  if (payload.path.includes("/chat-sessions")) {
    return MOCK_SESSIONS as T;
  }

  if (payload.path.includes("/decisions")) {
    return MOCK_DECISIONS as T;
  }

  if (payload.path.includes("/memories")) {
    return MOCK_MEMORIES as T;
  }

  if (payload.path === "/constitution/rules") {
    return MOCK_RULES as T;
  }

  throw new Error(`未提供預覽資料：${payload.path}`);
}

export function App() {
  const desktopBridge = window.cortexDesktop;
  const [bootstrap, setBootstrap] = useState<BootstrapConfig | null>(null);
  const [stage, setStage] = useState<Stage>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [rules, setRules] = useState<ConstitutionRule[]>([]);
  const [viewStatuses, setViewStatuses] = useState<Record<string, ViewStatus>>({});
  const [sidebarPage, setSidebarPage] = useState<SidebarPage>("workspace");
  const [bottomTab, setBottomTab] = useState<BottomTab>("cowork");
  const [primarySessionId, setPrimarySessionId] = useState("");
  const [secondarySessionId, setSecondarySessionId] = useState("");
  const [selectedSkillId, setSelectedSkillId] = useState(SKILLS[0].id);
  const [selectedRoleLibraryId, setSelectedRoleLibraryId] = useState(DEFAULT_ROLE_LIBRARY[0].id);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isLoadingWorkspace, setIsLoadingWorkspace] = useState(false);
  const [accounts, setAccounts] = useState<ProviderAccount[]>(
    PROVIDERS.map((provider) => ({
      provider: provider.key,
      connected: false,
      remembered: false,
      lastOpenedAt: null,
    }))
  );
  const [defaultProvider, setDefaultProvider] = useState<ProviderKey>("chatgpt");
  const [pinnedRoleIds, setPinnedRoleIds] = useState<string[]>(["cowork"]);
  const [providerOverrides, setProviderOverrides] = useState<Record<string, ProviderKey>>({});
  const primaryViewportRef = useRef<HTMLDivElement | null>(null);
  const secondaryViewportRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (desktopBridge) {
      void desktopBridge.getBootstrap().then((config) => {
        setBootstrap(config);
        setEmail(config.defaultEmail);
        setPassword(config.defaultPassword);
        setSelectedProjectId(config.defaultProjectId);
        setToken(config.presetToken);
      });
    } else {
      setBootstrap(MOCK_BOOTSTRAP);
      setEmail(MOCK_BOOTSTRAP.defaultEmail);
      setSelectedProjectId(MOCK_BOOTSTRAP.defaultProjectId);
    }

    const storedAccounts = safeParse<ProviderAccount[]>(
      window.localStorage.getItem(ACCOUNTS_STORAGE_KEY),
      []
    );

    if (storedAccounts.length > 0) {
      setAccounts(
        PROVIDERS.map((provider) => {
          const matched = storedAccounts.find((entry) => entry.provider === provider.key);
          return (
            matched ?? {
              provider: provider.key,
              connected: false,
              remembered: false,
              lastOpenedAt: null,
            }
          );
        })
      );
    }

    const storedDefaultProvider = window.localStorage.getItem(DEFAULT_PROVIDER_STORAGE_KEY);
    if (storedDefaultProvider && PROVIDERS.some((provider) => provider.key === storedDefaultProvider)) {
      setDefaultProvider(storedDefaultProvider as ProviderKey);
    }

    setPinnedRoleIds(
      safeParse<string[]>(window.localStorage.getItem(PINNED_ROLES_STORAGE_KEY), ["cowork"])
    );
    setProviderOverrides(
      safeParse<Record<string, ProviderKey>>(
        window.localStorage.getItem(PROVIDER_OVERRIDE_STORAGE_KEY),
        {}
      )
    );
  }, [desktopBridge]);

  useEffect(() => {
    if (!desktopBridge) {
      setViewStatuses(
        Object.fromEntries(
          MOCK_SESSIONS.map((session) => [
            session.id,
            {
              sessionId: session.id,
              title: session.title,
              workspaceUrl: session.workspace_url ?? "",
              currentUrl: session.workspace_url ?? "",
              pageTitle: `${session.title} Workspace`,
              state: "ready" as const,
            },
          ])
        )
      );
      return () => {};
    }

    const unsubscribe = desktopBridge.onViewStatus((status) => {
      setViewStatuses((current) => ({
        ...current,
        [status.sessionId]: status,
      }));
    });

    void desktopBridge.getViewStatuses().then((statuses) => {
      setViewStatuses(Object.fromEntries(statuses.map((entry) => [entry.sessionId, entry])));
    });

    return unsubscribe;
  }, [desktopBridge]);

  useEffect(() => {
    window.localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts));
  }, [accounts]);

  useEffect(() => {
    window.localStorage.setItem(DEFAULT_PROVIDER_STORAGE_KEY, defaultProvider);
  }, [defaultProvider]);

  useEffect(() => {
    window.localStorage.setItem(PINNED_ROLES_STORAGE_KEY, JSON.stringify(pinnedRoleIds));
  }, [pinnedRoleIds]);

  useEffect(() => {
    window.localStorage.setItem(PROVIDER_OVERRIDE_STORAGE_KEY, JSON.stringify(providerOverrides));
  }, [providerOverrides]);

  const bindableSessions = useMemo(
    () =>
      sessions
        .filter((session) => Boolean(session.workspace_url))
        .sort((left, right) => left.title.localeCompare(right.title, "zh-TW")),
    [sessions]
  );

  useEffect(() => {
    if (bindableSessions.length === 0) {
      setPrimarySessionId("");
      setSecondarySessionId("");
      return;
    }

    setPrimarySessionId((current) => current || bindableSessions[0].id);
    setSecondarySessionId((current) => current || bindableSessions[1]?.id || bindableSessions[0].id);
  }, [bindableSessions]);

  const roleLibrary = useMemo<RoleEntry[]>(() => {
    const merged = [...DEFAULT_ROLE_LIBRARY];
    for (const session of bindableSessions) {
      const inferredProvider = providerFromSession(session);
      const existing = merged.find((role) => role.id === sessionRoleKey(session));
      if (!existing) {
        merged.push({
          id: sessionRoleKey(session),
          name: sessionDisplayTitle(session),
          provider: inferredProvider,
          summary: `${providerConfig(inferredProvider).label} 擔任的外部工作角色。`,
          detail: `${sessionDisplayTitle(session)} 會載入真實聊天工作視窗，供該角色獨立思考與交接。`,
          pinned: false,
        });
      }
    }

    return merged.map((role) => ({
      ...role,
      pinned: pinnedRoleIds.includes(role.id),
    }));
  }, [bindableSessions, pinnedRoleIds]);

  const selectedSkill = SKILLS.find((skill) => skill.id === selectedSkillId) ?? SKILLS[0];
  const selectedRoleLibrary =
    roleLibrary.find((role) => role.id === selectedRoleLibraryId) ?? roleLibrary[0];

  const activeProject = projects.find((project) => project.id === selectedProjectId) ?? null;
  const primarySession = bindableSessions.find((session) => session.id === primarySessionId) ?? null;
  const secondarySession =
    bindableSessions.find((session) => session.id === secondarySessionId) ?? null;
  const connectedAccounts = accounts.filter((account) => account.connected);
  const activeViewCount = bindableSessions.filter(
    (session) => viewStatuses[session.id]?.state === "ready"
  ).length;

  const coworkMessages = useMemo(() => {
    if (decisions.length > 0) {
      return decisions.map((decision, index) => ({
        id: decision.id,
        author: bindableSessions[index % Math.max(bindableSessions.length, 1)]?.title ?? "CoWork",
        time: formatClock(decision.created_at),
        body: decision.summary,
      }));
    }

    return [
      {
        id: "cowork-1",
        author: "Architect",
        time: "11:40",
        body: "我已把工作台方向整理成 Electron workbench，請各角色對齊工作方式。",
      },
      {
        id: "cowork-2",
        author: "Engineer",
        time: "11:42",
        body: "收到，會先驗證登入流程、專案選擇與角色工作視窗的進入路徑。",
      },
      {
        id: "cowork-3",
        author: "Reviewer",
        time: "11:44",
        body: "我會盯 UI 是否偏離需求，尤其是不要再回到假聊天與儀表板畫面。",
      },
    ];
  }, [bindableSessions, decisions]);

  const consoleLines = useMemo(
    () => [
      "桌面工作台已啟動。",
      "AI 帳號頁現在會提供真實登入入口按鈕。",
      "專案選擇頁已改成固定版型與可捲動區域。",
      bootstrap?.runtimeLogPath
        ? `執行紀錄位置：${bootstrap.runtimeLogPath}`
        : "等待讀取執行紀錄位置。",
    ],
    [bootstrap?.runtimeLogPath]
  );

  function resolvedProvider(session: ChatSession): ProviderKey {
    return providerOverrides[session.id] ?? providerFromSession(session);
  }

  function resolvedWorkspaceUrl(session: ChatSession): string {
    const provider = resolvedProvider(session);
    if (connectedAccounts.length === 0) {
      return providerConfig(provider).url;
    }
    return providerConfig(provider).url;
  }

  async function openExternalUrl(url: string) {
    if (desktopBridge?.openExternal) {
      await desktopBridge.openExternal(url);
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!bootstrap) {
      return;
    }

    try {
      setIsAuthenticating(true);
      setError(null);
      const session = await request<AuthSession>({
        baseUrl: bootstrap.apiBaseUrl,
        path: "/auth/login",
        method: "POST",
        body: { email, password },
      });
      setToken(session.token);
      setMessage(`已登入 CORTEX，歡迎回來，${session.user.display_name}。`);
      setStage("accounts");
    } catch (err) {
      setError(err instanceof Error ? err.message : "登入失敗，請再試一次。");
    } finally {
      setIsAuthenticating(false);
    }
  }

  async function loadProjects() {
    if (!bootstrap || !token) {
      return;
    }

    try {
      const nextProjects = await request<Project[]>({
        baseUrl: bootstrap.apiBaseUrl,
        path: "/projects",
        token,
      });
      setProjects(nextProjects);
      if (!selectedProjectId && nextProjects[0]) {
        setSelectedProjectId(nextProjects[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "讀取專案失敗。");
    }
  }

  async function loadWorkspace() {
    if (!bootstrap || !token || !selectedProjectId) {
      return;
    }

    try {
      setIsLoadingWorkspace(true);
      setError(null);
      const [sessionData, decisionData, memoryData, ruleData] = await Promise.all([
        request<ChatSession[]>({
          baseUrl: bootstrap.apiBaseUrl,
          path: `/projects/${selectedProjectId}/chat-sessions`,
          token,
        }),
        request<Decision[]>({
          baseUrl: bootstrap.apiBaseUrl,
          path: `/projects/${selectedProjectId}/decisions`,
          token,
        }),
        request<Memory[]>({
          baseUrl: bootstrap.apiBaseUrl,
          path: `/projects/${selectedProjectId}/memories`,
          token,
        }),
        request<ConstitutionRule[]>({
          baseUrl: bootstrap.apiBaseUrl,
          path: "/constitution/rules",
          token,
        }),
      ]);

      setSessions(sessionData);
      setDecisions(decisionData);
      setMemories(memoryData);
      setRules(ruleData);
      setMessage(`已載入專案工作區，共 ${sessionData.length} 個角色工作視窗。`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "載入工作區失敗。");
    } finally {
      setIsLoadingWorkspace(false);
    }
  }

  useEffect(() => {
    if (stage === "project" && token) {
      void loadProjects();
    }
  }, [stage, token]);

  useEffect(() => {
    if (stage === "workspace" && token && selectedProjectId) {
      void loadWorkspace();
    }
  }, [stage, token, selectedProjectId]);

  function buildPaneDefinitions(): PaneDefinition[] {
    if (stage !== "workspace") {
      return [];
    }

    const panes: PaneDefinition[] = [];

    const collectPane = (
      paneId: PaneId,
      session: ChatSession | null,
      element: HTMLDivElement | null
    ) => {
      if (!session || !element) {
        return;
      }

      const rect = element.getBoundingClientRect();
      panes.push({
        paneId,
        sessionId: session.id,
        title: sessionDisplayTitle(session),
        workspaceUrl: resolvedWorkspaceUrl(session),
        bounds: {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        },
      });
    };

    collectPane("primary", primarySession, primaryViewportRef.current);
    collectPane("secondary", secondarySession, secondaryViewportRef.current);
    return panes;
  }

  useLayoutEffect(() => {
    const sync = () => {
      desktopBridge?.syncViews(buildPaneDefinitions());
    };

    sync();
    const observer = new ResizeObserver(sync);
    if (primaryViewportRef.current) {
      observer.observe(primaryViewportRef.current);
    }
    if (secondaryViewportRef.current) {
      observer.observe(secondaryViewportRef.current);
    }
    window.addEventListener("resize", sync);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", sync);
    };
  }, [desktopBridge, stage, primarySession, secondarySession, providerOverrides]);

  async function handleAccountEntry(provider: ProviderKey) {
    const target = providerConfig(provider);
    await openExternalUrl(target.loginUrl);
    const now = new Date().toISOString();
    setAccounts((current) =>
      current.map((account) =>
        account.provider === provider
          ? { ...account, lastOpenedAt: now }
          : account
      )
    );
    setMessage(`已開啟 ${target.label} 登入頁，請完成登入後回到這裡確認。`);
  }

  function confirmAccount(provider: ProviderKey) {
    setAccounts((current) =>
      current.map((account) =>
        account.provider === provider
          ? { ...account, connected: true, remembered: true }
          : account
      )
    );
  }

  function continueToProjects() {
    if (connectedAccounts.length === 0) {
      setError("至少要完成一個 AI 帳號登入，才能進入專案選擇。");
      return;
    }
    setError(null);
    setStage("project");
  }

  function enterWorkspace() {
    if (!selectedProjectId) {
      setError("請先選擇要載入的專案。");
      return;
    }
    setError(null);
    setStage("workspace");
  }

  function togglePinnedRole(roleId: string) {
    setPinnedRoleIds((current) => {
      const next = new Set(current);
      if (next.has(roleId)) {
        next.delete(roleId);
      } else {
        next.add(roleId);
      }
      next.add("cowork");
      return Array.from(next);
    });
  }

  function setPaneSession(paneId: PaneId, sessionId: string) {
    if (paneId === "primary") {
      setPrimarySessionId(sessionId);
    } else {
      setSecondarySessionId(sessionId);
    }
  }

  function setSessionProvider(sessionId: string, provider: ProviderKey) {
    setProviderOverrides((current) => ({
      ...current,
      [sessionId]: provider,
    }));
  }

  function renderOnboarding() {
    if (stage === "login") {
      return (
        <section className="onboarding-screen">
          <div className="login-centered-shell">
            <div className="login-centered-copy">
              <span className="hero-kicker">CORTEX AI IDE</span>
              <h1>先登入 CORTEX，然後再進入真正的多角色工作台。</h1>
              <p>
                這裡不是 dashboard，也不是假聊天畫面。登入後會依序進入 AI 帳號登入、專案選擇，最後才進入完整工作區。
              </p>
            </div>
            <form className="login-card login-card-centered" onSubmit={handleLogin}>
              <div className="card-head">
                <strong>登入 CORTEX</strong>
                <span>第一步：進入桌面工作台</span>
              </div>
              <label className="field-block">
                <span>電子郵件</span>
                <input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="請輸入登入帳號"
                />
              </label>
              <label className="field-block">
                <span>密碼</span>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="請輸入密碼"
                />
              </label>
              <button className="primary-action" disabled={isAuthenticating} type="submit">
                {isAuthenticating ? "登入中..." : "進入下一步"}
              </button>
            </form>
          </div>
        </section>
      );
    }

    if (stage === "accounts") {
      return (
        <section className="onboarding-screen">
          <div className="flow-shell accounts-shell">
            <div className="flow-header">
              <div>
                <span className="hero-kicker">第二步</span>
                <h2>開啟真實登入頁，至少完成一個 AI 帳號登入。</h2>
              </div>
              <button className="ghost-action" onClick={continueToProjects} type="button">
                下一步：選擇專案
              </button>
            </div>

            <div className="accounts-layout">
              <section className="accounts-rail">
                <div className="section-head">
                  <strong>登入入口</strong>
                  <span>不是假標記，是實際登入頁入口</span>
                </div>
                <div className="account-grid">
                  {PROVIDERS.map((provider) => {
                    const account = accounts.find((entry) => entry.provider === provider.key);
                    const isDefault = defaultProvider === provider.key;
                    return (
                      <article className="account-card" key={provider.key}>
                        <div className="account-card-top">
                          <div>
                            <strong>{provider.label}</strong>
                            <p>{provider.description}</p>
                          </div>
                          <span className={account?.connected ? "account-state is-connected" : "account-state"}>
                            {account?.connected ? "已確認登入" : "尚未確認"}
                          </span>
                        </div>

                        <div className="account-meta">
                          <span>登入頁</span>
                          <strong>{provider.loginUrl}</strong>
                        </div>

                        <div className="account-actions">
                          <button
                            className="primary-action"
                            onClick={() => void handleAccountEntry(provider.key)}
                            type="button"
                          >
                            開啟 {provider.label} 登入頁
                          </button>
                          <button
                            className={account?.connected ? "secondary-action is-active" : "secondary-action"}
                            onClick={() => confirmAccount(provider.key)}
                            type="button"
                          >
                            我已完成登入
                          </button>
                        </div>

                        <div className="account-footer">
                          <label className="default-choice">
                            <input
                              checked={isDefault}
                              name="default-provider"
                              onChange={() => setDefaultProvider(provider.key)}
                              type="radio"
                            />
                            <span>設為所有角色的預設 AI</span>
                          </label>
                          <span>
                            {account?.lastOpenedAt
                              ? `最近開啟：${formatClock(account.lastOpenedAt)}`
                              : "尚未開啟登入頁"}
                          </span>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>

              <aside className="accounts-guide">
                <div className="section-head">
                  <strong>使用方式</strong>
                  <span>避免登入完卻不知道怎麼接下去</span>
                </div>
                <ol className="step-list">
                  <li>點擊任一張卡片的「開啟登入頁」。</li>
                  <li>在開啟的真實站點完成登入。</li>
                  <li>回到 CORTEX 點「我已完成登入」。</li>
                  <li>至少完成一個帳號後，再進下一步。</li>
                  <li>若有多個帳號，可選擇預設載入來源。</li>
                </ol>

                <div className="accounts-summary">
                  <strong>目前已確認 {connectedAccounts.length} 個帳號。</strong>
                  <p>工作區載入時，角色視窗會優先套用你選擇的預設 AI，之後也能逐格切換。</p>
                </div>
              </aside>
            </div>
          </div>
        </section>
      );
    }

    return (
      <section className="onboarding-screen">
        <div className="flow-shell project-shell">
          <div className="flow-header">
            <div>
              <span className="hero-kicker">第三步</span>
              <h2>選擇要載入的專案，然後進入完整工作區。</h2>
            </div>
            <button className="primary-action" onClick={enterWorkspace} type="button">
              進入工作區
            </button>
          </div>

          <div className="project-layout">
            <section className="project-hero-card">
              <div className="section-head">
                <strong>專案入口</strong>
                <span>先把版面收穩，不再讓畫面爆框</span>
              </div>
              <h3>建立新專案</h3>
              <p>後續會在這裡放完整的新專案建立流程，目前先保留清楚入口，不讓畫面與卡片互相擠壓。</p>
              <button className="ghost-action" type="button">
                準備建立新專案
              </button>
            </section>

            <section className="project-selection-panel">
              <div className="section-head">
                <strong>載入既有專案</strong>
                <span>{projects.length} 個可載入專案</span>
              </div>
              <div className="project-scroll-list">
                {projects.map((project) => (
                  <button
                    className={project.id === selectedProjectId ? "project-list-card is-active" : "project-list-card"}
                    key={project.id}
                    onClick={() => setSelectedProjectId(project.id)}
                    type="button"
                  >
                    <div className="project-list-top">
                      <strong>{project.name}</strong>
                      <span>{project.status}</span>
                    </div>
                    <p>{project.description || "尚未填寫專案說明。"}</p>
                    <div className="project-list-meta">
                      <span>建立日期</span>
                      <strong>{formatLongDate(project.created_at)}</strong>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          </div>
        </div>
      </section>
    );
  }

  function renderSidebarContent() {
    if (sidebarPage === "pinned") {
      return (
        <>
          <section className="sidebar-section">
            <div className="sidebar-heading-row">
              <strong>必要角色常駐區</strong>
              <span>預設至少包含 CoWork</span>
            </div>
            <div className="pinned-list">
              {pinnedRoleIds.map((roleId) => {
                if (roleId === "cowork") {
                  return (
                    <article className="pinned-card" key={roleId}>
                      <strong>CoWork</strong>
                      <p>所有角色的共同討論區、交接區與同步區。</p>
                    </article>
                  );
                }

                const role = roleLibrary.find((entry) => entry.id === roleId);
                return role ? (
                  <article className="pinned-card" key={role.id}>
                    <strong>{role.name}</strong>
                    <p>{role.summary}</p>
                  </article>
                ) : null;
              })}
            </div>
          </section>
          <section className="sidebar-section">
            <div className="sidebar-heading-row">
              <strong>快速調整</strong>
              <span>選擇哪些角色要常駐</span>
            </div>
            <div className="toggle-list">
              {roleLibrary.map((role) => (
                <label className="toggle-row" key={role.id}>
                  <span>{role.name}</span>
                  <input
                    checked={pinnedRoleIds.includes(role.id)}
                    onChange={() => togglePinnedRole(role.id)}
                    type="checkbox"
                  />
                </label>
              ))}
            </div>
          </section>
        </>
      );
    }

    if (sidebarPage === "skills") {
      return (
        <>
          <section className="sidebar-section">
            <div className="sidebar-heading-row">
              <strong>技能庫</strong>
              <span>每個技能都有用途說明</span>
            </div>
            <div className="library-list">
              {SKILLS.map((skill) => (
                <button
                  className={selectedSkill.id === skill.id ? "library-card is-active" : "library-card"}
                  key={skill.id}
                  onClick={() => setSelectedSkillId(skill.id)}
                  type="button"
                >
                  <strong>{skill.name}</strong>
                  <p>{skill.summary}</p>
                </button>
              ))}
            </div>
          </section>
          <section className="sidebar-section detail-section">
            <div className="sidebar-heading-row">
              <strong>{selectedSkill.name}</strong>
              <span>詳細說明</span>
            </div>
            <p>{selectedSkill.detail}</p>
            <div className="tag-row">
              {selectedSkill.tags.map((tag) => (
                <span className="tag-chip" key={tag}>
                  {tag}
                </span>
              ))}
            </div>
          </section>
        </>
      );
    }

    if (sidebarPage === "roles") {
      return (
        <>
          <section className="sidebar-section">
            <div className="sidebar-heading-row">
              <strong>角色庫</strong>
              <span>角色用途與常駐設定</span>
            </div>
            <div className="library-list">
              {roleLibrary.map((role) => (
                <button
                  className={selectedRoleLibrary.id === role.id ? "library-card is-active" : "library-card"}
                  key={role.id}
                  onClick={() => setSelectedRoleLibraryId(role.id)}
                  type="button"
                >
                  <strong>{role.name}</strong>
                  <p>{role.summary}</p>
                </button>
              ))}
            </div>
          </section>
          <section className="sidebar-section detail-section">
            <div className="sidebar-heading-row">
              <strong>{selectedRoleLibrary.name}</strong>
              <span>{providerConfig(selectedRoleLibrary.provider).label}</span>
            </div>
            <p>{selectedRoleLibrary.detail}</p>
            <button
              className={selectedRoleLibrary.pinned ? "secondary-action is-active" : "secondary-action"}
              onClick={() => togglePinnedRole(selectedRoleLibrary.id)}
              type="button"
            >
              {selectedRoleLibrary.pinned ? "已加入常駐區" : "加入常駐區"}
            </button>
          </section>
        </>
      );
    }

    if (sidebarPage === "console") {
      return (
        <>
          <section className="sidebar-section">
            <div className="sidebar-heading-row">
              <strong>主控台</strong>
              <span>整合啟動與工作台提示</span>
            </div>
            <div className="console-panel">
              {consoleLines.map((line) => (
                <div className="console-line" key={line}>
                  {line}
                </div>
              ))}
            </div>
          </section>
          <section className="sidebar-section detail-section">
            <div className="sidebar-heading-row">
              <strong>下一步</strong>
              <span>待實作</span>
            </div>
            <p>後續會把真正的終端輸出、服務狀態與錯誤訊息收進這個頁面，不再另外彈出黑窗。</p>
          </section>
        </>
      );
    }

    return (
      <>
        <section className="sidebar-section brand-section">
          <div className="sidebar-label">CORTEX WORKBENCH</div>
          <div className="project-title">{activeProject?.name ?? "CORTEX"}</div>
        </section>
        <section className="sidebar-section">
          <div className="sidebar-heading-row">
            <strong>已載入角色</strong>
            <button className="tiny-button" onClick={() => void loadWorkspace()} type="button">
              重新整理
            </button>
          </div>
          <div className="role-cards">
            {bindableSessions.map((session) => {
              const status = viewStatuses[session.id];
              const provider = providerConfig(resolvedProvider(session));
              const selected = primarySessionId === session.id || secondarySessionId === session.id;
              return (
                <button
                  className={selected ? "role-card is-selected" : "role-card"}
                  key={session.id}
                  onClick={() => setPrimarySessionId(session.id)}
                  type="button"
                >
                  <div className="role-card-top">
                    <div className={`role-avatar ${provider.colorClass}`}>
                      {sessionDisplayTitle(session).slice(0, 1)}
                    </div>
                    <strong>{sessionDisplayTitle(session)}</strong>
                    <span className={`mini-status ${status ? STATUS_COLORS[status.state] : "is-loading"}`}>
                      {roleStatus(status)}
                    </span>
                  </div>
                  <div className="role-card-sub">
                    <span>{provider.label}</span>
                    <span>{pinnedRoleIds.includes(sessionRoleKey(session)) ? "常駐" : "一般"}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      </>
    );
  }

  function renderPane(
    session: ChatSession | null,
    paneId: PaneId,
    viewportRef: typeof primaryViewportRef
  ) {
    if (!session) {
      return (
        <section className="workspace-pane">
          <div className="pane-toolbar">
            <div className="pane-toolbar-title">
              <strong>尚未選擇角色工作視窗</strong>
              <span>請先從角色列表或分頁選擇要顯示的工作區。</span>
            </div>
          </div>
          <div className="pane-surface">
            <div className="pane-viewport" ref={viewportRef}>
              <div className="viewport-placeholder">等待載入角色工作視窗</div>
            </div>
          </div>
        </section>
      );
    }

    const provider = providerConfig(resolvedProvider(session));
    const status = viewStatuses[session.id];
    return (
      <section className="workspace-pane">
        <div className="pane-toolbar">
          <div className="pane-toolbar-title">
            <strong>{sessionDisplayTitle(session)} / 真實聊天工作視窗</strong>
            <div className="pane-toolbar-sub">
              <span className={`pane-status-badge ${status ? STATUS_COLORS[status.state] : "is-loading"}`}>
                {roleStatus(status)}
              </span>
              <span>{provider.label}</span>
            </div>
          </div>
          <div className="pane-toolbar-actions">
            <select
              className="inline-select"
              value={session.id}
              onChange={(event) => setPaneSession(paneId, event.target.value)}
            >
              {bindableSessions.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {sessionDisplayTitle(entry)}
                </option>
              ))}
            </select>
            <select
              className="inline-select"
              value={resolvedProvider(session)}
              onChange={(event) => setSessionProvider(session.id, event.target.value as ProviderKey)}
            >
              {PROVIDERS.map((entry) => (
                <option key={entry.key} value={entry.key}>
                  {entry.label}
                </option>
              ))}
            </select>
            <button className="tiny-button" onClick={() => desktopBridge?.refreshView(session.id)} type="button">
              重載
            </button>
          </div>
        </div>
        <div className="pane-surface">
          <div className="pane-viewport" ref={viewportRef} />
        </div>
      </section>
    );
  }

  if (stage !== "workspace") {
    return (
      <main className="desktop-shell onboarding-mode">
        {message ? <p className="status-banner">{message}</p> : null}
        {error ? <p className="error-banner">{error}</p> : null}
        {renderOnboarding()}
      </main>
    );
  }

  return (
    <main className="desktop-shell">
      <header className="window-frame">
        <div className="window-title">
          <div className="app-cube">C</div>
          <span>CORTEX Workspace</span>
        </div>
        <div className="window-summary">
          <span>桌面工作台</span>
          <span>{activeProject?.name ?? "未選擇專案"}</span>
        </div>
      </header>

      {message ? <p className="status-banner">{message}</p> : null}
      {error ? <p className="error-banner">{error}</p> : null}

      <section className="workbench-shell">
        <aside className="activity-bar">
          <div className="activity-logo">CX</div>
          <div className="activity-stack">
            {SIDEBAR_ITEMS.map((item) => (
              <button
                aria-label={item.label}
                className={sidebarPage === item.id ? "activity-button is-active" : "activity-button"}
                key={item.id}
                onClick={() => setSidebarPage(item.id)}
                type="button"
              >
                <span>{item.icon}</span>
              </button>
            ))}
          </div>
        </aside>

        <aside className="sidebar-column">{renderSidebarContent()}</aside>

        <section className="editor-column">
          <div className="tab-bar">
            {bindableSessions.map((session) => {
              const status = viewStatuses[session.id];
              return (
                <button
                  className={session.id === primarySessionId ? "tab-button is-active" : "tab-button"}
                  key={session.id}
                  onClick={() => setPrimarySessionId(session.id)}
                  type="button"
                >
                  <span className={`tab-dot ${status ? STATUS_COLORS[status.state] : ""}`} />
                  <span>{sessionDisplayTitle(session)}.chat</span>
                </button>
              );
            })}
          </div>

          <div className="pane-split">
            {renderPane(primarySession, "primary", primaryViewportRef)}
            {renderPane(secondarySession, "secondary", secondaryViewportRef)}
          </div>

          <section className="bottom-panel">
            <div className="bottom-tabs">
              <button
                className={bottomTab === "cowork" ? "bottom-tab is-active" : "bottom-tab"}
                onClick={() => setBottomTab("cowork")}
                type="button"
              >
                CoWork
              </button>
              <button
                className={bottomTab === "logs" ? "bottom-tab is-active" : "bottom-tab"}
                onClick={() => setBottomTab("logs")}
                type="button"
              >
                紀錄
              </button>
              <button
                className={bottomTab === "handover" ? "bottom-tab is-active" : "bottom-tab"}
                onClick={() => setBottomTab("handover")}
                type="button"
              >
                交接
              </button>
            </div>

            {bottomTab === "cowork" ? (
              <div className="bottom-content cowork-layout">
                <div className="cowork-stream">
                  <div className="cowork-header">
                    <strong># CoWork 全角色討論區</strong>
                    <span>所有參與專案的角色都在這裡</span>
                  </div>
                  <div className="cowork-messages">
                    {coworkMessages.map((line, index) => (
                      <article className="cowork-line" key={line.id}>
                        <div className={`cowork-avatar avatar-${(index % 4) + 1}`}>{line.author.slice(0, 1)}</div>
                        <div className="cowork-body">
                          <div className="cowork-meta">
                            <strong>{line.author}</strong>
                            <span>{line.time}</span>
                          </div>
                          <p>{line.body}</p>
                        </div>
                      </article>
                    ))}
                  </div>
                  <div className="cowork-input">
                    <span>這裡會是所有角色共用的協作輸入區，後續再接上真正訊息流。</span>
                    <button type="button">送出</button>
                  </div>
                </div>

                <div className="participants-panel">
                  <div className="cowork-header">
                    <strong>參與角色 ({bindableSessions.length})</strong>
                    <span>同步狀態</span>
                  </div>
                  <div className="participant-list">
                    {bindableSessions.map((session) => {
                      const provider = providerConfig(resolvedProvider(session));
                      return (
                        <div className="participant-row" key={session.id}>
                          <div className={`participant-avatar ${provider.colorClass}`}>
                            {sessionDisplayTitle(session).slice(0, 1)}
                          </div>
                          <div className="participant-copy">
                            <strong>{sessionDisplayTitle(session)}</strong>
                            <span>{roleStatus(viewStatuses[session.id])}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : null}

            {bottomTab === "logs" ? (
              <div className="bottom-content simple-grid">
                {bindableSessions.map((session) => {
                  const status = viewStatuses[session.id];
                  return (
                    <article className="info-card" key={session.id}>
                      <strong>{sessionDisplayTitle(session)}</strong>
                      <span>{resolvedWorkspaceUrl(session)}</span>
                      <p>{status?.pageTitle || "等待工作視窗完成頁面載入。"}</p>
                    </article>
                  );
                })}
              </div>
            ) : null}

            {bottomTab === "handover" ? (
              <div className="bottom-content simple-grid">
                <article className="info-card">
                  <strong>下一步</strong>
                  <p>把 AI 帳號登入確認、預設載入策略與角色工作區真正串接起來。</p>
                </article>
                <article className="info-card">
                  <strong>目前風險</strong>
                  <p>這一段先把登入入口 UI 拉正，後續仍要補上真正的登入狀態檢查。</p>
                </article>
                <article className="info-card">
                  <strong>交接提醒</strong>
                  <p>若切換角色或 AI，應保留決策、記憶與下一步摘要，避免上下文中斷。</p>
                </article>
              </div>
            ) : null}
          </section>
        </section>

        <aside className="governance-column">
          <div className="governance-title">治理側欄</div>
          <section className="governance-block">
            <div className="governance-head">
              <strong>決策板</strong>
              <button type="button">查看全部</button>
            </div>
            <div className="governance-cards">
              {decisions.map((decision) => (
                <article className="governance-card" key={decision.id}>
                  <div className="governance-card-top">
                    <span className={`decision-badge ${decisionTone(decision.status)}`}>{decision.status}</span>
                    <span>{formatClock(decision.created_at)}</span>
                  </div>
                  <strong>{decision.title}</strong>
                  <p>{decision.summary}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="governance-block">
            <div className="governance-head">
              <strong>記憶快照</strong>
              <button type="button">查看全部</button>
            </div>
            <div className="governance-cards">
              {memories.map((memory) => (
                <article className="governance-card compact" key={memory.id}>
                  <div className="governance-card-top">
                    <span>{memory.memory_type}</span>
                    <span>{memory.status}</span>
                  </div>
                  <p>{memory.content}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="governance-block">
            <div className="governance-head">
              <strong>工作憲章</strong>
              <button type="button">查看全部</button>
            </div>
            <div className="governance-cards">
              {rules.map((rule) => (
                <article className="governance-card compact" key={rule.id}>
                  <div className="constitution-row">
                    <span className="constitution-check">✓</span>
                    <div>
                      <strong>{rule.name}</strong>
                      <p>{rule.description}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </aside>
      </section>

      <footer className="statusbar">
        <div className="statusbar-left">
          <span>main</span>
          <span>已載入 {bindableSessions.length} 個角色工作視窗</span>
          <span>已就緒 {activeViewCount} 個</span>
          <span>常駐 {pinnedRoleIds.length} 項</span>
        </div>
        <div className="statusbar-right">
          <span>預設 AI：{providerConfig(defaultProvider).label}</span>
          <span>CoWork 常駐</span>
          <span>{activeProject?.name ?? "CORTEX"}</span>
        </div>
      </footer>
    </main>
  );
}
